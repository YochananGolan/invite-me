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
          setStatus('האימייל אומת בהצלחה! מפנה...');
          localStorage.setItem('user_id', session.user.id);
          localStorage.setItem('user_email', session.user.email);
          router.replace('/');
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
      if (event === 'SIGNED_IN' && session) {
        setStatus('האימייל אומת בהצלחה! מפנה...');
        localStorage.setItem('user_id', session.user.id);
        localStorage.setItem('user_email', session.user.email);
        router.replace('/');
      }
    });

    const fallback = setTimeout(() => {
      if (mounted && !error) {
        router.replace('/');
      }
    }, 5000);

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      clearTimeout(fallback);
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6" dir="rtl">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {error ? (
          <>
            <p className="text-red-600 text-lg font-medium mb-4">{error}</p>
            <p className="text-gray-600 text-sm mb-6">
              נסה להתחבר שוב או ליצור קשר לתמיכה.
            </p>
            <a
              href="/"
              className="inline-block bg-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-purple-700"
            >
              חזרה לדף הבית
            </a>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">✉️</div>
            <p className="text-gray-800 text-lg font-medium">{status}</p>
            <div className="mt-6 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
