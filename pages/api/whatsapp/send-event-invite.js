import { createClient } from '@supabase/supabase-js';
import { getInviteBaseUrl } from '../../../lib/inviteUrl';
import { sendWhatsAppTextMessage, normalizePhoneNumber } from '../../../lib/whatsappClient';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function ensureSupabaseConfigured(res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    res.status(500).json({
      error: 'Supabase service configuration is missing (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).',
    });
    return false;
  }
  return true;
}

function parseEventDetails(eventDetails) {
  if (!eventDetails) return {};
  if (typeof eventDetails === 'string') {
    try {
      return JSON.parse(eventDetails);
    } catch (err) {
      console.warn('[whatsapp] Failed to parse event_details JSON:', err);
      return {};
    }
  }
  return eventDetails;
}

function buildGuestMessage({ guest, eventDetails, eventId }) {
  const inviteBase = getInviteBaseUrl();
  const inviteLink = `${inviteBase}/${eventId}/${guest.id}`;

  const customText = eventDetails?.custom_invitation_text || eventDetails?.customEventDescription || '';
  const eventDateRaw = eventDetails?.date || eventDetails?.event_date;
  let formattedDate = eventDateRaw || '';
  if (eventDateRaw) {
    try {
      const parsed = new Date(eventDateRaw);
      if (!Number.isNaN(parsed.getTime())) {
        formattedDate = parsed.toLocaleDateString('he-IL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
    } catch (err) {
      formattedDate = eventDateRaw;
    }
  }

  const parts = [
    guest.first_name ? `היי ${guest.first_name}!` : 'שלום!',
    customText || undefined,
    formattedDate ? `תאריך האירוע: ${formattedDate}` : undefined,
    eventDetails?.time ? `שעה: ${eventDetails.time}` : undefined,
    eventDetails?.hallName ? `מקום האירוע: ${eventDetails.hallName}` : undefined,
    `קישור לאישור הגעה: ${inviteLink}`,
  ].filter(Boolean);

  return parts.join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ensureSupabaseConfigured(res)) {
    return;
  }

  const { eventId } = req.body || {};

  if (!eventId) {
    return res.status(400).json({ error: 'eventId is required' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, event_details')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError || !event) {
    console.error('[whatsapp] Failed to fetch event', eventError);
    return res.status(404).json({ error: 'Event not found' });
  }

  const { data: guests, error: guestsError } = await supabase
    .from('invited_guests')
    .select('id, phone, first_name, last_name')
    .eq('event_id', eventId);

  if (guestsError) {
    console.error('[whatsapp] Failed to fetch guests', guestsError);
    return res.status(500).json({ error: 'Failed to fetch guests' });
  }

  const guestsWithPhone = (guests || []).filter((guest) => normalizePhoneNumber(guest.phone));

  if (guestsWithPhone.length === 0) {
    return res.status(200).json({
      sent: 0,
      failed: [],
      skipped: guests?.length || 0,
      message: 'No guests with valid phone numbers to send WhatsApp invitations.',
    });
  }

  const eventDetails = parseEventDetails(event.event_details);
  const results = [];

  for (const guest of guestsWithPhone) {
    const body = buildGuestMessage({ guest, eventDetails, eventId });
    const sendResult = await sendWhatsAppTextMessage({ to: guest.phone, body });
    results.push({
      guestId: guest.id,
      phone: guest.phone,
      ok: sendResult.ok,
      error: sendResult.ok ? null : sendResult.error,
      status: sendResult.status,
    });
  }

  const sentCount = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  return res.status(200).json({
    sent: sentCount,
    failed,
    total: results.length,
  });
}
