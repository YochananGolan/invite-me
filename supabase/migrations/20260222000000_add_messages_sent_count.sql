-- Add messages_sent_count to events table
-- המכסה נמדדת לפי מספר ההודעות שנשלחו, לא לפי מספר המוזמנים.

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS messages_sent_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.events.messages_sent_count IS 'Number of SMS/WhatsApp messages sent for this event (used for quota)';
