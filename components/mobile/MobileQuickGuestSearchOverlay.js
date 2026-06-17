import { getGuestIdentityKey } from '../../lib/guestIdentity';
import { getGuestStatusMeta } from '../../lib/rsvpLabels';
import MobileBackHandler from './MobileBackHandler';
import MobileSwipeGuestCard from './MobileSwipeGuestCard';

export default function MobileQuickGuestSearchOverlay({
  searchQuery,
  searchResults,
  selectedGuestKey,
  onSelectGuest,
  targetGuest,
  onBack,
  onReminderFlow,
  onReminderForGuest,
  onWhatsApp,
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-[#08091a] sm:hidden"
      dir="rtl"
      data-testid="mobile-guest-search-screen"
    >
      <MobileBackHandler onClose={onBack} />
      <div className="shrink-0 border-b border-white/10 bg-[#0d0f2b]/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="text-sm font-black text-violet-200">ניהול אורחים מהיר</div>
        <h2 className="mt-1 text-3xl font-black text-white">תוצאות חיפוש</h2>
        {searchQuery ? (
          <p className="mt-2 text-base font-semibold text-slate-300">
            חיפוש עבור: <span className="text-white">{searchQuery}</span>
          </p>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {searchQuery ? (
          searchResults.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-black text-slate-400">
                נמצאו {searchResults.length} אורחים
              </div>
              {searchResults.length > 1 && (
                <p className="text-xs font-semibold text-violet-200">
                  לחצו על אורח לבחירה לפני שליחת תזכורת או WhatsApp
                </p>
              )}
              {searchResults.map((guest, idx) => {
                const guestKey = getGuestIdentityKey(guest);
                const isSelected = selectedGuestKey === guestKey;
                const statusMeta = getGuestStatusMeta(guest.status);
                const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(' ') || `אורח ${idx + 1}`;
                const initials = guestName.split(' ').map((part) => part[0]).filter(Boolean).slice(0, 2).join('');
                return (
                  <div
                    key={`search-${guestKey}-${idx}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectGuest(guestKey)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectGuest(guestKey);
                      }
                    }}
                    className={`block w-full rounded-2xl text-right transition-all ${
                      isSelected
                        ? 'ring-2 ring-violet-400/80 ring-offset-2 ring-offset-[#08091a]'
                        : 'ring-1 ring-transparent'
                    }`}
                  >
                    <MobileSwipeGuestCard
                      guestName={guestName}
                      initials={initials}
                      phone={guest.phone}
                      statusMeta={statusMeta}
                      onReminder={onReminderFlow}
                      onWhatsApp={() => onWhatsApp(guest.phone)}
                      showActionButtons={false}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-6 py-12 text-center">
              <div className="text-5xl">🔍</div>
              <div className="mt-4 text-2xl font-black text-white">לא נמצאו תוצאות</div>
              <p className="mt-3 max-w-xs text-base font-semibold leading-7 text-slate-400">
                לא נמצא אורח עם השם או מספר הנייד שהוזנו. בדקו שהמספר מלא ונכון, או שנו את מסנן הסטטוס.
              </p>
            </div>
          )
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-6 py-12 text-center">
            <div className="text-5xl">✎</div>
            <div className="mt-4 text-2xl font-black text-white">הזינו שם או מספר נייד</div>
            <p className="mt-3 max-w-xs text-base font-semibold leading-7 text-slate-400">
              לאחר מילוי השדה לחצו על «חפש».
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-[#0d0f2b]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
        {searchQuery && searchResults.length > 0 && targetGuest && (
          <>
            {searchResults.length > 1 && (
              <p className="mb-2 text-center text-xs font-semibold text-slate-400">
                נבחר:{' '}
                <span className="font-black text-white">
                  {[targetGuest.first_name, targetGuest.last_name]
                    .filter(Boolean)
                    .join(' ') || 'אורח'}
                </span>
              </p>
            )}
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onReminderForGuest(targetGuest)}
                className="rounded-2xl border border-amber-300/35 bg-amber-500/[0.12] px-3 py-3.5 text-base font-black text-amber-100 transition-colors active:bg-amber-500/[0.22]"
              >
                שלח תזכורת
              </button>
              <button
                type="button"
                onClick={() => onWhatsApp(targetGuest.phone)}
                className="rounded-2xl border border-emerald-300/35 bg-emerald-500/15 px-3 py-3.5 text-base font-black text-emerald-100 transition-colors active:bg-emerald-500/25"
              >
                WhatsApp
              </button>
            </div>
          </>
        )}
        <button
          type="button"
          onClick={onBack}
          data-testid="mobile-guest-search-back"
          className="w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-4 text-lg font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.28)] transition-opacity active:opacity-85"
        >
          חזור
        </button>
      </div>
    </div>
  );
}
