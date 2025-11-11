import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const links = [
  { name: 'צור קשר', href: '/contact' },
];

export default function NavBar({ onAuthClick }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_IN') {
        // Ensure fresh data (e.g., events) after login
        if (typeof window !== 'undefined') window.location.reload();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className="w-full bg-white shadow-sm">
      <div className="container mx-auto flex items-center justify-between py-4 px-6">
        {/* Left Side - Auth Buttons */}
        <div className="hidden md:flex flex-row space-x-4 space-x-reverse">
          {session && (
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-primary font-medium border border-primary rounded-full px-4 py-1 hover:bg-primary hover:text-white transition-colors"
            >
              התנתק
            </button>
          )}
          {session && (
                  <div className="flex items-center">
                    <span className="whitespace-nowrap text-white font-medium bg-green-600 rounded-full px-6 py-3">משתמש מחובר: {session.user?.email}</span>
                  </div>
          )}
          {!session && (
            <>
              <button
                onClick={() => onAuthClick('sign_up')}
                className="text-white font-medium bg-green-600 rounded-full px-6 py-3 hover:bg-green-700 transition-colors"
              >
                הרשמה חינם
              </button>
              <button
                onClick={() => onAuthClick('sign_in')}
                className="bg-[#FCE6AC] text-primary border border-primary rounded-full px-6 py-3 font-medium hover:bg-[#FCE6AC]/90 transition-colors"
              >
                כניסה
              </button>
            </>
          )}
        </div>

        {/* Center - Contact Button */}
        <div className="flex justify-center">
          {links.map((link) => (
            <Link key={link.name} href={link.href} className="text-white font-medium bg-blue-600 rounded-full px-6 py-3 hover:bg-blue-700 transition-colors">
              {link.name}
            </Link>
          ))}
        </div>

        {/* Logo - Right Side */}
        <Link href="/" className="flex items-center" passHref>
          <span className="text-2xl md:text-3xl font-medium px-3 py-1 bg-[#FCE6AC] text-primary border border-primary rounded-md ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC]">
            Meet-M
          </span>
        </Link>
      </div>

      {/* Auth Modal removed */}
    </nav>
  );
}