import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

export default function AuthModal({ initialMode = 'sign_in', open = false, onClose = () => {} }) {
  const [view, setView] = useState(initialMode);
  const [successMsg, setSuccessMsg] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle custom registration with additional fields
  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    try {
      const password = e.target.password.value;
      const confirmPassword = e.target.confirmPassword.value;
      
      if (password !== confirmPassword) {
        throw new Error('הסיסמאות אינן תואמות');
      }
      
      const { data, error } = await supabase.auth.signUp({
        email: e.target.email.value,
        password: password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone: phone
          }
        }
      });
      
      if (error) throw error;
      
      setSuccessMsg('נרשמת בהצלחה! בדוק את האימייל שלך לאימות');
      setFirstName('');
      setLastName('');
      setPhone('');
      e.target.reset();
    } catch (error) {
      setErrorMsg('שגיאה בהרשמה: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Close modal automatically after successful sign-in / sign-up
  useEffect(() => {
    if (!open) return; // Only listen when modal is open

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        onClose();
      }
    });
    return () => subscription.unsubscribe();
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setView(initialMode);
    }
  }, [open, initialMode]);

  // Parent component will hide/show modal based on session state.

  return (
    open && (
      <div className="fixed inset-0 flex items-center justify-center z-[100]">
        <div className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="סגור"
            className="absolute top-2 left-2 text-3xl text-gray-500 hover:text-gray-700 focus:outline-none leading-none w-8 h-8 flex items-center justify-center"
          >
            &times;
          </button>

          {/* Heading (single-purpose screen - no mode toggle) */}
          <div className="text-center mb-6">
            <div className="text-4xl font-extrabold text-gray-900 tracking-tight">
              {view === 'sign_up' ? 'הרשמה' : 'כניסה'}
            </div>
            {view === 'sign_up' && (
              <div className="mt-1 text-base text-gray-500">פתחו חשבון חדש והתחילו להזמין בקלות</div>
            )}
          </div>
          {successMsg && (
            <p className="text-green-600 text-center mb-4 font-medium">{successMsg}</p>
          )}

          <div className="border-2 border-purple-200 rounded-2xl p-6 bg-white/95 shadow-lg">
            {view === 'sign_up' ? (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-lg font-bold text-gray-800 mb-2">
                      שם פרטי *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="w-full h-12 rounded-xl border-2 border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg px-3 shadow-sm font-medium"
                      placeholder="הכנס שם פרטי"
                    />
                  </div>
                  <div>
                    <label className="block text-lg font-bold text-gray-800 mb-2">
                      שם משפחה *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="w-full h-12 rounded-xl border-2 border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg px-3 shadow-sm font-medium"
                      placeholder="הכנס שם משפחה"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-lg font-bold text-gray-800 mb-2">
                    אימייל *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full h-12 rounded-xl border-2 border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg px-3 shadow-sm font-medium"
                    placeholder="הכנס כתובת אימייל"
                  />
                </div>
                
                <div>
                  <label className="block text-lg font-bold text-gray-800 mb-2">
                    מספר נייד
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-12 rounded-xl border-2 border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg px-3 shadow-sm font-medium"
                    placeholder="הכנס מספר נייד"
                  />
                </div>
                
                <div>
                  <label className="block text-lg font-bold text-gray-800 mb-2">
                    סיסמה *
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    className="w-full h-12 rounded-xl border-2 border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg px-3 shadow-sm font-medium"
                    placeholder="הכנס סיסמה"
                  />
                </div>
                
                <div>
                  <label className="block text-lg font-bold text-gray-800 mb-2">
                    אימות סיסמה *
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    required
                    className="w-full h-12 rounded-xl border-2 border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg px-3 shadow-sm font-medium"
                    placeholder="הכנס שוב את הסיסמה"
                  />
                </div>
                
                {errorMsg && (
                  <div className="text-red-600 text-base font-medium">{errorMsg}</div>
                )}
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold shadow-sm text-base"
                >
                  {loading ? 'מעבד...' : 'לחץ להודעת אימות לאימייל'}
                </button>
              </form>
            ) : (
              <>
                <div className="rounded-2xl border-2 border-gray-400 p-5 bg-white shadow-sm signin-strong">
                  <Auth
                    supabaseClient={supabase}
                    appearance={{
                  theme: ThemeSupa,
                  variables: {
                    default: {
                      colors: {
                        brand: '#7c3aed', // purple-600
                        brandAccent: '#6d28d9',
                        inputBorder: '#e5e7eb',
                        inputText: '#111827',
                        messageText: '#ef4444'
                      },
                      radii: {
                        inputBorderRadius: '12px',
                        buttonBorderRadius: '12px'
                      }
                    }
                  },
                  className: {
                    container: 'space-y-3',
                    label: 'text-lg font-bold text-gray-800',
                    input: 'h-12 rounded-xl border-2 border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg shadow-sm font-medium',
                    button: 'h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-sm text-base',
                    anchor: 'text-purple-700 hover:text-purple-800 font-medium text-base',
                    message: 'text-base'
                  }
                }}
                  view={view}
                  onViewChange={(v) => setView(v)}
                  localization={{
                  variables: {
                    sign_in: {
                      email_label: 'אימייל',
                      password_label: 'סיסמה',
                      link_text: '',
                    },
                    sign_up: {
                      email_label: 'אימייל',
                      password_label: 'סיסמה',
                      password_confirm_label: 'אימות סיסמה',
                      button_label: 'לחץ להודעת אימות לאימייל',
                      link_text: '',
                    },
                  },
                }}
                  providers={[]}
                  magicLink={false}
                  />
                </div>
                {/* Sign Up Button */}
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setView('sign_up')}
                    className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm text-base transition-colors"
                  >
                    הרשמה
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  );
}
