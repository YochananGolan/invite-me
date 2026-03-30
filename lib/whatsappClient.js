const BASE_GRAPH_URL = 'https://graph.facebook.com/v17.0';

const PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN;

function ensureConfigured() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('Meta WhatsApp credentials are not configured (check META_WHATSAPP_PHONE_NUMBER_ID and META_WHATSAPP_ACCESS_TOKEN).');
  }
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
  ensureConfigured();

  const normalized = normalizePhoneNumber(to);
  if (!normalized) {
    return {
      ok: false,
      status: 'invalid_phone',
      error: 'Invalid or missing phone number',
    };
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: normalized,
    type: 'text',
    text: {
      body,
      preview_url: previewUrl,
    },
  };

  try {
    const response = await fetch(`${BASE_GRAPH_URL}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
