import Head from 'next/head';
import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import { supabase } from '../lib/supabaseClient';

export default function RsvpPage() {
  const [latestGuest, setLatestGuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteImgUrl, setInviteImgUrl] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Check localStorage instead of Supabase auth
        const userId = localStorage.getItem('user_id');
        const userEmail = localStorage.getItem('user_email');
        
        if (!userId || !userEmail) {
          setError('יש להתחבר כדי לראות נתוני אורחים');
          setLoading(false);
          return;
        }

        const { data, error: guestErr } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (guestErr) throw guestErr;

        setLatestGuest(data);

        // attempt to derive invite image from guest's event if not already found
        let imageUrl = '';

        if (data && data.event_id) {
          const { data: evByGuest } = await supabase
            .from('events')
            .select('invitation_path')
            .eq('id', data.event_id)
            .single();
          if (evByGuest && evByGuest.invitation_path) {
            imageUrl = evByGuest.invitation_path;
          }
        }

        // fallback: latest event per user (existing logic)
        if (!imageUrl) {
          const { data: ev } = await supabase
            .from('events')
            .select('invitation_path')
            .eq('user_id', userId)
            .not('invitation_path', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (ev && ev.invitation_path) {
            imageUrl = ev.invitation_path;
          }
        }

        if (imageUrl) {
          if (!imageUrl.startsWith('http')) {
            const { data: urlData } = supabase.storage.from('invites').getPublicUrl(imageUrl);
            imageUrl = urlData.publicUrl;
          }
          setInviteImgUrl(imageUrl);
        }
      } catch (e) {
        console.error('Fetch latest guest failed', e);
        setError('אירעה שגיאה בטעינת פרטי האורח');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Head>
        <title>Meet-M | אישורי הגעה</title>
      </Head>
      <div className="min-h-screen flex flex-col bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)] text-slate-100">
      <NavBar />
      <main className="container mx-auto py-16 px-4 text-center" dir="rtl">
        {inviteImgUrl && (
          <div className="mx-auto mb-10 max-w-md rounded-2xl overflow-hidden border border-white/15 shadow-[0_4px_32px_rgba(0,0,0,0.3)]">
            <img src={inviteImgUrl} alt="Invitation" className="w-full" />
          </div>
        )}
        <h1 className="text-3xl md:text-4xl font-black mb-8 text-white">אורח אחרון שהוזמן</h1>

        {loading && (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
          </div>
        )}
        {error && (
          <div className="mx-auto max-w-md rounded-xl border border-red-400/30 bg-red-500/10 p-4">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        )}

        {latestGuest && (
          <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-white/[0.055] backdrop-blur-xl shadow-[0_4px_32px_rgba(0,0,0,0.3)] p-6 text-right space-y-3">
            <div className="flex items-center gap-3 mb-2 pb-3 border-b border-white/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shrink-0">
                {latestGuest.first_name?.[0]}{latestGuest.last_name?.[0]}
              </div>
              <p className="text-lg font-bold text-white">{latestGuest.first_name} {latestGuest.last_name}</p>
            </div>
            {[
              ['טלפון', latestGuest.phone],
              latestGuest.email && ['אימייל', latestGuest.email],
              latestGuest.total_guests && ['סה"כ מוזמנים', latestGuest.total_guests],
              latestGuest.adults !== undefined && ['בוגרים', latestGuest.adults],
              latestGuest.children !== undefined && ['ילדים', latestGuest.children],
            ].filter(Boolean).map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-100 font-medium">{val}</span>
              </div>
            ))}
            {latestGuest.created_at && (
              <p className="text-xs text-slate-500 pt-2 border-t border-white/10">
                נשלח בתאריך {new Date(latestGuest.created_at).toLocaleString('he-IL')}
              </p>
            )}
          </div>
        )}
      </main>
      </div>
    </>
  );
}
