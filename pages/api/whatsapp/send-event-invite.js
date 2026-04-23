import { createClient } from '@supabase/supabase-js';
import { sendEventWhatsAppInvites } from '../../../lib/sendEventWhatsAppInvites';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function ensureSupabaseConfigured(res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
    res.status(500).json({
      error:
        'Supabase configuration is missing (check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY).',
    });
    return false;
  }
  return true;
}

function getBearerToken(req) {
  const header = req.headers?.authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  const trimmed = token.trim();
  return trimmed || null;
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
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized: missing access token' });
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(accessToken);
  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized: invalid access token' });
  }

  if (!eventId) {
    return res.status(400).json({ error: 'eventId is required' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: ownedEvent, error: ownershipError } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (ownershipError) {
    return res.status(500).json({ error: 'Failed to validate event ownership' });
  }
  if (!ownedEvent) {
    return res.status(403).json({ error: 'Forbidden: event does not belong to current user' });
  }

  const outcome = await sendEventWhatsAppInvites(supabase, {
    eventId,
    guestId,
    guestIds,
    skipMessageCountIncrement: false,
  });

  return res.status(outcome.statusCode).json(outcome.body);
}
