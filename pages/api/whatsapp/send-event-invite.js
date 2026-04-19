import { createClient } from '@supabase/supabase-js';
import { sendEventWhatsAppInvites } from '../../../lib/sendEventWhatsAppInvites';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ensureSupabaseConfigured(res)) {
    return;
  }

  const { eventId, guestId, guestIds } = req.body || {};
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const outcome = await sendEventWhatsAppInvites(supabase, {
    eventId,
    guestId,
    guestIds,
    skipMessageCountIncrement: false,
  });

  return res.status(outcome.statusCode).json(outcome.body);
}
