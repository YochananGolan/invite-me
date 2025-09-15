import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const links = [
  { name: 'הזמנה דיגיטאלית', href: '/#' },
  { name: 'מתנות באשראי', href: '/#' },
  { name: 'צור קשר', href: '/#' },
];

export default function NavBar() {
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
        {/* Navigation Links */}
        <ul className="hidden md:flex flex-row space-x-10 space-x-reverse">
          {links.map((link) => (
            <li key={link.name}>
              <Link href={link.href} className="text-primary font-medium border border-primary rounded-full px-4 py-1 hover:bg-primary hover:text-white transition-colors">
                {link.name}
              </Link>
            </li>
          ))}
          {session && (
            <li key="logout">
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-primary font-medium border border-primary rounded-full px-4 py-1 hover:bg-primary hover:text-white transition-colors"
              >
                התנתק
              </button>
            </li>
          )}
          {session && (
            <li key="user" className="flex items-center text-gray-700">
              <span className="whitespace-nowrap">משתמש: {session.user?.email}</span>
            </li>
          )}
        </ul>

        {/* Logo - Left Side */}
        <Link href="/" className="order-last flex items-center" passHref>
          <span className="text-2xl md:text-3xl font-medium px-3 py-1 bg-[#FCE6AC] text-primary border border-primary rounded-md ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC]">
            Invite&nbsp;Me
          </span>
        </Link>
      </div>

      {/* Auth Modal removed */}
    </nav>
  );
}