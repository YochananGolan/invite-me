import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function CheckPastEvents() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const userId = localStorage.getItem('user_id');
        const userEmail = localStorage.getItem('user_email');
        
        if (!userId || !userEmail) { 
          setError('לא מחובר. התחבר ואז רענן.'); 
          setLoading(false); 
          return; 
        }

        // fetch last 50 events for user (any status)
        const { data, error: evErr } = await supabase
          .from('events')
          .select('id, event_type, status, event_details')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (evErr) throw evErr;

        const today = new Date();
        today.setHours(0,0,0,0);

        const past = (data || []).filter(ev => {
          const d = ev?.event_details || {};
          const endStr = d.end_datetime || d.date || d.start_datetime;
          if (!endStr) return false;
          const end = new Date(endStr);
          end.setHours(0,0,0,0);
          return end < today;
        });

        setRows(past);
      } catch (e) {
        console.error(e);
        setError('שגיאה בבדיקת אירועים מהעבר');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="p-6 max-w-3xl mx-auto rtl">
      <h1 className="text-2xl font-bold mb-4">בדיקת אירועים שהסתיימו</h1>
      {loading && <p>טוען…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        rows.length === 0 ? (
          <p>לא נמצאו אירועים שהסתיימו.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">ID</th>
                  <th className="p-2 border">סוג אירוע</th>
                  <th className="p-2 border">סטטוס</th>
                  <th className="p-2 border">תאריך רלוונטי</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(ev => {
                  const d = ev.event_details || {};
                  const endStr = d.end_datetime || d.date || d.start_datetime || '-';
                  return (
                    <tr key={ev.id}>
                      <td className="p-2 border">{ev.id}</td>
                      <td className="p-2 border">{ev.event_type || '-'}</td>
                      <td className="p-2 border">{ev.status}</td>
                      <td className="p-2 border">{endStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </main>
  );
}


