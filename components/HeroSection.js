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
              ממשק מתקדם לתכנון וניהול אירוע מושלם בקלות – עם דרך חדשה להזמין ולהרשים את האורחים.
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
                {/* Card Image with overlay */}
                <div className="relative aspect-[3/4] md:aspect-[4/5]">
                  <Image
                    src="/images/עיצוב-הזמנה-1.jpg"
                    alt="הזמנה לדוגמא"
                    fill
                    sizes="(max-width: 768px) 100vw, 450px"
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white">
                    <h3 className="text-2xl md:text-3xl font-bold mb-1">מעיין & אמיר</h3>
                    <p className="text-amber-100 text-lg font-semibold mb-3">מתחתנים</p>
                    <button
                      onClick={onShowFeatures}
                      className="flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
                    >
                      אישור הגעה
                      <span className="text-xs">▼</span>
                    </button>
                  </div>
                </div>
                {/* Card Details */}
                <div className="p-4 md:p-5 bg-[#FFFBF5] text-right">
                  <p className="text-gray-700 text-sm mb-3">
                    אנו שמחים ונרגשים להזמין אתכם לחגוג עמנו את יום נישואינו
                  </p>
                  <p className="text-gray-800 font-bold text-lg mb-1">יום שני • 18.12.2024</p>
                  <p className="text-gray-600 text-sm flex items-center gap-1 justify-end">
                    <span>📍</span>
                    תל אביב, ישראל
                  </p>
                  <p className="text-gray-500 text-xs mt-2">קבלת פנים 19:30 • חופה וקידושין 20:30</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
