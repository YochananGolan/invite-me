import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal';

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

  // Handle registration for new users
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
      const redirectUrl = `${siteUrl.replace(/\/$/, '')}/verify-email?type=signup`;
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
            phone: phone,
          },
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      });

      if (authResult.error) {
        // Fallback to signUp with generated secure token if signInWithOtp is restricted
        const generatedPassword =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? `P@ss_${crypto.randomUUID()}`
            : `P@ss_${Math.random().toString(36).slice(2)}${Date.now()}`;
        authResult = await supabase.auth.signUp({
          email: emailNormalized,
          password: generatedPassword,
          options: {
            data: {
              full_name: trimmedFullName,
              first_name: firstName,
              last_name: lastName,
              phone: phone,
            },
            emailRedirectTo: redirectUrl,
          },
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
        setErrorMsg('שגיאה בההרשמה: ' + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle direct login for registered users without sending confirmation emails
  const handleSignIn = async (e) => {
    e.preventDefault();

    const email = signInEmail.trim().toLowerCase();

    if (!email) {
      setSignInError({
        code: 'missing_credentials',
        message: 'הזן אימייל כדי להיכנס',
      });
      return;
    }

    setSignInLoading(true);
    setSignInError({ code: '', message: '' });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('שגיאה בחיבור לשרת');
      }

      const data = await response.json();

      if (!data.success || !data.exists) {
        if (data.code === 'user_not_found' || data.exists === false) {
          setSignInError({
            code: 'user_not_found',
            message: 'האימייל לא רשום במערכת. ניתן להירשם כעת.',
          });
        } else {
          setSignInError({
            code: 'unknown',
            message: data.message || data.error || 'שגיאה בהתחברות',
          });
        }
        setSignInLoading(false);
        return;
      }

      // Registered user: establish authenticated session directly
      if (data.tokenHash) {
        try {
          await supabase.auth.verifyOtp({
            token_hash: data.tokenHash,
            type: 'magiclink',
          });
        } catch (otpErr) {
          console.warn('verifyOtp notice:', otpErr);
        }
      }

      const userId = data.user?.id || email;
      const userEmail = data.user?.email || email;

      localStorage.setItem('user_id', userId);
      localStorage.setItem('user_email', userEmail);
      localStorage.removeItem('showRegistrationSuccess');
      localStorage.removeItem('pendingCreateEvent');

      // Dispatch events so session state updates immediately
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(
        new CustomEvent('authSessionUpdated', {
          detail: { id: userId, email: userEmail },
        })
      );

      setSignInLoading(false);
      onClose();
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
              setView('sign_in');
              setSignInEmail(existingEmailNotice.email.trim());
              setSignInError({ code: '', message: '' });
            }}
            className="w-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold rounded-xl py-2 hover:opacity-90 transition-opacity"
          >
            כניסה למערכת
          </button>
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
                      {signInLoading ? 'מתחבר...' : 'כניסה למערכת'}
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
