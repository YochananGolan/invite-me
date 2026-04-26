-- Persist one Green API WhatsApp group per event.

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS whatsapp_group_id text,
ADD COLUMN IF NOT EXISTS whatsapp_group_invite_link text,
ADD COLUMN IF NOT EXISTS whatsapp_group_name text;

COMMENT ON COLUMN public.events.whatsapp_group_id IS 'Green API WhatsApp group chat id for this event';
COMMENT ON COLUMN public.events.whatsapp_group_invite_link IS 'Green API WhatsApp group invite link, when available';
COMMENT ON COLUMN public.events.whatsapp_group_name IS 'Display name used when creating the event WhatsApp group';
