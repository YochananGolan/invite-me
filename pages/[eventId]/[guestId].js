import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function GuestPage() {
  const router = useRouter();
  const { eventId, guestId } = router.query;

  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(null);
  const [error, setError] = useState(null);
  const [invitationUrl, setInvitationUrl] = useState('');
  const [saved, setSaved] = useState(false);

  // RSVP form state
  const [attending, setAttending] = useState(null); // true/false/null
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const mealCategories = [
    { key: 'vegetarian', label: 'צמחוני' },
    { key: 'vegan', label: 'טבעוני' },
    { key: 'glatt', label: 'גלאט' },
  ];

  const [specialMeals, setSpecialMeals] = useState({
    vegetarian: { adults: 0, children: 0 },
    vegan: { adults: 0, children: 0 },
    glatt: { adults: 0, children: 0 },
  });

  const [allergies, setAllergies] = useState([{ description: '', adults: 0, children: 0 }]);

  const updateMeal = (cat, field, val) => {
    setSpecialMeals((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        [field]: field === 'description' ? val : Math.max(0, val),
      },
    }));
  };

  const updateAllergy = (idx, field, val) => {
    setAllergies((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: field === 'description' ? val : Math.max(0, val) } : a))
    );
  };

  const addAllergy = () => setAllergies((prev) => [...prev, { description: '', adults: 0, children: 0 }]);
  const removeAllergy = (idx) => setAllergies((prev) => prev.filter((_, i) => i !== idx));

  useEffect(() => {
    if (!eventId || !guestId) return;
    (async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('id', guestId)
          .eq('event_id', eventId)
          .single();
        if (fetchErr) throw fetchErr;
        setGuest(data);

        // Fetch invitation image of the event
        const { data: ev, error: evErr } = await supabase
          .from('events')
          .select('invitation_path')
          .eq('id', eventId)
          .single();
        if (!evErr && ev?.invitation_path) {
          let url = ev.invitation_path;
          if (!url.startsWith('http')) {
            const { data: urlData } = supabase.storage
              .from('invites')
              .getPublicUrl(ev.invitation_path);
            url = urlData.publicUrl;
          }
          setInvitationUrl(url);
        }

        // preload existing answers if any; keep attending null so user re-confirms each visit
        // If you prefer to show last choice, uncomment and adjust:
        // if (data.status !== null) setAttending(data.status === 'approved');
        if (data.adults !== null) setAdults(data.adults);
        if (data.children !== null) setChildren(data.children);
        if (data.special_meals) setSpecialMeals({ ...specialMeals, ...data.special_meals });
      } catch (e) {
        console.error(e);
        setError('שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, guestId]);

  const handleSave = async () => {
    if (attending === null) {
      alert('אנא בחר/י האם את/ה מגיע/ה.');
      return;
    }

    // basic validation.
    if (attending && adults === 0 && children === 0) {
      alert('יש להזין לפחות משתתף אחד.');
      return;
    }

    try {
      // Sanitize numeric inputs to ensure valid integers
      const sanitizedAdults = attending ? (Number.isFinite(adults) && adults >= 0 ? adults : 0) : 0;
      const sanitizedChildren = attending ? (Number.isFinite(children) && children >= 0 ? children : 0) : 0;

      // Map special meals into individual numeric columns expected by DB
      const vegAdults = attending ? specialMeals.vegetarian.adults : 0;
      const vegChildren = attending ? specialMeals.vegetarian.children : 0;
      const veganAdults = attending ? specialMeals.vegan.adults : 0;
      const veganChildren = attending ? specialMeals.vegan.children : 0;
      const glattAdults = attending ? specialMeals.glatt.adults : 0;
      const glattChildren = attending ? specialMeals.glatt.children : 0;
      const allergyAdults = attending ? allergies.reduce((sum,a)=>sum+a.adults,0) : 0;
      const allergyChildren = attending ? allergies.reduce((sum,a)=>sum+a.children,0) : 0;

      const updatePayload = {
        status: attending ? 'approved' : 'rejected',
        adults: sanitizedAdults,
        children: sanitizedChildren,
        veg_adults: vegAdults,
        veg_children: vegChildren,
        vegan_adults: veganAdults,
        vegan_children: veganChildren,
        glatt_adults: glattAdults,
        glatt_children: glattChildren,
        allergy_adults: allergyAdults,
        allergy_children: allergyChildren,
      };

      // include allergy description text
      if (allergies && allergies.length) {
        updatePayload.allergy_note = allergies.map(a=>a.description).filter(Boolean).join('; ');
      }

      const { error: updErr } = await supabase
        .from('invited_guests')
        .update(updatePayload)
        .match({ id: guestId, event_id: eventId });
      if (updErr) throw updErr;

      setSaved(true);
    } catch (e) {
      console.error('save RSVP failed', e);
      alert('אירעה שגיאה בשמירה.');
    }
  };

  // Save status immediately (used for "לא מגיעים")
  const saveStatus = async (isAttending) => {
    try {
      const updatePayload = {
        status: isAttending ? 'approved' : 'rejected',
        adults: isAttending ? adults : 0,
        children: isAttending ? children : 0,
        veg_adults: 0,
        veg_children: 0,
        vegan_adults: 0,
        vegan_children: 0,
        glatt_adults: 0,
        glatt_children: 0,
        allergy_adults: 0,
        allergy_children: 0,
      };

      const { error: updErr } = await supabase
        .from('invited_guests')
        .update(updatePayload)
        .match({ id: guestId, event_id: eventId });
      if (updErr) throw updErr;

      setSaved(true);
    } catch (e) {
      console.error('save status failed', e);
      alert('אירעה שגיאה בשמירת הסטטוס.');
    }
  };

  if (loading) return <p className="p-6 text-center">טוען...</p>;
  if (error) return <p className="p-6 text-center text-red-600">{error}</p>;

  if (saved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6 text-center space-y-6">
        <h1 className="text-3xl font-bold text-green-700">הנתונים נשמרו בהצלחה!</h1>
        <button
          onClick={() => router.push('/')}
          className="bg-primary text-white px-8 py-3 rounded-full hover:bg-primary/90"
        >
          חזרה לדף הבית
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-between py-4">
      {invitationUrl && (
        <img
          src={invitationUrl}
          alt="הזמנה"
          className="w-full max-w-4xl max-h-[65vh] object-contain rounded-lg shadow-2xl"
        />
      )}

      <div className="w-full max-w-xl rounded-lg bg-white p-3 shadow-sm text-right text-sm mt-1 flex-shrink-0">
        <h1 className="mb-6 text-2xl font-bold text-primary">אישור הגעה</h1>

        <p className="mb-4 text-lg font-medium">
          {attending === null && (
            <>היי {guest.first_name}, נשמח לדעת אם את/ה מגיע/ה לאירוע שלנו.</>
          )}
          {attending === true && (
            <>מעולה! אנא עדכן/י את מספר המשתתפים (בוגרים וילדים) שיגיעו יחד איתך.</>
          )}
          {attending === false && (
            <>מצטערים שלא תוכל/י להשתתף באירוע. תודה על העדכון!</>
          )}
        </p>

        {attending === null ? (
          <div className="flex justify-center gap-4 mb-4 flex-nowrap">
            {/* Green "מגיעים" button on the right (first in markup for RTL) */}
            <button
              className="rounded-full bg-[#FCE6AC] text-primary border border-primary px-24 py-0.5 text-base font-medium ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 flex items-center justify-center gap-2 flex-row-reverse whitespace-nowrap"
              onClick={() => setAttending(true)}
            >
              <span className="text-green-600 text-xl">✓</span>
              <span>מגיעים</span>
            </button>

            {/* Red "לא מגיעים" button on the left */}
            <button
              className="rounded-full bg-[#FCE6AC] text-primary border border-primary px-20 py-0.5 text-base font-medium ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 flex items-center justify-center gap-2 flex-row-reverse"
              onClick={() => {
                setAttending(false);
                saveStatus(false);
              }}
            >
              <span className="text-red-600 text-xl">✗</span>
              <span>לא מגיעים</span>
            </button>
          </div>
        ) : attending ? (
          <>
            {/* participant counts */}
            <div className="mb-4">
              <label className="mb-1 block font-medium">סה"כ בוגרים</label>
              <input
                type="number"
                min="0"
                className="w-full rounded-md border p-2"
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
              />
            </div>
            <div className="mb-4">
              <label className="mb-1 block font-medium">סה"כ ילדים</label>
              <input
                type="number"
                min="0"
                className="w-full rounded-md border p-2"
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
              />
            </div>

            {/* special meals */}
            <h2 className="mb-2 text-lg font-bold">מנות מיוחדות</h2>
            <table className="mb-4 w-full text-right border">
              <thead>
                <tr className="bg-gray-50 text-sm">
                  <th className="border p-1">קטגוריה</th>
                  <th className="border p-1">בוגרים</th>
                  <th className="border p-1">ילדים</th>
                </tr>
              </thead>
              <tbody>
                {mealCategories.map((c) => (
                  <tr key={c.key} className="odd:bg-white even:bg-gray-50 text-sm">
                    <td className="border p-1">{c.label}</td>
                    <td className="border p-1">
                      <input
                        type="number"
                        min="0"
                        className="w-16 rounded-md border p-1"
                        value={specialMeals[c.key].adults}
                        onChange={(e) => updateMeal(c.key, 'adults', Number(e.target.value))}
                      />
                    </td>
                    <td className="border p-1">
                      <input
                        type="number"
                        min="0"
                        className="w-16 rounded-md border p-1"
                        value={specialMeals[c.key].children}
                        onChange={(e) => updateMeal(c.key, 'children', Number(e.target.value))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* allergies */}
            <h3 className="mb-2 font-medium">אלרגיות</h3>
            <div className="mb-2 flex items-center justify-end gap-2 text-sm">
              <span>להוספת אלרגיה לחץ</span>
              <button
                onClick={addAllergy}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700"
              >
                +
              </button>
            </div>
            <table className="mb-6 w-full text-right border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-1">תיאור</th>
                  <th className="border p-1">בוגרים</th>
                  <th className="border p-1">ילדים</th>
                  <th className="border p-1"></th>
                </tr>
              </thead>
              <tbody>
                {allergies.map((a, idx) => (
                  <tr key={idx} className="odd:bg-white even:bg-gray-50">
                    <td className="border p-1">
                      <input
                        type="text"
                        className="w-full rounded-md border p-1"
                        value={a.description}
                        onChange={(e) => updateAllergy(idx, 'description', e.target.value)}
                      />
                    </td>
                    <td className="border p-1 text-center">
                      <input
                        type="number"
                        min="0"
                        className="w-16 rounded-md border p-1"
                        value={a.adults}
                        onChange={(e) => updateAllergy(idx, 'adults', Number(e.target.value))}
                      />
                    </td>
                    <td className="border p-1 text-center">
                      <input
                        type="number"
                        min="0"
                        className="w-16 rounded-md border p-1"
                        value={a.children}
                        onChange={(e) => updateAllergy(idx, 'children', Number(e.target.value))}
                      />
                    </td>
                    <td className="border p-1 text-center">
                      <button onClick={() => removeAllergy(idx)} className="text-red-600">❌</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-center">
              <button
                className="rounded-full bg-primary px-10 py-3 font-medium text-white hover:bg-primary/90"
                onClick={handleSave}
              >
                שמור
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="flex justify-center w-full mt-0 mb-0 flex-shrink-0">
        <button
          onClick={() => router.push('/')}
          className="bg-primary text-white px-8 py-3 rounded-full hover:bg-primary/90"
        >
          חזרה לדף הבית
        </button>
      </div>
    </div>
  );
}
