import Image from 'next/image';
import { forwardRef } from 'react';

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

export default forwardRef(function HeroSection({ onStart, onShowFeatures, onSignUpClick, onSignInClick, isLoggedIn, onCreateEvent }, ref) {
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

            {/* Create Event + Process Description Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
              <button
                onClick={() => typeof onStart === 'function' && onStart()}
                className="px-8 py-4 rounded-lg border-2 border-primary text-primary font-medium hover:bg-primary/5 transition-colors text-lg"
              >
                תיאור תהליך יצירת אירוע
              </button>
              <button
                onClick={() => typeof onCreateEvent === 'function' && onCreateEvent()}
                className="px-8 py-4 rounded-lg bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg text-lg"
              >
                צור אירוע חדש
              </button>
            </div>

            {/* Feature Icons */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-6 mt-10">
              {[
                { icon: '🎨', label: 'עיצוב מקצועי', sub: '20 תבניות' },
                { icon: '📱', label: 'אישורים ב-SMS', sub: 'שליחה אוטומטית' },
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
            </div>
          </div>

          {/* Invitation Card - Left side in RTL */}
          <div className="lg:flex-1 flex justify-center order-1 lg:order-2">
            <div className="w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                {/* Card Image with all text overlay */}
                <div className="relative aspect-[3/4] md:aspect-[4/5]">
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
                      <h3 className="text-2xl md:text-3xl font-bold mb-2 text-gray-800 drop-shadow-lg">דוד & שרה</h3>
                      <p className="text-gray-700 text-lg font-semibold mb-1 drop-shadow-md">מתחתנים</p>
                    </div>
                    
                    {/* Center section - All details, no white box */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-full max-w-[90%]">
                        <p className="text-gray-800 text-base md:text-lg mb-4 font-medium leading-relaxed drop-shadow-lg">
                          בשמחה רבה אנו מזמינים אתכם לחגוג עמנו את יום נישואינו
                        </p>
                        <p className="text-gray-900 font-bold text-xl md:text-2xl mb-3 drop-shadow-lg">יום שישי • 15.03.2025</p>
                        <p className="text-gray-800 text-base md:text-lg flex items-center gap-1 justify-end mb-3 drop-shadow-lg">
                          <span>📍</span>
                          ירושלים, ישראל
                        </p>
                        <p className="text-gray-700 text-sm md:text-base drop-shadow-md">קבלת פנים 17:00 • חופה וקידושין 18:00 • ארוחת ערב 19:30</p>
                      </div>
                    </div>
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
