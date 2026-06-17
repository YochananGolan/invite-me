import React from 'react';

export default function MobileSwipeGuestCard({
  guestName,
  initials,
  phone,
  statusMeta,
  onWhatsApp,
  onReminder,
  showActionButtons = true,
}) {
  const [offset, setOffset] = React.useState(0);
  const startXRef = React.useRef(null);
  const offsetRef = React.useRef(0);
  const swipeThreshold = 72;
  const maxOffset = 92;

  const resetSwipe = React.useCallback(() => {
    offsetRef.current = 0;
    setOffset(0);
    startXRef.current = null;
  }, []);

  const handleTouchStart = (event) => {
    startXRef.current = event.touches[0].clientX;
  };

  const handleTouchMove = (event) => {
    if (startXRef.current == null) return;
    const delta = event.touches[0].clientX - startXRef.current;
    const nextOffset = Math.max(-maxOffset, Math.min(maxOffset, delta));
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  const handleTouchEnd = () => {
    if (offsetRef.current <= -swipeThreshold) {
      onWhatsApp();
    } else if (offsetRef.current >= swipeThreshold) {
      onReminder();
    }
    resetSwipe();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 flex">
        <button
          type="button"
          onClick={onReminder}
          className="flex flex-1 items-center justify-center bg-amber-500/25 text-sm font-black text-amber-100"
        >
          ◷ תזכורת
        </button>
        <button
          type="button"
          onClick={onWhatsApp}
          className="flex flex-1 items-center justify-center bg-emerald-500/25 text-sm font-black text-emerald-100"
        >
          WhatsApp
        </button>
      </div>
      <div
        className="relative rounded-2xl border border-white/10 bg-[#12143a] px-3 py-3 transition-transform duration-150 touch-pan-y"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={resetSwipe}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-300/25 bg-violet-500/20 text-sm font-black text-violet-100">
            {initials || 'א'}
          </div>
          <div className="min-w-0 flex-1 text-right">
            <div className="truncate text-lg font-black text-white">{guestName}</div>
            <div className="mt-0.5 text-xs font-semibold text-slate-400">{phone || 'אין טלפון'}</div>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${statusMeta.className}`}>
            {statusMeta.icon} {statusMeta.label}
          </span>
        </div>
        {showActionButtons && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onReminder}
            className="rounded-xl border border-amber-300/35 bg-amber-500/[0.12] px-3 py-2 text-sm font-black text-amber-100 transition-colors active:bg-amber-500/[0.22]"
          >
            תזכורת
          </button>
          <button
            type="button"
            onClick={onWhatsApp}
            className="rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-3 py-2 text-sm font-black text-emerald-100 transition-colors active:bg-emerald-500/25"
          >
            WhatsApp
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
