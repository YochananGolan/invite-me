import { useEffect } from 'react';

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[98vw]',
  screen: 'max-w-full w-full',
};

export default function Modal({ open, onClose, size = 'md', children, className = '' }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 z-50 flex ${size === 'screen' ? 'items-stretch' : 'items-end sm:items-center'} justify-center bg-[#0a0b1e]/75 backdrop-blur-sm p-0 ${size === 'screen' ? '' : 'sm:p-4'}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className={`relative bg-gradient-to-b from-[#1a1d4a]/95 to-[#12143a]/95 backdrop-blur-2xl border border-white/[0.12] overflow-hidden shadow-[0_24px_64px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] w-full ${SIZES[size]} ${size === 'screen' ? 'h-full max-h-full rounded-none' : size === 'full' ? 'rounded-t-3xl sm:rounded-3xl max-h-[96vh]' : 'rounded-t-3xl sm:rounded-3xl max-h-[92vh] sm:max-h-[85vh]'} flex flex-col ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* glow accents */}
        <div className="hidden sm:block pointer-events-none absolute -top-32 -right-24 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="hidden sm:block pointer-events-none absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-violet-600/15 blur-3xl" />
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ children, subtitle, onClose }) {
  return (
    <div className="relative z-10 flex items-start justify-between px-7 pt-6 pb-5 border-b border-white/[0.08] shrink-0">
      <div className="flex-1 text-right">
        <div className="text-xl sm:text-2xl font-black text-white leading-tight">{children}</div>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="mr-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors"
          aria-label="סגור"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children, className = '' }) {
  const hasCustomPadding = /\bp-\d|px-\d|py-\d/.test(className);
  return (
    <div className={`relative overflow-y-auto flex-1 ${hasCustomPadding ? '' : 'px-7 py-6'} ${className}`}>
      {children}
    </div>
  );
}

export function ModalFooter({ children, className = '' }) {
  return (
    <div className={`relative px-7 py-5 border-t border-white/[0.08] bg-white/[0.02] shrink-0 flex gap-3 justify-end ${className}`}>
      {children}
    </div>
  );
}
