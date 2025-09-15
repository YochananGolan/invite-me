import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

export default function AuthModal() {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState('sign_in');
  const [successMsg, setSuccessMsg] = useState('');

  // Close modal automatically after successful sign-in / sign-up
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        if (view === 'sign_up') {
          // registration completed
          setSuccessMsg('נרשמת בהצלחה!');
          setView('sign_in');
        } else {
          setOpen(false);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Parent component will hide/show modal based on session state.

  return (
    open && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-xl relative">

          {/* Toggle Sign In / Sign Up */}
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setView('sign_in')}
              className={`px-4 py-2 w-1/2 border-b-2 ${view === 'sign_in' ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-500'}`}
            >
              כניסה
            </button>
            <button
              onClick={() => setView('sign_up')}
              className={`px-4 py-2 w-1/2 border-b-2 ${view === 'sign_up' ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-500'}`}
            >
              הרשמה
            </button>
          </div>
          {successMsg && (
            <p className="text-green-600 text-center mb-4 font-medium">{successMsg}</p>
          )}

          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            view={view}
            onViewChange={(v) => setView(v)}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'אימייל',
                  password_label: 'סיסמה',
                  link_text: 'אין לך חשבון? הירשם',
                },
                sign_up: {
                  email_label: 'אימייל',
                  password_label: 'סיסמה',
                  password_confirm_label: 'אימות סיסמה',
                  button_label: 'לחץ להודעת אימות לאימייל',
                  link_text: 'כבר יש לך חשבון? כניסה',
                },
              },
            }}
            providers={[]}
            magicLink={false}
          />
        </div>
      </div>
    )
  );
}
