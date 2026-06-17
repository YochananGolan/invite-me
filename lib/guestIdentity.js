import { normalizePhoneNumber } from './whatsappClient';

export function getGuestIdentityKey(guest = {}) {
  const phone = guest.phone ?? guest.guestPhone ?? guest.phoneOriginal ?? guest.phoneNormalized ?? '';
  const normalizedPhone = normalizePhoneNumber(phone);
  if (normalizedPhone) return `phone:${normalizedPhone}`;

  const firstName = String(guest.first_name ?? guest.guestFirstName ?? '').trim().toLowerCase();
  const lastName = String(guest.last_name ?? guest.guestLastName ?? '').trim().toLowerCase();
  const tableNumber = String(guest.table_number ?? guest.guestTable ?? '').trim().toLowerCase();
  return `name:${firstName}|${lastName}|${tableNumber}`;
}
