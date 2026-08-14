import { shouldAutoCloseEndedEvent } from './eventLifecycle';

export async function archiveEndedEvents(supabase, { limit = 1000 } = {}) {
  const { data, error } = await supabase
    .from('events')
    .select('id, status, event_type, event_details')
    .or('status.neq.archived,status.is.null')
    .limit(limit);
  if (error) throw error;

  const ids = (data || []).filter(shouldAutoCloseEndedEvent).map((ev) => ev.id);
  if (ids.length === 0) return { archived: 0, ids: [] };

  let { error: updateError } = await supabase
    .from('events')
    .update({ status: 'archived', selected_plan: null, additional_packages: 0 })
    .in('id', ids);

  if (updateError && String(updateError.message || '').toLowerCase().includes('column')) {
    ({ error: updateError } = await supabase
      .from('events')
      .update({ status: 'archived' })
      .in('id', ids));
  }
  if (updateError) throw updateError;

  return { archived: ids.length, ids };
}
