import { createClient } from '@supabase/supabase-js';
import { findWhatsAppGroupByName } from '../../../lib/whatsappClient';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function getBearerToken(req) {
  const header = req.headers?.authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  return token?.trim() || null;
}

function parseEventDetails(event) {
  try {
    return typeof event?.event_details === 'string'
      ? JSON.parse(event.event_details || '{}')
      : event?.event_details || {};
  } catch {
    return {};
  }
}

function formatEventGroupName(event) {
  const details = parseEventDetails(event);
  const fallbackGroupName = String(details?.whatsapp_group?.groupName || '').trim();
  if (fallbackGroupName) return fallbackGroupName.slice(0, 100);

  const names = [
    details.brideName && details.groomName ? `${details.brideName} ו${details.groomName}` : '',
    details.birthdayName,
    details.businessName,
    details.hostName,
    event?.event_type,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return `קבוצת וואטסאפ - ${names[0] || 'אירוע'}`.slice(0, 100);
}

function getStoredGroup(event) {
  const details = parseEventDetails(event);
  const fallbackGroup = details?.whatsapp_group || {};
  return {
    groupId: event?.whatsapp_group_id || fallbackGroup.groupId || null,
    groupInviteLink: event?.whatsapp_group_invite_link || fallbackGroup.groupInviteLink || null,
    groupName: event?.whatsapp_group_name || fallbackGroup.groupName || null,
  };
}

async function persistGroupMetadata(supabase, event, metadata) {
  const details = parseEventDetails(event);
  const nextDetails = {
    ...details,
    whatsapp_group: {
      groupId: metadata.groupId,
      groupInviteLink: metadata.groupInviteLink || null,
      groupName: metadata.groupName,
    },
  };

  const { error } = await supabase
    .from('events')
    .update({
      whatsapp_group_id: metadata.groupId,
      whatsapp_group_invite_link: metadata.groupInviteLink || null,
      whatsapp_group_name: metadata.groupName,
      event_details: nextDetails,
    })
    .eq('id', event.id);

  if (error) {
    console.warn('[greenapi-group-status] Failed to persist discovered group', error);
  }

  return !error;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase configuration is missing' });
  }

  const eventId = String(req.query?.eventId || '').trim();
  if (!eventId) {
    return res.status(400).json({ error: 'eventId is required' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, user_id, event_type, event_details, whatsapp_group_id, whatsapp_group_invite_link, whatsapp_group_name')
    .eq('id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (eventError) {
    return res.status(500).json({ error: 'Failed to load event' });
  }

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const storedGroup = getStoredGroup(event);
  if (storedGroup.groupId) {
    return res.status(200).json({ hasGroup: true, recovered: false, ...storedGroup });
  }

  const expectedName = formatEventGroupName(event);
  const foundGroup = await findWhatsAppGroupByName({ groupName: expectedName });

  if (!foundGroup.ok || !foundGroup.groupId) {
    return res.status(200).json({
      hasGroup: false,
      recovered: false,
      expectedName,
      reason: foundGroup.status || 'not_found',
    });
  }

  const metadata = {
    groupId: foundGroup.groupId,
    groupInviteLink: foundGroup.groupInviteLink || null,
    groupName: foundGroup.groupName || expectedName,
  };
  await persistGroupMetadata(supabase, event, metadata);

  return res.status(200).json({ hasGroup: true, recovered: true, ...metadata });
}
