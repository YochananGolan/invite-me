const BASE_GRAPH_URL = 'https://graph.facebook.com/v17.0';

const GREENAPI_URL = process.env.GREENAPI_URL;
const GREENAPI_TOKEN = process.env.GREENAPI_TOKEN;
const GREENAPI_ID_INSTANCE = process.env.GREENAPI_ID_INSTANCE;

const PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN;

function getProvider() {
  const hasGreenApi = Boolean(GREENAPI_URL && GREENAPI_TOKEN && GREENAPI_ID_INSTANCE);
  if (hasGreenApi) return 'greenapi';

  const hasMeta = Boolean(PHONE_NUMBER_ID && ACCESS_TOKEN);
  if (hasMeta) return 'meta';

  return null;
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
    if (provider === 'greenapi') {
      const endpointBase = String(GREENAPI_URL || '').replace(/\/+$/, '');
      const payload = {
        chatId: `${normalized}@c.us`,
        message: body,
      };
      response = await fetch(
        `${endpointBase}/waInstance${GREENAPI_ID_INSTANCE}/sendMessage/${GREENAPI_TOKEN}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );
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
      response = await fetch(`${BASE_GRAPH_URL}/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }
    console.log('[whatsappClient] Send attempt finished', {
      provider,
      to: normalized,
      status: response.status,
      ok: response.ok,
    });

    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch (err) {
      // Ignore JSON parse issues (e.g., empty body)
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: responseBody?.error || responseBody || 'Unknown WhatsApp API error',
      };
    }

    return {
      ok: true,
      status: response.status,
      data: responseBody,
    };
  } catch (err) {
    return {
      ok: false,
      status: 'network_error',
      error: err?.message || err,
    };
  }
}
