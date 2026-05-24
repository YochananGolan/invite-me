import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

export default function ArchivePastEvents() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const handleArchive = async () => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const userId = localStorage.getItem('user_id');
      const userEmail = localStorage.getItem('user_email');

      if (!userId || !userEmail) {
        setError('לא מחובר. התחבר ואז נסה שוב.');
        setLoading(false);
        return;
      }

      const { data, error: evErr } = await supabase
        .from('events')
        .select('id, status, event_details')
        .eq('user_id', userId)
        .in('status', ['draft', 'active'])
        .order('created_at', { ascending: false })
        .limit(500);
      if (evErr) throw evErr;

      const today = new Date();
      const todayStr = today.toLocaleDateString('en-CA');

      const toArchive = (data || []).filter((ev) => {
        const d = ev?.event_details || {};
        const endStr = d.end_datetime || d.date || d.start_datetime;
        if (!endStr) return false;
        const end = new Date(endStr);
        const endStrFormatted = end.toLocaleDateString('en-CA');
        return endStrFormatted < todayStr;
      }).map((ev) => ev.id);

      if (toArchive.length === 0) {
        setResult('לא נמצאו אירועים לעדכון.');
        setLoading(false);
        return;
      }

      const { error: updErr } = await supabase
        .from('events')
        .update({ status: 'archived' })
        .in('id', toArchive);
      if (updErr) throw updErr;

      setResult(`עודכנו ${toArchive.length} אירועים לסטטוס archived`);
    } catch (e) {
      console.error(e);
      setError('שגיאה בארכוב אירועים');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)] text-slate-100" dir="rtl">
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 text-right">
        <section className="w-full rounded-lg border border-white/15 bg-white/[0.055] p-6 shadow-[0_4px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <Link href="/" className="mb-6 inline-flex text-sm font-semibold text-indigo-300 transition-colors hover:text-white">
            חזרה לדף הבית
          </Link>
          <h1 className="mb-3 text-2xl font-black text-white">ארכוב אירועים שהסתיימו</h1>
          <p className="mb-6 text-sm leading-6 text-slate-400">
            כלי תחזוקה לעדכון אירועים שעברו מתאריך האירוע לסטטוס ארכיון.
          </p>
          <button
            onClick={handleArchive}
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-3 font-bold text-white shadow-[0_5px_22px_rgba(99,70,230,0.45)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'מעדכן...' : 'ארכב אירועים שהסתיימו'}
          </button>
          {result && (
            <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-300">
              {result}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-semibold text-red-400">
              {error}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
