import { useMobileOverlayBack } from './useMobileOverlayBack';

export default function MobileFullScreenShell({
  testId,
  eyebrow,
  title,
  onClose,
  closeLabel = 'חזור',
  headerExtra,
  children,
}) {
  useMobileOverlayBack(true, onClose);

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-[#08091a] sm:hidden"
      dir="rtl"
      data-testid={testId}
    >
      <div className="shrink-0 border-b border-white/10 bg-[#0d0f2b]/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        {eyebrow && <div className="text-sm font-black text-indigo-200">{eyebrow}</div>}
        <h2 className="mt-1 text-3xl font-black text-white">{title}</h2>
        {headerExtra}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      <div className="shrink-0 border-t border-white/10 bg-[#0d0f2b]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
        <button
          type="button"
          onClick={onClose}
          data-testid={`${testId}-close`}
          className="w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-4 text-lg font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.28)] transition-opacity active:opacity-85"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
