import '../styles/globals.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { ToastProvider } from '../components/Toast';

const parseEventDateLocal = (str) => {
  if (!str) return null;
  const dateOnly = String(str).split(/[T ]/)[0];
  const isoMatch = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const match = dateOnly.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const native = new Date(dateOnly);
  if (!Number.isNaN(native.getTime())) return native;
  return null;
};

const getEventDateFromDetails = (details) => {
  if (!details || typeof details !== 'object') return null;
  const raw = details.date || details.start_datetime || details.event_date || details.end_datetime || null;
  return parseEventDateLocal(raw);
};

function MyApp({ Component, pageProps }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // --- Handle session state ---
  useEffect(() => {
    // Capture auth hash early (Supabase may clear it) - for registration success popup
    if (typeof window !== 'undefined' && window.location.hash?.includes('access_token')) {
      try { sessionStorage.setItem('fromEmailConfirmation', 'true'); } catch (e) {}
    }
    // First check localStorage for session
    const checkSession = () => {
      const userId = localStorage.getItem('user_id');
      const userEmail = localStorage.getItem('user_email');

      if (userId && userEmail) {
        // Only update session if it's different to prevent unnecessary re-renders
        setSession((prevSession) => {
          if (prevSession?.user?.id === userId && prevSession?.user?.email === userEmail) {
            return prevSession; // No change, keep same reference
          }
          return {
            user: {
              id: userId,
              email: userEmail
            }
          };
        });
      } else {
        setSession((prevSession) => {
          if (prevSession === null) return null; // Already null, don't update
          return null;
        });
      }
      setLoading(false);
    };

    // Clear event-related localStorage when user changes (localStorage is per-domain, not per-user)
    const clearEventStorageIfUserChanged = (newUserId) => {
      try {
        const prevUserId = localStorage.getItem('user_id');
        if (prevUserId && prevUserId !== newUserId) {
          localStorage.removeItem('newEventStarted');
          localStorage.removeItem('selectedPlan');
          localStorage.removeItem('draftEvent');
          localStorage.removeItem('savedEventDetails');
        }
      } catch (e) {}
    };

    // Also check Supabase auth state and sync to localStorage
    const checkAndSyncSupabaseAuth = async () => {
      try {
        const { data: { session: supabaseSession } } = await supabase.auth.getSession();
        if (supabaseSession?.user) {
          clearEventStorageIfUserChanged(supabaseSession.user.id);
          localStorage.setItem('user_id', supabaseSession.user.id);
          localStorage.setItem('user_email', supabaseSession.user.email);
          checkSession();
        } else {
          // No Supabase session, check localStorage
          checkSession();
        }
      } catch (error) {
        console.error('Error checking Supabase auth:', error);
        checkSession();
      }
    };

    checkAndSyncSupabaseAuth();

    // Listen for Supabase auth changes and sync to localStorage
    const {
      data: { subscription },
    } =     supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && supabaseSession?.user) {
        clearEventStorageIfUserChanged(supabaseSession.user.id);
        localStorage.setItem('user_id', supabaseSession.user.id);
        localStorage.setItem('user_email', supabaseSession.user.email);
        checkSession();
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('newEventStarted');
        localStorage.removeItem('selectedPlan');
        localStorage.removeItem('draftEvent');
        localStorage.removeItem('savedEventDetails');
        checkSession();
      }
      // Don't update on other events to prevent unnecessary refreshes
    });

    // Listen for storage changes (e.g., when user logs in from another tab)
    const handleStorageChange = (e) => {
      // Only react to user_id or user_email changes
      if (e.key === 'user_id' || e.key === 'user_email') {
        checkSession();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Re-sync session on route change (e.g. after verify-email redirect)
    const handleRouteChange = () => checkAndSyncSupabaseAuth();
    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, []);

  // Keep a single primary event marked active. Never auto-archive by date —
  // users must still be able to open reports for the current event.
  useEffect(() => {
    if (!session) return;

    const enforceSingleActive = async () => {
      try {
        // Fetch all non-archived events for the user
        const { data, error } = await supabase
          .from('events')
          .select('id, status, event_details, created_at')
          .eq('user_id', session.user.id)
          .or('status.neq.archived,status.is.null')
          .order('created_at', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) return;

        // Choose the primary active event: the most recently created event that is today or future.
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const parseDate = (ev) => {
          const details = typeof ev.event_details === 'string' ? JSON.parse(ev.event_details) : ev.event_details || {};
          return getEventDateFromDetails(details);
        };

        let primary = data.find((ev) => {
          const dt = parseDate(ev);
          if (!dt) return false;
          dt.setHours(0, 0, 0, 0);
          return dt.getTime() >= today.getTime();
        });

        if (!primary) return;

        const demoteIds = data.filter((ev) => ev.id !== primary.id && ev.status === 'active').map((e) => e.id);
        const promoteNeeded = primary.status !== 'active';

        if (demoteIds.length > 0) {
          const { error: demoteErr } = await supabase
            .from('events')
            .update({ status: 'draft' })
            .in('id', demoteIds);
          if (demoteErr) throw demoteErr;
        }

        if (promoteNeeded) {
          const { error: promoteErr } = await supabase
            .from('events')
            .update({ status: 'active' })
            .eq('id', primary.id);
          if (promoteErr) throw promoteErr;
        }

        if (demoteIds.length > 0 || promoteNeeded) {
          console.debug(`[single-active] Active set to ${primary.id}; demoted ${demoteIds.length}`);
        }
      } catch (e) {
        console.error('[single-active] Failed', e);
      }
    };

    enforceSingleActive();
  }, [session]);

  // --- Route guard ---
  useEffect(() => {
    if (loading) return; // Wait until we know the session state

    // Public paths that don't require authentication
    // Home page, terms page, and guest RSVP pages should be accessible without session
    const publicPaths = ['/', '/terms', '/verify-email'];
    const isGuestPage = router.pathname === '/[eventId]/[guestId]' || router.pathname.startsWith('/[eventId]/[guestId]');
    const isPublicPath = publicPaths.includes(router.pathname);

    if (!session && !isPublicPath && !isGuestPage) {
      router.replace('/');
    }

    // No additional redirect needed when authenticated or on public paths.
  }, [session, loading, router.pathname]); // Use router.pathname instead of router object

  // Guest pages: render immediately so they see "טוען..." instead of blank screen
  const isGuestPage = router.pathname === '/[eventId]/[guestId]' || router.pathname.startsWith('/[eventId]/[guestId]');
  if (loading && !isGuestPage) return null;

  return (
    <ToastProvider>
      <div dir="rtl">
        <Component {...pageProps} session={session} />
      </div>
    </ToastProvider>
  );
}

export default MyApp;
