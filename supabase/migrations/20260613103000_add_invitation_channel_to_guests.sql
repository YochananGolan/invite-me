-- Track the initial invitation delivery channel so reminders can use the same channel.
ALTER TABLE public.invited_guests
ADD COLUMN IF NOT EXISTS invitation_channel text;

ALTER TABLE public.invited_guests
DROP CONSTRAINT IF EXISTS invited_guests_invitation_channel_check;

ALTER TABLE public.invited_guests
ADD CONSTRAINT invited_guests_invitation_channel_check
CHECK (invitation_channel IS NULL OR invitation_channel IN ('whatsapp', 'sms'));

COMMENT ON COLUMN public.invited_guests.invitation_channel IS
'Initial invitation delivery channel: whatsapp or sms. Used to send reminders through the same channel.';
