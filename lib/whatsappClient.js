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
    const fetchWithTimeout = async (url, init) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), WHATSAPP_TIMEOUT_MS);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };
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
