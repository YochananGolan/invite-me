import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal';

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
    className="absolute inset-y-0 -left-10 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none"
  >
    <EyeIcon isOpen={isVisible} />
  </button>
);

export default function AuthModal({ initialMode = 'sign_in', open = false, onClose = () => {} }) {
  const router = useRouter();
  const [view, setView] = useState(initialMode);
  const [formKey, setFormKey] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');
  const [emailVerificationNotice, setEmailVerificationNotice] = useState({
    show: false,
    email: '',
  });
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [signInEmail, setSignInEmail] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState({ code: '', message: '' });
  const [existingEmailNotice, setExistingEmailNotice] = useState({
    show: false,
    email: '',
  });

  // Handle custom registration with additional fields
  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const emailInput = e.target.email.value;
      const emailNormalized = emailInput.trim().toLowerCase();

      try {
        const checkResponse = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailNormalized }),
        });

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          if (checkData?.exists) {
            setExistingEmailNotice({
              show: true,
              email: emailInput,
            });
            setLoading(false);
            return;
          }

          if (checkData?.skipped && checkData?.exists === false) {
            console.warn('signUp: email check skipped due to missing configuration');
          }
        } else {
          console.warn('signUp: email pre-check failed with status', checkResponse.status);
        }
      } catch (checkError) {
        console.warn('signUp: email pre-check threw error', checkError);
      }

      // Use current origin so redirect matches where user is (localhost for dev, meet-m.co.il for prod)
      const siteUrl = typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
      const redirectUrl = `${siteUrl.replace(/\/$/, '')}/verify-email`;
      const trimmedFullName = fullName.trim();
      const nameParts = trimmedFullName.split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      let authResult = await supabase.auth.signInWithOtp({
        email: emailNormalized,
        options: {
          data: {
            full_name: trimmedFullName,
            first_name: firstName,
            last_name: lastName,
            phone: phone
          },
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true
        }
      });

      if (authResult.error) {
        // Fallback to signUp with generated secure token if signInWithOtp is restricted
        const generatedPassword = typeof crypto !== 'undefined' && crypto.randomUUID ? `P@ss_${crypto.randomUUID()}` : `P@ss_${Math.random().toString(36).slice(2)}${Date.now()}`;
        authResult = await supabase.auth.signUp({
          email: emailNormalized,
          password: generatedPassword,
          options: {
            data: {
              full_name: trimmedFullName,
              first_name: firstName,
              last_name: lastName,
              phone: phone
            },
            emailRedirectTo: redirectUrl
          }
        });
      }

      if (authResult.error) throw authResult.error;

      setEmailVerificationNotice({
        show: true,
        email: emailInput,
      });
      setSuccessMsg('');
      setFullName('');
      setPhone('');
      e.target.reset();
    } catch (error) {
      const msg = error?.message || '';
      const isExistingEmail =
        error?.status === 422 ||
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('duplicate key');

      if (isExistingEmail) {
        setExistingEmailNotice({
          show: true,
          email: emailInput,
        });
        setErrorMsg('');
        return;
      }
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

    const email = signInEmail.trim().toLowerCase();

    if (!email) {
      setSignInError({
        code: 'missing_credentials',
        message: 'הזן אימייל כדי לקבל קישור כניסה',
      });
      return;
    }

    setSignInLoading(true);
    setSignInError({ code: '', message: '' });

    try {
      const checkResponse = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (checkResponse.ok) {
        const emailData = await checkResponse.json();
        if (emailData && emailData.exists === false) {
          setSignInError({
            code: 'user_not_found',
            message: 'האימייל לא רשום במערכת. ניתן להירשם כעת.',
          });
          setSignInLoading(false);
          return;
        }
      }

      const siteUrl = typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
      const redirectUrl = `${siteUrl.replace(/\/$/, '')}/verify-email`;

      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: false
        }
      });

      if (error) {
        const errMsg = (error.message || '').toLowerCase();
        if (errMsg.includes('signups not allowed') || errMsg.includes('user not found')) {
          setSignInError({
            code: 'user_not_found',
            message: 'האימייל לא רשום במערכת. ניתן להירשם כעת.',
          });
        } else if (errMsg.includes('rate limit') || errMsg.includes('rate_limit')) {
          setSignInError({
            code: 'rate_limit',
            message: 'נשלחו יותר מדי בקשות לאחרונה. אנא נסה שוב בעוד כשעה.',
          });
        } else {
          setSignInError({
            code: 'unknown',
            message: error.message || 'שגיאה בהתחברות',
          });
        }
        setSignInLoading(false);
        return;
      }

      setEmailVerificationNotice({
        show: true,
        email: email,
      });
      setSignInEmail('');
      setSignInLoading(false);
    } catch (err) {
      console.error('signIn error:', err);
      setSignInError({
        code: 'unknown',
        message: err?.message || 'שגיאה בהתחברות',
      });
      setSignInLoading(false);
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

  // Reset all form data when modal opens - clean screen every time
  useEffect(() => {
    if (open) {
      setView(initialMode);
      setFormKey((k) => k + 1);
      setSuccessMsg('');
      setEmailVerificationNotice({ show: false, email: '' });
      setFullName('');
      setPhone('');
      setErrorMsg('');
      setLoading(false);
      setSignInEmail('');
      setSignInError({ code: '', message: '' });
      setSignInLoading(false);
      setExistingEmailNotice({ show: false, email: '' });
    }
  }, [open, initialMode]);

  // Parent component will hide/show modal based on session state.

  if (open && existingEmailNotice.show) {
    return (
      <Modal size="sm" open={open} onClose={onClose}>
        <ModalBody>
          <div className="text-center space-y-6 py-4" dir="rtl">
            <div className="text-3xl font-extrabold text-indigo-300">
              האימייל כבר רשום
            </div>
            <div className="text-base font-semibold leading-relaxed text-slate-300">
              הכתובת {existingEmailNotice.email.trim()} כבר קיימת במערכת. ניתן להמשיך לכניסה או לחזור לדף הבית.
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="flex-col">
          <button
            type="button"
            onClick={() => {
              setExistingEmailNotice({ show: false, email: '' });
              onClose();
              router.push('/').catch(() => {});
            }}
            className="w-full border border-white/15 bg-transparent text-white hover:border-indigo-300 hover:text-indigo-200 font-semibold py-2 rounded-xl transition-colors"
          >
            חזרה לדף הבית
          </button>
          <button
            type="button"
            onClick={() => {
              setExistingEmailNotice({ show: false, email: '' });
              setView('sign_in');
              setSignInEmail(existingEmailNotice.email.trim());
              setSignInError({ code: '', message: '' });
            }}
            className="w-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold rounded-xl py-2 hover:opacity-90 transition-opacity"
          >
            כניסה למערכת
          </button>
        </ModalFooter>
      </Modal>
    );
  }

  if (open && successMsg) {
    return (
      <Modal size="sm" open={open} onClose={onClose}>
        <ModalBody>
          <div className="text-center space-y-6 py-4" dir="rtl">
            <div className="text-3xl font-extrabold text-emerald-300">ההרשמה בוצעה בהצלחה!</div>
            <div className="text-base font-semibold leading-relaxed text-slate-300">
              {successMsg}
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="flex-col">
          <button
            type="button"
            onClick={() => {
              setSuccessMsg('');
              onClose();
              if (typeof window !== 'undefined') {
                localStorage.setItem('pendingCreateEvent', 'true');
              }
            }}
            className="w-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold rounded-xl py-2 hover:opacity-90 transition-opacity"
          >
            התחלת יצירת אירוע
          </button>
          <button
            type="button"
            onClick={() => {
              setSuccessMsg('');
              onClose();
            }}
            className="w-full border border-white/15 bg-transparent text-white hover:border-indigo-300 hover:text-indigo-200 font-semibold rounded-xl py-2 transition-colors"
          >
            חזרה למסך הראשי
          </button>
        </ModalFooter>
      </Modal>
    );
  }

  if (open && emailVerificationNotice.show) {
    return (
      <Modal size="sm" open={open} onClose={onClose}>
        <ModalBody>
          <div className="text-center space-y-6 py-4" dir="rtl">
            <div className="text-3xl font-extrabold text-emerald-300">
              עוד צעד קטן!
            </div>
            <div className="text-base font-semibold leading-relaxed text-slate-300">
              שלחנו קישור אימות לכתובת <strong className="text-slate-100">{emailVerificationNotice.email}</strong>.
              אשר את הקישור במייל כדי להשלים את ההרשמה ואז חזור לכאן.
              אם לא קיבלת מייל אימות מ-Supabase, בדוק בכל המיילים (All Mail).
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="flex-col">
          <button
            type="button"
            onClick={() => {
              setEmailVerificationNotice({ show: false, email: '' });
              onClose();
            }}
            className="w-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold rounded-xl py-2 hover:opacity-90 transition-opacity"
          >
            הבנתי – אאשר את המייל
          </button>
          <button
            type="button"
            onClick={() => {
              setEmailVerificationNotice({ show: false, email: '' });
              setView('sign_in');
            }}
            className="w-full border border-white/15 bg-transparent text-white hover:border-indigo-300 hover:text-indigo-200 font-semibold rounded-xl py-2 transition-colors"
          >
            חזרה למסך הכניסה
          </button>
        </ModalFooter>
      </Modal>
    );
  }

  if (open && signInError.code) {
    const isUserNotFound = signInError.code === 'user_not_found';
    const overlayTitle = isUserNotFound ? 'האימייל לא קיים' : 'שגיאה בהתחברות';

    return (
      <Modal size="sm" open={open} onClose={onClose}>
        <ModalHeader>{overlayTitle}</ModalHeader>
        <ModalBody>
          <div
            className={`text-center py-4 text-base font-semibold leading-relaxed ${
              isUserNotFound ? 'text-amber-300/80' : 'text-red-400/80'
            }`}
          >
            {signInError.message}
          </div>
        </ModalBody>
        <ModalFooter className="flex-col">
          {isUserNotFound ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setSignInEmail('');
                  setSignInError({ code: '', message: '' });
                }}
                className="w-full border border-amber-400/30 bg-transparent text-amber-300 hover:bg-amber-400/10 font-semibold rounded-xl py-2 transition-colors"
              >
                נסה מייל אחר
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('sign_up');
                  setSignInError({ code: '', message: '' });
                }}
                className="w-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold rounded-xl py-2 hover:opacity-90 transition-opacity"
              >
                בצע הרשמה
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSignInError({ code: '', message: '' })}
              className="w-full bg-gradient-to-br from-red-600 to-rose-600 text-white font-bold rounded-xl py-2 hover:opacity-90 transition-opacity"
            >
              חזרה למסך הכניסה
            </button>
          )}
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal size="md" open={open} onClose={onClose}>
      <ModalHeader onClose={onClose}>
        {view === 'sign_up' ? 'הרשמה' : 'כניסה'}
      </ModalHeader>

      <ModalBody>
        <div dir="rtl">
          {view === 'sign_up' && (
            <div className="text-center mb-6">
              <div className="mt-1 text-base text-slate-400">פתחו חשבון חדש והתחילו להזמין בקלות</div>
            </div>
          )}
          {successMsg && (
            <p className="text-emerald-300 text-center mb-4 font-medium">{successMsg}</p>
          )}

          <div className="border border-white/15 rounded-2xl p-6 bg-white/[0.03] shadow-sm">
            {view === 'sign_up' ? (
              <form key={formKey} onSubmit={handleSignUp} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-base font-medium text-slate-300 mb-2">
                    שם מלא *
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full h-12 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 text-base px-3 font-medium outline-none"
                    placeholder="הכנס שם מלא"
                  />
                </div>

                <div>
                  <label className="block text-base font-medium text-slate-300 mb-2">
                    אימייל *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="off"
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readOnly')}
                    className="w-full h-12 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 text-base px-3 font-medium outline-none"
                    placeholder="הכנס כתובת אימייל"
                  />
                </div>

                <div>
                  <label className="block text-base font-medium text-slate-300 mb-2">
                    מספר נייד
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-12 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 text-base px-3 font-medium outline-none"
                    placeholder="הכנס מספר נייד"
                  />
                </div>

                {errorMsg && (
                  <div className="bg-red-500/10 border border-red-400/30 text-red-400 rounded-xl px-4 py-2 text-base font-medium">{errorMsg}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold disabled:opacity-50 text-base transition-opacity hover:opacity-90"
                >
                  {loading ? 'מעבד...' : 'לחץ להודעת אימות לאימייל'}
                </button>
              </form>
            ) : (
              <>
                <div className="rounded-2xl border border-white/15 p-5 bg-white/[0.03]">
                  <form onSubmit={handleSignIn} className="space-y-4" autoComplete="off">
                    <div>
                      <label className="block text-base font-medium text-slate-300 mb-2">
                        אימייל *
                      </label>
                      <input
                        type="email"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        className="w-full h-12 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 text-base px-3 font-medium outline-none"
                        placeholder="הכנס כתובת אימייל"
                        autoComplete="email"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={signInLoading}
                      className="w-full h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold disabled:opacity-50 text-base transition-opacity hover:opacity-90"
                    >
                      {signInLoading ? 'מעבד...' : 'לחץ לקבלת קישור כניסה לאימייל'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
