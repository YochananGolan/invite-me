import { createClient } from '@supabase/supabase-js';
import { getInviteBaseUrl } from '../../../lib/inviteUrl';
import { sendWhatsAppTextMessage, normalizePhoneNumber } from '../../../lib/whatsappClient';

const DEBUG_ENDPOINT = 'http://127.0.0.1:7780/ingest/b5f4ac25-b263-42d9-8749-29626868bbeb';
const DEBUG_SESSION_ID = 'dcd254';

function sendDebugLog({ runId = 'initial', hypothesisId, location, message, data }) {
  try {
    const payload = {
      sessionId: DEBUG_SESSION_ID,
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    };

    if (typeof fetch === 'function') {
      fetch(DEBUG_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': DEBUG_SESSION_ID,
        },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } else {
      const http = require('http');
      const url = new URL(DEBUG_ENDPOINT);
      const req = http.request(
        {
          method: 'POST',
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify(payload)),
            'X-Debug-Session-Id': DEBUG_SESSION_ID,
          },
        },
        () => {}
      );
      req.on('error', () => {});
      req.write(JSON.stringify(payload));
      req.end();
    }
  } catch {
    // Swallow instrumentation errors
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function ensureSupabaseConfigured(res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    sendDebugLog({
      hypothesisId: 'H4',
      location: 'pages/api/greenapi/send-event-invite.js:55',
      message: 'Supabase configuration missing',
      data: {
        hasUrl: Boolean(SUPABASE_URL),
        hasServiceKey: Boolean(SUPABASE_SERVICE_KEY),
      },
    });
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

function formatHebrewDate(eventDateRaw) {
  if (!eventDateRaw) return '';
  try {
    const parsed = new Date(eventDateRaw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('he-IL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  } catch (err) {
    // Fall through to raw value
  }
  return eventDateRaw;
}

function buildEventTemplateText({ eventType, eventDetails, formattedDate }) {
  const normalizeType = (type) => (type === 'ברית/ה' ? 'ברית' : type);
  const t = normalizeType(eventType);
  const d = eventDetails || {};

  const templates = {
    'חתונה': `${d.brideName || ''} ו${d.groomName || ''} מתחתנים
שמחים להזמינכם לחגוג עמנו את יום הנישואין
${formattedDate ? `ביום ${formattedDate}` : ''}
${d.time ? `בשעה ${d.time}` : ''}
${d.hallName || d.hallAddress ? `באולם ${d.hallName || ''}${d.hallAddress ? `, ${d.hallAddress}` : ''}` : ''}
${d.chuppahTime ? `החופה תתקיים בשעה ${d.chuppahTime}` : ''}`.trim(),
    'חינה': `${d.brideName || ''} ו${d.groomName || ''} מזמינים אתכם לחגוג עמנו בחינה
${formattedDate ? `ביום ${formattedDate}` : ''}
${d.time ? `בשעה ${d.time}` : ''}
${d.hallName || d.hallAddress ? `באולם ${d.hallName || ''}${d.hallAddress ? `, ${d.hallAddress}` : ''}` : ''}`.trim(),
    'מסיבת אירוסין': `${d.brideName || ''} ו${d.groomName || ''} שמחים להזמינכם למסיבת האירוסין שלנו
${formattedDate ? `ביום ${formattedDate}` : ''}
${d.time ? `בשעה ${d.time}` : ''}
${d.hallName || d.hallAddress ? `באולם ${d.hallName || ''}${d.hallAddress ? `, ${d.hallAddress}` : ''}` : ''}`.trim(),
    'בר מצווה': `מזמינים אתכם לחגוג עמנו את בר המצווה של ${d.boyName || 'בננו'}
${formattedDate ? `ביום ${formattedDate}` : ''}
${d.time ? `בשעה ${d.time}` : ''}
${d.hallName || d.hallAddress ? `באולם ${d.hallName || ''}${d.hallAddress ? `, ${d.hallAddress}` : ''}` : ''}`.trim(),
    'בת מצווה': `מזמינים אתכם לחגוג עמנו את בת המצווה של ${d.girlName || 'בתנו'}
${formattedDate ? `ביום ${formattedDate}` : ''}
${d.time ? `בשעה ${d.time}` : ''}
${d.hallName || d.hallAddress ? `באולם ${d.hallName || ''}${d.hallAddress ? `, ${d.hallAddress}` : ''}` : ''}`.trim(),
    'ברית': `שמחים להזמינכם לברית
${formattedDate ? `ביום ${formattedDate}` : ''}
${d.time ? `בשעה ${d.time}` : ''}
${d.hallName || d.hallAddress ? `באולם ${d.hallName || ''}${d.hallAddress ? `, ${d.hallAddress}` : ''}` : ''}`.trim(),
    'בריתה': `שמחים להזמינכם לבריתה
${formattedDate ? `ביום ${formattedDate}` : ''}
${d.time ? `בשעה ${d.time}` : ''}
${d.hallName || d.hallAddress ? `באולם ${d.hallName || ''}${d.hallAddress ? `, ${d.hallAddress}` : ''}` : ''}`.trim(),
    'יום הולדת': `את/ה מוזמנ/ת לחגוג יום הולדת ל${d.birthdayName || ''}
${formattedDate ? `ביום ${formattedDate}` : ''}
${d.time ? `בשעה ${d.time}` : ''}
${d.hallName || d.hallAddress ? `ב${d.hallName || ''}${d.hallAddress ? `, ${d.hallAddress}` : ''}` : ''}`.trim(),
    'אירוע עסקי': `חברת ${d.businessName || ''}${d.businessContact ? ` (${d.businessContact})` : ''}
מתכבדת להזמינך לאירוע העסקי שלנו
${formattedDate ? `ביום ${formattedDate}` : ''}
${d.time ? `בשעה ${d.time}` : ''}
${d.hallName || d.hallAddress ? `ב${d.hallName || ''}${d.hallAddress ? `, ${d.hallAddress}` : ''}` : ''}`.trim(),
    'הפרשת חלה': `${d.hostName || ''} מזמינה אתכן לטקס הפרשת חלה
${formattedDate ? `ביום ${formattedDate}` : ''}
${d.time ? `בשעה ${d.time}` : ''}
${d.hallName || d.hallAddress ? `ב${d.hallName || ''}${d.hallAddress ? `, ${d.hallAddress}` : ''}` : ''}`.trim(),
  };

  return templates[t] || '';
}

function buildGuestMessage({ guest, eventType, eventDetails, eventId }) {
  const inviteBase = getInviteBaseUrl();
  const inviteLink = `${inviteBase}/${eventId}/${guest.id}`;

  const eventDateRaw = eventDetails?.date || eventDetails?.event_date;
  const formattedDate = formatHebrewDate(eventDateRaw);

  const invitationLines = Array.isArray(eventDetails?.invitation_text_lines)
    ? eventDetails.invitation_text_lines.filter((line) => typeof line === 'string' && line.trim())
    : [];
  const customText = invitationLines.length
    ? invitationLines.join('\n')
    : (eventDetails?.custom_invitation_text || eventDetails?.customEventDescription || '').trim();
  const templateText = customText || buildEventTemplateText({ eventType, eventDetails, formattedDate });

  const parts = [
    guest.first_name ? `היי ${guest.first_name}!` : 'שלום!',
    templateText || undefined,
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

  const { eventId, guestId, guestIds } = req.body || {};
  console.log('[greenapi-send-invite] Request received', {
    method: req.method,
    eventId,
    guestId: guestId || null,
    guestIdsCount: Array.isArray(guestIds) ? guestIds.length : 0,
  });

  sendDebugLog({
    hypothesisId: 'H4',
    location: 'pages/api/greenapi/send-event-invite.js:43',
    message: 'Invite send request received',
    data: {
      eventId,
      guestId,
      guestIdsCount: Array.isArray(guestIds) ? guestIds.length : null,
      method: req.method,
    },
  });

  if (!eventId) {
    return res.status(400).json({ error: 'eventId is required' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, event_type, event_details, messages_sent_count')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError || !event) {
    console.error('[whatsapp] Failed to fetch event', eventError);
    sendDebugLog({
      hypothesisId: 'H4',
      location: 'pages/api/greenapi/send-event-invite.js:69',
      message: 'Event fetch failed',
      data: { eventError },
    });
    return res.status(404).json({ error: 'Event not found' });
  }
  console.log('[greenapi-send-invite] Event loaded', {
    eventId: event?.id || eventId,
    eventType: event?.event_type || null,
    hasEventDetails: Boolean(event?.event_details),
  });

  let guestQuery = supabase
    .from('invited_guests')
    .select('id, phone, first_name, last_name')
    .eq('event_id', eventId);

  if (Array.isArray(guestIds) && guestIds.length > 0) {
    guestQuery = guestQuery.in('id', guestIds);
  } else if (guestId) {
    guestQuery = guestQuery.eq('id', guestId);
  }

  const { data: guests, error: guestsError } = await guestQuery;

  if (guestsError) {
    console.error('[whatsapp] Failed to fetch guests', guestsError);
    sendDebugLog({
      hypothesisId: 'H5',
      location: 'pages/api/greenapi/send-event-invite.js:95',
      message: 'Guests fetch failed',
      data: { guestsError },
    });
    return res.status(500).json({ error: 'Failed to fetch guests' });
  }
  const guestsWithPhone = (guests || []).filter((guest) => normalizePhoneNumber(guest.phone));
  console.log('[greenapi-send-invite] Guests loaded', {
    totalGuests: guests?.length || 0,
    guestsWithPhone: guestsWithPhone.length,
  });

  sendDebugLog({
    hypothesisId: 'H5',
    location: 'pages/api/greenapi/send-event-invite.js:103',
    message: 'Guests fetched',
    data: { totalGuests: guests?.length || 0, withPhone: guestsWithPhone.length },
  });

  if (guestsWithPhone.length === 0) {
    console.log('[greenapi-send-invite] No guests with valid phone numbers');
    return res.status(200).json({
      sent: 0,
      failed: [],
      skipped: guests?.length || 0,
      message: 'No guests with valid phone numbers to send WhatsApp invitations.',
    });
  }

  const eventDetails = parseEventDetails(event.event_details);
  let updatedMessagesSentCount = Number.isFinite(event.messages_sent_count)
    ? event.messages_sent_count
    : 0;
  const results = [];

  for (const guest of guestsWithPhone) {
    const body = buildGuestMessage({ guest, eventType: event.event_type, eventDetails, eventId });
    const phone = normalizePhoneNumber(guest.phone);
    if (!phone) {
      results.push({
        guestId: guest.id,
        phone: guest.phone,
        ok: false,
        error: 'Invalid phone number',
        status: 'invalid',
      });
      continue;
    }
    const sendResult = await sendWhatsAppTextMessage({ to: phone, body });
    const resultEntry = {
      guestId: guest.id,
      phoneOriginal: guest.phone,
      phoneNormalized: phone,
      ok: sendResult.ok,
      error: sendResult.ok ? null : sendResult.error,
      status: sendResult.status,
    };

    if (!sendResult.ok) {
      console.error('[greenapi-send-invite] Failed sending to guest', {
        guestId: guest.id,
        phone,
        status: sendResult.status,
        error: sendResult.error,
      });
      sendDebugLog({
        hypothesisId: 'H6',
        location: 'pages/api/greenapi/send-event-invite.js:126',
        message: 'WhatsApp send failed',
        data: resultEntry,
      });
    }

    results.push(resultEntry);
  }

  const sentCount = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log('[greenapi-send-invite] Send summary', {
    eventId,
    sentCount,
    failedCount: failed.length,
  });

  sendDebugLog({
    hypothesisId: 'H2',
    location: 'pages/api/greenapi/send-event-invite.js:135',
    message: 'WhatsApp send summary',
    data: { sentCount, failedCount: failed.length, updatedMessagesSentCount },
  });

  if (sentCount > 0) {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('increment_event_messages_sent', {
        p_event_id: eventId,
        p_delta: sentCount,
      });
      if (rpcError) {
        console.warn('[whatsapp] increment_event_messages_sent RPC failed', rpcError);
      } else if (typeof rpcData === 'number') {
        updatedMessagesSentCount = rpcData;
      }
    } catch (err) {
      console.warn('[whatsapp] Failed to increment messages_sent_count', err);
    }
  }

  return res.status(200).json({
    sent: sentCount,
    failed,
    total: results.length,
    results,
    updatedMessagesSentCount,
  });
}
