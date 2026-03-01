import { createClient } from '@supabase/supabase-js';
import { sendSmsToGuests } from '../../lib/activeTrailSms';

async function atomicIncrement(supabase, eventId, delta) {
  // 1) Try the dedicated RPC (truly atomic at DB level)
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('increment_event_messages_sent', {
    p_event_id: eventId,
    p_delta: delta,
  });

  if (!rpcErr && typeof rpcResult === 'number') {
    return rpcResult;
  }

  // 2) Optimistic-locking fallback: read current, write with WHERE check, retry on conflict
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: evRow } = await supabase
      .from('events')
      .select('messages_sent_count')
      .eq('id', eventId)
      .single();

    const current = evRow?.messages_sent_count ?? 0;
    const newCount = current + delta;

    // Only update if the DB value still matches what we read (optimistic lock)
    const { data: updated } = await supabase
      .from('events')
      .update({ messages_sent_count: newCount })
      .eq('id', eventId)
      .eq('messages_sent_count', current)
      .select('messages_sent_count')
      .single();

    if (updated && typeof updated.messages_sent_count === 'number') {
      return updated.messages_sent_count;
    }

    // Another request changed the value between our read and write; wait briefly and retry
    await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
  }

  // All retries failed; force-write as last resort
  const { data: evRow } = await supabase
    .from('events')
    .select('messages_sent_count')
    .eq('id', eventId)
    .single();
  const current = evRow?.messages_sent_count ?? 0;
  const newCount = current + delta;
  await supabase.from('events').update({ messages_sent_count: newCount }).eq('id', eventId);
  return newCount;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { guests, message, eventId } = req.body || {};

  if (!guests || !Array.isArray(guests) || guests.length === 0) {
    return res.status(400).json({ error: 'Missing guests array' });
  }

  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

  try {
    const { sent, failed, results, errors } = await sendSmsToGuests(guests, message, 'Invitation SMS');

    let updatedMessagesSentCount = null;

    if (sent > 0 && eventId) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          updatedMessagesSentCount = await atomicIncrement(supabase, eventId, sent);
        }
      } catch (dbErr) {
        console.error('send-sms: failed to update messages_sent_count', dbErr);
      }
    }

    return res.status(200).json({
      success: failed === 0,
      sent,
      failed,
      results,
      errors,
      updatedMessagesSentCount,
    });
  } catch (err) {
    console.error('send-sms error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send SMS' });
  }
}
