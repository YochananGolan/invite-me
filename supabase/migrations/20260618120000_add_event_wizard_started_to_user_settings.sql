ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS event_wizard_started boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_settings.event_wizard_started IS
  'True after plan payment while the create-event wizard is in progress (cross-device sync).';
