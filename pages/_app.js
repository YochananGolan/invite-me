import '../styles/globals.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

function MyApp({ Component, pageProps }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // --- Handle session state ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- Route guard ---
  useEffect(() => {
    if (loading) return; // Wait until we know the session state

    // Only the home page is public; all other routes require authentication.
    const publicPaths = ['/'];

    if (!session && router.pathname !== '/') {
      router.replace('/');
    }

    // No additional redirect needed when authenticated.
  }, [session, loading, router]);

  // Optional: could render a loader while checking auth
  if (loading) return null;

  return (
    <div dir="rtl">
      <Component {...pageProps} session={session} />
    </div>
  );
}

export default MyApp;
