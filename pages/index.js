import Head from 'next/head';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';
import HeroSection from '../components/HeroSection';
import StepButtons from '../components/StepButtons';
import { useState, useEffect, useRef } from 'react';
import AuthModal from '../components/AuthModal';
import Footer from '../components/Footer';
import PricingTableModal from '../components/PricingTableModal';
import Modal, { ModalHeader, ModalBody, ModalFooter } from '../components/Modal';

export default function Home({ session }) {
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('sign_in');
  const [showFeatures, setShowFeatures] = useState(false);
  const [showPricingTable, setShowPricingTable] = useState(false);
  const [pendingCreateEvent, setPendingCreateEvent] = useState(false);
  const [triggerCreateEvent, setTriggerCreateEvent] = useState(false);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);
  const stepRef = useRef();

  // Capture hash early (Supabase may clear it) - for direct redirect to / from email
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash?.includes('access_token')) {
      sessionStorage.setItem('fromEmailConfirmation', 'true');
    }
  }, []);


  useEffect(() => {
    if (!session) return;
    const fromStorage = typeof window !== 'undefined' && localStorage.getItem('showRegistrationSuccess') === 'true';
    const fromQuery = router.query?.registration === 'success' ||
      (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('registration') === 'success');
    // Supabase may redirect directly to / with hash (bypassing verify-email)
    const fromHash = typeof window !== 'undefined' && window.location.hash &&
      (window.location.hash.includes('access_token') || window.location.hash.includes('type='));
    const fromSessionStorage = typeof window !== 'undefined' && sessionStorage.getItem('fromEmailConfirmation') === 'true';
    if (fromStorage || fromQuery || fromHash || fromSessionStorage) {
      setShowRegistrationSuccess(true);
      // Do NOT clear storage/URL here - only when user clicks. Keeps popup visible until user dismisses.
    }
  }, [session, router.query?.registration, router.isReady]);

  useEffect(() => {
    if (session) {
      const shouldCreateEvent = pendingCreateEvent || (typeof window !== 'undefined' && localStorage.getItem('pendingCreateEvent') === 'true');
      if (shouldCreateEvent) {
        setPendingCreateEvent(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pendingCreateEvent');
        }
        setTimeout(() => {
          setTriggerCreateEvent(true);
          scrollToWizard();
        }, 500);
      }
    }
  }, [session, pendingCreateEvent]);
  // When no session, show Supabase AuthModal; otherwise render site normally.

  const handleAuthClick = (mode) => {
    setAuthMode(mode === 'sign_up' ? 'sign_up' : 'sign_in');
    setShowAuth(true);
  };

  const handleShowFeatures = () => {
    setShowFeatures(true);
  };

  const scrollToWizard = () => {
    if (typeof window === 'undefined') return;
    const el = document.getElementById('pricing');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleShowReports = () => {
    stepRef.current?.goToReportsStep?.();
    scrollToWizard();
  };

  // Description of the creation process – should work גם בלי כניסה
  const handleShowProcess = () => {
    if (stepRef.current?.startFlow) {
      stepRef.current.startFlow();
    } else {
      handleShowFeatures();
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    const open = router.query.open;
    if (!open) return;
    if (open === 'features') setShowFeatures(true);
    else if (open === 'pricing') setShowPricingTable(true);
    else if (open === 'reports') { handleShowReports(); }
    router.replace('/', undefined, { shallow: true });
  }, [router.isReady, router.query.open]);

  const handleCreateEvent = () => {
    if (!session) {
      setAuthMode('sign_in');
      setPendingCreateEvent(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('pendingCreateEvent', 'true');
      }
      setShowAuth(true);
    } else {
      setTriggerCreateEvent(true);
      scrollToWizard(); // גלילה לאזור הוויזארד כדי שהמשתמש יראה את יצירת האירוע
    }
  };

  return (
    <>
      <Head>
        <title>Meet-M | הדרך המושלמת להזמין ולנהל אורחים</title>
        <meta name="description" content="ניהול הזמנות, אישורי הגעה, שליחת הודעות ודוחות אירוע במקום אחד." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="theme-color" content="#0d0f2b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </Head>
      <div className="min-h-screen flex flex-col bg-[#0d0f2b] text-slate-100">
        <main className="flex-1">
          <div className="relative bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)]">
            <NavBar onAuthClick={handleAuthClick} onAboutClick={handleShowFeatures} onShowPricing={() => setShowPricingTable(true)} onShowReports={handleShowReports} />
            <HeroSection
              onStart={handleShowProcess}
              onPressCreateEvent={handleCreateEvent}
              onPressReports={handleShowReports}
              onShowFeatures={handleShowFeatures}
              isLoggedIn={!!session}
            />
          </div>
          <div id="pricing" className="scroll-mt-20 scroll-mb-28 bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)] px-4 pt-0 pb-36 text-slate-100 sm:pb-24">
            <div className="mx-auto max-w-6xl">
              <StepButtons 
                ref={stepRef} 
                session={session} 
                onAuthClick={handleAuthClick}
                triggerCreateEvent={triggerCreateEvent}
                onConsumedCreateTrigger={() => setTriggerCreateEvent(false)}
              />
            </div>
          </div>
        </main>
        <Footer />
      </div>
      <AuthModal 
        initialMode={authMode} 
        open={showAuth} 
        onClose={() => {
          setShowAuth(false);
        }} 
      />

      <PricingTableModal isOpen={showPricingTable} onClose={() => setShowPricingTable(false)} />

      {/* Registration Success Modal - after email verification - stays until user clicks */}
      {showRegistrationSuccess && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6" dir="rtl">
          <div className="bg-[#12143a] border border-white/15 rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.3)] w-full max-w-sm text-center px-6 py-10 space-y-6">
            <div className="text-3xl font-extrabold text-emerald-300">ההרשמה בוצעה בהצלחה!</div>
            <div className="text-base font-semibold text-slate-300 leading-relaxed">
              החשבון החדש הוכן. ניתן להתחיל ליצור אירוע או לחזור למסך הראשי.
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('showRegistrationSuccess');
                    sessionStorage.removeItem('fromEmailConfirmation');
                    if (window.history.replaceState) {
                      window.history.replaceState(null, '', window.location.pathname);
                    }
                  }
                  if (router.query?.registration) router.replace('/', undefined, { shallow: true });
                  setShowRegistrationSuccess(false);
                  handleCreateEvent();
                }}
                className="w-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold rounded-xl py-2 transition-opacity hover:opacity-90"
              >
                צור אירוע חדש
              </button>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('showRegistrationSuccess');
                    sessionStorage.removeItem('fromEmailConfirmation');
                    if (window.history.replaceState) {
                      window.history.replaceState(null, '', window.location.pathname);
                    }
                  }
                  if (router.query?.registration) router.replace('/', undefined, { shallow: true });
                  setShowRegistrationSuccess(false);
                }}
                className="w-full border border-white/15 bg-transparent text-white hover:border-indigo-300 hover:text-indigo-200 font-semibold rounded-xl py-2 transition-colors"
              >
                חזרה למסך הראשי
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Features Modal */}
      <Modal open={showFeatures} onClose={() => setShowFeatures(false)} size="lg">
        <ModalHeader onClose={() => setShowFeatures(false)} subtitle="המערכת היחידה לניהול אירועים מקצה לקצה">
          Meet-M — ניהול אירועים חכם
        </ModalHeader>
        <ModalBody>
          {/* 3 pillars */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { icon: '🎨', title: 'עיצוב מקצועי', desc: '45 תבניות + עריכה מלאה' },
              { icon: '📱', title: 'שליחה חכמה',   desc: 'SMS + WhatsApp מאקסל' },
              { icon: '👥', title: 'ניהול חכם',    desc: 'מעקב + דוחות בזמן אמת' },
            ].map((p) => (
              <div key={p.title} className="bg-white/[0.05] border border-white/10 rounded-2xl p-3 text-center">
                <div className="text-2xl mb-1">{p.icon}</div>
                <h4 className="font-bold text-sm text-slate-100 mb-1">{p.title}</h4>
                <p className="text-xs text-slate-400">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Why us + what you get */}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-indigo-300 mb-2">✅ למה לבחור בנו?</h3>
              <ul className="space-y-1.5 text-sm text-slate-300">
                {[
                  ['פשוט ומהיר', '5 דקות מהרשמה ועד שליחה'],
                  ['חיסכון', 'אין צורך במעצב או הדפסות'],
                  ['מעקב בזמן אמת', 'מי מגיע, מי לא, כמה להזמין'],
                  ['כל מכשיר', 'מחשב, טאבלט, סמארטפון'],
                ].map(([strong, rest]) => (
                  <li key={strong} className="flex items-start gap-2">
                    <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                    <span><strong className="text-slate-100">{strong}</strong> — {rest}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-indigo-300 mb-2">🎯 מה תקבל?</h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-300">
                {[
                  'הזמנות מעוצבות',
                  'שליחה אוטומטית',
                  'SMS + WhatsApp',
                  'תזכורות',
                  'מעקב אישורים',
                  'דוחות בזמן אמת',
                  'ניהול אורחים',
                  'העדפות מזון',
                  'ייצוא Excel',
                  'ארכיון',
                  'מפה + ניווט',
                ].map((f) => (
                  <div key={f} className="flex items-center gap-1">
                    <span className="text-indigo-400">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400">🎉 אלפי לקוחות מרוצים שכבר מנהלים את האירועים שלהם עם Meet-M</p>
        </ModalBody>
        <ModalFooter>
          <button
            onClick={() => setShowFeatures(false)}
            className="px-5 py-2.5 rounded-xl border border-white/15 text-sm text-slate-300 hover:text-white hover:border-white/30 transition-colors"
          >
            סגור
          </button>
          <button
            onClick={() => {
              setShowFeatures(false);
              stepRef.current?.createNewEvent?.();
            }}
            className="bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold rounded-xl px-6 py-2.5 text-sm hover:opacity-90 transition-opacity"
          >
            התחל עכשיו
          </button>
        </ModalFooter>
      </Modal>
    </>
  );
}
