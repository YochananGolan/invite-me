import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const navLinks = [
  { name: 'בית', href: '/' },
  { name: 'פיצ׳רים', isButton: true },
  { name: 'מחירים', onShowPricing: true },
  { name: 'דוחות בקרה', onShowReports: true },
  { name: 'צור קשר', href: '/contact' },
];

const LogoMark = () => (
  <svg width="40" height="26" viewBox="0 0 44 28" fill="none" aria-hidden="true">
    <path
      d="M2 26 L12 3 L22 19 L32 3 L42 26"
      stroke="#818cf8"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MenuIcon = ({ open }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    {open ? (
      <>
        <path d="M18 6 6 18" strokeLinecap="round" />
        <path d="m6 6 12 12" strokeLinecap="round" />
      </>
    ) : (
      <>
        <path d="M4 7h16" strokeLinecap="round" />
        <path d="M4 12h16" strokeLinecap="round" />
        <path d="M4 17h16" strokeLinecap="round" />
      </>
    )}
  </svg>
);

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
    });

    return () => subscription.unsubscribe();
  }, []);

  const runLinkAction = (link) => {
    if (link.isButton) {
      if (onAboutClick) onAboutClick();
      else if (typeof window !== 'undefined') window.location.href = '/?open=features';
    }
    if (link.onShowPricing) {
      if (onShowPricing) onShowPricing();
      else if (typeof window !== 'undefined') window.location.href = '/?open=pricing';
    }
    if (link.onShowReports) {
      if (onShowReports) onShowReports();
      else if (typeof window !== 'undefined') window.location.href = '/?open=reports';
    }
    setMobileMenuOpen(false);
  };

  const openAuth = (mode) => {
    if (onAuthClick) {
      onAuthClick(mode);
      return;
    }
    window.location.href = '/';
  };

  const linkClass =
    'relative text-sm font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f2b]';

  return (
    <nav className="relative z-40 border-b border-white/15 px-4 py-4 text-slate-100 sm:px-6 lg:px-12">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-2xl font-black text-white">
            <span>Meet-M</span>
            <LogoMark />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 text-slate-200 transition-colors hover:border-indigo-300 lg:hidden"
            aria-label="תפריט"
            aria-expanded={mobileMenuOpen}
          >
            <MenuIcon open={mobileMenuOpen} />
          </button>
        </div>

        <div className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) =>
            link.href ? (
              <Link key={link.name} href={link.href} className={`${linkClass} ${link.href === '/' ? 'text-white after:absolute after:-bottom-2 after:right-1/2 after:h-1 after:w-1 after:translate-x-1/2 after:rounded-full after:bg-indigo-300' : ''}`}>
                {link.name}
              </Link>
            ) : (
              <button key={link.name} type="button" onClick={() => runLinkAction(link)} className={linkClass}>
                {link.name}
              </button>
            )
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {session ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-indigo-300"
              >
                התנתקות
              </button>
              <span className="hidden max-w-[180px] truncate text-xs text-slate-400 sm:inline">{session.user?.email}</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openAuth('sign_in')}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-indigo-300"
              >
                התחברות
              </button>
              <button
                type="button"
                onClick={() => openAuth('sign_up')}
                className="rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-[0_8px_24px_rgba(99,70,230,0.3)] transition-transform hover:-translate-y-0.5"
              >
                התנסות בחינם
              </button>
            </>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mx-auto mt-4 max-w-6xl rounded-lg border border-white/15 bg-[#12143a]/95 p-2 shadow-2xl backdrop-blur-xl lg:hidden">
          {navLinks.map((link) =>
            link.href ? (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[44px] items-center justify-end rounded-md px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
              >
                {link.name}
              </Link>
            ) : (
              <button
                key={link.name}
                type="button"
                onClick={() => runLinkAction(link)}
                className="flex min-h-[44px] w-full items-center justify-end rounded-md px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
              >
                {link.name}
              </button>
            )
          )}
        </div>
      )}
    </nav>
  );
}
