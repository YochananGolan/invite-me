import { getInviteBaseUrl } from './inviteUrl';
import { sendWhatsAppTextMessage, normalizePhoneNumber, getWhatsAppProvider } from './whatsappClient';

const DEBUG_ENDPOINT = process.env.WHATSAPP_DEBUG_ENDPOINT || '';
const DEBUG_SESSION_ID = process.env.WHATSAPP_DEBUG_SESSION_ID || 'whatsapp-default';

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
    console.log('[whatsapp-debug]', JSON.stringify(payload));

    if (!DEBUG_ENDPOINT) {
      return;
    }

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

const SEND_CONCURRENCY = Math.max(1, Number(process.env.WHATSAPP_SEND_CONCURRENCY || 5));
/** Green API לעיתים נכשל/מחמיץ כששולחים מספר הודעות במקביל — ברירת מחדל רצף + מרווח */
const GREENAPI_DEFAULT_GAP_MS = 450;

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

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (true) {
      const index = currentIndex;
      currentIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Same pipeline as production invite send: load event + guests, buildGuestMessage, sendWhatsAppTextMessage (Green/Meta).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ eventId: string, guestId?: string, guestIds?: string[], skipMessageCountIncrement?: boolean }} options
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
export async function sendEventWhatsAppInvites(supabase, options) {
  const { eventId, guestId, guestIds, skipMessageCountIncrement = false } = options || {};

  console.log('[greenapi-send-invite] Request received', {
    method: 'POST',
    eventId,
    guestId: guestId || null,
    guestIdsCount: Array.isArray(guestIds) ? guestIds.length : 0,
    skipMessageCountIncrement: Boolean(skipMessageCountIncrement),
  });

  sendDebugLog({
    hypothesisId: 'H4',
    location: 'lib/sendEventWhatsAppInvites.js',
    message: 'Invite send request received',
    data: {
      eventId,
      guestId,
      guestIdsCount: Array.isArray(guestIds) ? guestIds.length : null,
      skipMessageCountIncrement,
    },
  });

  if (!eventId) {
    return { statusCode: 400, body: { error: 'eventId is required' } };
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, event_type, event_details, messages_sent_count')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError || !event) {
    console.error('[whatsapp] Failed to fetch event', eventError);
    sendDebugLog({
      hypothesisId: 'H4',
      location: 'lib/sendEventWhatsAppInvites.js',
      message: 'Event fetch failed',
      data: { eventError },
    });
    return { statusCode: 404, body: { error: 'Event not found' } };
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
      location: 'lib/sendEventWhatsAppInvites.js',
      message: 'Guests fetch failed',
      data: { guestsError },
    });
    return { statusCode: 500, body: { error: 'Failed to fetch guests' } };
  }

  const uniqueGuests = [];
  const seenGuestIds = new Set();
  for (const guest of guests || []) {
    if (!guest?.id || seenGuestIds.has(guest.id)) continue;
    seenGuestIds.add(guest.id);
    uniqueGuests.push(guest);
  }
  const guestsWithPhone = uniqueGuests.filter((guest) => normalizePhoneNumber(guest.phone));

  console.log('[greenapi-send-invite] Guests loaded', {
    totalGuests: guests?.length || 0,
    guestsWithPhone: guestsWithPhone.length,
  });

  sendDebugLog({
    hypothesisId: 'H5',
    location: 'lib/sendEventWhatsAppInvites.js',
    message: 'Guests fetched',
    data: { totalGuests: guests?.length || 0, withPhone: guestsWithPhone.length },
  });

  if (guestsWithPhone.length === 0) {
    console.log('[greenapi-send-invite] No guests with valid phone numbers');
    return {
      statusCode: 200,
      body: {
          queued: 0,
        sent: 0,
        failed: [],
        skipped: guests?.length || 0,
        message: 'No guests with valid phone numbers to send WhatsApp invitations.',
        devSkippedCounter: Boolean(skipMessageCountIncrement),
      },
    };
  }

  const eventDetails = parseEventDetails(event.event_details);
  let updatedMessagesSentCount = Number.isFinite(event.messages_sent_count) ? event.messages_sent_count : 0;
  const results = [];

  const provider = getWhatsAppProvider();
  const rawGapEnv = process.env.WHATSAPP_GREENAPI_SEND_GAP_MS;
  const parsedGap = Math.floor(
    Number(rawGapEnv !== undefined && rawGapEnv !== '' ? rawGapEnv : GREENAPI_DEFAULT_GAP_MS),
  );
  const greenGapMs =
    provider === 'greenapi'
      ? Math.max(0, Number.isFinite(parsedGap) ? parsedGap : GREENAPI_DEFAULT_GAP_MS)
      : 0;
  const useMetaStyleParallel = provider !== 'greenapi';

  const sendOneGuest = async (guest) => {
    const body = buildGuestMessage({ guest, eventType: event.event_type, eventDetails, eventId });
    const phone = normalizePhoneNumber(guest.phone);
    if (!phone) {
      return {
        guestId: guest.id,
        phone: guest.phone,
        ok: false,
        error: 'Invalid phone number',
        status: 'invalid',
      };
    }
    const sendResult = await sendWhatsAppTextMessage({ to: phone, body });
    const resultEntry = {
      guestId: guest.id,
      phoneOriginal: guest.phone,
      phoneNormalized: phone,
      ok: sendResult.ok,
      error: sendResult.ok ? null : sendResult.error,
      status: sendResult.status,
      deliveryState: sendResult.deliveryState || (sendResult.ok ? 'accepted' : 'failed'),
      provider: sendResult.provider || provider || null,
      providerMessageId: sendResult.providerMessageId || null,
      durationMs: sendResult.durationMs ?? null,
      attempts: sendResult.attempts ?? null,
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
        location: 'lib/sendEventWhatsAppInvites.js',
        message: 'WhatsApp send failed',
        data: resultEntry,
      });
    }

    return resultEntry;
  };

  let sendResults;
  if (useMetaStyleParallel) {
    sendResults = await mapWithConcurrency(guestsWithPhone, SEND_CONCURRENCY, sendOneGuest);
  } else {
    sendResults = [];
    for (let i = 0; i < guestsWithPhone.length; i += 1) {
      if (i > 0 && greenGapMs > 0) {
        await new Promise((r) => setTimeout(r, greenGapMs));
      }
      sendResults.push(await sendOneGuest(guestsWithPhone[i]));
    }
  }
  results.push(...sendResults);

  const queuedCount = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log('[greenapi-send-invite] Send summary', {
    eventId,
    queuedCount,
    failedCount: failed.length,
    provider: provider || 'none',
    concurrency: useMetaStyleParallel ? SEND_CONCURRENCY : 1,
    greenGapMs: useMetaStyleParallel ? 0 : greenGapMs,
  });

  sendDebugLog({
    hypothesisId: 'H2',
    location: 'lib/sendEventWhatsAppInvites.js',
    message: 'WhatsApp send summary',
    data: { queuedCount, failedCount: failed.length, updatedMessagesSentCount },
  });

  if (queuedCount > 0 && !skipMessageCountIncrement) {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('increment_event_messages_sent', {
        p_event_id: eventId,
        p_delta: queuedCount,
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

  return {
    statusCode: 200,
    body: {
      queued: queuedCount,
      sent: queuedCount,
      failed,
      total: results.length,
      results,
      updatedMessagesSentCount,
      message:
        queuedCount > 0
          ? `Queued ${queuedCount} WhatsApp messages for provider processing`
          : undefined,
      devSkippedCounter: Boolean(skipMessageCountIncrement),
    },
  };
}
