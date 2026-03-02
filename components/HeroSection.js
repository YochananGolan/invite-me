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
  const fullInvitationText = '\u05D3\u05D5\u05D3 & \u05E9\u05E8\u05D4\n\u05DE\u05EA\u05D7\u05EA\u05E0\u05D9\u05DD\n\n\u05D1\u05E9\u05DE\u05D7\u05D4 \u05E8\u05D1\u05D4 \u05D0\u05E0\u05D5 \u05DE\u05D6\u05DE\u05D9\u05E0\u05D9\u05DD \u05D0\u05EA\u05DB\u05DD \u05DC\u05D7\u05D2\u05D5\u05D2 \u05E2\u05DE\u05E0\u05D5 \u05D0\u05EA \u05D9\u05D5\u05DD \u05E0\u05D9\u05E9\u05D5\u05D0\u05D9\u05E0\u05D5\n\n\u05D9\u05D5\u05DD \u05E9\u05DC\u05D9\u05E9\u05D9 \u2022 24.03.2026\n\uD83D\uDCCD \u05D9\u05E8\u05D5\u05E9\u05DC\u05D9\u05DD, \u05D9\u05E9\u05E8\u05D0\u05DC\n\n\u05E7\u05D1\u05DC\u05EA \u05E4\u05E0\u05D9\u05DD 19:00 \u2022 \u05D7\u05D5\u05E4\u05D4 \u05D5\u05E7\u05D9\u05D3\u05D5\u05E9\u05D9\u05DF 21:00';
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
    <section className="relative min-h-[70vh] md:min-h-[85vh] flex items-center bg-white">
      {/* Confetti background */}
      <ConfettiBackground />

      <div className="container mx-auto relative z-10 py-6 md:py-16 px-4">
        <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-12 lg:gap-16">
          {/* Hero Text - Right side in RTL */}
          <div className="lg:flex-1 flex flex-col justify-center text-center lg:text-right order-2 lg:order-1">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-5 leading-tight">
              {'\u05E0\u05E2\u05D9\u05DD \u05DE\u05D0\u05D5\u05D3, \u05D0\u05E0\u05D7\u05E0\u05D5 Meet-M'}
            </h1>
            <p className="text-gray-600 text-lg md:text-xl mb-6 leading-relaxed max-w-xl lg:mr-0 lg:ml-auto mx-auto">
              {'\u05D9\u05E6\u05D9\u05E8\u05EA \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05DE\u05E2\u05D5\u05E6\u05D1\u05D5\u05EA, \u05E9\u05DC\u05D9\u05D7\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05D1-SMS \u05D5-WhatsApp, \u05DE\u05E2\u05E7\u05D1 \u05D0\u05D9\u05E9\u05D5\u05E8\u05D9 \u05D4\u05D2\u05E2\u05D4 \u05D1\u05D6\u05DE\u05DF \u05D0\u05DE\u05EA, \u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05DC\u05E4\u05E0\u05D9 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2, \u05D3\u05D5\u05D7\u05D5\u05EA \u05D1\u05E7\u05E8\u05D4 \u05D5\u05D9\u05D9\u05E6\u05D5\u05D0 \u05DC\u05D0\u05E7\u05E1\u05DC \u2013 \u05D4\u05DB\u05DC \u05D1\u05DE\u05E7\u05D5\u05DD \u05D0\u05D7\u05D3.'}
            </p>
            
            {/* Stats */}
            <div className="mb-6">
              <span className="text-primary font-bold text-2xl md:text-3xl">{'\u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DB\u05DD '}</span>
              <span className="text-gray-700 font-medium text-lg md:text-xl">{'\u05DE\u05EA\u05D7\u05D9\u05DC \u05DB\u05D0\u05DF \u2728'}</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-3">
              <button
                type="button"
                onClick={handleCreateNewEvent}
                className="group relative px-9 py-4 rounded-xl text-white font-extrabold text-lg cursor-pointer overflow-hidden
                           bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600
                           shadow-[0_14px_35px_rgba(124,58,237,0.35)] ring-4 ring-purple-300/60 ring-offset-2 ring-offset-white
                           transition-all duration-200 order-first sm:order-last
                           hover:from-purple-900 hover:via-purple-900 hover:to-purple-900 hover:-translate-y-0.5 hover:shadow-[0_0_55px_rgba(88,28,135,0.8)] hover:ring-purple-900/80
                           active:from-purple-900 active:via-purple-900 active:to-purple-900 active:translate-y-0 active:scale-[0.98] active:shadow-inner
                           focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500"
                aria-label={'\u05E6\u05D5\u05E8 \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D7\u05D3\u05E9'}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-xl bg-purple-900 animate-cta-dark-cover pointer-events-none"
                />
                <span className="relative z-10">{'\u05E6\u05D5\u05E8 \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D7\u05D3\u05E9'}</span>
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)] pointer-events-none"
                />
              </button>
              <button
                type="button"
                onClick={() => { if (typeof onStart === 'function') onStart(); }}
                className="group inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                           bg-white border-2 border-gray-300 text-gray-700 font-bold text-base
                           shadow-sm hover:shadow-lg hover:border-primary hover:bg-primary hover:text-white
                           transition-all duration-200 cursor-pointer"
                aria-label={'\u05EA\u05D9\u05D0\u05D5\u05E8 \u05EA\u05D4\u05DC\u05D9\u05DA \u05D9\u05E6\u05D9\u05E8\u05EA \u05D0\u05D9\u05E8\u05D5\u05E2'}
              >
                <span>{'\u05EA\u05D9\u05D0\u05D5\u05E8 \u05EA\u05D4\u05DC\u05D9\u05DA \u05D9\u05E6\u05D9\u05E8\u05EA \u05D0\u05D9\u05E8\u05D5\u05E2'}</span>
                <svg className="w-4 h-4 mr-1 transition-transform duration-200 group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {typeof onPressReports === 'function' && (
              <div className="flex justify-center lg:justify-start">
                <button
                  type="button"
                  onClick={handleOpenReports}
                  className="group inline-flex items-center gap-2 sm:gap-3 px-5 sm:px-7 py-3 rounded-xl
                             bg-white border-2 border-primary/40 text-primary font-bold text-sm sm:text-base
                             shadow-sm hover:shadow-lg hover:border-primary hover:bg-primary hover:text-white
                             transition-all duration-200 cursor-pointer"
                  aria-label={'\u05D3\u05D5\u05D7\u05D5\u05EA \u05D1\u05E7\u05E8\u05D4'}
                >
                  <span className="text-xl">{'\uD83D\uDCCA'}</span>
                  <span>{'\u05D3\u05D5\u05D7\u05D5\u05F4\u05EA \u05D1\u05E7\u05E8\u05D4'}</span>
                  <svg className="w-4 h-4 mr-1 transition-transform duration-200 group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            )}

            <div className="flex flex-wrap justify-center lg:justify-start items-end gap-6 mt-8">
              {[
                { icon: '\uD83C\uDFA8', label: '\u05E2\u05D9\u05E6\u05D5\u05D1 \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9', sub: '45 \u05EA\u05D1\u05E0\u05D9\u05D5\u05EA' },
                { icon: '\uD83D\uDCF1', label: '\u05D0\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD \u05D1\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4 \u05D5\u05D1-SMS', sub: '\u05E9\u05DC\u05D9\u05D7\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA' },
                { icon: '\uD83D\uDCAC', label: '\u05D0\u05D9\u05E9\u05D5\u05E8\u05D9 \u05D4\u05D2\u05E2\u05D4', sub: '\u05DE\u05E2\u05E7\u05D1 \u05D1\u05D6\u05DE\u05DF \u05D0\u05DE\u05EA' },
              ].map((f) => (
                <div key={f.label} className="flex flex-col items-center lg:items-start">
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl mb-2">
                    {f.icon}
                  </div>
                  <span className="text-primary font-semibold text-sm">{f.label}</span>
                  <span className="text-gray-500 text-xs">{f.sub}</span>
                </div>
              ))}
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
                    alt={'\u05D4\u05D6\u05DE\u05E0\u05D4 \u05DC\u05D3\u05D5\u05D2\u05DE\u05D0'}
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
                                  <span>{'\uD83D\uDCCD'}</span>
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
