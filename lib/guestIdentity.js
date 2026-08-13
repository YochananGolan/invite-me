import { normalizePhoneNumber } from './whatsappClient';

export function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function joinFullName(firstName, lastName) {
  return [firstName, lastName]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
}

export function getGuestIdentityKey(guest = {}) {
  const phone = guest.phone ?? guest.guestPhone ?? guest.phoneOriginal ?? guest.phoneNormalized ?? '';
  const normalizedPhone = normalizePhoneNumber(phone);
  if (normalizedPhone) return `phone:${normalizedPhone}`;

  const fullName = String(
    guest.guestFullName
    ?? joinFullName(
      guest.first_name ?? guest.guestFirstName,
      guest.last_name ?? guest.guestLastName,
    ),
  ).trim().toLowerCase();
  const tableNumber = String(guest.table_number ?? guest.guestTable ?? '').trim().toLowerCase();
  return `name:${fullName}|${tableNumber}`;
}
