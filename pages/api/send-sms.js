import { sendSmsToGuests } from '../../lib/activeTrailSms';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { guests, message } = req.body || {};

  if (!guests || !Array.isArray(guests) || guests.length === 0) {
    return res.status(400).json({ error: 'Missing guests array' });
  }

  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

  try {
    const { sent, failed, results, errors } = await sendSmsToGuests(guests, message, 'Invitation SMS');
    return res.status(200).json({
      success: failed === 0,
      sent,
      failed,
      results,
      errors,
    });
  } catch (err) {
    console.error('send-sms error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send SMS' });
  }
}
