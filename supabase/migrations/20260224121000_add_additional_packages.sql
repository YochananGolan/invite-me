-- Track number of 100-message addon packages purchased per event.
-- This allows web and mobile clients to stay in sync (single source of truth).

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS additional_packages integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.events.additional_packages IS 'How many 100-message addon packages were purchased for this event.';

