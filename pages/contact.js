import Link from 'next/link';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)] text-slate-100" dir="rtl">
      <NavBar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-white/[0.055] backdrop-blur-xl shadow-[0_4px_32px_rgba(0,0,0,0.3)] p-8 space-y-5 text-right">
          <Link
            href="/"
            className="absolute top-4 left-4 text-2xl text-slate-400 hover:text-slate-100 transition-colors leading-none"
            aria-label="סגור"
          >
            &times;
          </Link>
          <div className="flex items-center justify-center mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M22 7l-10 7L2 7"/>
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-black text-center text-white">צור קשר</h1>
          <p className="text-base leading-relaxed text-slate-400 text-center">
            נשמח לשמוע ממך! לכל שאלה, בקשה או הצעה — שלח לנו מייל:
          </p>
          <div className="text-center">
            <a
              href="mailto:gyapps1@gmail.com"
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-5 py-2.5 text-base font-semibold text-indigo-200 hover:bg-indigo-500/20 transition-colors"
            >
              gyapps1@gmail.com
            </a>
          </div>
          <p className="text-sm text-slate-500 text-center">
            נענה בהקדם. תודה שבחרת ב־Meet‑M!
          </p>
          <div className="pt-2 text-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_5px_22px_rgba(99,70,230,0.45)] transition-transform hover:-translate-y-0.5"
            >
              חזרה לדף הבית
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
