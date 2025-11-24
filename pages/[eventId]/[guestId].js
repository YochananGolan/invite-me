import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function GuestPage() {
  const router = useRouter();
  const { eventId, guestId } = router.query;

  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(null);
  const [error, setError] = useState(null);
  const [invitationUrl, setInvitationUrl] = useState('');
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
  const [eventDetails, setEventDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const wazeUrl = useMemo(() => {
    if (!eventDetails) return null;

    const explicitUrl = eventDetails.hall_location_url || eventDetails.hallLocationUrl || eventDetails.wazeLink;
    if (explicitUrl && /^https?:\/\//i.test(explicitUrl)) {
      return explicitUrl;
    }

    const locationParts = [
      eventDetails.hallName,
      eventDetails.hallAddress,
      eventDetails.hallCity,
    ]
      .filter(Boolean)
      .join(' ');

    if (!locationParts) return null;

    const encoded = encodeURIComponent(locationParts);
    return `https://www.waze.com/ul?q=${encoded}&navigate=yes`;
  }, [eventDetails]);

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

        // Fetch invitation image and event details
        const { data: ev, error: evErr } = await supabase
          .from('events')
          .select('invitation_path, event_details')
          .eq('id', eventId)
          .single();
          
        let details = {};
        if (!evErr && ev) {
          // Parse event_details if it's a string
          if (ev?.event_details) {
            try {
              details = typeof ev.event_details === 'string' 
                ? JSON.parse(ev.event_details) 
                : ev.event_details;
            } catch (e) {
              console.error('Error parsing event_details:', e);
              details = ev.event_details || {};
            }
          } else {
            console.warn('⚠️ No event_details found in event');
          }
          
          setEventDetails(details);
          
          // Debug: Log text data
          console.log('📝 Event details loaded:', {
            has_event_details: !!ev?.event_details,
            event_details_type: typeof ev?.event_details,
            has_invitation_text_lines: !!details?.invitation_text_lines,
            invitation_text_lines_count: details?.invitation_text_lines?.length || 0,
            invitation_text_lines: details?.invitation_text_lines,
            has_custom_invitation_text: !!details?.custom_invitation_text,
            custom_invitation_text: details?.custom_invitation_text,
            has_line_styles: !!details?.line_styles,
            line_styles: details?.line_styles,
            font_css: details?.font_css,
            full_details: details
          });
        } else {
          console.error('❌ Error loading event:', evErr);
        }
          
        // Set invitation image - prefer invitation_path (final uploaded invitation with text)
        // If not available, fall back to template_src (background design only)
        let url = '';
        
        if (ev) {
          console.log('🔍 Event data:', {
            invitation_path: ev?.invitation_path,
            has_template_src: !!details?.template_src,
            template_src: details?.template_src,
            fullEventRow: ev
          });
          
          // First try to get invitation_path (final uploaded invitation WITH text overlay)
          if (ev?.invitation_path) {
            url = ev.invitation_path;
            console.log('📷 Found invitation_path:', url);
            if (!url.startsWith('http')) {
              const { data: urlData } = supabase.storage
                .from('invites')
                .getPublicUrl(ev.invitation_path);
              url = urlData.publicUrl;
              console.log('📷 Generated public URL:', url);
            }
            // Add cache busting to ensure we get the latest version
            url += (url.includes('?') ? '&' : '?') + 't=' + Date.now();
            console.log('📷 Final invitation URL with cache busting:', url);
            setInvitationUrl(url);
          } 
          // Fallback to template_src (background design only - no text)
          else if (details?.template_src) {
            url = details.template_src;
            console.log('⚠️ Using template_src fallback (no text overlay):', url);
            // If it's a relative path, make it absolute
            if (!url.startsWith('http') && !url.startsWith('/')) {
              url = '/' + url;
            }
            setInvitationUrl(url);
          } else {
            console.warn('⚠️ No invitation image found - neither invitation_path nor template_src');
          }
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

  // Poll for event details updates (every 2 seconds)
  useEffect(() => {
    if (!eventId) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const { data: ev, error: evErr } = await supabase
          .from('events')
          .select('event_details, updated_at')
          .eq('id', eventId)
          .single();
          
        if (!evErr && ev?.event_details) {
          let details = {};
          try {
            details = typeof ev.event_details === 'string' 
              ? JSON.parse(ev.event_details) 
              : ev.event_details;
          } catch (e) {
            console.error('Error parsing event_details in poll:', e);
            details = ev.event_details || {};
          }
          
          // Always update - React will handle re-rendering only if changed
          setEventDetails(prevDetails => {
            const prevStr = JSON.stringify(prevDetails || {});
            const newStr = JSON.stringify(details);
            
            if (prevStr !== newStr) {
              console.log('🔄 Event details updated, refreshing...', {
                has_line_styles: !!details?.line_styles,
                line_styles: details?.line_styles,
                line_styles_keys: Object.keys(details?.line_styles || {}),
                first_line_style: details?.line_styles?.[0]
              });
              return details;
            }
            return prevDetails;
          });
        }
      } catch (e) {
        console.error('Error polling event details:', e);
      }
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(pollInterval);
  }, [eventId]);

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
        celiac_adults: celiacAdults,
        celiac_children: celiacChildren,
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
        <h1 className="text-3xl sm:text-4xl font-bold text-green-700">תודה רבה!</h1>
        <p className="text-xl sm:text-2xl text-gray-700">אישור ההגעה נשלח בהצלחה</p>
        {guest?.table_number && (
          <div className="text-2xl font-extrabold text-primary bg-[#FCE6AC] border border-primary rounded-full px-6 py-3 inline-block mt-4">
            שים לב מקומך באולם : שולחן מספר {guest.table_number}
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
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-between py-4">
      {invitationUrl && (
        <div className="relative w-full max-w-4xl max-h-[60vh] flex items-center justify-center mb-6 overflow-hidden">
          <button
            onClick={() => router.push('/')}
            className="absolute top-[1px] left-[1px] z-30 w-9 h-9 flex items-center justify-center text-xl font-bold text-gray-600 hover:text-gray-800 bg-white/90 rounded-full shadow-md border border-gray-200"
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
                className="absolute inset-0 w-full h-full object-cover"
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
            </div>
          </div>
          
          {/* Text Overlay - displayed on top of image */}
          {invitationTextLines && invitationTextLines.length > 0 ? (
            <div 
              className="absolute inset-0 flex flex-col justify-center items-center p-6 pointer-events-none z-20"
              dir="rtl"
            >
              {invitationTextLines.map((line, idx) => {
                if (!line || !line.trim()) return null;
                const style = lineStyles[idx] || {};
                const defaultFontSize = 24;
                const fontSize = style.fontSize ? parseInt(style.fontSize) : defaultFontSize;
                const lineHeight = style.lineHeight ? parseFloat(style.lineHeight) : 1.4;
                
                // Clean font CSS
                let cleanFontCSS = fontCSS ? fontCSS.replace(/['"]/g, '') : 'Assistant, sans-serif';
                
                // Get text color
                let textColor = style.color || '#000000';
                if (!textColor.startsWith('#')) {
                  const colorMap = {
                    'black': '#000000', 'red': '#FF0000', 'blue': '#0000FF', 'green': '#008000',
                    'purple': '#800080', 'orange': '#FFA500', 'brown': '#A52A2A', 'gold': '#FFD700',
                    'pink': '#FFC0CB', 'cyan': '#00FFFF', 'indigo': '#4B0082', 'teal': '#008080'
                  };
                  textColor = colorMap[textColor.toLowerCase()] || '#000000';
                }

                // Debug log for first line with styles
                if (idx === 0 && style.color) {
                  console.log(`🎨 Rendering line ${idx} with style:`, {
                    color: textColor,
                    style: style,
                    lineStyles: lineStyles
                  });
                }

                return (
                  <div
                    key={`line-${idx}-${textColor}-${style.fontSize || 'default'}`}
                    style={{
                      fontSize: `${fontSize}px`,
                      fontFamily: cleanFontCSS,
                      fontWeight: style.fontWeight || 'normal',
                      color: textColor,
                      lineHeight: `${lineHeight}`,
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : '0',
                      textAlign: style.textAlign || 'center',
                      textDecoration: style.textDecoration || 'none',
                      fontStyle: style.fontStyle || 'normal',
                      // Enhanced text shadow for better readability
                      textShadow: style.textShadow && style.textShadow !== 'none' 
                        ? '2px 2px 4px rgba(0, 0, 0, 0.3)' 
                        : '0 2px 6px rgba(0, 0, 0, 0.35)',
                      transform: style.transform || 'none',
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
                      maxWidth: '85%',
                      wordWrap: 'break-word',
                      textAlign: 'center'
                    }}
                  >
                    {line.trim()}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-red-500 text-lg font-bold bg-white/80 p-4 rounded">
                ⚠️ אין טקסט להצגה - בדוק את הקונסול
              </div>
            </div>
          )}
        </div>
      )}

      {guest?.table_number && (
        <div className="mt-2 mb-2 text-center">
          <div className="inline-block text-2xl font-extrabold text-primary bg-[#FCE6AC] border border-primary rounded-full px-6 py-3">
            שים לב מקומך באולם : שולחן מספר {guest.table_number}
          </div>
        </div>
      )}

      {wazeUrl && (
        <div className="flex justify-center mb-3">
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 text-white px-5 py-2 text-lg font-medium shadow hover:bg-blue-700 transition-colors"
          >
            <span role="img" aria-label="Waze">🧭</span>
            ניווט לאולם ב-Waze
          </a>
        </div>
      )}

      <div className="w-full max-w-xl rounded-lg bg-white px-3 pb-1 pt-0 shadow-sm text-right text-sm mt-1 flex-shrink-0">
        <h1 className="mb-4 text-2xl font-bold text-primary">אישור הגעה</h1>

        <p className="mb-1 text-base font-medium">
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
            {/* Green "מגיעים" button on the right (first in markup for RTL) */}
            <button
              className="rounded-full bg-green-600 text-white border border-green-700 px-20 py-2 text-base font-medium hover:bg-green-700 flex items-center justify-center gap-2 flex-row-reverse whitespace-nowrap"
              onClick={() => {
                setAttending(true);
                setShowDetailsModal(true);
              }}
            >
              <span className="text-white text-2xl">✓</span>
              <span>מגיעים</span>
            </button>

            {/* Red "לא מגיעים" button on the left */}
            <button
              className="rounded-full bg-red-600 text-white border border-red-700 px-16 py-2 text-base font-medium hover:bg-red-700 flex items-center justify-center gap-2 flex-row-reverse"
              onClick={() => {
                setAttending(false);
                saveStatus(false);
              }}
            >
              <span className="text-white text-2xl">✗</span>
              <span>לא מגיעים</span>
            </button>
          </div>
        ) : attending === false ? (
          <p className="text-center text-gray-600">תודה על העדכון!</p>
        ) : null}
      </div>

      <div className="flex justify-center w-full mt-0 mb-0 flex-shrink-0">
        {/* Closed button removed */}
      </div>

      {/* Embedded Map Modal */}
      {console.log('showMap state:', showMap)}
      {showMap && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <div className="relative bg-white rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
            <button 
              onClick={() => setShowMap(false)} 
              className="absolute top-4 left-4 text-3xl text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center font-bold transition-all z-10" 
              aria-label="סגור"
            >
              &times;
            </button>
            
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold text-center text-primary">מפת הגעה לאולם</h2>
              {guest?.hall_name && (
                <p className="text-center text-gray-600 mt-1">{guest.hall_name}</p>
              )}
              {guest?.hall_address && (
                <p className="text-center text-gray-500 text-sm mt-1">{guest.hall_address}</p>
              )}
            </div>
            
            <div className="flex-1 relative bg-gray-100 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="text-6xl">🗺️</div>
                <div>
                  <h3 className="text-xl font-bold text-gray-700 mb-2">מיקום האולם</h3>
                  <p className="text-gray-600 mb-4">{guest?.hall_address || 'כתובת לא זמינה'}</p>
                  <button
                    onClick={() => {
                      const targetUrl = wazeUrl || (guest?.hall_address
                        ? `https://www.waze.com/ul?q=${encodeURIComponent(guest.hall_address)}&navigate=yes&zoom=17&lang=heb`
                        : 'https://www.waze.com/ul?ll=31.771959,35.217018&navigate=yes&zoom=7&lang=heb');
                      window.open(targetUrl, '_blank');
                    }}
                    className="bg-blue-600 text-white px-8 py-3 rounded-full hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <span role="img" aria-label="ניווט">🧭</span>
                    פתח ניווט ב-Waze
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50">
              <div className="flex justify-center">
                <button
                  onClick={() => setShowMap(false)}
                  className="bg-gray-600 text-white px-8 py-3 rounded-full hover:bg-gray-700 transition-colors"
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal - opens when clicking "מגיעים" */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="min-h-screen flex items-center justify-center p-2 sm:p-4">
            <div className="relative bg-white rounded-lg w-full max-w-6xl my-4 flex flex-col max-h-[95vh]">
              <button
                onClick={() => {
                  // Reset attending state when closing modal, so user can choose again
                  setAttending(null);
                  setShowDetailsModal(false);
                  // Reset form fields to default values
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
                className="absolute top-2 left-2 text-2xl text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center font-bold transition-all z-10 touch-manipulation"
                aria-label="סגור"
              >
                &times;
              </button>

              <div className="p-3 sm:p-4 border-b flex-shrink-0">
                <h2 className="text-xl sm:text-2xl font-bold text-center text-primary">פירוט אישור הגעה</h2>
                <p className="text-center text-gray-600 text-sm sm:text-base mt-1">מעולה! אנא עדכן/י את מספר המשתתפים (בוגרים וילדים) שיגיעו יחד איתך.</p>
              </div>

              <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
                {/* Error message - displayed at top of modal */}
                {formError && (
                  <div className="bg-red-100 border-2 border-red-500 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 text-right">
                    <div className="flex items-center justify-center">
                      <span className="text-red-600 text-xl sm:text-2xl mr-2">✗</span>
                      <p className="text-red-600 text-sm sm:text-lg font-medium">{formError}</p>
                    </div>
                  </div>
                )}

                {/* participant counts - prominent section */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-blue-800 mb-2 text-center">מספר משתתפים</h3>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="mb-1 block font-bold text-base sm:text-lg text-blue-900">סה"כ בוגרים</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full rounded-md border-2 border-blue-300 p-2 sm:p-3 text-lg sm:text-xl text-center font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        value={adults}
                        onChange={(e) => {
                          setAdults(Number(e.target.value));
                          if (formError) setFormError('');
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-bold text-base sm:text-lg text-blue-900">סה"כ ילדים</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full rounded-md border-2 border-blue-300 p-2 sm:p-3 text-lg sm:text-xl text-center font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        value={children}
                        onChange={(e) => {
                          setChildren(Number(e.target.value));
                          if (formError) setFormError('');
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* special meals */}
                <h2 className="mb-2 text-lg sm:text-xl font-bold">מנות מיוחדות</h2>
                <div className="overflow-x-auto mb-3 sm:mb-4">
                  <table className="w-full text-right border min-w-[300px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border p-2 text-sm sm:text-base">קטגוריה</th>
                        <th className="border p-2 text-sm sm:text-base w-20 sm:w-24">בוגרים</th>
                        <th className="border p-2 text-sm sm:text-base w-20 sm:w-24">ילדים</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mealCategories.map((c) => (
                        <tr key={c.key} className="odd:bg-white even:bg-gray-50">
                          <td className="border p-2 font-medium text-sm sm:text-lg">{c.label}</td>
                          <td className="border p-2">
                            <input
                              type="number"
                              min="0"
                              className="w-full rounded-md border p-1.5 text-sm sm:text-base text-center max-w-[60px] sm:max-w-[80px] mx-auto"
                              value={specialMeals[c.key].adults}
                              onChange={(e) => updateMeal(c.key, 'adults', Number(e.target.value))}
                            />
                          </td>
                          <td className="border p-2">
                            <input
                              type="number"
                              min="0"
                              className="w-full rounded-md border p-1.5 text-sm sm:text-base text-center max-w-[60px] sm:max-w-[80px] mx-auto"
                              value={specialMeals[c.key].children}
                              onChange={(e) => updateMeal(c.key, 'children', Number(e.target.value))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* allergies */}
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold">אלרגיות נוספות</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm">להוספת אלרגיה לחץ</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addAllergy();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addAllergy();
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 active:bg-green-800 text-xl font-bold touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    +
                  </button>
                </div>
              </div>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-right border min-w-[300px]">
                    <thead className="sticky top-0 bg-gray-100 z-10">
                      <tr>
                        <th className="border p-2 text-sm sm:text-base">תיאור</th>
                        <th className="border p-2 text-sm sm:text-base w-16 sm:w-20">בוגרים</th>
                        <th className="border p-2 text-sm sm:text-base w-16 sm:w-20">ילדים</th>
                        <th className="border p-2 text-sm sm:text-base w-10 sm:w-12"></th>
                      </tr>
                    </thead>
                  <tbody>
                    {allergies.map((a, idx) => (
                      <tr key={idx} className="odd:bg-white even:bg-gray-50">
                        <td className="border p-2">
                          <input
                            type="text"
                            className="w-full rounded-md border p-1.5 text-sm md:text-lg"
                            value={a.description}
                            onChange={(e) => updateAllergy(idx, 'description', e.target.value)}
                            placeholder="תיאור האלרגיה"
                          />
                        </td>
                        <td className="border p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            className="w-full rounded-md border p-1.5 text-sm md:text-base text-center max-w-[60px] md:max-w-[80px] mx-auto"
                            value={a.adults}
                            onChange={(e) => updateAllergy(idx, 'adults', Number(e.target.value))}
                          />
                        </td>
                        <td className="border p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            className="w-full rounded-md border p-1.5 text-sm md:text-base text-center max-w-[60px] md:max-w-[80px] mx-auto"
                            value={a.children}
                            onChange={(e) => updateAllergy(idx, 'children', Number(e.target.value))}
                          />
                        </td>
                        <td className="border p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeAllergy(idx)}
                            className="text-red-600 text-lg hover:text-red-800 touch-manipulation p-1"
                          >
                            ❌
                          </button>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 sm:p-4 border-t bg-gray-50 flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 flex-shrink-0">
                <button
                  type="button"
                  className="rounded-full bg-green-600 px-12 sm:px-16 py-3 sm:py-4 font-medium text-white hover:bg-green-700 active:bg-green-800 transition-colors text-lg sm:text-xl touch-manipulation"
                  onClick={async () => {
                    const success = await handleSave();
                    // Only close modal if save was successful (no errors)
                    if (success) {
                      setShowDetailsModal(false);
                    }
                    // If there's an error, the modal stays open and shows the error message
                  }}
                >
                  שלח אישור
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Reset attending state when canceling, so user can choose again
                    setAttending(null);
                    setShowDetailsModal(false);
                    // Reset form fields to default values
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
                  className="bg-red-600 text-white px-10 sm:px-12 py-3 sm:py-4 rounded-full hover:bg-red-700 active:bg-red-800 transition-colors font-medium text-lg sm:text-xl touch-manipulation"
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
