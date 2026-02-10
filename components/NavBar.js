import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const navLinks = [
  { name: 'ראשי', href: '/' },
  { name: 'אישורי הגעה', href: '/rsvp' },
  { name: 'חבילות ומחירים', href: '/#pricing' },
  { name: 'אודות', isButton: true },
  { name: 'צור קשר', href: '/contact' },
];

export default function NavBar({ onAuthClick, onAboutClick }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_IN') {
        if (typeof window !== 'undefined') window.location.reload();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className="w-full bg-white border-b border-gray-100">
      <div className="container mx-auto flex items-center justify-between py-4 px-4 md:px-6">
        {/* Logo - Right side in RTL */}
        <Link href="/" className="flex items-center" passHref>
          <span className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight">
            Meet-M
          </span>
        </Link>

        {/* Nav Links - Center */}
        <div className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) =>
            link.isButton ? (
              <button
                key={link.name}
                onClick={onAboutClick}
                className="text-gray-600 hover:text-primary transition-colors text-sm font-medium"
              >
                {link.name}
              </button>
            ) : (
              <Link
                key={link.name}
                href={link.href}
                className="text-gray-600 hover:text-primary transition-colors text-sm font-medium"
              >
                {link.name}
              </Link>
            )
          )}
        </div>

        {/* Auth Buttons - Left side in RTL */}
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="hidden sm:inline text-sm text-gray-600 truncate max-w-[120px] md:max-w-[180px]">
                {session.user?.email}
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-primary font-medium border-2 border-primary rounded-lg px-4 py-2 hover:bg-primary hover:text-white transition-colors text-sm"
              >
                התנתק
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onAuthClick('sign_in')}
                className="text-primary font-medium border-2 border-primary rounded-lg px-4 py-2 hover:bg-primary/5 transition-colors text-sm whitespace-nowrap"
              >
                כניסה
              </button>
              <button
                onClick={() => onAuthClick('sign_up')}
                className="bg-primary text-white font-medium rounded-lg px-5 py-2.5 hover:bg-primary/90 transition-colors text-sm whitespace-nowrap shadow-sm"
              >
                הרשמה בחינם
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
