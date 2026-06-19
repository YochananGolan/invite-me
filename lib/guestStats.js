import { getGuestIdentityKey } from './guestIdentity';
import { getGuestStatusBucket } from './rsvpLabels';

export function dedupeGuestsByIdentity(guests = []) {
  const byIdentity = new Map();

  for (const guest of guests || []) {
    const key = getGuestIdentityKey(guest);
    const current = byIdentity.get(key);

    if (!current) {
      byIdentity.set(key, guest);
      continue;
    }

    const currentStatus = getGuestStatusBucket(current.status);
    const nextStatus = getGuestStatusBucket(guest.status);
    if (currentStatus === 'pending' && nextStatus !== 'pending') {
      byIdentity.set(key, guest);
    }
  }

  return Array.from(byIdentity.values());
}

const EMPTY_SPECIAL_MEALS = () => ({
  veg: { adults: 0, children: 0, total: 0 },
  vegan: { adults: 0, children: 0, total: 0 },
  glatt: { adults: 0, children: 0, total: 0 },
  allergy: { adults: 0, children: 0, total: 0 },
});

export function buildGuestRsvpStats(guests = []) {
  const dedupedGuests = dedupeGuestsByIdentity(guests);
  const summary = { approved: 0, adults: 0, children: 0 };
  const statusSummary = { approved: 0, rejected: 0, pending: 0 };
  const specialMeals = EMPTY_SPECIAL_MEALS();

  dedupedGuests.forEach((guest) => {
    const bucket = getGuestStatusBucket(guest.status);
    statusSummary[bucket] += 1;

    if (bucket !== 'approved') return;

    summary.approved += 1;
    summary.adults += guest.adults || 0;
    summary.children += guest.children || 0;
    specialMeals.veg.adults += guest.veg_adults || 0;
    specialMeals.veg.children += guest.veg_children || 0;
    specialMeals.vegan.adults += guest.vegan_adults || 0;
    specialMeals.vegan.children += guest.vegan_children || 0;
    specialMeals.glatt.adults += guest.glatt_adults || 0;
    specialMeals.glatt.children += guest.glatt_children || 0;
    specialMeals.allergy.adults += guest.allergy_adults || 0;
    specialMeals.allergy.children += guest.allergy_children || 0;
  });

  specialMeals.veg.total = specialMeals.veg.adults + specialMeals.veg.children;
  specialMeals.vegan.total = specialMeals.vegan.adults + specialMeals.vegan.children;
  specialMeals.glatt.total = specialMeals.glatt.adults + specialMeals.glatt.children;
  specialMeals.allergy.total = specialMeals.allergy.adults + specialMeals.allergy.children;

  return {
    dedupedGuests,
    summary,
    statusSummary,
    specialMeals,
    totalRsvp: statusSummary.approved + statusSummary.rejected + statusSummary.pending,
    totalApprovedGuests: summary.adults + summary.children,
  };
}
