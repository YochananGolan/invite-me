import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const navLinks = [
  { name: 'ראשי', href: '/' },
  { name: 'חבילות ומחירים', onShowPricing: true },
  { name: 'דוחו"ת בקרה', onShowReports: true },
  { name: 'אודות', isButton: true },
  { name: 'צור קשר', href: '/contact' },
];

export default function NavBar({ onAuthClick = null, onAboutClick, onShowPricing, onShowReports }) {
  const [session, setSession] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Do NOT reload on SIGNED_IN - Supabase fires it on token refresh, tab refocus, and when
      // Google Pay sheet opens on mobile (document loses focus). Reload would interrupt payment.
      // Session propagates via setSession; verify-email page handles its own router.replace.
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className="w-full bg-white border-b border-gray-100">
      <div className="container mx-auto flex items-center justify-between py-4 px-3 sm:px-4 md:px-6">
        {/* Logo + Hamburger - Right side in RTL */}
        <div className="flex items-center gap-1">
          <Link href="/" className="flex items-center" passHref>
            <span className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
              Meet-M
            </span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:bg-gray-100"
            aria-label="תפריט"
          >
            <span className="text-2xl">{mobileMenuOpen ? '✕' : '☰'}</span>
          </button>
        </div>

        {/* Nav Links - Center (desktop) */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) =>
            link.isButton ? (
              <button
                key={link.name}
                onClick={onAboutClick}
                className="text-gray-700 hover:text-primary transition-colors text-base font-semibold"
              >
                {link.name}
              </button>
            ) : link.onShowPricing ? (
              <button
                key={link.name}
                onClick={() => typeof onShowPricing === 'function' && onShowPricing()}
                className="text-gray-700 hover:text-primary transition-colors text-base font-semibold"
              >
                {link.name}
              </button>
            ) : link.onShowReports ? (
              <button
                key={link.name}
                onClick={() => typeof onShowReports === 'function' && onShowReports()}
                className="text-gray-700 hover:text-primary transition-colors text-base font-semibold"
              >
                {link.name}
              </button>
            ) : (
              <Link
                key={link.name}
                href={link.href}
                className="text-gray-700 hover:text-primary transition-colors text-base font-semibold"
              >
                {link.name}
              </Link>
            )
          )}
        </div>

        {/* Auth Buttons - Left side in RTL */}
        <div className="flex flex-row items-center gap-1 sm:gap-3">
          {session ? (
            <div className="flex flex-col items-start sm:flex-row sm:items-center gap-0.5 sm:gap-3">
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-primary font-semibold border-2 border-primary rounded-lg px-3 py-1.5 sm:px-5 sm:py-2.5 hover:bg-primary hover:text-white transition-colors text-sm sm:text-base"
              >
                התנתק
              </button>
              <span className="text-[11px] sm:text-sm text-gray-500 sm:text-gray-600 truncate max-w-[140px] sm:max-w-[120px] md:max-w-[180px]">
                {session.user?.email}
              </span>
            </div>
          ) : (
            <>
              <button
                onClick={() => onAuthClick ? onAuthClick('sign_in') : (window.location.href = '/')}
                className="text-primary font-semibold border-2 border-primary rounded-lg px-2.5 py-1.5 sm:px-5 sm:py-2.5 hover:bg-primary/5 transition-colors text-xs sm:text-base whitespace-nowrap"
              >
                כניסה
              </button>
              <button
                onClick={() => onAuthClick ? onAuthClick('sign_up') : (window.location.href = '/')}
                className="bg-primary text-white font-semibold rounded-lg px-2 py-1.5 sm:px-6 sm:py-2.5 hover:bg-primary/90 transition-colors text-xs sm:text-base whitespace-nowrap shadow-sm"
              >
                <span className="sm:hidden">הרשמה</span>
                <span className="hidden sm:inline">הרשמה בחינם</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white">
          <div className="container mx-auto py-3 px-4 flex flex-col gap-1">
            {navLinks.map((link) =>
              link.isButton ? (
                <button
                  key={link.name}
                  onClick={() => { onAboutClick?.(); setMobileMenuOpen(false); }}
                  className="text-right py-3 px-4 text-gray-700 hover:bg-primary/10 rounded-lg min-h-[44px] flex items-center justify-end"
                >
                  {link.name}
                </button>
              ) : link.onShowPricing ? (
                <button
                  key={link.name}
                  onClick={() => { onShowPricing?.(); setMobileMenuOpen(false); }}
                  className="text-right py-3 px-4 text-gray-700 hover:bg-primary/10 rounded-lg min-h-[44px] flex items-center justify-end"
                >
                  {link.name}
                </button>
              ) : link.onShowReports ? (
                <button
                  key={link.name}
                  onClick={() => { onShowReports?.(); setMobileMenuOpen(false); }}
                  className="text-right py-3 px-4 text-gray-700 hover:bg-primary/10 rounded-lg min-h-[44px] flex items-center justify-end"
                >
                  {link.name}
                </button>
              ) : (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-right py-3 px-4 text-gray-700 hover:bg-primary/10 rounded-lg min-h-[44px] flex items-center justify-end"
                >
                  {link.name}
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
