import { createClient } from '@supabase/supabase-js';
import {
  addWhatsAppGroupParticipant,
  createWhatsAppGroup,
  normalizePhoneNumber,
} from '../../../lib/whatsappClient';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const GROUP_ADD_GAP_MS = Math.max(0, Number(process.env.WHATSAPP_GREENAPI_GROUP_ADD_GAP_MS || 700));

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

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatEventGroupName(event, requestedName) {
  const cleanRequested = String(requestedName || '').trim();
  if (cleanRequested) return cleanRequested.slice(0, 100);

  const details =
    typeof event?.event_details === 'string'
      ? (() => {
          try {
            return JSON.parse(event.event_details);
          } catch {
            return {};
          }
        })()
      : event?.event_details || {};

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

function isMissingColumnError(error) {
  const msg = `${error?.message || ''} ${error?.details || ''}`;
  return error?.code === '42703' || msg.includes('whatsapp_group_');
}

async function loadOwnedEvent(supabase, eventId, userId) {
  const fullSelect =
    'id, user_id, event_type, event_details, whatsapp_group_id, whatsapp_group_invite_link, whatsapp_group_name';
  const fullResult = await supabase
    .from('events')
    .select(fullSelect)
    .eq('id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!fullResult.error || !isMissingColumnError(fullResult.error)) {
    return { ...fullResult, supportsGroupColumns: true };
  }

  const fallbackResult = await supabase
    .from('events')
    .select('id, user_id, event_type, event_details')
    .eq('id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  return { ...fallbackResult, supportsGroupColumns: false };
}

async function persistGroupMetadata(supabase, eventId, metadata, supportsGroupColumns) {
  if (!supportsGroupColumns) return false;

  const { error } = await supabase
    .from('events')
    .update({
      whatsapp_group_id: metadata.groupId,
      whatsapp_group_invite_link: metadata.groupInviteLink || null,
      whatsapp_group_name: metadata.groupName,
    })
    .eq('id', eventId);

  if (error) {
    console.warn('[greenapi-group] Failed to persist group metadata', error);
    return false;
  }

  return true;
}

function uniqueGuestsWithPhones(guests = []) {
  const seenPhones = new Set();
  const result = [];

  for (const guest of guests || []) {
    const normalized = normalizePhoneNumber(guest?.phone);
    if (!normalized || seenPhones.has(normalized)) continue;
    seenPhones.add(normalized);
    result.push({
      guestId: guest.id,
      firstName: guest.first_name || '',
      lastName: guest.last_name || '',
      tableNumber: guest.table_number || '',
      phoneOriginal: guest.phone,
      phoneNormalized: normalized,
    });
  }

  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ensureSupabaseConfigured(res)) {
    return;
  }

  const { eventId, groupName, guestIds } = req.body || {};
  if (!eventId) {
    return res.status(400).json({ error: 'eventId is required' });
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized: missing access token' });
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(accessToken);

  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized: invalid access token' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: event, error: eventError, supportsGroupColumns } = await loadOwnedEvent(
    supabase,
    eventId,
    user.id,
  );

  if (eventError) {
    return res.status(500).json({ error: 'Failed to validate event ownership' });
  }
  if (!event) {
    return res.status(403).json({ error: 'Forbidden: event does not belong to current user' });
  }

  let guestQuery = supabase
    .from('invited_guests')
    .select('id, first_name, last_name, phone, table_number')
    .eq('event_id', eventId);

  if (Array.isArray(guestIds) && guestIds.length > 0) {
    guestQuery = guestQuery.in('id', guestIds);
  }

  const { data: guests, error: guestsError } = await guestQuery;
  if (guestsError) {
    return res.status(500).json({ error: 'Failed to fetch guests' });
  }

  const targetGuests = uniqueGuestsWithPhones(guests);
  if (targetGuests.length === 0) {
    return res.status(200).json({
      created: false,
      reused: Boolean(event.whatsapp_group_id),
      added: 0,
      failed: [],
      skipped: (guests || []).length,
      message: 'No guests with valid WhatsApp phone numbers were found.',
      supportsGroupColumns,
    });
  }

  const cleanGroupName = formatEventGroupName(event, groupName);
  let groupId = event.whatsapp_group_id || null;
  let groupInviteLink = event.whatsapp_group_invite_link || null;
  let created = false;
  const results = [];
  const failed = [];

  if (!groupId) {
    const createResult = await createWhatsAppGroup({
      groupName: cleanGroupName,
      phones: targetGuests.map((guest) => guest.phoneNormalized),
    });

    if (!createResult.ok) {
      return res.status(502).json({
        error: createResult.error || 'Failed to create WhatsApp group',
        status: createResult.status,
        data: createResult.data,
        created: false,
        added: 0,
        failed: targetGuests.map((guest) => ({
          ...guest,
          ok: false,
          error: createResult.error || 'Failed to create WhatsApp group',
        })),
        supportsGroupColumns,
      });
    }

    created = true;
    groupId = createResult.groupId;
    groupInviteLink = createResult.groupInviteLink || null;
    await persistGroupMetadata(
      supabase,
      eventId,
      { groupId, groupInviteLink, groupName: cleanGroupName },
      supportsGroupColumns,
    );

    for (const guest of targetGuests) {
      results.push({
        ...guest,
        ok: true,
        status: 'created_with_group',
        participantChatId: `${guest.phoneNormalized}@c.us`,
      });
    }
  } else {
    for (let i = 0; i < targetGuests.length; i += 1) {
      if (i > 0) {
        await sleep(GROUP_ADD_GAP_MS);
      }
      const guest = targetGuests[i];
      const addResult = await addWhatsAppGroupParticipant({
        groupId,
        phone: guest.phoneNormalized,
      });
      const entry = {
        ...guest,
        ok: addResult.ok,
        status: addResult.status,
        error: addResult.ok ? null : addResult.error,
        participantChatId: addResult.participantChatId || `${guest.phoneNormalized}@c.us`,
        data: addResult.data || null,
      };
      results.push(entry);
      if (!entry.ok) failed.push(entry);
    }
  }

  const added = results.filter((entry) => entry.ok).length;
  return res.status(200).json({
    created,
    reused: !created,
    groupId,
    groupName: cleanGroupName,
    groupInviteLink,
    added,
    failed,
    total: results.length,
    results,
    supportsGroupColumns,
    message: created
      ? `Created WhatsApp group and requested ${added} participants`
      : `Requested adding ${added} participants to WhatsApp group`,
  });
}
