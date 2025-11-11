import { useEffect, useState } from 'react';
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
        .in('status', ['draft','active'])
        .order('created_at', { ascending: false })
        .limit(500);
      if (evErr) throw evErr;

      const today = new Date();
      const todayStr = today.toLocaleDateString('en-CA');

      const toArchive = (data || []).filter(ev => {
        const d = ev?.event_details || {};
        const endStr = d.end_datetime || d.date || d.start_datetime;
        if (!endStr) return false;
        const end = new Date(endStr);
        const endStr_formatted = end.toLocaleDateString('en-CA');
        return endStr_formatted < todayStr;
      }).map(ev => ev.id);

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
    <main className="p-6 max-w-xl mx-auto rtl text-right">
      <h1 className="text-2xl font-bold mb-4">ארכוב אירועים שהסתיימו</h1>
      <button onClick={handleArchive} disabled={loading} className="bg-primary text-white rounded-full px-6 py-2 disabled:opacity-40">
        {loading ? 'מעדכן…' : 'ארכב אירועים שהסתיימו'}
      </button>
      {result && <p className="mt-4 text-green-700">{result}</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
    </main>
  );
}


