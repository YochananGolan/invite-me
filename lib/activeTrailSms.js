/**
 * Shared SMS sending via ActiveTrail – used by send-sms API and send-reminders cron.
 */

function formatPhoneForIsrael(phone) {
  if (!phone) return null;
  let formatted = String(phone).replace(/\D/g, '');
  if (formatted.startsWith('0')) formatted = '972' + formatted.slice(1);
  else if (!formatted.startsWith('972')) formatted = '972' + formatted;
  return formatted;
}

function personalizeMessage(message, guest = {}) {
  const { firstName = '', lastName = '', inviteLink = '' } = guest;
  return (message || '')
    .replace(/{firstName}/g, firstName)
    .replace(/{lastName}/g, lastName)
    .replace(/{fullName}/g, `${firstName} ${lastName}`.trim())
    .replace(/{inviteLink}/g, inviteLink);
}

/**
 * Send SMS to a list of guests via ActiveTrail.
 * @param {Array<{ phone, firstName?, lastName?, inviteLink? }>} guests
 * @param {string} message - Template with {firstName}, {lastName}, {inviteLink}
 * @param {string} [campaignNamePrefix='SMS'] - Prefix for campaign name in ActiveTrail
 * @returns {{ sent: number, errors: Array, results: Array }}
 */
export async function sendSmsToGuests(guests, message, campaignNamePrefix = 'SMS') {
  const apiKey = process.env.ACTIVETRAIL_API_KEY;
  if (!apiKey) {
    throw new Error('ACTIVETRAIL_API_KEY not configured');
  }

  const results = [];
  const errors = [];

  for (const guest of guests) {
    const { phone, firstName, lastName, inviteLink } = guest;
    const formattedPhone = formatPhoneForIsrael(phone);

    if (!formattedPhone) {
      errors.push({ guest, error: 'Missing or invalid phone number' });
      continue;
    }

    const personalizedMessage = personalizeMessage(message, { firstName, lastName, inviteLink });

    try {
      const response = await fetch('https://webapi.mymarketing.co.il/api/smscampaign/OperationalMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({
          details: {
            name: `${campaignNamePrefix} - ${firstName || ''} ${lastName || ''}`.trim() || 'Guest',
            from_name: 'Meet-M',
            content: personalizedMessage,
            can_unsubscribe: false,
          },
          scheduling: { send_now: true },
          mobiles: [{ phone_number: formattedPhone }],
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

  return { sent: results.length, failed: errors.length, results, errors };
}
