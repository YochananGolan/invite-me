import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const EyeIcon = ({ isOpen }) => (
  <svg
    className="w-5 h-5"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {!isOpen && (
      <path
        d="M4 4l16 16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    )}
  </svg>
);

const VisibilityToggle = ({ isVisible, onToggle, label }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={isVisible ? `הסתר ${label}` : `הצג ${label}`}
    className="absolute inset-y-0 left-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
  >
    <EyeIcon isOpen={isVisible} />
  </button>
);

export default function AuthModal({ initialMode = 'sign_in', open = false, onClose = () => {} }) {
  const [view, setView] = useState(initialMode);
  const [formKey, setFormKey] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [passwordResetSent, setPasswordResetSent] = useState(false);

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
      
      // Use current origin so redirect matches where user is (localhost for dev, meet-m.co.il for prod)
      const siteUrl = typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
      const redirectUrl = `${siteUrl.replace(/\/$/, '')}/verify-email`;
      const { data, error } = await supabase.auth.signUp({
        email: e.target.email.value,
        password: password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone: phone
          },
          emailRedirectTo: redirectUrl
        }
      });
      
      if (error) throw error;
      
      setSuccessMsg('נרשמת בהצלחה! בדוק את האימייל שלך לאימות');
      setFirstName('');
      setLastName('');
      setPhone('');
      e.target.reset();
    } catch (error) {
      const msg = error?.message || '';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('rate_limit')) {
        setErrorMsg('נשלחו יותר מדי מיילי אימות לאחרונה. אנא נסה שוב בעוד כשעה, או צור קשר לתמיכה.');
      } else {
        setErrorMsg('שגיאה בהרשמה: ' + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setSignInLoading(true);
    setSignInError('');
    setPasswordResetSent(false);

    try {
      const email = signInEmail.trim();
      const password = signInPassword;

      if (!email || !password) {
        throw new Error('הזן אימייל וסיסמה כדי להיכנס');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      onClose();
    } catch (error) {
      setSignInError(error?.message || 'שגיאה בהתחברות');
    } finally {
      setSignInLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setSignInError('');
    setPasswordResetSent(false);

    if (!signInEmail.trim()) {
      setSignInError('הזן אימייל כדי לקבל קישור לאיפוס סיסמה');
      return;
    }

    try {
      await supabase.auth.resetPasswordForEmail(signInEmail.trim());
      setPasswordResetSent(true);
    } catch (error) {
      setSignInError(error?.message || 'שגיאה בשליחת קישור לאיפוס סיסמה');
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

  // Reset all form data when modal opens - clean screen every time (including passwords)
  useEffect(() => {
    if (open) {
      setView(initialMode);
      setFormKey((k) => k + 1);
      setSuccessMsg('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setErrorMsg('');
      setLoading(false);
      setShowSignUpPassword(false);
      setShowSignUpConfirmPassword(false);
      setSignInEmail('');
      setSignInPassword('');
      setShowSignInPassword(false);
      setSignInError('');
      setSignInLoading(false);
      setPasswordResetSent(false);
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
            className="absolute top-6 left-4 text-2xl text-gray-500 hover:text-gray-700 focus:outline-none leading-none w-8 h-8 flex items-center justify-center sm:top-2 sm:text-3xl"
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
              <form key={formKey} onSubmit={handleSignUp} className="space-y-4" autoComplete="off">
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
                    autoComplete="off"
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readOnly')}
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
                  <div className="relative">
                    <input
                      type={showSignUpPassword ? 'text' : 'password'}
                      name="password"
                      required
                      autoComplete="new-password"
                      readOnly
                      onFocus={(e) => e.target.removeAttribute('readOnly')}
                      className="w-full h-12 rounded-xl border-2 border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg pr-3 pl-12 shadow-sm font-medium"
                      placeholder="הכנס סיסמה"
                    />
                    <VisibilityToggle
                      isVisible={showSignUpPassword}
                      onToggle={() => setShowSignUpPassword((prev) => !prev)}
                      label="סיסמה"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-lg font-bold text-gray-800 mb-2">
                    אימות סיסמה *
                  </label>
                  <div className="relative">
                    <input
                      type={showSignUpConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      required
                      autoComplete="new-password"
                      readOnly
                      onFocus={(e) => e.target.removeAttribute('readOnly')}
                      className="w-full h-12 rounded-xl border-2 border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg pr-3 pl-12 shadow-sm font-medium"
                      placeholder="הכנס שוב את הסיסמה"
                    />
                    <VisibilityToggle
                      isVisible={showSignUpConfirmPassword}
                      onToggle={() => setShowSignUpConfirmPassword((prev) => !prev)}
                      label="אימות סיסמה"
                    />
                  </div>
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
                <div className="rounded-2xl border-2 border-gray-400 p-5 bg-white shadow-sm">
                  <form onSubmit={handleSignIn} className="space-y-4" autoComplete="off">
                    <div>
                      <label className="block text-lg font-bold text-gray-800 mb-2">
                        אימייל
                      </label>
                      <input
                        type="email"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        className="w-full h-12 rounded-xl border-2 border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg px-3 shadow-sm font-medium"
                        placeholder="הכנס אימייל"
                        autoComplete="email"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-lg font-bold text-gray-800 mb-2">
                        סיסמה
                      </label>
                      <div className="relative">
                        <input
                          type={showSignInPassword ? 'text' : 'password'}
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          className="w-full h-12 rounded-xl border-2 border-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg pr-3 pl-12 shadow-sm font-medium"
                          placeholder="הכנס סיסמה"
                          autoComplete="current-password"
                          required
                        />
                        <VisibilityToggle
                          isVisible={showSignInPassword}
                          onToggle={() => setShowSignInPassword((prev) => !prev)}
                          label="סיסמה"
                        />
                      </div>
                    </div>

                    {signInError && (
                      <div className="text-red-600 text-base font-medium">
                        {signInError}
                      </div>
                    )}
                    {passwordResetSent && (
                      <div className="text-green-600 text-base font-medium">
                        שלחנו אליך אימייל לאיפוס הסיסמה
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm font-medium">
                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        className="text-purple-700 hover:text-purple-800 text-base text-left"
                      >
                        שכחת סיסמה?
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setView('sign_up');
                          setSignInError('');
                          setPasswordResetSent(false);
                        }}
                        className="text-blue-600 hover:text-blue-700 text-base"
                      >
                        להרשמה
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={signInLoading}
                      className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold shadow-sm text-base transition-colors"
                    >
                      {signInLoading ? 'מתחבר...' : 'התחבר'}
                    </button>
                  </form>
                </div>
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
