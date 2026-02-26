-- Atomic increment of messages_sent_count to avoid race when multiple sends (WhatsApp + SMS) happen close together.
-- Without this, both reads could see 0 and both write 1 → only one is recorded.

CREATE OR REPLACE FUNCTION public.increment_event_messages_sent(p_event_id uuid, p_delta int DEFAULT 1)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count int;
BEGIN
  UPDATE events
  SET messages_sent_count = COALESCE(messages_sent_count, 0) + p_delta
  WHERE id = p_event_id
  RETURNING messages_sent_count INTO new_count;
  RETURN new_count;
END;
$$;

COMMENT ON FUNCTION public.increment_event_messages_sent(uuid, int) IS 'Atomically add p_delta to events.messages_sent_count for the given event; returns new count.';

GRANT EXECUTE ON FUNCTION public.increment_event_messages_sent(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_event_messages_sent(uuid, int) TO service_role;
