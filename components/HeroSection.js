import Image from 'next/image';
import { forwardRef, useState, useEffect } from 'react';

// Confetti shapes for festive background
const ConfettiBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    {[...Array(24)].map((_, i) => (
      <div
        key={i}
        className="absolute w-3 h-3 md:w-4 md:h-4 rounded-sm opacity-40"
        style={{
          left: `${(i * 7 + 3) % 100}%`,
          top: `${(i * 11 + 5) % 100}%`,
          backgroundColor: ['#93c5fd', '#fde047', '#f9a8d4', '#86efac', '#c4b5fd'][i % 5],
          transform: `rotate(${i * 15}deg)`,
          borderRadius: i % 3 === 0 ? '50%' : '2px',
        }}
      />
    ))}
  </div>
);

// Typewriter effect hook
const useTypewriter = (text, speed = 100, pauseDuration = 5000) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let timeoutId;
    let currentIndex = 0;
    let isPaused = false;

    const type = () => {
      if (isPaused) return;
      
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
        timeoutId = setTimeout(type, speed);
      } else {
        // Finished typing, wait for pause duration then restart
        isPaused = true;
        timeoutId = setTimeout(() => {
          setDisplayedText('');
          currentIndex = 0;
          isPaused = false;
          type();
        }, pauseDuration);
      }
    };

    type();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [text, speed, pauseDuration]);

  return displayedText;
};

export default forwardRef(function HeroSection({ onStart, onShowFeatures, onSignUpClick, onSignInClick, isLoggedIn, onPressCreateEvent, onPressReports }, ref) {
  const handleCreateNewEvent = () => typeof onPressCreateEvent === 'function' && onPressCreateEvent();
  const handleOpenReports = () => typeof onPressReports === 'function' && onPressReports();
  // Full invitation text with line breaks
  const fullInvitationText = 'דוד & שרה\nמתחתנים\n\nבשמחה רבה אנו מזמינים אתכם לחגוג עמנו את יום נישואינו\n\nיום שלישי • 24.03.2026\n📍 ירושלים, ישראל\n\nקבלת פנים 19:00 • חופה וקידושין 21:00';
  const displayedInvitationText = useTypewriter(fullInvitationText, 80, 5000);
  
  // Parse displayed text into parts
  const allLines = fullInvitationText.split('\n');
  const lines = displayedInvitationText.split('\n');
  
  const namesLine = lines[0] || '';
  const weddingLine = lines[1] || '';
  const invitationLine = lines[3] || '';
  const dateLine = lines[5] || '';
  const locationLine = lines[6] || '';
  const timesLine = lines[8] || '';
  
  const isNamesComplete = namesLine === allLines[0];
  const isWeddingComplete = weddingLine === allLines[1];
  const isInvitationComplete = invitationLine === allLines[3];
  const isDateComplete = dateLine === allLines[5];
  const isLocationComplete = locationLine === allLines[6];
  const isTimesComplete = timesLine === allLines[8];
  return (
    <section className="relative min-h-[85vh] flex items-center bg-white">
      {/* Confetti background */}
      <ConfettiBackground />

      <div className="container mx-auto relative z-10 py-12 md:py-16 px-4">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Hero Text - Right side in RTL */}
          <div className="lg:flex-1 flex flex-col justify-center text-center lg:text-right order-2 lg:order-1">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-4 leading-tight">
              נעים מאוד, אנחנו Meet-M
            </h1>
            <p className="text-gray-600 text-lg md:text-xl mb-6 leading-relaxed max-w-xl lg:mr-0 lg:ml-auto mx-auto">
              יצירת הזמנות מעוצבות, שליחה אוטומטית ב-SMS ו-WhatsApp, מעקב אישורי הגעה בזמן אמת, דוחות וייצוא לאקסל – הכל במקום אחד.
            </p>
            
            {/* Stats */}
            <div className="mb-4">
              <span className="text-primary font-bold text-2xl md:text-3xl">אלפי אירועים </span>
              <span className="text-gray-700 font-medium text-lg md:text-xl">הצטרפו!</span>
            </div>

            {/* כפתורי פעולה ראשיים */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
              <button
                type="button"
                onClick={() => typeof onStart === 'function' && onStart()}
                className="px-8 py-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors text-lg"
                aria-label="תיאור תהליך יצירת אירוע"
              >
                תיאור תהליך יצירת אירוע
              </button>
              <button
                type="button"
                onClick={handleCreateNewEvent}
                className="px-8 py-4 rounded-lg bg-purple-600 text-white font-extrabold text-lg cursor-pointer
                           shadow-xl ring-2 ring-purple-400 hover:bg-purple-700 hover:shadow-[0_0_35px_rgba(147,51,234,0.65)]
                           transition-all duration-200 hover:scale-105 active:scale-95 animate-[pulse_4s_ease-in-out_infinite]"
                aria-label="צור אירוע חדש"
              >
                צור אירוע חדש
              </button>
            </div>

            {/* Feature Icons + דוחות בקרה – כפתור נפרד, קורא רק ל-onShowReports */}
            <div className="flex flex-wrap justify-center lg:justify-start items-end gap-6 mt-10">
              {[
                { icon: '🎨', label: 'עיצוב מקצועי', sub: '45 תבניות' },
                { icon: '📱', label: 'אישורים בוואטסאפ וב-SMS', sub: 'שליחה אוטומטית' },
                { icon: '💬', label: 'אישורי הגעה', sub: 'מעקב בזמן אמת' },
              ].map((f) => (
                <div key={f.label} className="flex flex-col items-center lg:items-start">
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl mb-2">
                    {f.icon}
                  </div>
                  <span className="text-primary font-semibold text-sm">{f.label}</span>
                  <span className="text-gray-500 text-xs">{f.sub}</span>
                </div>
              ))}
              {typeof onPressReports === 'function' && (
                <button
                  type="button"
                  onClick={handleOpenReports}
                  className="px-8 py-4 rounded-full bg-primary/15 text-primary font-bold border-2 border-primary hover:bg-primary hover:text-white transition-colors text-lg shadow-md shrink-0 self-center lg:-translate-x-24"
                  aria-label="דוחות בקרה"
                >
                  דוחו״ת בקרה
                </button>
              )}
            </div>
          </div>

          {/* Invitation Card */}
          <div className="lg:flex-1 flex justify-center order-1 lg:order-2 -translate-y-8 md:-translate-y-12">
            <div className="w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                {/* Card Image with all text overlay */}
                <div className="relative aspect-[3/5] md:aspect-[2/3]">
                  <Image
                    src="/images/wedding-couple-bright-luxury.jpg"
                    alt="הזמנה לדוגמא"
                    fill
                    sizes="(max-width: 768px) 100vw, 450px"
                    className="object-cover"
                    priority
                  />
                  {/* Very bright overlay so text is readable without white box */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-white/55 to-white/35" />
                  {/* All invitation text on image */}
                  <div className="absolute inset-0 flex flex-col p-4 md:p-6 text-right">
                    {/* Top section - Names */}
                    <div className="mt-4 md:mt-6">
                      <h3 className="text-2xl md:text-3xl font-bold mb-2 text-gray-800 drop-shadow-lg">
                        {namesLine}
                        {!isNamesComplete && <span className="animate-pulse">|</span>}
                      </h3>
                      {isNamesComplete && (
                        <p className="text-gray-700 text-lg font-semibold mb-1 drop-shadow-md">
                          {weddingLine}
                          {!isWeddingComplete && <span className="animate-pulse">|</span>}
                        </p>
                      )}
                    </div>
                    
                    {/* Center section - All details, no white box */}
                    {isWeddingComplete && (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="w-full max-w-[90%]">
                          <p className="text-gray-800 text-base md:text-lg mb-4 font-medium leading-relaxed drop-shadow-lg">
                            {invitationLine}
                            {!isInvitationComplete && <span className="animate-pulse">|</span>}
                          </p>
                          {isInvitationComplete && (
                            <>
                              <p className="text-gray-900 font-bold text-xl md:text-2xl mb-3 drop-shadow-lg">
                                {dateLine}
                                {!isDateComplete && <span className="animate-pulse">|</span>}
                              </p>
                              {isDateComplete && (
                                <p className="text-gray-800 text-base md:text-lg flex items-center gap-1 justify-end mb-3 drop-shadow-lg">
                                  <span>📍</span>
                                  {locationLine}
                                  {!isLocationComplete && <span className="animate-pulse">|</span>}
                                </p>
                              )}
                              {isLocationComplete && (
                                <p className="text-gray-700 text-sm md:text-base drop-shadow-md">
                                  {timesLine}
                                  {!isTimesComplete && <span className="animate-pulse">|</span>}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
