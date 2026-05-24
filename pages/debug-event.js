import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

function parseToDate(str) {
  if (!str) return null;
  if (typeof str === 'string') {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      const [dd, mm, yyyy] = str.split('/').map(Number);
      return new Date(yyyy, mm - 1, dd);
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
      const [dd, mm, yyyy] = str.split('-').map(Number);
      return new Date(yyyy, mm - 1, dd);
    }
    return new Date(str);
  }
  return new Date(str);
}

export default function DebugEvent() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const userId = localStorage.getItem('user_id');
        const userEmail = localStorage.getItem('user_email');

        if (!userId || !userEmail) {
          setMsg('לא מחובר');
          return;
        }

        const { data } = await supabase
          .from('events')
          .select('id,status,event_type,event_details,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const mapped = (data || []).map((ev) => {
          const d = ev.event_details || {};
          const raw = d.end_datetime || d.date || d.start_datetime || null;
          const parsed = parseToDate(raw);
          const parsedDay = parsed ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) : null;
          const isPast = parsedDay ? parsedDay < today : null;
          return { id: ev.id, status: ev.status, type: ev.event_type, rawDate: raw, parsed: String(parsed), isPast };
        });
        setRows(mapped);
      } catch (e) {
        console.error(e);
        setMsg('שגיאה');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)] text-slate-100" dir="rtl">
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-lg border border-white/15 bg-white/[0.055] p-6 shadow-[0_4px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <Link href="/" className="mb-6 inline-flex text-sm font-semibold text-indigo-300 transition-colors hover:text-white">
            חזרה לדף הבית
          </Link>
          <h1 className="mb-6 text-2xl font-black text-white">Debug תאריכים</h1>
          {msg && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-semibold text-red-400">{msg}</p>}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[880px] border-collapse text-right text-sm">
              <thead>
                <tr className="bg-white/5 text-slate-300">
                  <th className="border border-white/10 p-2">ID</th>
                  <th className="border border-white/10 p-2">סטטוס</th>
                  <th className="border border-white/10 p-2">סוג</th>
                  <th className="border border-white/10 p-2">Raw</th>
                  <th className="border border-white/10 p-2">Parsed</th>
                  <th className="border border-white/10 p-2">Past?</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="odd:bg-white/5 even:bg-white/[0.02] text-slate-300">
                    <td className="border border-white/10 p-2">{r.id}</td>
                    <td className="border border-white/10 p-2">{r.status}</td>
                    <td className="border border-white/10 p-2">{r.type}</td>
                    <td className="border border-white/10 p-2">{String(r.rawDate)}</td>
                    <td className="border border-white/10 p-2">{r.parsed}</td>
                    <td className="border border-white/10 p-2">{r.isPast === null ? '-' : (r.isPast ? 'Yes' : 'No')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
