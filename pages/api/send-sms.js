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

  const apiKey = process.env.ACTIVETRAIL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ActiveTrail API key not configured' });
  }

  const results = [];
  const errors = [];

  for (const guest of guests) {
    const { phone, firstName, lastName, inviteLink } = guest;

    if (!phone) {
      errors.push({ guest, error: 'Missing phone number' });
      continue;
    }

    // Format phone for Israeli numbers: remove leading 0, add 972
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '972' + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith('972')) {
      formattedPhone = '972' + formattedPhone;
    }

    // Personalize message with guest name and invite link
    const personalizedMessage = message
      .replace(/{firstName}/g, firstName || '')
      .replace(/{lastName}/g, lastName || '')
      .replace(/{fullName}/g, `${firstName || ''} ${lastName || ''}`.trim())
      .replace(/{inviteLink}/g, inviteLink || '');

    try {
      const response = await fetch('https://webapi.mymarketing.co.il/api/smscampaign/OperationalMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({
          details: {
            name: `Invitation SMS - ${firstName} ${lastName}`,
            from_name: 'MeetM',
            content: personalizedMessage,
            can_unsubscribe: false,
          },
          scheduling: {
            send_now: true,
          },
          mobiles: [
            { phone_number: formattedPhone }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ActiveTrail SMS error for ${phone}:`, errorText);
        errors.push({ guest, error: `API error: ${response.status}` });
      } else {
        const data = await response.json();
        results.push({ guest, success: true, response: data });
      }
    } catch (err) {
      console.error(`Failed to send SMS to ${phone}:`, err);
      errors.push({ guest, error: err.message });
    }
  }

  return res.status(200).json({
    success: errors.length === 0,
    sent: results.length,
    failed: errors.length,
    results,
    errors,
  });
}
