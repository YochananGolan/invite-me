import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { isBefore } from 'date-fns';
import { he } from 'date-fns/locale';
import { RSVP_STATUS_LABELS } from '../lib/rsvpLabels';

export default function EventSummary() {
  const [event, setEvent] = useState(null);
  const [stats, setStats] = useState({ approved: 0, rejected: 0, pending: 0, adults:0, children:0 });
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-archive past events
  const autoArchivePastEvents = async (user) => {
    try {
      const { data, error: evErr } = await supabase
        .from('events')
        .select('id, status, event_details')
        .eq('user_id', user.id)
        .in('status', ['draft', 'active'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (evErr) throw evErr;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const toArchive = (data || []).filter(ev => {
        const d = ev?.event_details || {};
        const endStr = d.end_datetime || d.date || d.start_datetime;
        if (!endStr) return false;
        const end = new Date(endStr);
        end.setHours(0, 0, 0, 0);
        return end < today;
      }).map(ev => ev.id);

      if (toArchive.length > 0) {
        await supabase
          .from('events')
          .update({ status: 'archived' })
          .in('id', toArchive);
        console.log(`🗄️ אורכבו אוטומטית ${toArchive.length} אירועים שעברו`);
      }
    } catch (e) {
      console.error('Auto-archive failed:', e);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Auto-archive past events first
        await autoArchivePastEvents(user);

        const { data, error } = await supabase
          .from('events')
          .select('id, event_type, event_details, status')
          .eq('user_id', user.id)
          .or('status.neq.archived,status.is.null')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();


        if(error){
          console.error('EventSummary fetch error', error);
        }
        // Parse date and ignore if in the past
        if(data){
          const details = typeof data.event_details === 'string' ? JSON.parse(data.event_details):data.event_details||{};
          const dateStr = details.date || details.start_datetime || null;
          const dt = dateStr ? parseISO(dateStr) : null;
          if(dt && isBefore(dt, new Date())){
            setEvent(null);
          }else{
            setEvent({ ...data, event_details: details });
          }
        }else{
          setEvent(null);
        }
        if(data){
          // fetch all guest rows and derive counts like detailed report does
          const { data: guests, error: guestsError } = await supabase
            .from('invited_guests')
            .select('status, adults, children')
            .eq('event_id', data.id);

          if(guestsError) console.error('Guests fetch error:', guestsError);

          const newStats = { approved:0, rejected:0, pending:0, adults:0, children:0 };
          if(guests){
            guests.forEach(g=>{
                // Count by status for approval stats
              if(g.status==='approved'){
                newStats.approved +=1;
                // Only count adults/children for approved guests
                newStats.adults  += g.adults || 0;
                newStats.children+= g.children || 0;
              } else if(g.status==='rejected'){
                newStats.rejected +=1;
              } else {
                newStats.pending  +=1;
              }
            });
          }
          setStats(newStats);
          setRefreshKey(prev => prev + 1);
        }
      } catch (e) {
        console.error('❌ fetch live event failed', e);
      }
      // Fallback: check localStorage for draft
      if (!event) {
        try {
          const raw = localStorage.getItem('draftEvent');
          const draft = (raw && typeof raw === 'string' && raw.trim().startsWith('{')) ? JSON.parse(raw) : null;
          if (draft) setEvent(draft);
        } catch (e) { /* ignore */ }
      }
    })();
  }, [refreshKey]);

  // Realtime sync: when event or its guests change, refresh summary.
  useEffect(() => {
    if (!event?.id) return;
    const channel = supabase.channel(`event-summary-${event.id}`);
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `id=eq.${event.id}` },
        () => setRefreshKey((k) => k + 1)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invited_guests', filter: `event_id=eq.${event.id}` },
        () => setRefreshKey((k) => k + 1)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [event?.id]);

  if (!event) {
    return (
      <section className="container mx-auto mb-8 px-4">
        <div className="bg-white/[0.055] border border-dashed border-white/15 backdrop-blur-xl rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.3)] p-6 text-center text-slate-400 rtl">
          <p className="text-lg mb-4">אין אירוע פעיל כרגע</p>
          <p className="mb-4">התחילו בלחיצה על <span className="font-medium text-indigo-300">צור אירוע חדש</span></p>
          <p className="text-sm">לצפייה באירועים מהעבר ובטבלאות נתונים, לחצו על <span className="font-medium text-indigo-300">אירועים מהעבר</span> בתפריט הדוחות</p>
        </div>
      </section>
    );
  }

  const dateStr = event.event_details?.date || event.event_details?.start_datetime || null;
  const dateObj = dateStr ? parseISO(dateStr) : null;
  const location = event.event_details?.hallName || event.event_details?.location || '-';
  const daysLeft = dateObj ? differenceInCalendarDays(dateObj, new Date()) : null;

  return (
    <section className="container mx-auto mb-8 px-4 flex flex-col md:flex-row justify-center items-stretch gap-6">
      {/* Approval Stats Card */}
      <div className="bg-white/[0.055] border border-white/15 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] p-6 flex-1 min-w-[220px] max-w-xs text-center rtl ring-2 ring-indigo-400/30">
        <h3 className="text-base font-bold mb-4 text-slate-100">סיכום מספר אישורים</h3>
        <p className="mb-2 text-sm text-slate-300">{RSVP_STATUS_LABELS.approved}: <span className="font-bold text-emerald-300">{stats.approved}</span></p>
        <p className="mb-2 text-sm text-slate-300">{RSVP_STATUS_LABELS.rejected}: <span className="font-bold text-red-400">{stats.rejected}</span></p>
        <p className="text-sm text-slate-300">{RSVP_STATUS_LABELS.pending}: <span className="font-bold text-slate-100">{stats.pending}</span></p>
      </div>

      {/* Participants Card */}
      <div key={refreshKey} className="bg-white/[0.055] border border-white/15 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] p-6 flex-1 min-w-[220px] max-w-xs text-center rtl ring-2 ring-indigo-400/30">
        <h3 className="text-base font-bold mb-4 text-slate-100">סיכום מספר משתתפים</h3>
        <p className="mb-2 text-sm text-slate-300">מבוגרים: <span className="font-bold text-slate-100">{stats.adults}</span></p>
        <p className="mb-2 text-sm text-slate-300">ילדים: <span className="font-bold text-slate-100">{stats.children}</span></p>
        <p className="text-sm text-slate-300">סה"כ: <span className="font-bold text-indigo-300">{stats.adults + stats.children}</span></p>
      </div>

      {/* Event Card */}
      <div className="bg-white/[0.055] border border-white/15 backdrop-blur-xl rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] p-6 flex flex-col items-center text-center rtl flex-1 min-w-[220px] max-w-xs min-h-[200px] ring-2 ring-indigo-400/30">
        <div className="flex-1">
          <p className="font-bold text-base mb-3 text-slate-100">האירוע הפעיל שלך</p>
          <p className="text-sm text-slate-300">סוג: <span className="font-medium text-slate-100">{event.event_type}</span></p>
          {dateObj && (
            <p className="text-sm text-slate-300">תאריך: <span className="font-medium text-slate-100">{format(dateObj,'dd/MM/yyyy', { locale: he })}</span></p>
          )}
          <p className="text-sm text-slate-300">מיקום: <span className="font-medium text-slate-100">{location}</span></p>
          {daysLeft !== null && (
            <p className={`text-xl font-bold mt-3 ${daysLeft >= 0 ? 'text-indigo-300' : 'text-red-400'}`}>
              {daysLeft >= 0 ? `נותרו ${daysLeft} ימים` : `נותרו ${Math.abs(daysLeft)}- ימים`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
