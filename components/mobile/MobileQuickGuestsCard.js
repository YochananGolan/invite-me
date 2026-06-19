import {
  RSVP_STATUS_LABELS,
  RSVP_STATUS_LABELS_COMPACT,
  RSVP_FILTER_LABELS,
} from '../../lib/rsvpLabels';

export default function MobileQuickGuestsCard({
  guestStatusSummary,
  guestSummary,
  mobileMessageBalanceMetrics,
  mobileSummaryFilter,
  onSummaryFilterChange,
  mobileGuestFilterCounts,
  mobileQuickGuestSearchDraft,
  onQuickGuestSearchDraftChange,
  onQuickGuestSearchSubmit,
  onQuickGuestSearchClear,
  onOpenGuestList,
  onOpenCharts,
  showChartsButton,
  onOpenFullReports,
  showFullReportsButton,
}) {
  const activeFilterLabel = RSVP_FILTER_LABELS[mobileSummaryFilter] || RSVP_FILTER_LABELS.all;
  const activeFilterCount = mobileGuestFilterCounts[mobileSummaryFilter] ?? mobileGuestFilterCounts.all;

  return (
    <section
      id="mobile-quick-guests"
      data-testid="mobile-quick-guests"
      className="mx-auto mb-4 w-full max-w-md rounded-[1.75rem] border border-violet-300/25 bg-white/[0.06] p-4 text-right shadow-[0_14px_44px_rgba(0,0,0,0.36)] ring-1 ring-violet-400/20 backdrop-blur-2xl sm:hidden"
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-black leading-tight text-white">ניהול אורחים מהיר</h2>
        </div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/20 text-2xl shadow-[0_8px_26px_rgba(139,92,246,0.32)]">
          ◉
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-sm font-black text-violet-200">סטטוס אישורי הגעה</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            [guestStatusSummary.approved, RSVP_STATUS_LABELS.approved, 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'],
            [guestStatusSummary.pending, RSVP_STATUS_LABELS.pending, 'border-amber-400/25 bg-amber-500/[0.12] text-amber-300'],
            [guestStatusSummary.rejected, RSVP_STATUS_LABELS.rejected, 'border-rose-400/25 bg-rose-400/10 text-rose-300'],
          ].map(([value, label, tone], idx) => (
            <div
              key={`status-summary-${idx}`}
              className={`rounded-2xl border px-2 py-3 text-center ${tone}`}
            >
              <div className="text-3xl font-black leading-none tabular-nums">{value || 0}</div>
              <div className="mt-1 text-[11px] font-black text-slate-100">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 text-sm font-black text-indigo-200">סיכום מאושרים (מגיעים)</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            [guestSummary.adults, 'מבוגרים', 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'],
            [guestSummary.children, 'ילדים', 'border-orange-400/25 bg-orange-500/10 text-orange-300'],
            [guestSummary.adults + guestSummary.children, 'סה״כ', 'border-indigo-400/25 bg-indigo-500/10 text-indigo-300'],
          ].map(([value, label, tone], idx) => (
            <div
              key={`guest-summary-${idx}`}
              className={`rounded-2xl border px-2 py-3 text-center ${tone}`}
            >
              <div className="text-3xl font-black leading-none tabular-nums">{value || 0}</div>
              <div className="mt-1 text-[11px] font-black text-slate-100">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 text-sm font-black text-amber-200">יתרת הודעות</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            [mobileMessageBalanceMetrics.messageLimit, 'מגבלת הודעות', 'border-amber-400/25 bg-amber-500/10 text-amber-300'],
            [mobileMessageBalanceMetrics.messagesSent, 'נשלחו', 'border-indigo-400/25 bg-indigo-500/10 text-indigo-300'],
            [
              mobileMessageBalanceMetrics.overMessages > 0
                ? `-${mobileMessageBalanceMetrics.overMessages}`
                : mobileMessageBalanceMetrics.remainingMessages,
              mobileMessageBalanceMetrics.overMessages > 0 ? 'חריגה' : 'יתרה',
              mobileMessageBalanceMetrics.overMessages > 0
                ? 'border-rose-400/25 bg-rose-500/10 text-rose-300'
                : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300',
            ],
          ].map(([value, label, tone], idx) => (
            <div
              key={`message-balance-${idx}`}
              className={`rounded-2xl border px-2 py-3 text-center ${tone}`}
            >
              <div className="text-3xl font-black leading-none tabular-nums">{value ?? 0}</div>
              <div className="mt-1 text-[11px] font-black text-slate-100">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-4">
        <h3
          className="text-center text-xl font-black leading-snug text-violet-100"
          data-testid="mobile-guest-section-title"
        >
          צפיה וחיפוש ברשימות אורחים
        </h3>

        <div
          className="overflow-hidden rounded-2xl border-2 border-white/15 bg-white/[0.06] shadow-[0_8px_28px_rgba(0,0,0,0.22)] ring-1 ring-violet-400/20"
          data-testid="mobile-guest-search-frame"
        >
          <form
            className="flex min-w-0 items-stretch gap-2 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              onQuickGuestSearchSubmit();
            }}
          >
            <button
              type="button"
              onClick={onQuickGuestSearchClear}
              className="flex min-h-[4.75rem] shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-lg font-black text-slate-100 transition-colors active:bg-white/[0.12]"
            >
              נקה
            </button>
            <label className="sr-only" htmlFor="mobile-quick-guest-search">חיפוש אורח</label>
            <div className="relative flex min-h-[4.75rem] min-w-0 flex-1 items-center">
              {!mobileQuickGuestSearchDraft && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm font-semibold text-white"
                >
                  חפש אורח לפי שם או נייד
                </span>
              )}
              <input
                id="mobile-quick-guest-search"
                type="search"
                value={mobileQuickGuestSearchDraft}
                onChange={(event) => onQuickGuestSearchDraftChange(event.target.value)}
                placeholder=""
                className="h-full w-full border-0 bg-transparent px-2 text-right text-sm font-semibold text-slate-100 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              data-testid="mobile-guest-search-submit"
              className="flex min-h-[4.75rem] shrink-0 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-5 text-2xl font-black leading-tight text-emerald-100 shadow-[0_2px_10px_rgba(16,185,129,0.25)] transition-all active:opacity-85"
            >
              חפש
            </button>
          </form>
        </div>

        <div
          className="overflow-hidden rounded-2xl border-2 border-white/15 bg-white/[0.06] shadow-[0_8px_28px_rgba(0,0,0,0.22)] ring-1 ring-violet-400/20"
          data-testid="mobile-guest-filter-frame"
        >
          <div className="px-4 pb-4 pt-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                ['all', RSVP_FILTER_LABELS.all],
                ['approved', RSVP_STATUS_LABELS_COMPACT.approved],
                ['pending', RSVP_STATUS_LABELS.pending],
                ['rejected', RSVP_STATUS_LABELS.rejected],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  data-testid={`mobile-guest-filter-pill-${key}`}
                  onClick={() => onSummaryFilterChange(key)}
                  className={`min-h-[4.25rem] rounded-full border px-2 py-3.5 text-center transition-all ${
                    mobileSummaryFilter === key
                      ? 'border-amber-300/70 bg-amber-500/30 text-white'
                      : 'border-white/10 bg-white/[0.04] text-slate-300'
                  }`}
                >
                  <span className="block text-base font-black leading-tight">{label}</span>
                  <span className="mt-1 block text-sm font-bold tabular-nums opacity-95">
                    {mobileGuestFilterCounts[key] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenGuestList}
            className="relative flex min-h-[4.75rem] w-full items-center justify-center rounded-none border-0 border-t border-white/10 bg-violet-500/15 px-5 py-4 text-center text-2xl font-black leading-tight text-violet-100 transition-colors active:bg-violet-500/25"
            data-testid="mobile-open-guest-list"
          >
            {`ראה רשימת אורחים : ${activeFilterLabel} (${activeFilterCount})`}
          </button>
        </div>
      </div>

      {showChartsButton && (
        <button
          type="button"
          style={{ cursor: 'pointer', position: 'relative', zIndex: 21, pointerEvents: 'auto' }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenCharts();
          }}
          className="mt-3 relative flex min-h-[4.75rem] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-indigo-400/40 bg-indigo-500/15 py-4 px-5 text-center text-indigo-200 shadow-[0_2px_10px_rgba(99,102,241,0.25)] transition-all"
          data-testid="mobile-open-charts"
        >
          <span className="text-center text-2xl font-black leading-tight">הצג גרפים</span>
        </button>
      )}

      <p className="mt-2 text-center text-[11px] font-semibold text-slate-400">
        החליקו על כרטיס אורח ימינה לתזכורת או שמאלה ל-WhatsApp
      </p>

      {showFullReportsButton && (
        <button
          type="button"
          onClick={onOpenFullReports}
          className="mt-3 w-full rounded-2xl border border-violet-300/30 bg-violet-500/15 px-4 py-3 text-base font-black text-violet-100 transition-colors active:bg-violet-500/25"
        >
          פתח דוחות לכל האורחים
        </button>
      )}
    </section>
  );
}
