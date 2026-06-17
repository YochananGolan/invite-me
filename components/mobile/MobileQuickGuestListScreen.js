import { RSVP_FILTER_LABELS, getGuestStatusMeta } from '../../lib/rsvpLabels';
import MobileFullScreenShell from './MobileFullScreenShell';
import MobileStateMessage from './MobileStateMessage';
import MobileSwipeGuestCard from './MobileSwipeGuestCard';

export const MOBILE_GUEST_LIST_PAGE_SIZE = 40;

export default function MobileQuickGuestListScreen({
  filterKey,
  filterLabel,
  listSearch,
  onListSearchChange,
  visibleGuests,
  filteredGuestsCount,
  onLoadMore,
  hasMoreGuests,
  onClose,
  onReminder,
  onWhatsApp,
}) {
  return (
    <MobileFullScreenShell
      testId="mobile-guest-list-screen"
      eyebrow="ניהול אורחים מהיר"
      title={`ראה רשימת אורחים : ${filterLabel}`}
      onClose={onClose}
      headerExtra={(
        <>
          <p className="mt-2 text-base font-semibold text-slate-300">
            {filteredGuestsCount} אורחים
            {listSearch.trim() ? ` · חיפוש: ${listSearch.trim()}` : ''}
          </p>
          <label className="sr-only" htmlFor="mobile-guest-list-search">חיפוש ברשימת אורחים</label>
          <input
            id="mobile-guest-list-search"
            type="search"
            value={listSearch}
            onChange={(event) => onListSearchChange(event.target.value)}
            placeholder="חיפוש לפי שם או נייד"
            className="mt-3 w-full rounded-full border border-white/10 bg-white/[0.055] px-4 py-2.5 text-right text-sm font-semibold text-slate-100 placeholder:text-white/85 focus:border-violet-300 focus:outline-none"
          />
        </>
      )}
    >
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {visibleGuests.length > 0 ? (
          <div className="space-y-3">
            {visibleGuests.map((guest, idx) => {
              const statusMeta = getGuestStatusMeta(guest.status);
              const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(' ') || `אורח ${idx + 1}`;
              const initials = guestName.split(' ').map((part) => part[0]).filter(Boolean).slice(0, 2).join('');
              return (
                <MobileSwipeGuestCard
                  key={`list-${guest.phone || guestName}-${idx}`}
                  guestName={guestName}
                  initials={initials}
                  phone={guest.phone}
                  statusMeta={statusMeta}
                  onReminder={onReminder}
                  onWhatsApp={() => onWhatsApp(guest.phone)}
                  showActionButtons={false}
                />
              );
            })}
            {hasMoreGuests && (
              <button
                type="button"
                onClick={onLoadMore}
                className="w-full rounded-2xl border border-violet-300/30 bg-violet-500/15 px-4 py-3 text-sm font-black text-violet-100"
              >
                {`טען עוד (${filteredGuestsCount - visibleGuests.length} נותרו)`}
              </button>
            )}
          </div>
        ) : (
          <MobileStateMessage
            variant="empty"
            title="אין אורחים להצגה"
            description={`אין אורחים במסנן «${RSVP_FILTER_LABELS[filterKey] || RSVP_FILTER_LABELS.all}». נסו לשנות את המסנן או את החיפוש.`}
          />
        )}
      </div>
    </MobileFullScreenShell>
  );
}
