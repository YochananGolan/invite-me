import Link from 'next/link';

export default function ContactPage() {
  return (
    <main className="container mx-auto p-6 rtl text-right max-w-xl">
      <div className="relative bg-[#FFF9E8] border-2 border-primary rounded-lg p-8 shadow-sm space-y-4">
        <Link
          href="/"
          className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700"
          aria-label="סגור"
        >
          &times;
        </Link>
        <h1 className="text-3xl font-bold text-primary text-center mb-4">צור קשר</h1>
        <p className="text-xl leading-relaxed">
          נשמח לשמוע ממך! ניתן לפנות אלינו בכל שאלה, בקשה או הצעה באמצעות כתובת המייל:
        </p>
        <p className="text-lg font-semibold text-primary text-center">
          <a href="mailto:gyapps1@gmail.com" className="underline hover:text-primary/80">
            gyapps1@gmail.com
          </a>
        </p>
        <p className="text-lg text-gray-700">
          נענה בהקדם האפשרי ונעשה את המיטב כדי לסייע לך. תודה שבחרת ב־Meet‑M!
        </p>
        <div className="pt-2 text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-primary text-white rounded-full px-6 py-2 text-lg hover:bg-primary/90 transition-colors"
          >
            סגור
          </Link>
        </div>
      </div>
    </main>
  );
}
