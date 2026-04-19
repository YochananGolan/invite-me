import { createClient } from '@supabase/supabase-js';
import { sendEventWhatsAppInvites } from '../../../lib/sendEventWhatsAppInvites';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Dev-only: run the same WhatsApp invite pipeline as /api/greenapi/send-event-invite
 * (event + guests from DB, buildGuestMessage, Green/Meta sendWhatsAppTextMessage),
 * but skip increment_event_messages_sent so tests do not inflate quotas.
 *
 * WHATSAPP_DEV_TEST_ENABLED=1, WHATSAPP_DEV_TEST_SECRET=...
 * POST JSON: { "secret": "...", "eventId": "uuid", "guestIds"?: [], "guestId"?: "uuid" }
 * Omit guestIds/guestId to send to all guests with phones (same as triggerWhatsAppInvites).
 */

function isDevTestEnabled() {
  const v = String(process.env.WHATSAPP_DEV_TEST_ENABLED || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isDevTestEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  const expectedSecret = String(process.env.WHATSAPP_DEV_TEST_SECRET || '').trim();
  if (!expectedSecret) {
    return res.status(503).json({
      error: 'WHATSAPP_DEV_TEST_SECRET is not set. Refusing dev send for safety.',
    });
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const providedSecret =
    typeof body.secret === 'string' ? body.secret : typeof body.devSecret === 'string' ? body.devSecret : '';

  if (providedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Invalid or missing secret' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({
      error: 'Supabase service configuration is missing (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).',
    });
  }

  const { eventId, guestId, guestIds } = body;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const outcome = await sendEventWhatsAppInvites(supabase, {
    eventId,
    guestId,
    guestIds,
    skipMessageCountIncrement: true,
  });

  return res.status(outcome.statusCode).json(outcome.body);
}
