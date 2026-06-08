import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { fetchGuestRsvpData } from '../../lib/fetchGuestRsvp';

const API = '/api/guest-rsvp';

export default function GuestPage({ initialData, initialError }) {
  const router = useRouter();
  const { eventId: qEventId, guestId: qGuestId } = router.query;

  // Fallback: parse from asPath when query is empty (e.g. direct URL load, some browsers)
  const { eventId, guestId } = useMemo(() => {
    if (qEventId && qGuestId) return { eventId: qEventId, guestId: qGuestId };
    const path = (router.asPath || '').split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '');
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { eventId: parts[0], guestId: parts[1] };
    }
    return { eventId: qEventId, guestId: qGuestId };
  }, [qEventId, qGuestId, router.asPath]);

  const [loading, setLoading] = useState(!initialData && !initialError);
  const [guest, setGuest] = useState(initialData?.guest ?? null);
  const [error, setError] = useState(initialError ?? null);
  const [invitationUrl, setInvitationUrl] = useState(initialData?.invitationUrl ?? '');
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');

  // RSVP form state
  const [attending, setAttending] = useState(null); // true/false/null
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const mealCategories = [
    { key: 'vegetarian', label: 'צמחוני' },
    { key: 'vegan', label: 'טבעוני' },
    { key: 'glatt', label: 'גלאט' },
    { key: 'celiac', label: 'צליאקים' },
  ];

  const [specialMeals, setSpecialMeals] = useState({
    vegetarian: { adults: 0, children: 0 },
    vegan: { adults: 0, children: 0 },
    glatt: { adults: 0, children: 0 },
    celiac: { adults: 0, children: 0 },
  });

  const [allergies, setAllergies] = useState([{ description: '', adults: 0, children: 0 }]);
  const [showMap, setShowMap] = useState(false);
  const [eventDetails, setEventDetails] = useState(initialData?.eventDetails ?? null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const resolvedAddress = useMemo(() => {
    if (guest?.hall_address?.trim()) {
      return guest.hall_address.trim();
    }
    if (eventDetails?.hall_address?.trim?.()) {
      return eventDetails.hall_address.trim();
    }
    if (eventDetails?.hallAddress?.trim?.()) {
      return eventDetails.hallAddress.trim();
    }
    if (guest?.hall_name?.trim()) {
      return guest.hall_name.trim();
    }
    if (eventDetails?.hall_name?.trim?.()) {
      return eventDetails.hall_name.trim();
    }
    if (eventDetails?.hallName?.trim?.()) {
      return eventDetails.hallName.trim();
    }
    return '';
  }, [guest?.hall_address, guest?.hall_name, eventDetails]);

  const wazeUrl = useMemo(() => {
    if (!resolvedAddress) return null;
    const encoded = encodeURIComponent(resolvedAddress);
    return `https://www.waze.com/ul?q=${encoded}&navigate=yes&zoom=17&lang=heb`;
  }, [resolvedAddress]);

  const googleMapQuery = useMemo(() => {
    return resolvedAddress || '31.771959,35.217018';
  }, [resolvedAddress]);

  const googleMapsLink = useMemo(
    () => `https://www.google.com/maps?q=${encodeURIComponent(googleMapQuery)}`,
    [googleMapQuery]
  );

  const googleMapsEmbedUrl = useMemo(
    () => `${googleMapsLink}&output=embed`,
    [googleMapsLink]
  );

  const updateMeal = (cat, field, val) => {
    setSpecialMeals((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        [field]: field === 'description' ? val : Math.max(0, val),
      },
    }));
    // Clear error when user updates values
    if (formError && field !== 'description') {
      setFormError('');
    }
  };

  const updateAllergy = (idx, field, val) => {
    setAllergies((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: field === 'description' ? val : Math.max(0, val) } : a))
    );
    // Clear error when user updates values
    if (formError && field !== 'description') {
      setFormError('');
    }
  };

  const addAllergy = () => setAllergies((prev) => [...prev, { description: '', adults: 0, children: 0 }]);
  const removeAllergy = (idx) => setAllergies((prev) => prev.filter((_, i) => i !== idx));

  // Hydrate from initialData (SSR)
  useEffect(() => {
    if (initialData?.guest) {
      const d = initialData.guest;
      if (d.adults !== null) setAdults(d.adults);
      if (d.children !== null) setChildren(d.children);
      if (d.special_meals) setSpecialMeals((prev) => ({ ...prev, ...d.special_meals }));
    }
  }, [initialData]);

  // Client fetch only when no SSR data (fallback)
  useEffect(() => {
    if (initialData) return;
    if (!router.isReady && !eventId && !guestId) return;
    if (!eventId || !guestId) {
      setLoading(false);
      setError('קישור לא תקין – חסרים פרטי אירוע או אורח');
      return;
    }
    (async () => {
      try {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${base}${API}?eventId=${encodeURIComponent(eventId)}&guestId=${encodeURIComponent(guestId)}`);
        let json;
        try {
          const text = await res.text();
          json = text && text.trim().startsWith('{') ? JSON.parse(text) : {};
        } catch (parseErr) {
          throw new Error('תשובה לא תקינה מהשרת');
        }
        if (!res.ok) {
          throw new Error(json.error || 'Failed to load');
        }
        const { guest: data, eventDetails: details, invitationUrl: url } = json;
        setGuest(data);
        setEventDetails(details || {});
        if (url) setInvitationUrl(url);
        else if (details?.template_src) {
          let fallback = details.template_src;
          if (!fallback.startsWith('http') && !fallback.startsWith('/')) fallback = '/' + fallback;
          setInvitationUrl(fallback);
        }
        if (data.adults !== null) setAdults(data.adults);
        if (data.children !== null) setChildren(data.children);
        if (data.special_meals) setSpecialMeals((prev) => ({ ...prev, ...data.special_meals }));
      } catch (e) {
        console.error(e);
        setError('שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    })();
  }, [initialData, router.isReady, eventId, guestId]);

  const handleSave = async () => {
    setFormError('');
    if (attending === null) {
      setFormError('אנא בחר/י האם את/ה מגיע/ה.');
      return false; // Return false to indicate failure
    }

    // basic validation.
    if (attending && adults === 0 && children === 0) {
      setFormError('יש להזין לפחות משתתף אחד.');
      return false; // Return false to indicate failure
    }

    // Inside handleSave, after basic validations and before building payload
    if (attending) {
      const sanitizedAdults = Number.isFinite(adults) && adults >= 0 ? adults : 0;
      const sanitizedChildren = Number.isFinite(children) && children >= 0 ? children : 0;

      // count special meals per group
      const specialAdultsCount =
        specialMeals.vegetarian.adults +
        specialMeals.vegan.adults +
        specialMeals.glatt.adults +
        specialMeals.celiac.adults +
        allergies.reduce((sum, a) => sum + a.adults, 0);
      const specialChildrenCount =
        specialMeals.vegetarian.children +
        specialMeals.vegan.children +
        specialMeals.glatt.children +
        specialMeals.celiac.children +
        allergies.reduce((sum, a) => sum + a.children, 0);

      let errorMsg = '';
      if (specialAdultsCount > sanitizedAdults) {
        errorMsg += `מספר המנות המיוחדות למבוגרים (${specialAdultsCount}) גדול ממספר המבוגרים (${sanitizedAdults}).`;
      }
      if (specialChildrenCount > sanitizedChildren) {
        if (errorMsg) errorMsg += ' ';
        errorMsg += `מספר המנות המיוחדות לילדים (${specialChildrenCount}) גדול ממספר הילדים (${sanitizedChildren}).`;
      }
      if (errorMsg) {
        setFormError(errorMsg);
        return false; // Return false to indicate failure - keep modal open
      }
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
      const celiacAdults = attending ? specialMeals.celiac.adults : 0;
      const celiacChildren = attending ? specialMeals.celiac.children : 0;
      const allergyAdults = attending ? allergies.reduce((sum,a)=>sum+a.adults,0) : 0;
      const allergyChildren = attending ? allergies.reduce((sum,a)=>sum+a.children,0) : 0;

      const payload = {
        eventId,
        guestId,
        status: attending ? 'approved' : 'rejected',
        adults: sanitizedAdults,
        children: sanitizedChildren,
        veg_adults: vegAdults,
        veg_children: vegChildren,
        vegan_adults: veganAdults,
        vegan_children: veganChildren,
        glatt_adults: glattAdults,
        glatt_children: glattChildren,
        celiac_adults: celiacAdults,
        celiac_children: celiacChildren,
        allergy_adults: allergyAdults,
        allergy_children: allergyChildren,
        allergy_note: allergies?.map((a) => a.description).filter(Boolean).join('; ') || '',
      };

      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let json = {};
      try {
        const text = await res.text();
        if (text && text.trim().startsWith('{')) json = JSON.parse(text);
      } catch (parseErr) {
        throw new Error('תשובה לא תקינה מהשרת');
      }
      if (!res.ok) throw new Error(json.error || 'Failed to save');

      setSaved(attending ? 'approved' : 'rejected');
      setFormError('');
      return true; // Return true to indicate success
    } catch (e) {
      console.error('save RSVP failed', e);
      setFormError('אירעה שגיאה בשמירה. אנא נסה שוב.');
      return false; // Return false to indicate failure - keep modal open
    }
  };

  // Save status immediately (used for "לא מגיעים")
  const saveStatus = async (isAttending) => {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          guestId,
          status: isAttending ? 'approved' : 'rejected',
          adults: isAttending ? adults : 0,
          children: isAttending ? children : 0,
          veg_adults: 0,
          veg_children: 0,
          vegan_adults: 0,
          vegan_children: 0,
          glatt_adults: 0,
          glatt_children: 0,
          celiac_adults: 0,
          celiac_children: 0,
          allergy_adults: 0,
          allergy_children: 0,
        }),
      });
      let json = {};
      try {
        const text = await res.text();
        if (text && text.trim().startsWith('{')) json = JSON.parse(text);
      } catch (parseErr) {
        throw new Error('תשובה לא תקינה מהשרת');
      }
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setSaved(isAttending ? 'approved' : 'rejected');
    } catch (e) {
      console.error('save status failed', e);
      alert('אירעה שגיאה בשמירת הסטטוס.');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400" />
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)] p-6" dir="rtl">
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 backdrop-blur-xl p-8 max-w-md w-full text-center">
        <p className="text-red-400 text-lg font-medium">{error}</p>
      </div>
    </div>
  );

  if (saved) {
    const isApproved = saved === 'approved';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)] p-6 text-center space-y-6" dir="rtl">
        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl mx-auto ${isApproved ? 'bg-emerald-500/20 border border-emerald-400/30' : 'bg-red-500/20 border border-red-400/30'}`}>
          <span className="text-3xl">{isApproved ? '✓' : '✗'}</span>
        </div>
        <h1 className={`text-3xl sm:text-4xl font-black text-white`}>
          {isApproved ? 'תודה רבה!' : 'תודה על העדכון!'}
        </h1>
        <p className={`text-lg sm:text-xl ${isApproved ? 'text-emerald-300' : 'text-slate-400'}`}>
          {isApproved ? 'אישור ההגעה נשלח בהצלחה' : '😔 מצטערים שלא תוכל/י להגיע הפעם – מקווים לראותך בקרוב'}
        </p>
        {isApproved && guest?.table_number && (
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/20 px-6 py-3 text-xl font-black text-indigo-200 mt-4">
            שולחן מספר {guest.table_number}
          </div>
        )}
      </div>
    );
  }

  // Get invitation text and styles from event details
  const invitationTextLines = eventDetails?.invitation_text_lines || 
    (eventDetails?.custom_invitation_text ? eventDetails.custom_invitation_text.split('\n') : []);
  const lineStyles = eventDetails?.line_styles || {};
  const fontCSS = eventDetails?.font_css || eventDetails?.font || "'Assistant', sans-serif";
  
  // Debug: Log what we're trying to display
  console.log('🎨 Text overlay data:', {
    eventDetails: eventDetails,
    invitationTextLines: invitationTextLines,
    invitationTextLinesLength: invitationTextLines?.length || 0,
    lineStyles: lineStyles,
    fontCSS: fontCSS,
    willShowText: invitationTextLines?.length > 0
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)] flex flex-col items-center justify-between py-4 text-slate-100" dir="rtl">
      {invitationUrl && (
        <div className="relative w-full max-w-4xl flex items-center justify-center mb-6">
          <button
            onClick={() => router.push('/')}
            className="absolute top-2 left-2 z-30 w-9 h-9 flex items-center justify-center text-xl font-bold text-slate-400 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors border border-white/15"
            aria-label="סגור הזמנה"
          >
            ×
          </button>
          {/* Background Image */}
          <div className="relative w-full" style={{ maxWidth: '520px' }}>
            <div className="relative w-full pt-[125%] rounded-lg shadow-2xl overflow-hidden">
              <img
                src={invitationUrl}
                alt="הזמנה"
                className="absolute inset-0 w-full h-full object-cover object-top"
                onLoad={() => console.log('✅ Invitation image loaded successfully from:', invitationUrl)}
                onError={(e) => {
                  console.error('❌ Failed to load invitation image from:', invitationUrl);
                  console.error('Error details:', e);
                  setTimeout(() => {
                    const newUrl = invitationUrl.split('?')[0] + '?t=' + Date.now();
                    console.log('🔄 Attempting to reload with new URL:', newUrl);
                    setInvitationUrl(newUrl);
                  }, 1000);
                }}
              />
              {/* Text Overlay - constrained to the invitation image frame */}
              {invitationTextLines && invitationTextLines.length > 0 ? (
                <div 
                  className="absolute inset-0 flex flex-col justify-center items-center p-6 pointer-events-none z-20"
                  dir="rtl"
                >
                  {invitationTextLines.map((line, idx) => {
                    if (!line || !line.trim()) return <div key={idx} style={{ height: '0.4em', flexShrink: 0 }} />;
                    const defaultStyle = idx === 0
                      ? { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: 'black' }
                      : { fontSize: 16, fontWeight: 'normal', textAlign: 'center', color: 'black', lineHeight: 1.5, letterSpacing: 0, textDecoration: 'none', fontStyle: 'normal' };
                    const style = { ...defaultStyle, ...(lineStyles[idx] || {}) };

                    const fontSize = Math.round((style.fontSize ? parseInt(style.fontSize) : (idx === 0 ? 28 : 16)) * 0.9);
                    const fontWeight = style.fontWeight || 'normal';
                    const lineHeight = style.lineHeight ? parseFloat(style.lineHeight) : 1.4;

                    let cleanFontCSS = fontCSS || 'Assistant, sans-serif';

                    let textColor = style.color || '#000000';
                    if (!textColor.startsWith('#')) {
                      const colorMap = {
                        'black': '#000000', 'red': '#FF0000', 'blue': '#0000FF', 'green': '#008000',
                        'purple': '#800080', 'orange': '#FFA500', 'brown': '#A52A2A', 'gold': '#FFD700',
                        'pink': '#FFC0CB', 'cyan': '#00FFFF', 'indigo': '#4B0082', 'teal': '#008080'
                      };
                      textColor = colorMap[textColor.toLowerCase()] || '#000000';
                    }

                    const skewTransform = style.fontStyle === 'italic'
                      ? 'skewX(20deg)'
                      : style.fontStyle === 'back-slant'
                        ? 'skewX(-20deg)'
                        : 'none';

                    return (
                      <div
                        key={`line-${idx}-${textColor}-${style.fontSize || 'default'}`}
                        style={{
                          fontSize: `${fontSize}px`,
                          fontFamily: cleanFontCSS,
                          fontWeight: fontWeight,
                          color: textColor,
                          lineHeight: `${lineHeight}`,
                          letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : '0',
                          textAlign: style.textAlign || 'center',
                          textDecoration: style.textDecoration || 'none',
                          fontStyle: (style.fontStyle === 'italic' || style.fontStyle === 'back-slant') ? 'normal' : (style.fontStyle || 'normal'),
                          textShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
                          transform: skewTransform,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          marginBottom: idx < invitationTextLines.length - 1 ? '0.5em' : '0',
                          position: 'relative',
                          zIndex: 20,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.05))',
                          backdropFilter: 'blur(1.2px)',
                          boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                          width: '100%',
                          maxWidth: '88%',
                          minWidth: 0,
                          boxSizing: 'border-box',
                          overflowWrap: 'anywhere',
                          wordWrap: 'break-word',
                        }}
                      >
                        {line.trim()}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="text-red-400 text-sm font-bold bg-black/60 backdrop-blur-sm p-3 rounded-lg border border-red-400/30">
                    ⚠️ אין טקסט להצגה
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-xl rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#1a1d4a]/80 to-[#12143a]/80 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] ring-2 ring-indigo-400/30 px-5 pb-5 pt-4 text-right text-sm mt-1 flex-shrink-0">
        <h1 className="mb-3 text-2xl font-black text-white">אישור הגעה</h1>

        <p className="mb-3 text-base text-slate-300">
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
          <div className="flex justify-center gap-4 mt-2 flex-nowrap">
            <button
              className="rounded-full bg-gradient-to-br from-emerald-600 to-green-600 text-white border border-emerald-500/40 px-8 py-3 text-base font-bold hover:-translate-y-0.5 transition-transform shadow-[0_5px_18px_rgba(52,211,153,0.3)] flex items-center justify-center gap-2 flex-row-reverse whitespace-nowrap"
              onClick={() => {
                setAttending(true);
                setShowDetailsModal(true);
              }}
            >
              <span className="text-xl">✓</span>
              <span>מגיעים</span>
            </button>

            <button
              className="rounded-full bg-white/10 text-slate-200 border border-white/20 px-8 py-3 text-base font-medium hover:bg-white/15 transition-colors flex items-center justify-center gap-2 flex-row-reverse"
              onClick={() => {
                setAttending(false);
                saveStatus(false);
              }}
            >
              <span className="text-xl">✗</span>
              <span>לא מגיעים</span>
            </button>
          </div>
        ) : attending === false ? (
          <p className="text-center text-slate-400">תודה על העדכון!</p>
        ) : null}
      </div>

      {(wazeUrl || guest?.hall_address) && (
        <div className="flex justify-center my-3 gap-3 flex-wrap">
          {wazeUrl && (
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/20 text-indigo-200 px-5 py-2.5 text-sm font-semibold hover:bg-indigo-500/30 transition-colors"
            >
              <span role="img" aria-label="Waze">🧭</span>
              ניווט לאולם ב-Waze
            </a>
          )}

          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 text-slate-200 px-5 py-2.5 text-sm font-semibold hover:bg-white/15 transition-colors"
          >
            <span role="img" aria-label="מפת האזור">🗺️</span>
            מפת איזור האירוע
          </button>
        </div>
      )}

      {guest?.table_number && (
        <div className="mt-2 mb-2 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/20 px-6 py-3 text-xl font-black text-indigo-200">
            שולחן מספר {guest.table_number}
          </div>
        </div>
      )}

      <div className="flex justify-center w-full mt-0 mb-0 flex-shrink-0">
        {/* Closed button removed */}
      </div>

      {/* Embedded Map Modal */}
      {showMap && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0a0b1e]/75 backdrop-blur-sm z-50 p-4">
          <div className="relative rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#1a1d4a]/95 to-[#12143a]/95 backdrop-blur-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-[0_24px_64px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] ring-2 ring-indigo-400/20">
            <button
              onClick={() => setShowMap(false)}
              className="absolute top-4 left-4 text-2xl text-slate-400 hover:text-white bg-white/10 hover:bg-white/15 rounded-full w-10 h-10 flex items-center justify-center transition-all z-10"
              aria-label="סגור"
            >
              &times;
            </button>

            <div className="p-4 border-b border-white/10">
              <h2 className="text-xl font-bold text-center text-white">מפת הגעה לאולם</h2>
              {guest?.hall_name && (
                <p className="text-center text-slate-400 mt-1 text-sm">{guest.hall_name}</p>
              )}
              {guest?.hall_address && (
                <p className="text-center text-slate-500 text-xs mt-1">{guest.hall_address}</p>
              )}
            </div>

            <div className="flex-1 relative overflow-hidden rounded-b-xl">
              <iframe
                title="מפת הגעה לאולם"
                src={googleMapsEmbedUrl}
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.open(googleMapsLink, '_blank')}
                className="inline-flex items-center gap-2 justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white px-8 py-2.5 text-sm font-bold shadow-[0_5px_18px_rgba(99,70,230,0.35)] hover:-translate-y-0.5 transition-transform"
              >
                <span role="img" aria-label="מפת גוגל">📍</span>
                פתח בגוגל מפות
              </button>
              <button
                onClick={() => setShowMap(false)}
                className="rounded-full border border-white/15 bg-white/10 text-slate-200 px-8 py-2.5 text-sm font-medium hover:bg-white/15 transition-colors"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal - opens when clicking "מגיעים" */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-[#0a0b1e]/75 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen flex items-center justify-center p-2 sm:p-4">
            <div className="relative rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#1a1d4a]/95 to-[#12143a]/95 backdrop-blur-2xl w-full max-w-6xl my-4 flex flex-col max-h-[95vh] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] ring-2 ring-indigo-400/20 text-slate-100">
              <button
                onClick={() => {
                  setAttending(null);
                  setShowDetailsModal(false);
                  setAdults(1);
                  setChildren(0);
                  setSpecialMeals({
                    vegetarian: { adults: 0, children: 0 },
                    vegan: { adults: 0, children: 0 },
                    glatt: { adults: 0, children: 0 },
                    celiac: { adults: 0, children: 0 },
                  });
                  setAllergies([{ description: '', adults: 0, children: 0 }]);
                  setFormError('');
                }}
                className="absolute top-3 left-3 text-2xl text-slate-400 hover:text-white bg-white/10 hover:bg-white/15 rounded-full w-10 h-10 flex items-center justify-center transition-all z-10 touch-manipulation"
                aria-label="סגור"
              >
                &times;
              </button>

              <div className="p-4 border-b border-white/10 flex-shrink-0">
                <h2 className="text-xl sm:text-2xl font-black text-center text-white">פירוט אישור הגעה</h2>
                <p className="text-center text-slate-400 text-sm mt-1">מעולה! אנא עדכן/י את מספר המשתתפים שיגיעו יחד איתך.</p>
              </div>

              <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-4">
                {formError && (
                  <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 sm:p-4 text-right">
                    <p className="text-red-400 text-sm font-medium text-center">{formError}</p>
                  </div>
                )}

                <div className="rounded-2xl border border-white/15 bg-white/[0.055] backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-2 ring-indigo-400/30 p-3 sm:p-4">
                  <h3 className="text-base sm:text-lg font-bold text-indigo-200 mb-3 text-center">מספר משתתפים</h3>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="mb-1 block font-semibold text-sm text-slate-300">סה"כ בוגרים</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="w-full rounded-lg border border-white/20 bg-white/10 text-white placeholder-slate-500 p-2 sm:p-3 text-lg sm:text-xl text-center font-semibold focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                        value={String(adults)}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, '');
                          setAdults(v === '' ? 0 : Math.min(99, parseInt(v, 10)));
                          if (formError) setFormError('');
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-sm text-slate-300">סה"כ ילדים</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="w-full rounded-lg border border-white/20 bg-white/10 text-white placeholder-slate-500 p-2 sm:p-3 text-lg sm:text-xl text-center font-semibold focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                        value={String(children)}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, '');
                          setChildren(v === '' ? 0 : Math.min(99, parseInt(v, 10)));
                          if (formError) setFormError('');
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="mb-2 text-xl sm:text-2xl font-bold text-slate-100 text-center">מנות מיוחדות</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right min-w-[300px] border-collapse">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="py-2 px-3 text-xs font-semibold text-slate-400">קטגוריה</th>
                          <th className="py-2 px-3 text-xs font-semibold text-slate-400 w-20 sm:w-24">בוגרים</th>
                          <th className="py-2 px-3 text-xs font-semibold text-slate-400 w-20 sm:w-24">ילדים</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mealCategories.map((c) => (
                          <tr key={c.key} className="border-b border-white/5 last:border-0">
                            <td className="py-2 px-3 font-medium text-sm sm:text-base text-slate-200">{c.label}</td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="w-full rounded-lg border border-white/20 bg-white/10 text-white p-1.5 text-sm text-center max-w-[60px] sm:max-w-[80px] mx-auto focus:border-indigo-400 outline-none"
                                value={String(specialMeals[c.key].adults)}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^0-9]/g, '');
                                  updateMeal(c.key, 'adults', v === '' ? 0 : Math.min(99, parseInt(v, 10)));
                                }}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="w-full rounded-lg border border-white/20 bg-white/10 text-white p-1.5 text-sm text-center max-w-[60px] sm:max-w-[80px] mx-auto focus:border-indigo-400 outline-none"
                                value={String(specialMeals[c.key].children)}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^0-9]/g, '');
                                  updateMeal(c.key, 'children', v === '' ? 0 : Math.min(99, parseInt(v, 10)));
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-bold text-slate-100">אלרגיות נוספות</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm text-slate-400">להוספת אלרגיה לחץ</span>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); addAllergy(); }}
                        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); addAllergy(); }}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-xl font-bold touch-manipulation hover:-translate-y-0.5 transition-transform"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right min-w-[300px] border-collapse">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="py-2 px-3 text-xs font-semibold text-slate-400">תיאור</th>
                          <th className="py-2 px-3 text-xs font-semibold text-slate-400 w-16 sm:w-20">בוגרים</th>
                          <th className="py-2 px-3 text-xs font-semibold text-slate-400 w-16 sm:w-20">ילדים</th>
                          <th className="py-2 px-3 w-10 sm:w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {allergies.map((a, idx) => (
                          <tr key={idx} className="border-b border-white/5 last:border-0">
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                className="w-full rounded-lg border border-white/20 bg-white/10 text-white placeholder-slate-500 p-1.5 text-sm focus:border-indigo-400 outline-none"
                                value={a.description}
                                onChange={(e) => updateAllergy(idx, 'description', e.target.value)}
                                placeholder="תיאור האלרגיה"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="w-full rounded-lg border border-white/20 bg-white/10 text-white p-1.5 text-sm text-center max-w-[60px] md:max-w-[80px] mx-auto focus:border-indigo-400 outline-none"
                                value={String(a.adults)}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^0-9]/g, '');
                                  updateAllergy(idx, 'adults', v === '' ? 0 : Math.min(99, parseInt(v, 10)));
                                }}
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="w-full rounded-lg border border-white/20 bg-white/10 text-white p-1.5 text-sm text-center max-w-[60px] md:max-w-[80px] mx-auto focus:border-indigo-400 outline-none"
                                value={String(a.children)}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^0-9]/g, '');
                                  updateAllergy(idx, 'children', v === '' ? 0 : Math.min(99, parseInt(v, 10)));
                                }}
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => removeAllergy(idx)}
                                className="text-slate-400 hover:text-red-400 text-lg touch-manipulation p-1 transition-colors"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4 border-t border-white/10 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 flex-shrink-0">
                <button
                  type="button"
                  className="rounded-full bg-gradient-to-br from-emerald-600 to-green-600 px-12 sm:px-16 py-3 font-bold text-white hover:-translate-y-0.5 active:translate-y-0 transition-transform text-base sm:text-lg shadow-[0_5px_18px_rgba(52,211,153,0.3)] touch-manipulation"
                  onClick={async () => {
                    const success = await handleSave();
                    if (success) setShowDetailsModal(false);
                  }}
                >
                  שלח אישור
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAttending(null);
                    setShowDetailsModal(false);
                    setAdults(1);
                    setChildren(0);
                    setSpecialMeals({
                      vegetarian: { adults: 0, children: 0 },
                      vegan: { adults: 0, children: 0 },
                      glatt: { adults: 0, children: 0 },
                      celiac: { adults: 0, children: 0 },
                    });
                    setAllergies([{ description: '', adults: 0, children: 0 }]);
                    setFormError('');
                  }}
                  className="rounded-full border border-white/15 bg-white/10 text-slate-200 px-10 sm:px-12 py-3 font-medium text-base sm:text-lg hover:bg-white/15 transition-colors touch-manipulation"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps(context) {
  const { eventId, guestId } = context.params || {};
  if (!eventId || !guestId) {
    return { props: { initialData: null, initialError: 'קישור לא תקין – חסרים פרטי אירוע או אורח' } };
  }
  try {
    const result = await fetchGuestRsvpData(eventId, guestId);
    if (result.error) {
      return { props: { initialData: null, initialError: result.error === 'Guest not found' ? 'אורח לא נמצא' : 'שגיאה בטעינת הנתונים' } };
    }
    return { props: { initialData: result, initialError: null } };
  } catch (e) {
    console.error('[guest-rsvp] getServerSideProps error:', e);
    return { props: { initialData: null, initialError: 'שגיאה בטעינת הנתונים' } };
  }
}
