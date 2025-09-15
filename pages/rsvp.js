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
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError('יש להתחבר כדי לראות נתוני אורחים');
          setLoading(false);
          return;
        }

        const { data, error: guestErr } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('user_id', user.id)
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
            .eq('user_id', user.id)
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
        <title>InviteMe | אישורי הגעה</title>
      </Head>
      <NavBar />
      <main className="container mx-auto py-20 px-4 text-center">
        {inviteImgUrl && (
          <img src={inviteImgUrl} alt="Invitation" className="mx-auto mb-10 max-w-md rounded-lg shadow" />
        )}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium mb-10 text-primary">אורח אחרון שהוזמן</h1>

        {loading && <p className="text-gray-600">טוען...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {latestGuest && (
          <div className="mx-auto max-w-md rounded-lg border border-primary p-6 text-right shadow-sm bg-[#FFF9E8]">
            <p className="mb-2 text-lg font-bold text-primary">{latestGuest.first_name} {latestGuest.last_name}</p>
            <p className="mb-1"><span className="font-medium">טלפון:</span> {latestGuest.phone}</p>
            {latestGuest.email && <p className="mb-1"><span className="font-medium">אימייל:</span> {latestGuest.email}</p>}
            {latestGuest.total_guests && (
              <p className="mb-1"><span className="font-medium">סה"כ מוזמנים:</span> {latestGuest.total_guests}</p>
            )}
            {latestGuest.adults !== undefined && (
              <p className="mb-1"><span className="font-medium">בוגרים:</span> {latestGuest.adults}</p>
            )}
            {latestGuest.children !== undefined && (
              <p className="mb-1"><span className="font-medium">ילדים:</span> {latestGuest.children}</p>
            )}
            {latestGuest.created_at && (
              <p className="text-sm text-gray-500 mt-4">נשלח בתאריך {new Date(latestGuest.created_at).toLocaleString('he-IL')}</p>
            )}
          </div>
        )}
      </main>
    </>
  );
}
