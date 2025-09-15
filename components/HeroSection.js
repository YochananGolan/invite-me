import Image from 'next/image';


export default function HeroSection({ onStart }) {
  return (
    <section className="container mx-auto flex flex-col md:flex-row py-16 px-4">
      {/* Text Column (Right) */}
      <div className="md:w-1/2 flex flex-col justify-center md:pl-16 mt-8 md:mt-0 text-center md:text-right">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium mb-4 leading-snug">
          הדרך המושלמת להזמין ולנהל אורחים
        </h1>
        <p className="text-gray-600 mb-8 leading-8 text-lg md:text-xl">
          שלח הזמנות מעוצבות, עקוב אחר אישורי הגעה בזמן אמת ונהל את האירוע שלך
          בקלות ובסטייל יוקרתי.
        </p>
        <button onClick={onStart} className="self-center md:self-start bg-[#FCE6AC] text-primary border border-primary rounded-full px-8 py-3 font-medium ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 transition-all">
          התחל עכשיו
        </button>
      </div>

      {/* Image Column (Left) */}
      <div className="md:w-1/2 flex flex-col space-y-6">
        <div className="relative w-full h-96">
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
}
