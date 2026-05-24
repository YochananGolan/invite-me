import { useEffect, useState } from 'react';
import Link from 'next/link';
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

        const { data, error: evErr } = await supabase
          .from('events')
          .select('id, event_type, status, event_details')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (evErr) throw evErr;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const past = (data || []).filter((ev) => {
          const d = ev?.event_details || {};
          const endStr = d.end_datetime || d.date || d.start_datetime;
          if (!endStr) return false;
          const end = new Date(endStr);
          end.setHours(0, 0, 0, 0);
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
    <div className="min-h-screen bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)] text-slate-100" dir="rtl">
      <main className="mx-auto max-w-4xl px-4 py-10">
        <section className="rounded-lg border border-white/15 bg-white/[0.055] p-6 shadow-[0_4px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <Link href="/" className="mb-6 inline-flex text-sm font-semibold text-indigo-300 transition-colors hover:text-white">
            חזרה לדף הבית
          </Link>
          <h1 className="mb-6 text-2xl font-black text-white">בדיקת אירועים שהסתיימו</h1>
          {loading && <p className="text-slate-400">טוען...</p>}
          {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-semibold text-red-400">{error}</p>}
          {!loading && !error && (
            rows.length === 0 ? (
              <p className="text-slate-400">לא נמצאו אירועים שהסתיימו.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[720px] border-collapse text-right text-sm">
                  <thead>
                    <tr className="bg-white/5 text-slate-300">
                      <th className="border border-white/10 p-2">ID</th>
                      <th className="border border-white/10 p-2">סוג אירוע</th>
                      <th className="border border-white/10 p-2">סטטוס</th>
                      <th className="border border-white/10 p-2">תאריך רלוונטי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((ev) => {
                      const d = ev.event_details || {};
                      const endStr = d.end_datetime || d.date || d.start_datetime || '-';
                      return (
                        <tr key={ev.id} className="odd:bg-white/5 even:bg-white/[0.02] text-slate-300">
                          <td className="border border-white/10 p-2">{ev.id}</td>
                          <td className="border border-white/10 p-2">{ev.event_type || '-'}</td>
                          <td className="border border-white/10 p-2">{ev.status}</td>
                          <td className="border border-white/10 p-2">{endStr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
      </main>
    </div>
  );
}
