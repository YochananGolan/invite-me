/**
 * Archives events whose calendar date is before today (Asia/Jerusalem).
 * Vercel Cron + optional manual POST with CRON_SECRET.
 */
import { createClient } from '@supabase/supabase-js';
import { archiveEndedEvents } from '../../lib/archiveEndedEvents';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const result = await archiveEndedEvents(supabase);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('archive-ended-events failed', e);
    return res.status(500).json({ error: 'Failed to archive ended events' });
  }
}
