/**
 * Public API for guest RSVP - uses service role to bypass RLS.
 * Allows unauthenticated guests to view and update their RSVP.
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const eventId = req.query.eventId || req.body?.eventId;
  const guestId = req.query.guestId || req.body?.guestId;

  if (!eventId || !guestId) {
    return res.status(400).json({ error: 'Missing eventId or guestId' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  // Prefer service role to bypass RLS (guests are unauthenticated)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

  const supabase = createClient(supabaseUrl, key);

  if (req.method === 'GET') {
    try {
      const { data: guest, error: guestErr } = await supabase
        .from('invited_guests')
        .select('*')
        .eq('id', guestId)
        .eq('event_id', eventId)
        .single();

      if (guestErr || !guest) {
        return res.status(404).json({ error: 'Guest not found' });
      }

      const { data: ev, error: evErr } = await supabase
        .from('events')
        .select('invitation_path, event_details')
        .eq('id', eventId)
        .single();

      if (evErr) {
        return res.status(500).json({ error: 'Failed to load event' });
      }

      // Build invitation image URL
      let invitationUrl = '';
      const eventDetails = (() => {
        const ed = ev?.event_details;
        if (!ed) return {};
        try {
          return typeof ed === 'string' ? JSON.parse(ed) : ed;
        } catch {
          return {};
        }
      })();

      if (ev?.invitation_path) {
        if (ev.invitation_path.startsWith('http')) {
          invitationUrl = ev.invitation_path;
        } else {
          const { data: urlData } = supabase.storage.from('invites').getPublicUrl(ev.invitation_path);
          invitationUrl = urlData.publicUrl + (urlData.publicUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        }
      } else if (eventDetails?.template_src) {
        const t = eventDetails.template_src;
        invitationUrl = t.startsWith('http') ? t : (t.startsWith('/') ? t : '/' + t);
      }

      return res.status(200).json({
        guest,
        event: ev || {},
        eventDetails,
        invitationUrl,
      });
    } catch (e) {
      console.error('[guest-rsvp] GET error:', e);
      return res.status(500).json({ error: 'Failed to load data' });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const {
      status,
      adults = 0,
      children = 0,
      veg_adults = 0,
      veg_children = 0,
      vegan_adults = 0,
      vegan_children = 0,
      glatt_adults = 0,
      glatt_children = 0,
      celiac_adults = 0,
      celiac_children = 0,
      allergy_adults = 0,
      allergy_children = 0,
      allergy_note = '',
    } = body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    try {
      const updatePayload = {
        status,
        adults: Number(adults) || 0,
        children: Number(children) || 0,
        veg_adults: Number(veg_adults) || 0,
        veg_children: Number(veg_children) || 0,
        vegan_adults: Number(vegan_adults) || 0,
        vegan_children: Number(vegan_children) || 0,
        glatt_adults: Number(glatt_adults) || 0,
        glatt_children: Number(glatt_children) || 0,
        celiac_adults: Number(celiac_adults) || 0,
        celiac_children: Number(celiac_children) || 0,
        allergy_adults: Number(allergy_adults) || 0,
        allergy_children: Number(allergy_children) || 0,
        allergy_note: String(allergy_note || '').trim(),
      };

      const { data, error } = await supabase
        .from('invited_guests')
        .update(updatePayload)
        .eq('id', guestId)
        .eq('event_id', eventId)
        .select('id, status')
        .single();

      if (error) {
        console.error('[guest-rsvp] UPDATE error:', error);
        return res.status(500).json({ error: 'Failed to save' });
      }

      return res.status(200).json({ success: true, data });
    } catch (e) {
      console.error('[guest-rsvp] POST error:', e);
      return res.status(500).json({ error: 'Failed to save' });
    }
  }
}
