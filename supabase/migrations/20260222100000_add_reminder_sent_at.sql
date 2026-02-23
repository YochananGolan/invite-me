-- תזכורת שבוע לפני: סימון שאירוע כבר קיבל שליחת תזכורת
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

COMMENT ON COLUMN public.events.reminder_sent_at IS 'When the 1-week-before reminder SMS was sent for this event (null = not sent yet)';
