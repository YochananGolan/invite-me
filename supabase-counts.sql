-- ספירות מבסיס הנתונים: מוזמנים והודעות
-- הרץ ב-Supabase: SQL Editor → New query → הדבק והרץ

-- ========== מוזמנים (invited_guests) ==========

-- 1) סה"כ מוזמנים במערכת
SELECT COUNT(*) AS total_guests FROM public.invited_guests;

-- 2) מוזמנים לפי אירוע
SELECT 
  e.id AS event_id,
  e.event_type,
  e.event_details->>'event_date' AS event_date,
  COUNT(g.id) AS guests_count
FROM public.events e
LEFT JOIN public.invited_guests g ON g.event_id = e.id
GROUP BY e.id, e.event_type, e.event_details
ORDER BY e.created_at DESC;

-- 3) מוזמנים לפי משתמש
SELECT 
  user_id,
  COUNT(*) AS guests_count
FROM public.invited_guests
GROUP BY user_id;


-- ========== הודעות (SMS) ==========
-- אם הרצת את הטבלה sms_log (ראה למטה), השתמש ב:

-- 4) סה"כ הודעות שנשלחו
-- SELECT COUNT(*) AS total_messages FROM public.sms_log;

-- 5) הודעות לפי אירוע
-- SELECT event_id, COUNT(*) AS messages_count FROM public.sms_log GROUP BY event_id;

-- 6) הודעות לפי משתמש
-- SELECT user_id, COUNT(*) AS messages_count FROM public.sms_log GROUP BY user_id;


-- ========== טבלת לוג הודעות (אופציונלי) ==========
-- כדי לשמור כמות הודעות, צור את הטבלה והרץ אותה פעם אחת.
-- אחר כך עדכן את הקוד ב-pages/api/send-sms.js לשמירת רשומה בכל שליחה.

/*
CREATE TABLE IF NOT EXISTS public.sms_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  guest_id UUID REFERENCES public.invited_guests(id) ON DELETE SET NULL,
  phone TEXT,
  status TEXT DEFAULT 'sent',  -- sent | failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_log_user_id ON public.sms_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_event_id ON public.sms_log(event_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_created_at ON public.sms_log(created_at DESC);

ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sms_log"
  ON public.sms_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert sms_log"
  ON public.sms_log FOR INSERT WITH CHECK (true);
*/
