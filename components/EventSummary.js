import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { isBefore } from 'date-fns';
import { he } from 'date-fns/locale';

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
          .neq('status', 'archived')
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
          const draft = JSON.parse(localStorage.getItem('draftEvent'));
          if (draft) setEvent(draft);
        } catch(e) { /* ignore */ }
      }
    })();
  }, []);

  if (!event) {
    return (
      <section className="container mx-auto mb-8 px-4">
        <div className="bg-gray-50 border border-dashed border-gray-400 rounded-lg p-6 text-center text-gray-600 rtl">
          <p className="text-lg mb-4">אין אירוע פעיל כרגע</p>
          <p className="mb-4">התחילו בלחיצה על <span className="font-medium text-primary">צור אירוע חדש</span></p>
          <p className="text-sm">לצפייה באירועים מהעבר ובטבלאות נתונים, לחצו על <span className="font-medium text-primary">אירועים מהעבר</span> בתפריט הדוחות</p>
        </div>
      </section>
    );
  }

  const dateStr = event.event_details?.date || event.event_details?.start_datetime || null;
  const dateObj = dateStr ? parseISO(dateStr) : null;
  const location = event.event_details?.hallName || event.event_details?.location || '-';
  const daysLeft = dateObj ? differenceInCalendarDays(dateObj, new Date()) : null;

  return (
    <section className="container mx-auto mb-8 px-4 flex flex-col md:flex-row-reverse justify-end gap-6">
      {/* Approval Stats Card */}
      <div className="bg-[#FFF9E0] border border-primary rounded-lg p-6 w-64 text-center rtl flex-shrink-0 text-lg md:text-xl ring-2 ring-primary ring-offset-2 ring-offset-[#FFF9E0]">
        <h3 className="text-xl md:text-2xl font-bold mb-4">סיכום מספר אישורים</h3>
        <p className="mb-2 text-lg md:text-xl">מגיעים: <span className="font-bold text-green-700">{stats.approved}</span></p>
        <p className="mb-2 text-lg md:text-xl">לא מגיעים: <span className="font-bold text-red-600">{stats.rejected}</span></p>
        <p className="text-lg md:text-xl">טרם השיבו: <span className="font-bold">{stats.pending}</span></p>
      </div>

      {/* Participants Card */}
      <div key={refreshKey} className="bg-[#FFF9E0] border border-primary rounded-lg p-6 w-64 text-center rtl flex-shrink-0 text-lg md:text-xl ring-2 ring-primary ring-offset-2 ring-offset-[#FFF9E0]">
        <h3 className="text-xl md:text-2xl font-bold mb-4">סיכום מספר משתתפים</h3>
        <p className="mb-2 text-lg md:text-xl">מבוגרים: <span className="font-bold">{stats.adults}</span></p>
        <p className="mb-2 text-lg md:text-xl">ילדים: <span className="font-bold">{stats.children}</span></p>
        <p className="text-lg md:text-xl">סה"כ: <span className="font-bold text-primary">{stats.adults + stats.children}</span></p>
      </div>

      {/* Event Card */}
      <div className="bg-[#FFF9E0] border border-primary rounded-lg p-6 flex flex-col items-center text-center rtl w-64 flex-shrink-0 min-h-[200px] text-lg md:text-xl ring-2 ring-primary ring-offset-2 ring-offset-[#FFF9E0]">
        <div className="flex-1">
          <p className="font-bold text-xl md:text-2xl mb-1">האירוע הפעיל שלך</p>
          <p className="text-lg md:text-xl">סוג: <span className="font-medium">{event.event_type}</span></p>
          {dateObj && (
            <p className="text-lg md:text-xl">תאריך: <span className="font-medium">{format(dateObj,'dd/MM/yyyy', { locale: he })}</span></p>
          )}
          <p className="text-lg md:text-xl">מיקום: <span className="font-medium">{location}</span></p>
          {daysLeft !== null && (
            <p className={`text-2xl md:text-3xl font-bold mt-2 ${daysLeft >= 0 ? 'text-primary' : 'text-red-600'}`}>
              {daysLeft >= 0 ? `נותרו ${daysLeft} ימים` : `נותרו ${Math.abs(daysLeft)}- ימים`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
