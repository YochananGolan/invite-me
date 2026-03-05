/**
 * Server-side fetch for guest RSVP data. Uses service role to bypass RLS.
 * Used by getServerSideProps and API.
 */
import { createClient } from '@supabase/supabase-js';

export async function fetchGuestRsvpData(eventId, guestId) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { error: 'Server not configured' };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: guest, error: guestErr } = await supabase
    .from('invited_guests')
    .select('*')
    .eq('id', guestId)
    .eq('event_id', eventId)
    .single();

  if (guestErr || !guest) {
    return { error: 'Guest not found' };
  }

  const { data: ev, error: evErr } = await supabase
    .from('events')
    .select('invitation_path, event_details')
    .eq('id', eventId)
    .single();

  if (evErr) {
    return { error: 'Failed to load event' };
  }

  const eventDetails = (() => {
    const ed = ev?.event_details;
    if (!ed) return {};
    try {
      return typeof ed === 'string' ? JSON.parse(ed) : ed;
    } catch {
      return {};
    }
  })();

  let invitationUrl = '';
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

  return { guest, eventDetails, invitationUrl };
}
