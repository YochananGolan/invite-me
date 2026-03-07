/**
 * תזכורת אוטומטית – יומיים לפני האירוע.
 * נשלחת ב-SMS בלבד לכל מי שהזמנה נשלחה אליו (כל המופיעים ברשימת המוזמנים).
 * התזכורת נשלחת פעם אחת בלבד לאירוע (reminder_sent_at).
 * מופעלת אוטומטית על ידי Vercel Cron מדי יום; אפשר גם להפעיל ידנית עם CRON_SECRET.
 */

import { createClient } from '@supabase/supabase-js';
import { sendSmsToGuests } from '../../lib/activeTrailSms';
import { getInviteBaseUrl } from '../../lib/inviteUrl';

const ISRAEL_TZ = 'Asia/Jerusalem';

function getDateStringInIsrael(date) {
  return date.toLocaleDateString('en-CA', { timeZone: ISRAEL_TZ });
}

export default async function handler(req, res) {
  // Allow GET (cron) and POST (manual with secret)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  const dryRun = req.query?.dryRun === '1';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized', hint: 'Add header: Authorization: Bearer YOUR_CRON_SECRET' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const now = new Date();
  const todayStr = getDateStringInIsrael(now);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getDateStringInIsrael(tomorrow);
  const inTwoDays = new Date(now); inTwoDays.setDate(inTwoDays.getDate() + 2);
  const inTwoDaysStr = getDateStringInIsrael(inTwoDays);
  const inThreeDays = new Date(now); inThreeDays.setDate(inThreeDays.getDate() + 3);
  const inThreeDaysStr = getDateStringInIsrael(inThreeDays);
  // חלון: יומיים לפני, יום לפני, ויום האירוע (למקרה של הבדלי timezone)
  const targetDates = new Set([todayStr, tomorrowStr, inTwoDaysStr, inThreeDaysStr]);

  const { data: events, error: evError } = await supabase
    .from('events')
    .select('id, user_id, event_details, reminder_sent_at')
    .in('status', ['draft', 'active'])
    .is('reminder_sent_at', null);

  if (evError) {
    console.error('[send-reminders] Events fetch error:', evError);
    return res.status(500).json({ error: evError.message });
  }

  const debugSamples = [];
  const eventsInRange = (events || []).filter((ev) => {
    const d = ev?.event_details || {};
    const dateStr = d.end_datetime || d.date || d.start_datetime;
    if (!dateStr) return false;
    try {
      // תמיכה בפורמטים: "2026-03-09", "2026-03-09T19:00:00", "09.03.2026"
      let parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        const parts = String(dateStr).split(/[.\/-]/);
        if (parts.length >= 3) {
          const [a, b, c] = parts;
          const y = a.length >= 4 ? parseInt(a, 10) : parseInt(c, 10);
          const m = parseInt(b, 10) - 1;
          const day = a.length >= 4 ? parseInt(c, 10) : parseInt(a, 10);
          parsed = new Date(y, m, day);
        }
      }
      if (isNaN(parsed.getTime())) return false;
      const eventDateStr = getDateStringInIsrael(parsed);
      const matched = targetDates.has(eventDateStr);
      if (debugSamples.length < 5) {
        debugSamples.push({ eventId: ev.id, dateStr, eventDateStr, matched, targetDates: [...targetDates] });
      }
      return matched;
    } catch (_) {
      if (debugSamples.length < 5) debugSamples.push({ eventId: ev.id, dateStr, error: 'parse failed' });
      return false;
    }
  });

  const baseUrl = getInviteBaseUrl();
  const report = { targetDates: [...targetDates], eventsProcessed: 0, totalSent: 0, errors: [] };

  for (const event of eventsInRange) {
    const details = typeof event.event_details === 'string' ? JSON.parse(event.event_details || '{}') : event.event_details || {};
    const eventName = details.title || details.event_name || 'האירוע';
    const eventDateStr = details.date || details.start_datetime || details.end_datetime || '';
    let eventDateDisplay = eventDateStr;
    try {
      eventDateDisplay = new Date(eventDateStr).toLocaleDateString('he-IL', { dateStyle: 'long', timeZone: ISRAEL_TZ });
    } catch (_) {}

    // נוסח ההזמנה המלא – לשימוש בתזכורת
    const fullInvitationText = details.custom_invitation_text ||
      details.invitation_text ||
      (details.invitation_text_lines && details.invitation_text_lines.length
        ? details.invitation_text_lines.join('\n')
        : `${eventName} בתאריך ${eventDateDisplay}`);

    const { data: guests, error: gError } = await supabase
      .from('invited_guests')
      .select('id, first_name, last_name, phone')
      .eq('event_id', event.id);

    if (gError || !guests?.length) {
      if (gError) report.errors.push({ eventId: event.id, error: gError.message });
      continue;
    }

    const smsGuests = guests.map((g) => {
      const inviteLink = `${baseUrl}/${event.id}/${g.id}`;
      return {
        phone: g.phone,
        firstName: g.first_name || '',
        lastName: g.last_name || '',
        inviteLink,
      };
    });

    // פורמט: הדגשת תזכורת, נוסח ההזמנה המלא, משפט ללא צורך באישור חוזר, לינק. התזכורת נשלחת פעם אחת בלבד (reminder_sent_at).
    const message = `שלום {firstName}, *תזכורת*:\n\n${fullInvitationText}\n\nאין צורך לאשר שוב אם אין שינויים.\n\nלאישור הגעה לחצו כאן:\n{inviteLink}\n\nMeet-M`;

    if (dryRun) {
      report.totalSent += smsGuests.length;
      report.eventsProcessed += 1;
      continue;
    }
    try {
      const { sent, failed, errors: sendErrors } = await sendSmsToGuests(smsGuests, message, 'Reminder');
      report.totalSent += sent;
      if (failed > 0 && sendErrors?.length) report.errors.push({ eventId: event.id, sendErrors });
    } catch (err) {
      report.errors.push({ eventId: event.id, error: err.message });
      continue;
    }

    const { error: updErr } = await supabase
      .from('events')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', event.id);

    if (updErr) report.errors.push({ eventId: event.id, updateError: updErr.message });
    else report.eventsProcessed += 1;
  }

  const response = {
    ok: true,
    targetDates: [...targetDates],
    todayStr,
    totalEventsInDb: (events || []).length,
    eventsFound: eventsInRange.length,
    eventsProcessed: report.eventsProcessed,
    totalRemindersSent: report.totalSent,
    dryRun: dryRun || undefined,
    errors: report.errors.length ? report.errors : undefined,
  };
  if (dryRun || eventsInRange.length === 0) {
    response.debug = { samples: debugSamples, hint: 'Cron runs at 06:00 UTC. Events need status draft/active, reminder_sent_at null, and date in event_details.' };
  }
  return res.status(200).json(response);
}
