import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0d0f2b]/80 text-slate-100 py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-right">
            <h3 className="text-xl font-black mb-1 text-white">Meet-M</h3>
            <p className="text-slate-400 text-sm">הדרך המושלמת להזמין ולנהל אורחים</p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link
              href="/terms"
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              תנאי שימוש ומדיניות פרטיות
            </Link>
            <a
              href="mailto:gyapps1@gmail.com"
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              צור קשר
            </a>
          </div>

          <div className="text-center md:text-left text-slate-500 text-sm">
            <p>&copy; {new Date().getFullYear()} Meet-M. כל הזכויות שמורות.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
