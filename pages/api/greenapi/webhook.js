const GREENAPI_WEBHOOK_SECRET = process.env.GREENAPI_WEBHOOK_SECRET;

function getBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

function isAuthorized(req) {
  if (!GREENAPI_WEBHOOK_SECRET) {
    return true;
  }

  const authToken = getBearerToken(req.headers?.authorization);
  if (authToken && authToken === GREENAPI_WEBHOOK_SECRET) {
    return true;
  }

  const queryToken = req.query?.token;
  if (queryToken && String(queryToken) === GREENAPI_WEBHOOK_SECRET) {
    return true;
  }

  return false;
}

function extractEventSummary(payload = {}) {
  const typeWebhook = payload?.typeWebhook || null;
  const senderData = payload?.senderData || {};
  const messageData = payload?.messageData || {};

  const chatId =
    senderData?.chatId ||
    messageData?.extendedTextMessageData?.chatId ||
    messageData?.textMessageData?.chatId ||
    null;

  const text =
    messageData?.extendedTextMessageData?.text ||
    messageData?.textMessageData?.textMessage ||
    null;

  return {
    typeWebhook,
    instanceData: payload?.instanceData || null,
    idMessage: senderData?.idMessage || null,
    chatId,
    sender: senderData?.sender || null,
    senderName: senderData?.senderName || null,
    text,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized webhook request' });
  }

  try {
    const payload = req.body || {};
    const summary = extractEventSummary(payload);
    console.log('[greenapi-webhook] Received event:', JSON.stringify(summary, null, 2));

    // GreenAPI requires quick 200 response for webhook delivery confirmation.
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[greenapi-webhook] Failed to process webhook payload', err);
    return res.status(500).json({ error: 'Failed to process webhook payload' });
  }
}
