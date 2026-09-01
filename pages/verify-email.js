import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

/**
 * דף callback לאימות אימייל בהרשמה.
 * Supabase מפנה לכאן לאחר לחיצה על לינק האימות במייל.
 * נתיב יחיד (/verify-email) כדי למנוע התנגשות עם [eventId]/[guestId].
 */
export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState('מאמת את המייל שלך...');
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          if (mounted) {
            setError('שגיאה באימות: ' + sessionError.message);
            setStatus('');
          }
          return;
        }
        if (session && mounted) {
          const isSignup = router.query?.type === 'signup';
          localStorage.setItem('user_id', session.user.id);
          localStorage.setItem('user_email', session.user.email);
          localStorage.removeItem('pendingCreateEvent');

          if (isSignup) {
            setStatus('האימייל אומת בהצלחה! מפנה...');
            localStorage.setItem('showRegistrationSuccess', 'true');
            router.replace('/?registration=success');
          } else {
            setStatus('התחברת בהצלחה! מפנה...');
            localStorage.removeItem('showRegistrationSuccess');
            router.replace('/');
          }
          return;
        }
        if (mounted) {
          setStatus('מאמת...');
        }
      } catch (e) {
        if (mounted) {
          setError('שגיאה: ' + (e.message || 'לא ניתן לאמת'));
          setStatus('');
        }
      }
    };

    handleCallback();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        const isSignup = router.query?.type === 'signup';
        localStorage.setItem('user_id', session.user.id);
        localStorage.setItem('user_email', session.user.email);
        localStorage.removeItem('pendingCreateEvent');

        if (isSignup) {
          setStatus('האימייל אומת בהצלחה! מפנה...');
          localStorage.setItem('showRegistrationSuccess', 'true');
          router.replace('/?registration=success');
        } else {
          setStatus('התחברת בהצלחה! מפנה...');
          localStorage.removeItem('showRegistrationSuccess');
          router.replace('/');
        }
      }
    });

    const fallback = setTimeout(() => {
      if (mounted && !error) {
        const isSignup = router.query?.type === 'signup';
        if (isSignup) {
          router.replace('/?registration=success');
        } else {
          router.replace('/');
        }
      }
    }, 5000);

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      clearTimeout(fallback);
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)] p-6" dir="rtl">
      <div className="rounded-2xl border border-white/15 bg-white/[0.055] backdrop-blur-xl shadow-[0_4px_32px_rgba(0,0,0,0.3)] p-8 max-w-md w-full text-center">
        {error ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/20 border border-red-400/30 mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <p className="text-red-400 text-lg font-semibold mb-3">{error}</p>
            <p className="text-slate-400 text-sm mb-6">נסה להתחבר שוב או ליצור קשר לתמיכה.</p>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_5px_22px_rgba(99,70,230,0.45)] transition-transform hover:-translate-y-0.5"
            >
              חזרה לדף הבית
            </a>
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] mx-auto mb-5">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/>
              </svg>
            </div>
            <p className="text-slate-100 text-lg font-semibold mb-6">{status}</p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
