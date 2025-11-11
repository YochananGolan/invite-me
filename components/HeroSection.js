import Image from 'next/image';
import { forwardRef, useImperativeHandle } from 'react';


export default forwardRef(function HeroSection({ onStart, onShowFeatures, onSignUpClick, onSignInClick, isLoggedIn }, ref) {
  console.log('🔍 HeroSection rendered with onStart:', typeof onStart, 'isLoggedIn:', isLoggedIn);
  
  return (
    <section className="container mx-auto flex flex-col md:flex-row py-12 px-4">
      {/* Text Column (Right) */}
      <div className="md:w-1/2 flex flex-col justify-center md:pl-16 mt-8 md:mt-0 text-center md:text-right">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium mb-4 leading-snug">
          הדרך המושלמת להזמין ולנהל אורחים
        </h1>
        <p className="text-gray-600 mb-8 leading-7 text-lg md:text-xl">
          שלח הזמנות מעוצבות, עקוב אחר אישורי הגעה בזמן אמת ונהל את האירוע שלך
          בקלות ובסטייל יוקרתי.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 self-center md:self-start">
          <button 
            onClick={onShowFeatures} 
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-2 border-blue-600 rounded-full px-8 py-4 font-bold hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg transform hover:scale-105 text-lg"
          >
            מה המערכת שלנו יודעת לתת לך?
          </button>
          
          <button onClick={() => {
            console.log('🔍 Button clicked - calling onStart');
            console.log('🔍 onStart function:', onStart);
            if (typeof onStart === 'function') {
              onStart();
            } else {
              console.error('❌ onStart is not a function!');
            }
          }} className="bg-[#FCE6AC] text-primary border border-primary rounded-full px-12 py-4 font-bold ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 transition-all text-xl">
            התחל כאן עכשיו
          </button>
        </div>
      </div>

      {/* Image Column (Left) */}
      <div className="md:w-1/2 flex flex-col space-y-6">
        <div className="relative w-full h-80">
          {/* Background hero image */}
          <Image
            src="/images/תמונת מסך בית מעודכן.png"
            alt="Background"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover rounded-md"
            priority
          />
        </div>
      </div>

    </section>
  );
});
