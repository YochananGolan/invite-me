const BASE_GRAPH_URL = 'https://graph.facebook.com/v17.0';

const GREENAPI_URL = process.env.GREENAPI_URL;
const GREENAPI_TOKEN = process.env.GREENAPI_TOKEN;
const GREENAPI_ID_INSTANCE = process.env.GREENAPI_ID_INSTANCE;
const WHATSAPP_TIMEOUT_MS = Math.max(3000, Number(process.env.WHATSAPP_SEND_TIMEOUT_MS || 15000));

const PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN;

function getProvider() {
  const hasGreenApi = Boolean(GREENAPI_URL && GREENAPI_TOKEN && GREENAPI_ID_INSTANCE);
  if (hasGreenApi) return 'greenapi';

  const hasMeta = Boolean(PHONE_NUMBER_ID && ACCESS_TOKEN);
  if (hasMeta) return 'meta';

  return null;
}

/** `'greenapi' | 'meta' | null` — לשימוש בשכבת השליחה (ריסוס, מקביליות) */
export function getWhatsAppProvider() {
  return getProvider();
}

function ensureConfigured() {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      'WhatsApp credentials are not configured. Set GREENAPI_URL/GREENAPI_TOKEN/GREENAPI_ID_INSTANCE or META_WHATSAPP_PHONE_NUMBER_ID/META_WHATSAPP_ACCESS_TOKEN.'
    );
  }

  return provider;
}

function ensureGreenApiConfigured() {
  const provider = ensureConfigured();
  if (provider !== 'greenapi') {
    throw new Error('Green API credentials are required for WhatsApp group operations.');
  }

  return {
    endpointBase: String(GREENAPI_URL || '').replace(/\/+$/, ''),
    idInstance: GREENAPI_ID_INSTANCE,
    token: GREENAPI_TOKEN,
  };
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WHATSAPP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (err) {
    return null;
  }
}

function getGreenApiError(responseBody, fallback = 'Unknown Green API error') {
  return (
    responseBody?.message ||
    responseBody?.error ||
    (typeof responseBody === 'string' ? responseBody : null) ||
    fallback
  );
}

export function normalizePhoneNumber(phone) {
  if (!phone && phone !== 0) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return null;

  if (cleaned.startsWith('972')) {
    return cleaned;
  }

  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `972${cleaned.slice(1)}`;
  }

  return cleaned;
}

function toGreenApiChatId(phone) {
  const normalized = normalizePhoneNumber(phone);
  return normalized ? `${normalized}@c.us` : null;
}

export async function createWhatsAppGroup({ groupName, phones = [] }) {
  let greenApi;
  try {
    greenApi = ensureGreenApiConfigured();
  } catch (err) {
    return {
      ok: false,
      status: 'config_error',
      error: err?.message || 'Green API is not configured',
    };
  }

  const cleanName = String(groupName || '').trim();
  const chatIds = Array.from(new Set((phones || []).map(toGreenApiChatId).filter(Boolean)));

  if (!cleanName) {
    return { ok: false, status: 'invalid_group_name', error: 'Group name is required' };
  }

  if (chatIds.length === 0) {
    return { ok: false, status: 'no_participants', error: 'At least one valid phone number is required' };
  }

  const startedAt = Date.now();
  try {
    const url = `${greenApi.endpointBase}/waInstance${greenApi.idInstance}/createGroup/${greenApi.token}`;
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupName: cleanName.slice(0, 100), chatIds }),
    });
    const responseBody = await readJsonResponse(response);

    if (!response.ok || !responseBody?.created || !responseBody?.chatId) {
      return {
        ok: false,
        status: response.ok ? 'greenapi_group_not_created' : response.status,
        error: getGreenApiError(responseBody, 'Green API did not create the WhatsApp group'),
        data: responseBody,
        durationMs: Date.now() - startedAt,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: responseBody,
      groupId: responseBody.chatId,
      groupInviteLink: responseBody.groupInviteLink || null,
      participantChatIds: chatIds,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      status: err?.name === 'AbortError' ? 'timeout' : 'network_error',
      error: err?.message || err,
      durationMs: Date.now() - startedAt,
    };
  }
}

export async function findWhatsAppGroupByName({ groupName }) {
  let greenApi;
  try {
    greenApi = ensureGreenApiConfigured();
  } catch (err) {
    return {
      ok: false,
      status: 'config_error',
      error: err?.message || 'Green API is not configured',
    };
  }

  const cleanName = String(groupName || '').trim();
  if (!cleanName) {
    return { ok: false, status: 'invalid_group_name', error: 'Group name is required' };
  }

  try {
    const chatsUrl = `${greenApi.endpointBase}/waInstance${greenApi.idInstance}/getChats/${greenApi.token}`;
    const chatsResponse = await fetchWithTimeout(chatsUrl, { method: 'GET' });
    const chatsBody = await readJsonResponse(chatsResponse);

    if (!chatsResponse.ok || !Array.isArray(chatsBody)) {
      return {
        ok: false,
        status: chatsResponse.ok ? 'greenapi_chats_not_listed' : chatsResponse.status,
        error: getGreenApiError(chatsBody, 'Green API did not return chats'),
        data: chatsBody,
      };
    }

    const candidateGroups = chatsBody.filter((chat) => {
      const chatId = String(chat?.chatId || '');
      return chatId.includes('@g.us') || Number(chat?.phoneNumber) === 0;
    });

    for (const group of candidateGroups) {
      const groupId = String(group?.chatId || '').trim();
      if (!groupId) continue;

      const groupDataUrl = `${greenApi.endpointBase}/waInstance${greenApi.idInstance}/getGroupData/${greenApi.token}`;
      const groupDataResponse = await fetchWithTimeout(groupDataUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      });
      const groupData = await readJsonResponse(groupDataResponse);

      if (!groupDataResponse.ok) continue;

      const subject = String(groupData?.subject || groupData?.groupName || groupData?.name || '').trim();
      if (subject === cleanName) {
        return {
          ok: true,
          status: groupDataResponse.status,
          groupId,
          groupName: subject,
          groupInviteLink: groupData?.groupInviteLink || groupData?.inviteLink || null,
          data: groupData,
        };
      }
    }

    return { ok: false, status: 'not_found', error: 'Matching WhatsApp group was not found' };
  } catch (err) {
    return {
      ok: false,
      status: err?.name === 'AbortError' ? 'timeout' : 'network_error',
      error: err?.message || err,
    };
  }
}

export async function addWhatsAppGroupParticipant({ groupId, phone }) {
  let greenApi;
  try {
    greenApi = ensureGreenApiConfigured();
  } catch (err) {
    return {
      ok: false,
      status: 'config_error',
      error: err?.message || 'Green API is not configured',
    };
  }

  const cleanGroupId = String(groupId || '').trim();
  const participantChatId = toGreenApiChatId(phone);

  if (!cleanGroupId) {
    return { ok: false, status: 'missing_group_id', error: 'Group id is required' };
  }

  if (!participantChatId) {
    return { ok: false, status: 'invalid_phone', error: 'Invalid or missing phone number' };
  }

  const startedAt = Date.now();
  try {
    const url = `${greenApi.endpointBase}/waInstance${greenApi.idInstance}/addGroupParticipant/${greenApi.token}`;
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: cleanGroupId, participantChatId }),
    });
    const responseBody = await readJsonResponse(response);
    const added = Boolean(responseBody?.addParticipant);

    if (!response.ok || !added) {
      return {
        ok: false,
        status: response.ok ? 'greenapi_participant_not_added' : response.status,
        error: getGreenApiError(responseBody, 'Green API did not add the participant'),
        data: responseBody,
        participantChatId,
        durationMs: Date.now() - startedAt,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: responseBody,
      participantChatId,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      status: err?.name === 'AbortError' ? 'timeout' : 'network_error',
      error: err?.message || err,
      participantChatId,
      durationMs: Date.now() - startedAt,
    };
  }
}

export async function sendWhatsAppTextMessage({ to, body, previewUrl = false }) {
  let provider;
  try {
    provider = ensureConfigured();
  } catch (err) {
    return {
      ok: false,
      status: 'config_error',
      error: err?.message || 'WhatsApp provider is not configured',
    };
  }

  const normalized = normalizePhoneNumber(to);
  if (!normalized) {
    return {
      ok: false,
      status: 'invalid_phone',
      error: 'Invalid or missing phone number',
    };
  }

  try {
    let response;
    let attempts = 0;
    const startedAt = Date.now();
    if (provider === 'greenapi') {
      const endpointBase = String(GREENAPI_URL || '').replace(/\/+$/, '');
      const payload = {
        chatId: `${normalized}@c.us`,
        message: body,
      };
      const url = `${endpointBase}/waInstance${GREENAPI_ID_INSTANCE}/sendMessage/${GREENAPI_TOKEN}`;
      const maxAttempts = Math.max(1, Math.min(5, Number(process.env.WHATSAPP_GREENAPI_SEND_RETRIES || 3)));
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        attempts = attempt;
        response = await fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (response.ok) break;
        const retryable = [408, 425, 429, 500, 502, 503, 504].includes(response.status);
        if (attempt < maxAttempts && retryable) {
          const backoff = Math.min(8000, 600 * 2 ** (attempt - 1));
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        break;
      }
    } else {
      const payload = {
        messaging_product: 'whatsapp',
        to: normalized,
        type: 'text',
        text: {
          body,
          preview_url: previewUrl,
        },
      };
      attempts = 1;
      response = await fetchWithTimeout(`${BASE_GRAPH_URL}/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }
    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch (err) {
      // Ignore JSON parse issues (e.g., empty body)
    }

    console.log('[whatsappClient] Send attempt finished', {
      provider,
      to: normalized,
      attempts,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      hasIdMessage: Boolean(provider === 'greenapi' && responseBody && responseBody.idMessage),
    });

    if (!response.ok) {
      const errMsg =
        responseBody?.message ||
        responseBody?.error ||
        (typeof responseBody === 'string' ? responseBody : null) ||
        'Unknown WhatsApp API error';
      return {
        ok: false,
        status: response.status,
        error: errMsg,
        data: responseBody,
        provider,
        attempts,
        durationMs: Date.now() - startedAt,
      };
    }

    // Green API: HTTP 200 is not enough — success must include idMessage (see SendMessage response docs).
    if (provider === 'greenapi') {
      const rawId = responseBody?.idMessage;
      const idMsg = rawId != null && String(rawId).trim() !== '' ? String(rawId).trim() : '';
      if (!idMsg) {
        const hint =
          responseBody?.message ||
          (typeof responseBody === 'object' ? JSON.stringify(responseBody).slice(0, 500) : String(responseBody || ''));
        console.warn('[whatsappClient] Green API returned 200 without idMessage', { to: normalized, body: responseBody });
        return {
          ok: false,
          status: 'greenapi_invalid_response',
          error: hint || 'Green API did not return idMessage; message may not have been queued.',
          data: responseBody,
          provider,
          attempts,
          durationMs: Date.now() - startedAt,
        };
      }
    }

    return {
      ok: true,
      status: response.status,
      data: responseBody,
      provider,
      attempts,
      durationMs: Date.now() - startedAt,
      deliveryState: provider === 'greenapi' ? 'queued' : 'accepted',
      providerMessageId:
        provider === 'greenapi'
          ? String(responseBody?.idMessage || '').trim() || null
          : (responseBody?.messages?.[0]?.id ?? null),
    };
  } catch (err) {
    const timeoutErr = err?.name === 'AbortError';
    return {
      ok: false,
      status: timeoutErr ? 'timeout' : 'network_error',
      error: err?.message || err,
      provider,
      durationMs: null,
    };
  }
}
