// Returns the SQL needed to add messages_sent_count to events.
// Run this SQL once in Supabase → SQL Editor to enable message-quota tracking.

const SQL = `-- Add messages_sent_count to events table
-- המכסה נמדדת לפי מספר ההודעות שנשלחו, לא לפי מספר המוזמנים.
-- Run in Supabase: SQL Editor → New query → Paste → Run

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS messages_sent_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.events.messages_sent_count IS 'Number of SMS/WhatsApp messages sent for this event (used for quota)';
`;

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    sql: SQL,
    instructions: 'הרץ את ה-SQL ב-Supabase: SQL Editor → New query → הדבק והרץ. Run once.',
    supabaseSqlEditor: 'https://supabase.com/dashboard/project/_/sql/new',
  });
}
