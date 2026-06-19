import { getGuestIdentityKey } from './guestIdentity';
import { getGuestStatusBucket } from './rsvpLabels';

const STATUS_PRIORITY = { approved: 3, rejected: 2, pending: 1 };

function guestStatusRank(status) {
  return STATUS_PRIORITY[getGuestStatusBucket(status)] ?? 0;
}

function pickPreferredGuestRecord(current, next) {
  const currentRank = guestStatusRank(current?.status);
  const nextRank = guestStatusRank(next?.status);
  if (nextRank !== currentRank) {
    return nextRank > currentRank ? next : current;
  }

  const currentUpdated = Date.parse(current?.updated_at || current?.created_at || '') || 0;
  const nextUpdated = Date.parse(next?.updated_at || next?.created_at || '') || 0;
  if (nextUpdated !== currentUpdated) {
    return nextUpdated > currentUpdated ? next : current;
  }

  const currentHeadcount = (current?.adults || 0) + (current?.children || 0);
  const nextHeadcount = (next?.adults || 0) + (next?.children || 0);
  return nextHeadcount >= currentHeadcount ? next : current;
}

export function dedupeGuestsByIdentity(guests = []) {
  const byIdentity = new Map();

  for (const guest of guests || []) {
    const key = getGuestIdentityKey(guest);
    const current = byIdentity.get(key);

    if (!current) {
      byIdentity.set(key, guest);
      continue;
    }

    byIdentity.set(key, pickPreferredGuestRecord(current, guest));
  }

  return Array.from(byIdentity.values());
}

export function filterGuestsByStatusBucket(guests = [], bucket) {
  return dedupeGuestsByIdentity(guests).filter(
    (guest) => getGuestStatusBucket(guest.status) === bucket,
  );
}

function compareTableNumbers(a, b) {
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
  if (!Number.isNaN(numA)) return -1;
  if (!Number.isNaN(numB)) return 1;
  if (a === 'ללא שולחן') return 1;
  if (b === 'ללא שולחן') return -1;
  return String(a).localeCompare(String(b), 'he');
}

export function buildTableSummaryFromGuests(guests = []) {
  const approvedGuests = filterGuestsByStatusBucket(guests, 'approved');
  const groupedByTable = {};

  approvedGuests.forEach((guest) => {
    const table = guest.table_number || 'ללא שולחן';
    if (!groupedByTable[table]) groupedByTable[table] = [];
    groupedByTable[table].push(guest);
  });

  return Object.keys(groupedByTable)
    .sort(compareTableNumbers)
    .map((table) => {
      const tableGuests = groupedByTable[table];
      const adults = tableGuests.reduce((sum, guest) => sum + (guest.adults || 0), 0);
      const children = tableGuests.reduce((sum, guest) => sum + (guest.children || 0), 0);
      return {
        table_number: table,
        adults,
        children,
        total: adults + children,
      };
    });
}

export function buildApprovedGuestsByTableReportRows(guests = []) {
  const approvedGuests = [...filterGuestsByStatusBucket(guests, 'approved')].sort((a, b) => (
    compareTableNumbers(a.table_number || 'ללא שולחן', b.table_number || 'ללא שולחן')
  ));

  const groupedByTable = {};
  approvedGuests.forEach((guest) => {
    const table = guest.table_number || 'ללא שולחן';
    if (!groupedByTable[table]) groupedByTable[table] = [];
    groupedByTable[table].push(guest);
  });

  const rows = [];
  Object.keys(groupedByTable)
    .sort(compareTableNumbers)
    .forEach((table) => {
      const tableGuests = groupedByTable[table];
      tableGuests.forEach((guest) => rows.push(guest));

      const tableTotalAdults = tableGuests.reduce((sum, guest) => sum + (guest.adults || 0), 0);
      const tableTotalChildren = tableGuests.reduce((sum, guest) => sum + (guest.children || 0), 0);
      const tableTotalVeg = tableGuests.reduce((sum, guest) => sum + (guest.veg_adults || 0) + (guest.veg_children || 0), 0);
      const tableTotalVegan = tableGuests.reduce((sum, guest) => sum + (guest.vegan_adults || 0) + (guest.vegan_children || 0), 0);
      const tableTotalGlatt = tableGuests.reduce((sum, guest) => sum + (guest.glatt_adults || 0) + (guest.glatt_children || 0), 0);
      const tableTotalCeliac = tableGuests.reduce((sum, guest) => sum + (guest.celiac_adults || 0) + (guest.celiac_children || 0), 0);
      const tableTotalAllergy = tableGuests.reduce((sum, guest) => sum + (guest.allergy_adults || 0) + (guest.allergy_children || 0), 0);

      rows.push({
        isSummary: true,
        table_number: table,
        summary_label: `סה"כ שולחן ${table}`,
        adults: tableTotalAdults,
        children: tableTotalChildren,
        total: tableTotalAdults + tableTotalChildren,
        veg: tableTotalVeg,
        vegan: tableTotalVegan,
        glatt: tableTotalGlatt,
        celiac: tableTotalCeliac,
        allergy: tableTotalAllergy,
      });
    });

  return rows;
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
    tableSummary: buildTableSummaryFromGuests(guests),
    totalRsvp: statusSummary.approved + statusSummary.rejected + statusSummary.pending,
    totalApprovedGuests: summary.adults + summary.children,
  };
}
