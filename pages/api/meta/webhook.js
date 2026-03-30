const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

function respondMissingToken(res) {
  res
    .status(500)
    .json({ error: 'META_WEBHOOK_VERIFY_TOKEN is not configured on the server' });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!VERIFY_TOKEN) {
      return respondMissingToken(res);
    }

    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
      // Meta expects the challenge string echoed back on successful verification.
      return res.status(200).send(challenge);
    }

    return res.status(403).json({ error: 'Webhook verification failed' });
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      if (body.entry) {
        console.log('[meta-webhook] Received entry:', JSON.stringify(body.entry, null, 2));
      } else {
        console.log('[meta-webhook] Received payload without entry field:', body);
      }
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('[meta-webhook] Failed to handle webhook payload', err);
      return res.status(500).json({ error: 'Failed to process webhook payload' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
