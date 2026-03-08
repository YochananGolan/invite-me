import Head from 'next/head';
import NavBar from '../components/NavBar';
import HeroSection from '../components/HeroSection';
import StepButtons from '../components/StepButtons';
import { useState, useEffect, useRef } from 'react';
import AuthModal from '../components/AuthModal';
import Footer from '../components/Footer';
import PricingTableModal from '../components/PricingTableModal';


export default function Home({ session }) {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('sign_in');
  const [showFeatures, setShowFeatures] = useState(false);
  const [showPricingTable, setShowPricingTable] = useState(false);
  const [pendingCreateEvent, setPendingCreateEvent] = useState(false);
  const [triggerCreateEvent, setTriggerCreateEvent] = useState(false);
  const stepRef = useRef();

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
        <meta name="description" content="Send stylish invitations and manage guests effortlessly" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="theme-color" content="#D1B45B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </Head>
      <div className="min-h-screen flex flex-col">
        <main className="flex-1">
          <NavBar onAuthClick={handleAuthClick} onAboutClick={handleShowFeatures} onShowPricing={() => setShowPricingTable(true)} onShowReports={handleShowReports} />
          <HeroSection
            onStart={handleShowProcess}
            onPressCreateEvent={handleCreateEvent}
            onPressReports={handleShowReports}
            onShowFeatures={handleShowFeatures}
            isLoggedIn={!!session}
          />
          <div id="pricing" className="mb-8 scroll-mt-20 scroll-mb-28 pb-36 sm:pb-24">
            <StepButtons 
              ref={stepRef} 
              session={session} 
              onAuthClick={handleAuthClick}
              triggerCreateEvent={triggerCreateEvent}
              onConsumedCreateTrigger={() => setTriggerCreateEvent(false)}
            />
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
      
      {/* Features Modal */}
      {showFeatures && (
        <div className="fixed inset-0 bg-black/50 z-50">
          <div className="bg-white w-full h-full overflow-y-auto shadow-xl relative p-6 md:p-8">
            {/* Close Button */}
            <button
              onClick={() => setShowFeatures(false)}
              aria-label="סגור"
              className="absolute top-4 left-4 text-3xl text-gray-500 hover:text-gray-700 focus:outline-none leading-none w-8 h-8 flex items-center justify-center"
            >
              &times;
            </button>

            <h2 className="text-4xl font-bold text-center mb-4 text-primary">🚀 Meet-M - המערכת המושלמת לניהול אירועים</h2>
            <p className="text-xl text-center text-gray-600 mb-6">המערכת היחידה שמאפשרת לך ליצור, לשלוח ולנהל את האירוע שלך במקום אחד!</p>
            
            {/* Main Value Proposition */}
            <div className="bg-gradient-to-r from-primary/10 to-blue-100 p-6 rounded-xl mb-6 text-center">
              <h3 className="text-2xl font-bold text-primary mb-3">⚡ תוך 5 דקות יש לך הזמנות מעוצבות לכל האורחים!</h3>
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="text-3xl mb-2">🎨</div>
                  <h4 className="font-bold text-lg mb-2">עיצוב מקצועי</h4>
                  <p className="text-sm text-gray-600">45 תבניות מעוצבות + עריכה מלאה</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="text-3xl mb-2">📱</div>
                  <h4 className="font-bold text-lg mb-2">שליחה ל SMS ו-WhatsApp</h4>
                  <p className="text-sm text-gray-600">שליחה אוטומטית מקובץ אקסל לאורחים</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="text-3xl mb-2">👥</div>
                  <h4 className="font-bold text-lg mb-2">ניהול חכם</h4>
                  <p className="text-sm text-gray-600">מעקב אורחים + דוחות בקרה</p>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="grid md:grid-cols-2 gap-6 mb-6 text-lg text-gray-700">
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-primary">✅ למה לבחור בנו?</h3>
                <ul className="space-y-1.5">
                  <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> <strong>פשוט ומהיר</strong> - 5 דקות מהרשמה ועד שליחה</li>
                  <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> <strong>חיסכון משמעותי</strong> - אין צורך במעצב או הדפסות</li>
                  <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> <strong>מעקב בזמן אמת</strong> - מי מגיע, מי לא, כמה אוכל להזמין</li>
                  <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> <strong>עובד על כל מכשיר</strong> - מחשב, טאבלט, סמארטפון</li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    <strong>הזמנות ללא הגבלה</strong> – אפשרות לרכוש חבילות תוספת אורחים מעבר לתקרה הרגילה ולהזמין כמה שצריך
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-primary">🎯 מה תקבל?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-700">
                  <ol className="space-y-2 list-decimal list-inside">
                    <li>הזמנות מעוצבות מקצועית</li>
                    <li>שליחה אוטומטית לכל האורחים</li>
                    <li>שליחת הודעות SMS ו-WhatsApp</li>
                    <li>שליחת תזכורת לפני אירוע</li>
                    <li>מעקב אחר אישורי הגעה</li>
                    <li>הצגת דוחות בקרה מתעדכנים בזמן אמת בדף הבית</li>
                  </ol>
                  <ol start={7} className="space-y-2 list-decimal list-inside">
                    <li>ניהול פרטי אורחים</li>
                    <li>ניהול העדפות מזון ואלרגיות</li>
                    <li>דוחות בקרה מפורטים + ייצוא ל-Excel</li>
                    <li>שמירת אירועי עבר בארכיון</li>
                    <li>הצגת מפת אזור האירוע</li>
                    <li>ניווט ישיר לאולם האירועים</li>
                  </ol>
                </div>
              </div>
            </div>


            <div className="text-center mt-6 space-y-3">
              <div className="text-lg font-bold text-gray-800 mb-3">
                🎉 הצטרף לאלפי לקוחות מרוצים שכבר מנהלים את האירועים שלהם עם Meet-M!
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    setShowFeatures(false);
                    stepRef.current?.createNewEvent?.();
                  }}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-full font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg transform hover:scale-105 text-lg"
                >
                  🚀 התחל עכשיו
                </button>
                <button
                  onClick={() => setShowFeatures(false)}
                  className="bg-gray-200 text-gray-700 px-6 py-3 rounded-full font-medium hover:bg-gray-300 transition-colors"
                >
                  סגור
                </button>
              </div>
              
            </div>
          </div>
        </div>
      )}
    </>
  );
}
