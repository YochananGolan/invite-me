import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Company Info */}
          <div className="text-center md:text-right">
            <h3 className="text-xl font-bold mb-2">Meet-M</h3>
            <p className="text-gray-400 text-sm">הדרך המושלמת להזמין ולנהל אורחים</p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link
              href="/terms"
              className="text-gray-300 hover:text-white transition-colors"
            >
              תנאי שימוש ומדיניות פרטיות
            </Link>
            <a
              href="mailto:gyapps1@gmail.com"
              className="text-gray-300 hover:text-white transition-colors"
            >
              צור קשר
            </a>
          </div>

          {/* Copyright */}
          <div className="text-center md:text-left text-gray-400 text-sm">
            <p>&copy; {new Date().getFullYear()} Meet-M. כל הזכויות שמורות.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
