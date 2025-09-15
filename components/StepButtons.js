import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../lib/supabaseClient';
import DatePicker, { registerLocale } from 'react-datepicker';
import he from 'date-fns/locale/he';
import 'react-datepicker/dist/react-datepicker.css';

// Register Hebrew locale for datepicker
registerLocale('he', he);

const StepButtons = forwardRef(function StepButtons(_, ref) {
  const steps = ['שלב 1 - סוג אירוע', 'שלב 2 - פרטי האירוע', 'שלב 3 - בחר עיצוב הזמנה', 'שלב 4 - שליחת הזמנה לאורח', 'שלב 5 - דוחו"ת אישורי הגעה'];
  const eventTypes = ['חתונה', 'חינה', 'בר מצווה', 'בת מצווה', 'ברית', 'בריתה', 'יום הולדת', 'אירוע עסקי'];
  const times = Array.from({ length: (24 - 8) * 2 }, (_, i) => {
    const totalHalfHours = 16 + i; // מתחילים מ-08:00
    const hours = String(Math.floor(totalHalfHours / 2)).padStart(2, '0');
    const minutes = totalHalfHours % 2 === 0 ? '00' : '30';
    return `${hours}:${minutes}`;
  });

  const [showEventTypes, setShowEventTypes] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState('');
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [formData, setFormData] = useState({
    brideName: '',
    groomName: '',
    brideParents: '',
    groomParents: '',
    boyName: '',
    boyParents: '',
    girlName: '',
    girlParents: '',
    babyParents: '',
    birthdayName: '',
    birthdayAge: '',
    businessName: '',
    businessContact: '',
    date: '',
    time: '19:30',
    chuppahTime: '21:00',
    hallName: '',
    hallAddress: '',
    customEventDescription: 'תיאור האירוע',
  });
  const [formErrors, setFormErrors] = useState({});
  const [eventDetailsCompleted, setEventDetailsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Global error message for skipped steps
  const [stepErrorMsg, setStepErrorMsg] = useState('');

  // Reports menu visibility
  const [showReportsOptions, setShowReportsOptions] = useState(false);
  const [showApprovedReport, setShowApprovedReport] = useState(false);
  const [approvedGuests, setApprovedGuests] = useState([]);
  const [showRejectedReport, setShowRejectedReport] = useState(false);
  const [rejectedGuests, setRejectedGuests] = useState([]);
  const [showPendingReport, setShowPendingReport] = useState(false);
  const [pendingGuests, setPendingGuests] = useState([]);

  // Clear global "missing details" error once all required fields are provided
  React.useEffect(() => {
    if (errorMsg !== 'נא למלא את כל הפרטים.') return;

    // Re-evaluate missing fields with the same rules used in handleSaveDetails
    const missing = Object.entries(formData).filter(([key, value]) => {
      if (key === 'customEventDescription') return false; // שדה טקסט חופשי – לא חובה
      if (key === 'chuppahTime' && selectedEventType !== 'חתונה') return false;
      if (['groomName', 'brideName', 'brideParents', 'groomParents'].includes(key) && !['חתונה', 'חינה'].includes(selectedEventType)) return false;
      if (['boyName', 'boyParents'].includes(key) && selectedEventType !== 'בר מצווה') return false;
      if (['girlName', 'girlParents'].includes(key) && selectedEventType !== 'בת מצווה') return false;
      if (['babyParents'].includes(key) && !['ברית','בריתה'].includes(selectedEventType)) return false;
      if (['birthdayName', 'birthdayAge'].includes(key) && selectedEventType !== 'יום הולדת') return false;
      if (['businessName', 'businessContact'].includes(key) && selectedEventType !== 'אירוע עסקי') return false;
      return !value.trim();
    });

    if (missing.length === 0) {
      setErrorMsg('');
      setFormErrors({});
    }
  }, [formData, selectedEventType, errorMsg]);

  // --- Guest invitation state ---
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestData, setGuestData] = useState({
    guestFirstName: '',
    guestLastName: '',
    guestPhone: '',
    guestEmail: '',
  });
  const [guestErrors, setGuestErrors] = useState({});
  const [guestErrorMsg, setGuestErrorMsg] = useState('');
  const [invitationSent, setInvitationSent] = useState(false);
  const [rsvpConfirmed, setRsvpConfirmed] = useState(false);
  const [showGuestListModal, setShowGuestListModal] = useState(false);
  const [sentGuests, setSentGuests] = useState([]);
  // Guests fetched from Supabase (latest event)
  const [dbGuests, setDbGuests] = useState([]);
  const [previewLink, setPreviewLink] = useState(''); // RSVP link for preview
  const [selectedReport, setSelectedReport] = useState('pending');
  // Guest search modal
  const [showSearchGuest, setShowSearchGuest] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');

  // --- Share message state ---
  // Share modal state removed – reverting to direct WhatsApp share

  const [deleteIdx, setDeleteIdx] = useState(null);
  const [showStep5Options, setShowStep5Options] = useState(false);
  const [showRsvpQuestion, setShowRsvpQuestion] = useState(false);
  const [showDesignChooser, setShowDesignChooser] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [countError, setCountError] = useState('');
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
        [field]: field === 'description' ? val : val < 0 ? 0 : val,
      },
    }));
  };

  const updateAllergy = (idx, field, val) => {
    setAllergies((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: field==='description'? val : val<0?0:val } : a))
    );
  };

  const addAllergy = () => setAllergies((prev)=>[...prev,{description:'',adults:0,children:0}]);
  const removeAllergy = (idx)=> setAllergies((prev)=>prev.filter((_,i)=>i!==idx));

  const handleDeleteGuest = (idxToDelete) => {
    setDeleteIdx(idxToDelete);
  };

  const confirmDelete = () => {
    setSentGuests((prev) => prev.filter((_, i) => i !== deleteIdx));
    setDeleteIdx(null);
  };

  const cancelDelete = () => setDeleteIdx(null);

  // ------------------------------

  const handleSaveDetails = () => {
    // Validate date is in the future (> today)
    const today = new Date();
    today.setHours(0,0,0,0);
    const selectedDate = formData.date ? new Date(formData.date) : null;

    if (selectedDate && selectedDate <= today) {
      setFormErrors((prev)=>({...prev, date:true}));
      setErrorMsg('תאריך האירוע חייב להיות עתידי.');
      return;
    }

    // Hebrew labels for form keys (reused)
    const labels = {
      brideName: 'שם הכלה',
      groomName: 'שם החתן',
      brideParents: 'שם הורי הכלה',
      groomParents: 'שם הורי החתן',
      boyName: 'שם חתן בר מצווה',
      boyParents: 'שם ההורים',
      girlName: 'שם כלת בת מצווה',
      girlParents: 'שם ההורים',
      babyParents: 'שם ההורים',
      birthdayName: 'שם החוגג/ת',
      birthdayAge: 'גיל',
      businessName: 'שם החברה',
      businessContact: 'איש קשר',
      date: 'תאריך האירוע',
      time: 'שעת האירוע',
      chuppahTime: 'שעת החופה',
      hallName: 'שם האולם',
      hallAddress: 'כתובת האולם',
    };

    const getMissingDetails = () => {
      return Object.entries(formData).filter(([key, value]) => {
        if (key === 'customEventDescription') return false; // שדה טקסט חופשי – לא חובה
        if (key === 'chuppahTime' && selectedEventType !== 'חתונה') return false;
        if (['groomName', 'brideName', 'brideParents', 'groomParents'].includes(key) && !['חתונה', 'חינה'].includes(selectedEventType)) return false;
        if (['boyName', 'boyParents'].includes(key) && selectedEventType !== 'בר מצווה') return false;
        if (['girlName', 'girlParents'].includes(key) && selectedEventType !== 'בת מצווה') return false;
        if (['babyParents'].includes(key) && !['ברית','בריתה'].includes(selectedEventType)) return false;
        if (['birthdayName', 'birthdayAge'].includes(key) && selectedEventType !== 'יום הולדת') return false;
        if (['businessName', 'businessContact'].includes(key) && selectedEventType !== 'אירוע עסקי') return false;
        return !value.trim();
      });
    };

    const missing = getMissingDetails();
    if (missing.length) {
      const errs = missing.reduce((acc, [key]) => ({ ...acc, [key]: true }), {});
      setFormErrors(errs);
      const missingLabels = missing.map(([key]) => labels[key] || key);
      setErrorMsg(`נא למלא את השדות הבאים: ${missingLabels.join(', ')}`);
    } else {
      setFormErrors({});
      setErrorMsg('');
      setStepErrorMsg('');
      setShowEventDetails(false);
      setEventDetailsCompleted(true);
      // Automatically proceed to step 3 – design chooser
      setShowDesignChooser(true);
    }
  };

  const handleSelectEvent = (type) => {
    setSelectedEventType(normalizeType(type));
    setEventDetailsCompleted(false);
    setShowEventTypes(false);
    setShowEventDetails(true);
  };

      // Helper to format ISO date (YYYY-MM-DD) to Hebrew format (DD/MM/YYYY)
    const formatDateToHebrew = (isoDate) => {
      if (!isoDate) return '';
      const [year, month, day] = isoDate.split('-');
      return `${day}/${month}/${year}`;
    };

    /**
     * Try to share an invitation image using the Web Share API (level 2 – files).
     * Falls back to returning false if not supported or on error.
     * @param {string} url Public URL of the invitation image (jpg)
     * @param {string} guestFirstName Name of guest for greeting
     * @returns {Promise<boolean>} true if shared successfully, else false
     */
    const shareInviteImage = async (url, guestFirstName, inviteLink) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], 'invite.jpg', { type: 'image/jpeg' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'הזמנה',
            text: `היי ${guestFirstName}, מצורפת ההזמנה שלנו.\nלאישור הגעה והזנת פרטי משתתפים:\n${inviteLink}`,
          });
          return true;
        }
      } catch (e) {
        console.error('Share invite image failed', e);
      }
      return false;
    };

    const handleSendInvitation = async () => {
      const required = ['guestFirstName', 'guestLastName', 'guestPhone'];
    const missingFields = required.filter((key) => !guestData[key].toString().trim());

    if (missingFields.length) {
      const errs = missingFields.reduce((acc, key) => ({ ...acc, [key]: true }), {});
      setGuestErrors(errs);
      setGuestErrorMsg('נא למלא שם פרטי, שם משפחה ומספר טלפון תקין.');
      return;
    }

    // Validate phone - must contain exactly 10 digits (Israeli format e.g., 05XXXXXXXX)
    const digitsOnly = guestData.guestPhone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setGuestErrors({ guestPhone: true });
      setGuestErrorMsg('מספר טלפון לא תקין – יש להזין 10 ספרות.');
      return;
    }

    // Validate email using simple regex
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (guestData.guestEmail.trim() && !emailPattern.test(guestData.guestEmail)) {
      setGuestErrors({ guestEmail: true });
      setGuestErrorMsg('המייל לא תקין');
      return;
    }

    // Attempt to save guest to Supabase (optional – will work only if table exists)
    try {
      // fetch latest event id for this user
      const { data: { user } } = await supabase.auth.getUser();
      const { data: evRow } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { data: newGuest, error } = await supabase
        .from('invited_guests')
        .insert([
          {
            user_id: user.id,
            event_id: evRow?.id || null,
            first_name: guestData.guestFirstName,
            last_name: guestData.guestLastName,
            phone: guestData.guestPhone,
            email: guestData.guestEmail || null,
            total_guests: 1,
            adults: 1,
          },
        ])
        .select()
        .single();
      if (error) throw error;

      const inviteLink = `${window.location.origin}/${evRow?.id}/${newGuest.id}`;

      // Dev helper: log the RSVP link so it can be copied from the browser console
      if (process.env.NODE_ENV !== 'production') {
        console.log('RSVP link:', inviteLink);
      }

      // Fetch invitation public URL
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: ev } = await supabase
          .from('events')
          .select('invitation_path')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        let inviteUrl = '';
        if (ev && ev.invitation_path) {
          if (ev.invitation_path.startsWith('http')) {
            inviteUrl = ev.invitation_path;
          } else {
            const { data: urlData } = supabase.storage
              .from('invites')
              .getPublicUrl(ev.invitation_path);
            inviteUrl = urlData.publicUrl;
          }
        }

        // Compose a copy-friendly message: text, image URL, then RSVP link
        const messageContent = `${invitationText}\n\n${inviteLink}`; // omit raw image URL in text
        // Open WhatsApp with pre-filled message (image URL gives preview)
        const waNumber = digitsOnly;
        const waText = encodeURIComponent(
          `${invitationText}\n\n` +
          `מצורפת ההזמנה לאירוע:\n${inviteUrl}\n\n` +
          `לאישור השתתפות לחצו על הקישור:\n${inviteLink}`
        );
        const waWin = window.open(`https://wa.me/972${waNumber.slice(1)}?text=${waText}`, '_blank','noopener,noreferrer');
        if (!waWin) {
          console.warn('WhatsApp popup possibly blocked');
        }
      } catch (err) {
        console.error('Failed to send invitation:', err);
        setGuestErrorMsg('אירעה שגיאה בשליחת ההזמנה.');
      }
    } catch (err) {
      console.error('Failed to send invitation:', err);
      setGuestErrorMsg('אירעה שגיאה בשליחת ההזמנה.');
    }
  };

  // Quick SMS sender – opens default SMS app with pre-filled text (mobile browsers)
  const handleSendInvitationSms = async () => {
    const digitsOnly = guestData.guestPhone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setGuestErrors({ guestPhone: true });
      setGuestErrorMsg('מספר טלפון לא תקין – יש להזין 10 ספרות.');
      return;
    }

    try {
      // create guest in DB (similar to WA function but without opening WA)
      const { data: { user } } = await supabase.auth.getUser();
      const { data: evRow } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { data: newGuest, error } = await supabase
        .from('invited_guests')
        .insert([
          {
            user_id: user.id,
            event_id: evRow?.id || null,
            first_name: guestData.guestFirstName,
            last_name: guestData.guestLastName,
            phone: guestData.guestPhone,
            email: guestData.guestEmail || null,
            total_guests: 1,
            adults: 1,
          },
        ])
        .select()
        .single();
      if (error) throw error;

      const inviteLink = `${window.location.origin}/${evRow?.id}/${newGuest.id}`;

      // Compose message
      const smsBody = encodeURIComponent(`${invitationText}\n\nלאישור השתתפות לחצו על הקישור:\n${inviteLink}`);
      window.open(`sms:972${digitsOnly.slice(1)}?body=${smsBody}`, '_blank', 'noopener,noreferrer');
      setInvitationSent(true);
    } catch (err) {
      console.error('Failed to send SMS invitation', err);
      setGuestErrorMsg('אירעה שגיאה בשליחת ההזמנה בסמס.');
    }
  };

  // כל קבצי העיצוב הקיימים בתיקייה public/images
  const designImages = [
    '/images/עיצוב-הזמנה-1.jpg',
    '/images/עיצוב-הזמנה-2.jpg',
    '/images/עיצוב-הזמנה-3.jpg',
    '/images/עיצוב-הזמנה-4.jpg',
    '/images/עיצוב-הזמנה-5.jpg',
    '/images/עיצוב-הזמנה-6.jpg',
    '/images/עיצוב-הזמנה-7.jpg',
    '/images/עיצוב-הזמנה-8.jpg',
    '/images/עיצוב-הזמנה-9.jpg',
    '/images/עיצוב-הזמנה-10.jpg',
    '/images/עיצוב-הזמנה-11.jpg',
    '/images/עיצוב-הזמנה-12.jpg',
    '/images/עיצוב-הזמנה-13.jpg',
    '/images/עיצוב-הזמנה-14.jpg',
    '/images/עיצוב-הזמנה-15.jpg',
    '/images/עיצוב-הזמנה-16.jpg',
    '/images/עיצוב-הזמנה-17.jpg',
    '/images/עיצוב הזמנה-18.jpg',
    '/images/עיצוב-הזמנה-19.jpg',
    '/images/עיצוב-הזמנה-20.jpg',
    '/images/עיצוב-הזמנה-21.jpg',
  ];

  const [selectedDesign, setSelectedDesign] = useState(null);
  const fontsOptions = [
    { key: 'gloria', label: 'Gloria Hallelujah', css: "'Gloria Hallelujah', cursive" },
    { key: 'assistant', label: 'Assistant', css: "'Assistant', sans-serif" },
    { key: 'mplus', label: 'M PLUS 1p', css: "'M PLUS 1p', sans-serif" },
    { key: 'secular', label: 'Secular One', css: "'Secular One', sans-serif" },
    { key: 'ojuju', label: 'Ojuju', css: "'Ojuju', sans-serif" },
    { key: 'macondo', label: 'Macondo', css: "'Macondo', cursive" },
  ];
  const [selectedFontKey, setSelectedFontKey] = useState('assistant');
  const selectedFontCss = fontsOptions.find(f=>f.key===selectedFontKey)?.css;
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [uploadingInvite, setUploadingInvite] = useState(false);

  // ---------- Invitation text templates ----------
  const invitationTemplates = {
    'חתונה': (d) => `${d.brideParents} ובתם ${d.brideName} יחד עם ${d.groomParents} ובנם ${d.groomName}\nשמחים להזמינכם לחגוג עמנו את חתונת ילדינו\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}\nחופה תתקיים בשעה ${d.chuppahTime}`,
    'חינה': (d) => `${d.brideParents} ובתם ${d.brideName} יחד עם ${d.groomParents} ובנם ${d.groomName}\nמזמינים אתכם לחגוג עמנו בחינה\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'בר מצווה': (d)=> `אנו, ${d.boyParents},\nמזמינים אתכם לחגוג עמנו את בר המצווה של בננו ${d.boyName}\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'בת מצווה': (d)=> `אנו, ${d.girlParents},\nמזמינים אתכם לחגוג עמנו את בת המצווה של בתנו ${d.girlName}\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'ברית': (d)=> `אנו, ${d.babyParents},\nשמחים להזמינכם לברית בננו\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'בריתה': (d)=> `אנו, ${d.babyParents},\nשמחים להזמינכם לבריתה בתנו\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'יום הולדת': (d)=> `את/ה מוזמנ/ת לחגוג עם ${d.birthdayName} יום הולדת ${d.birthdayAge}!\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nב-${d.hallName}, ${d.hallAddress}`,
    'אירוע עסקי': (d)=> `חברת ${d.businessName} (${d.businessContact})\nמתכבדת להזמינך לאירוע העסקי שלנו\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nב-${d.hallName}, ${d.hallAddress}`,
  };

  const normalizeType = (t) => (t === 'ברית/ה' || t === 'בריתה' ? 'ברית' : t);

  const [customInvitationText, setCustomInvitationText] = useState('');

  const invitationTextDefault = selectedEventType && invitationTemplates[normalizeType(selectedEventType)]
    ? `הזמנה ל${selectedEventType}\n\n` + invitationTemplates[normalizeType(selectedEventType)](formData)
    : '';
  const invitationText = customInvitationText.trim() || invitationTextDefault;

  // Reset custom text when event type changes so default reflects new event
  React.useEffect(() => {
    setCustomInvitationText('');
  }, [selectedEventType]);

  // When design chooser opens the first time, prefill the textarea with default text so user edits retain event details
  React.useEffect(() => {
    if (showDesignChooser && !customInvitationText) {
      setCustomInvitationText(invitationTextDefault);
    }
  }, [showDesignChooser, invitationTextDefault, customInvitationText]);

  React.useEffect(()=>{
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('events')
        .select('event_type, event_details, invitation_path')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error || !data) return;
      const details = data.event_details || {};
      setSelectedEventType(data.event_type);
      setFormData((prev)=>({ ...prev, ...details }));
      setEventDetailsCompleted(true);

      // get public URL for invitation image
      let url = data.invitation_path;
      if (url && !url.startsWith('http')) {
        const { data: urlData } = supabase.storage.from('invites').getPublicUrl(url);
        url = urlData.publicUrl;
      }
      setSelectedDesign(url);
    })();
  }, []);

  // Expose imperative method to start the flow from parent components (e.g., "התחל עכשיו")
  useImperativeHandle(ref, () => ({
    startFlow: () => {
      setShowEventTypes(true);
      setStepErrorMsg('');
    },
  }));

  const saveEventToSupabase = async (designSrc) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        user_id: user?.id || null,
        event_type: selectedEventType,
        event_details: {
          ...formData,
          invitation_text: invitationText,
          font: selectedFontKey,
        },
        invitation_path: designSrc,
      };

      await supabase.from('events').insert(payload);
    } catch (err) {
      console.error('Failed to save event', err);
    }
  };

  /**
   * Generate canvas image with overlayed text and selected font.
   * @param {string} imgSrc local image url
   * @param {string} txt invitation text (may contain \n)
   * @param {string} fontCSS e.g. "'Macondo', cursive"
   * @returns {Promise<Blob>} image/jpeg blob
   */
  const generateInvitationBlob = (imgSrc, txt, fontCSS) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Text styles
        const fontSize = Math.floor(canvas.height * 0.04); // 4% of height
        ctx.font = `${fontSize}px ${fontCSS}`;
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const lines = txt.split('\n');
        const lineHeight = fontSize * 1.4;
        const totalHeight = lineHeight * lines.length;
        let startY = (canvas.height - totalHeight) / 2;
        lines.forEach((line, idx) => {
          ctx.fillText(line.trim(), canvas.width / 2, startY + idx * lineHeight);
        });

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/jpeg', 0.9);
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = imgSrc;
    });
  };

  const handleChooseDesign = async (src) => {
    setUploadingInvite(true);
    try {
      // compose image
      const blob = await generateInvitationBlob(src, invitationText || ' ', selectedFontCss);
      const fileName = `${(typeof crypto!== 'undefined' && crypto.randomUUID)? crypto.randomUUID() : Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage.from('invites').upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (uploadError) throw uploadError;

      await saveEventToSupabase(fileName);

      setSelectedDesign(src);
      setStepErrorMsg('');
      setShowLightbox(false);
      setShowDesignChooser(false);
    } catch (err) {
      console.error('Upload failed', err);
      alert('שגיאה בהעלאת ההזמנה');
    } finally {
      setUploadingInvite(false);
    }
  };

  // --- Reports modal state ---
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportGuests, setReportGuests] = useState([]);
  const [reportTitle, setReportTitle] = useState('');

  // Compute totals for report
  const totalReportAdults = reportGuests.reduce((sum, g) => sum + (g.adults || 0), 0);
  const totalReportChildren = reportGuests.reduce((sum, g) => sum + (g.children || 0), 0);
  const totalVeg = reportGuests.reduce((sum, g) => sum + ((g.veg_adults||0)+(g.veg_children||0)),0);
  const totalVegan = reportGuests.reduce((sum, g) => sum + ((g.vegan_adults||0)+(g.vegan_children||0)),0);
  const totalGlatt = reportGuests.reduce((sum, g) => sum + ((g.glatt_adults||0)+(g.glatt_children||0)),0);
  const totalAllergy = reportGuests.reduce((sum, g) => sum + ((g.allergy_adults||0)+(g.allergy_children||0)),0);

  // Fetch guests when guest list modal opens
  React.useEffect(() => {
    if (!showGuestListModal) return;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Get latest event id for this user
        const { data: evRow } = await supabase
          .from('events')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!evRow) return;

        const { data: guests } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('event_id', evRow.id);

        setDbGuests(guests || []);
      } catch (e) {
        console.error('Failed to fetch guest list', e);
      }
    })();
  }, [showGuestListModal]);

  // Handle guest search
  const handleGuestSearch = async () => {
    setSearchError('');
    setSearchResults([]);
    if (!searchTerm.trim()) {
      setSearchError('נא להזין שם או טלפון');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: evRow } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!evRow) return;

      const term = searchTerm.trim();
      const { data: guests, error } = await supabase
        .from('invited_guests')
        .select('*')
        .eq('user_id', user.id)
        .or(`first_name.ilike.*${term}*,last_name.ilike.*${term}*,phone.ilike.*${term}*`);
      if (error) throw error;

      if (!guests.length) {
        setSearchError('לא נמצאו אורחים תואמים');
      } else {
        setSearchResults(guests);
      }
    } catch (e) {
      console.error('search guest failed', e);
      setSearchError('שגיאה בחיפוש');
    }
  };

  // fetch approved guests when report opens
  React.useEffect(() => {
    if (!showApprovedReport) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'approved');
        setApprovedGuests(data || []);
      } catch (e) {
        console.error('fetch approved guests failed', e);
      }
    })();
  }, [showApprovedReport]);

  // fetch rejected guests
  React.useEffect(() => {
    if (!showRejectedReport) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'rejected');
        setRejectedGuests(data || []);
      } catch (e) {
        console.error('fetch rejected guests failed', e);
      }
    })();
  }, [showRejectedReport]);

  // fetch pending guests
  React.useEffect(() => {
    if (!showPendingReport) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('user_id', user.id)
          .or('status.is.null,status.eq.pending,status.eq.""');
        setPendingGuests(data || []);
      } catch (e) {
        console.error('fetch pending guests failed', e);
      }
    })();
  }, [showPendingReport]);

  // Helper to export approved guests to CSV (Excel)
  const exportApprovedCsv = () => {
    if (!approvedGuests.length) return;
    const headers = ['#','שם פרטי','שם משפחה','טלפון','בוגרים','ילדים','סה"כ','צמחוני','טבעוני','גלאט','אלרגיות','הערות'];
    const rows = approvedGuests.map((g,idx)=>[
      idx+1,
      g.first_name,
      g.last_name,
      g.phone,
      g.adults||0,
      g.children||0,
      (g.adults||0)+(g.children||0),
      (g.veg_adults||0)+(g.veg_children||0),
      (g.vegan_adults||0)+(g.vegan_children||0),
      (g.glatt_adults||0)+(g.glatt_children||0),
      (g.allergy_adults||0)+(g.allergy_children||0),
      g.allergy_note || (((g.allergy_adults||0)+(g.allergy_children||0))>0?'אלרגיה':'-')
    ]);

    // Summary totals
    const totalAdults = approvedGuests.reduce((s,g)=>s+(g.adults||0),0);
    const totalChildren = approvedGuests.reduce((s,g)=>s+(g.children||0),0);
    const totalTotal = totalAdults + totalChildren;
    const totalVeg = approvedGuests.reduce((s,g)=>s+(g.veg_adults||0)+(g.veg_children||0),0);
    const totalVegan = approvedGuests.reduce((s,g)=>s+(g.vegan_adults||0)+(g.vegan_children||0),0);
    const totalGlatt = approvedGuests.reduce((s,g)=>s+(g.glatt_adults||0)+(g.glatt_children||0),0);
    const totalAllergy = approvedGuests.reduce((s,g)=>s+(g.allergy_adults||0)+(g.allergy_children||0),0);

    rows.push(['','סה"כ','','',totalAdults,totalChildren,totalTotal,totalVeg,totalVegan,totalGlatt,totalAllergy,'']);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
    const blob = new Blob([csvContent],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'approved_guests.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="w-full flex flex-row justify-center gap-6 py-8">
        {steps.map((step, idx) => (
          <button
            key={idx}
            onClick={
              idx === 0
                ? () => { setShowEventTypes(true); setStepErrorMsg(''); }
                : idx === 1
                ? () => {
                    if (selectedEventType) {
                      setShowEventDetails(true);
                      setStepErrorMsg('');
                    } else {
                      const msg = 'עליך לבחור סוג אירוע לפני מעבר לשלב זה';
                      setStepErrorMsg(msg);
                      setErrorMsg(msg);
                      alert(msg);
                      setShowEventTypes(true);
                    }
                  }
                : idx === 2
                ? () => {
                    if (!selectedEventType) {
                      const msg = 'עליך לבחור סוג אירוע לפני מעבר לשלב זה';
                      setStepErrorMsg(msg);
                      setErrorMsg(msg);
                      alert(msg);
                      setShowEventTypes(true);
                    } else if (!eventDetailsCompleted) {
                      const missing = getMissingDetails();
                      const msg = missing.length
                        ? `נא למלא את השדות הבאים: ${missing.map(([k])=>labels[k]||k).join(', ')}`
                        : 'נא למלא את פרטי האירוע לפני מעבר לשלב זה';
                      setStepErrorMsg(msg);
                      setErrorMsg(msg);
                      alert(msg);
                      setShowEventDetails(true);
                    } else {
                      setStepErrorMsg('');
                      setShowDesignChooser(true);
                    }
                  }
                : idx === 3
                ? () => {
                    if (!selectedEventType) {
                      const msg = 'עליך לבחור סוג אירוע לפני מעבר לשלב זה';
                      setStepErrorMsg(msg);
                      setErrorMsg(msg);
                      alert(msg);
                      setShowEventTypes(true);
                    } else if (!eventDetailsCompleted) {
                      const missing = getMissingDetails();
                      const msg = missing.length
                        ? `נא למלא את השדות הבאים: ${missing.map(([k])=>labels[k]||k).join(', ')}`
                        : 'נא למלא את פרטי האירוע לפני מעבר לשלב זה';
                      setStepErrorMsg(msg);
                      setErrorMsg(msg);
                      alert(msg);
                      setShowEventDetails(true);
                    } else if (!selectedDesign) {
                      const msg = 'יש לבחור עיצוב הזמנה לפני מעבר לשלב זה';
                      setStepErrorMsg(msg);
                      setErrorMsg(msg);
                      alert(msg);
                      setShowDesignChooser(true);
                    } else {
                      setStepErrorMsg('');
                      setShowGuestForm(true);
                    }
                  }
                : idx === 4
                ? () => {
                    setShowReportsOptions(true);
                    setShowGuestListModal(false);
                  }
                : undefined
            }
            className={`${((idx === 0 && selectedEventType) || (idx === 1 && (showEventDetails || eventDetailsCompleted)) || (idx === 2 && selectedDesign) || (idx === 3 && invitationSent) || (idx === 4 && (rsvpConfirmed || showRsvpQuestion))) ? 'bg-primary text-white' : 'bg-[#FCE6AC] text-primary'} border border-primary rounded-full px-8 py-3 font-medium ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 transition-all`}
          >
            {step}
          </button>
        ))}
      </div>

      {stepErrorMsg && (
        <p className="text-center text-red-600 text-lg font-medium mb-4">{stepErrorMsg}</p>
      )}

      {showEventTypes && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowEventTypes(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4 text-center">בחר סוג אירוע</h2>
            <ul className="space-y-3">
              {eventTypes.map((type) => (
                <li key={type}>
                  <button
                    onClick={() => handleSelectEvent(type)}
                    className={`w-full ${selectedEventType === type ? 'bg-primary text-white' : 'bg-[#FCE6AC] text-primary'} border border-primary rounded-full px-4 py-2 font-medium hover:bg-[#FCE6AC]/90 transition-all`}
                  >
                    {type}
                  </button>
                </li>
              ))}
            </ul>

            {selectedEventType && (
              <p className="text-center text-primary font-medium text-xl mt-4">האירוע הנבחר: {selectedEventType}</p>
            )}

            <button
              onClick={() => setShowEventTypes(false)}
              className="mt-6 w-full bg-primary text-white border border-primary rounded-full px-4 py-2 font-medium hover:bg-primary/90 transition-all"
            >
              שמור וסגור
            </button>
          </div>
        </div>
      )}

      {showEventDetails && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto event-form">
            <button onClick={() => setShowEventDetails(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4 text-center">{`פרטי האירוע - ${selectedEventType}`}</h2>
            {errorMsg && <p className="text-red-600 text-lg text-center mb-2">{errorMsg}</p>}
            <form className="space-y-4">
              {/* Existing event details form (unchanged) */}
              {['חתונה', 'חינה'].includes(selectedEventType) && (
                <div>
                  <label className="block mb-1 font-medium">שם הכלה</label>
                  <input type="text" placeholder="שם הכלה" value={formData.brideName} onChange={(e) => setFormData({ ...formData, brideName: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.brideName ? 'border-red-500' : ''}`} />
                </div>
              )}
              {(selectedEventType === 'חתונה' || selectedEventType === 'חינה') && (
                <div>
                  <label className="block mb-1 font-medium">שם החתן</label>
                  <input type="text" placeholder="שם החתן" value={formData.groomName} onChange={(e) => setFormData({ ...formData, groomName: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.groomName ? 'border-red-500' : ''}`} />
                </div>
              )}
              {['חתונה', 'חינה'].includes(selectedEventType) && (
                <div>
                  <label className="block mb-1 font-medium">שם הורי הכלה</label>
                  <input type="text" placeholder="שם הורי הכלה" value={formData.brideParents} onChange={(e) => setFormData({ ...formData, brideParents: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.brideParents ? 'border-red-500' : ''}`} />
                </div>
              )}
              {['חתונה', 'חינה'].includes(selectedEventType) && (
                <div>
                  <label className="block mb-1 font-medium">שם הורי החתן</label>
                  <input type="text" placeholder="שם הורי החתן" value={formData.groomParents} onChange={(e) => setFormData({ ...formData, groomParents: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.groomParents ? 'border-red-500' : ''}`} />
                </div>
              )}
              {selectedEventType === 'בר מצווה' && (
                <>
                  <div>
                    <label className="block mb-1 font-medium">שם חתן בר מצווה</label>
                    <input type="text" placeholder="שם חתן בר מצווה" value={formData.boyName} onChange={(e) => setFormData({ ...formData, boyName: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.boyName ? 'border-red-500' : ''}`} />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">שם ההורים</label>
                    <input type="text" placeholder="שם ההורים" value={formData.boyParents} onChange={(e) => setFormData({ ...formData, boyParents: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.boyParents ? 'border-red-500' : ''}`} />
                  </div>
                </>
              )}
              {selectedEventType === 'בת מצווה' && (
                <>
                  <div>
                    <label className="block mb-1 font-medium">שם כלת בת מצווה</label>
                    <input type="text" placeholder="שם כלת בת מצווה" value={formData.girlName} onChange={(e) => setFormData({ ...formData, girlName: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.girlName ? 'border-red-500' : ''}`} />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">שם ההורים</label>
                    <input type="text" placeholder="שם ההורים" value={formData.girlParents} onChange={(e) => setFormData({ ...formData, girlParents: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.girlParents ? 'border-red-500' : ''}`} />
                  </div>
                </>
              )}
              {['ברית','בריתה'].includes(selectedEventType) && (
                <>
                  <div>
                    <label className="block mb-1 font-medium">שם ההורים</label>
                    <input type="text" placeholder="שם ההורים" value={formData.babyParents} onChange={(e) => setFormData({ ...formData, babyParents: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.babyParents ? 'border-red-500' : ''}`} />
                  </div>
                </>
              )}
              {selectedEventType === 'יום הולדת' && (
                <>
                  <div>
                    <label className="block mb-1 font-medium">שם החוגג/ת</label>
                    <input type="text" placeholder="שם החוגג/ת" value={formData.birthdayName} onChange={(e) => setFormData({ ...formData, birthdayName: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.birthdayName ? 'border-red-500' : ''}`} />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">גיל</label>
                    <input type="number" placeholder="גיל" value={formData.birthdayAge} onChange={(e) => setFormData({ ...formData, birthdayAge: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.birthdayAge ? 'border-red-500' : ''}`} />
                  </div>
                </>
              )}
              {selectedEventType === 'אירוע עסקי' && (
                <>
                  <div>
                    <label className="block mb-1 font-medium">שם החברה</label>
                    <input type="text" placeholder="שם החברה" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.businessName ? 'border-red-500' : ''}`} />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">איש קשר</label>
                    <input type="text" placeholder="איש קשר" value={formData.businessContact} onChange={(e) => setFormData({ ...formData, businessContact: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.businessContact ? 'border-red-500' : ''}`} />
                  </div>
                </>
              )}
              <div>
                <label className="block mb-1 font-medium">תאריך האירוע</label>
                <DatePicker
                  selected={formData.date ? new Date(formData.date) : null}
                  onChange={(date)=> setFormData({ ...formData, date: date ? date.toISOString().slice(0,10) : '' })}
                  dateFormat="dd/MM/yyyy"
                  locale="he"
                  placeholderText="בחר תאריך"
                  className={`w-full border rounded-md p-2 ${formErrors.date ? 'border-red-500' : ''}`}
                  calendarStartDay={0}
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">שעת האירוע</label>
                <select value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.time ? 'border-red-500' : ''}`}>
                  <option value="">בחר שעה</option>
                  {times.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {selectedEventType === 'חתונה' && (
                <div>
                  <label className="block mb-1 font-medium">שעת החופה</label>
                  <select value={formData.chuppahTime} onChange={(e) => setFormData({ ...formData, chuppahTime: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.chuppahTime ? 'border-red-500' : ''}`}>
                    <option value="">בחר שעה</option>
                    {times.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block mb-1 font-medium">שם האולם</label>
                <input type="text" placeholder="שם האולם" value={formData.hallName} onChange={(e) => setFormData({ ...formData, hallName: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.hallName ? 'border-red-500' : ''}`} />
              </div>
              <div>
                <label className="block mb-1 font-medium">כתובת האולם</label>
                <input type="text" placeholder="כתובת האולם" value={formData.hallAddress} onChange={(e) => setFormData({ ...formData, hallAddress: e.target.value })} className={`w-full border rounded-md p-2 ${formErrors.hallAddress ? 'border-red-500' : ''}`} />
              </div>
              <div className="flex justify-center pt-2">
                <button type="button" onClick={handleSaveDetails} className="bg-[#FCE6AC] text-primary border border-primary rounded-full px-8 py-3 font-medium ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 transition-all">
                  שמור וסגור
                </button>
              </div>
              {errorMsg && <p className="text-red-600 text-lg text-center mt-2">{errorMsg}</p>}
            </form>
          </div>
        </div>
      )}

      {showGuestForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto event-form">
            <button onClick={() => setShowGuestForm(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4 text-center">פרטי אורח מוזמן</h2>
            {guestErrorMsg && <p className="text-red-600 text-lg text-center mb-2">{guestErrorMsg}</p>}
            <form className="space-y-4">
              <div>
                <label className="block mb-1 font-medium">שם פרטי</label>
                <input type="text" placeholder="שם פרטי" value={guestData.guestFirstName} onChange={(e) => setGuestData({ ...guestData, guestFirstName: e.target.value })} className={`w-full border rounded-md p-2 ${guestErrors.guestFirstName ? 'border-red-500' : ''}`} />
              </div>
              <div>
                <label className="block mb-1 font-medium">שם משפחה</label>
                <input type="text" placeholder="שם משפחה" value={guestData.guestLastName} onChange={(e) => setGuestData({ ...guestData, guestLastName: e.target.value })} className={`w-full border rounded-md p-2 ${guestErrors.guestLastName ? 'border-red-500' : ''}`} />
              </div>
              <div>
                <label className="block mb-1 font-medium">טלפון</label>
                <input type="tel" placeholder="טלפון" value={guestData.guestPhone} onChange={(e) => setGuestData({ ...guestData, guestPhone: e.target.value })} className={`w-full border rounded-md p-2 ${guestErrors.guestPhone ? 'border-red-500' : ''}`} />
              </div>
              <div>
                <label className="block mb-1 font-medium">אימייל (אופציונלי)</label>
                <input type="email" placeholder="אימייל" value={guestData.guestEmail} onChange={(e) => setGuestData({ ...guestData, guestEmail: e.target.value })} className={`w-full border rounded-md p-2 ${guestErrors.guestEmail ? 'border-red-500' : ''}`} />
              </div>
              <div className="flex justify-end pt-2 gap-3">
                <button type="button" onClick={handleSendInvitation} className="bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all whitespace-nowrap">
                  שלח הזמנה בוואטסאפ
                </button>
                <button type="button" onClick={handleSendInvitationSms} className="bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all whitespace-nowrap">
                  שלח הזמנה ב-SMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RSVP Confirmation Modal */}
      {showGuestListModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-md event-form">
            <button onClick={() => setShowGuestListModal(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4 text-center">דו"חות אישורי הגעה</h2>
            {/* filter buttons */}
            <div className="flex justify-center gap-2 mb-4">
              {['approved','rejected','pending'].map(key=> (
                <button key={key} onClick={()=>setSelectedReport(key)} className={`${selectedReport===key?'bg-primary text-white':'bg-[#FCE6AC] text-primary'} border border-primary rounded-full px-4 py-1 text-sm font-medium`}>
                  {key==='approved'?'אישרו הגעה': key==='rejected'?'לא מגיעים':'טרם הגיבו'}
                </button>
              ))}
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {/* הטבלה הוסרה לפי דרישה */}
            </div>
            <div className="flex justify-center mt-6">
              <button onClick={() => setShowGuestListModal(false)} className="bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all">סגור</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteIdx !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm text-center">
            <p className="text-lg mb-6">האם אתה בטוח שברצונך למחוק אורח זה?</p>
            <div className="flex justify-center gap-4">
              <button onClick={confirmDelete} className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700">מחיקה</button>
              <button onClick={cancelDelete} className="border border-gray-400 px-6 py-2 rounded-md hover:bg-gray-100">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* RSVP Yes/No Question Modal */}
      {showRsvpQuestion && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm text-center space-y-6 relative">
            <button onClick={() => setShowRsvpQuestion(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium">האם אתם מגיעים לאירוע?</h2>
            <div className="flex justify-center gap-6">
              <button
                className="bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700 text-lg font-bold"
                onClick={() => {
                  setShowRsvpQuestion(false);
                  setShowCountModal(true);
                }}
              ><span className="mr-2 text-white">✓</span> מגיעים</button>
              <button
                className="bg-red-600 text-white px-6 py-2 rounded-full hover:bg-red-700 text-lg font-bold"
                onClick={() => {
                  setRsvpConfirmed(false);
                  setShowRsvpQuestion(false);
                }}
              ><span className="mr-2 text-white">✗</span> לא מגיעים</button>
            </div>
          </div>
        </div>
      )}

      {/* Count modal */}
      {showCountModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm text-center space-y-6 relative event-form">
            <button onClick={() => setShowCountModal(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium">כמה אורחים מגיעים?</h2>
            {countError && <p className="text-red-600 text-lg font-medium text-center">{countError}</p>}
            <div className="space-y-4 text-right">
              <div>
                <label className="block mb-1 font-medium">סה"כ בוגרים</label>
                <input type="number" min="0" value={adultsCount} onChange={(e)=>setAdultsCount(parseInt(e.target.value)||0)} className="w-full border rounded-md p-2" />
              </div>
              <div>
                <label className="block mb-1 font-medium">סה"כ ילדים</label>
                <input type="number" min="0" value={childrenCount} onChange={(e)=>setChildrenCount(parseInt(e.target.value)||0)} className="w-full border rounded-md p-2" />
              </div>
            </div>

            <h3 className="text-lg font-medium mt-4">מנות מיוחדות</h3>
            <table className="w-full text-right border">
              <thead>
                <tr className="bg-gray-100 text-sm font-bold whitespace-nowrap">
                  <th className="p-1 border">קטגוריה</th>
                  <th className="p-1 border">סה"כ בוגרים</th>
                  <th className="p-1 border">סה"כ ילדים</th>
                </tr>
              </thead>
              <tbody>
                {mealCategories.map((c) => (
                  <tr key={c.key} className="odd:bg-white even:bg-gray-50">
                    <td className="p-1 border">{c.label}</td>
                    {
                      /* standard categories */
                    }
                    {c.key !== 'allergy' ? (
                      <>
                        <td className="p-1 border">
                          <input type="number" min="0" value={specialMeals[c.key].adults} onChange={(e)=>updateMeal(c.key,'adults',parseInt(e.target.value)||0)} className="w-16 border rounded-md p-1" />
                        </td>
                        <td className="p-1 border">
                          <input type="number" min="0" value={specialMeals[c.key].children} onChange={(e)=>updateMeal(c.key,'children',parseInt(e.target.value)||0)} className="w-16 border rounded-md p-1" />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-1 border">
                          <input type="number" min="0" value={specialMeals.allergy.adults} onChange={(e)=>updateMeal('allergy','adults',parseInt(e.target.value)||0)} className="w-16 border rounded-md p-1" />
                        </td>
                        <td className="p-1 border">
                          <input type="number" min="0" value={specialMeals.allergy.children} onChange={(e)=>updateMeal('allergy','children',parseInt(e.target.value)||0)} className="w-16 border rounded-md p-1" />
                        </td>
                        <td className="p-1 border" colSpan={1}>
                          <input type="text" placeholder="סוג אלרגיה" value={specialMeals.allergy.description} onChange={(e)=>updateMeal('allergy','description',e.target.value)} className="w-full border rounded-md p-1" />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Allergies section */}
            <h4 className="font-medium mt-4 mb-2 text-right">אלרגיות</h4>
            <div className="flex justify-end items-center mb-2 space-x-2 space-x-reverse">
              <span className="text-lg font-medium text-gray-700">להוספת אלרגיות לחץ</span>
              <button onClick={addAllergy} className="bg-green-600 hover:bg-green-700 text-white rounded-full w-8 h-8 text-lg flex items-center justify-center" aria-label="הוסף אלרגיה">+</button>
            </div>
            <table className="w-full text-right border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-1 border">תיאור האלרגיה</th>
                  <th className="p-1 border">סה"כ בוגרים</th>
                  <th className="p-1 border">סה"כ ילדים</th>
                  <th className="p-1 border"></th>
                </tr>
              </thead>
              <tbody>
                {allergies.map((a, idx)=>(
                  <tr key={idx} className="odd:bg-white even:bg-gray-50">
                    <td className="p-1 border"><input type="text" value={a.description} onChange={(e)=>updateAllergy(idx,'description',e.target.value)} className="w-full border rounded-md p-1"/></td>
                    <td className="p-1 border"><input type="number" min="0" value={a.adults} onChange={(e)=>updateAllergy(idx,'adults',parseInt(e.target.value)||0)} className="w-16 border rounded-md p-1"/></td>
                    <td className="p-1 border"><input type="number" min="0" value={a.children} onChange={(e)=>updateAllergy(idx,'children',parseInt(e.target.value)||0)} className="w-16 border rounded-md p-1"/></td>
                    <td className="p-1 border text-center"><button onClick={()=>removeAllergy(idx)} className="text-red-600">❌</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={async () => {
                // totals for validation
                const totalSpecialAdults = Object.values(specialMeals).reduce((sum, m)=>sum+m.adults,0)+allergies.reduce((s,a)=>s+a.adults,0);
                const totalSpecialChildren = Object.values(specialMeals).reduce((sum, m)=>sum+m.children,0)+allergies.reduce((s,a)=>s+a.children,0);

                if (adultsCount < 0 || childrenCount < 0) {
                  setCountError('מספר אורחים לא יכול להיות שלילי');
                  return;
                }
                if (adultsCount === 0 && childrenCount === 0) {
                  setCountError('יש להזין לפחות אורח אחד');
                  return;
                }
                if (totalSpecialAdults > adultsCount || totalSpecialChildren > childrenCount) {
                  setCountError('סך המנות המיוחדות חורג ממספר האורחים.');
                  return;
                }

                // Require allergy description when quantity > 0
                const allergyMissingDesc = allergies.some(a=> (a.adults>0 || a.children>0) && !a.description.trim());
                if (allergyMissingDesc) {
                  setCountError('יש להזין סוג אלרגיה עבור כל אלרגיה שמצויינת.');
                  return;
                }

                // validation passed - clear previous errors
                setCountError('');

                // save to Supabase (optional)
                try {
                  await supabase.from('event_rsvps').insert([
                    {
                      event_type: selectedEventType,
                      adults: adultsCount,
                      children: childrenCount,
                      special_meals: { ...specialMeals, allergies },
                    },
                  ]);
                } catch (e) {
                  console.error('Supabase insert failed', e);
                }

                // עדכון טבלת האורחים המקומית כך שתשקף את כמות האורחים והמנות המיוחדות
                setSentGuests((prev) => {
                  const guestInfo = {
                    guestName: 'אנונימי',
                    guestPhone: '-',
                    guestEmail: '-',
                    adults: adultsCount,
                    children: childrenCount,
                    special_meals: { ...specialMeals, allergies },
                  };

                  if (prev.length === 0) {
                    return [guestInfo];
                  }
                  // אם קיים כבר לפחות אורח אחד (אנונימי או אחר) נעדכן את הראשון
                  return prev.map((g, idx) => (idx === 0 ? { ...g, ...guestInfo } : g));
                });

                setRsvpConfirmed(true);
                setShowCountModal(false);
                setShowGuestListModal(true);
              }}
              className="bg-primary text-white px-6 py-2 rounded-full hover:bg-primary/90"
            >
              שמור
            </button>
          </div>
        </div>
      )}

      {/* Step 5 - choose action modal */}
      {showStep5Options && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm text-center space-y-4 relative">
            <button onClick={() => setShowStep5Options(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4">בחר דוח</h2>

            {/* Reports buttons */}
            <button
              onClick={async () => {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    alert('יש להתחבר כדי להציג דוח.');
                    return;
                  }

                  const { data, error } = await supabase
                    .from('invited_guests')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'approved');
                  if (error) throw error;

                  setReportGuests(data || []);
                  setReportTitle('אורחים מגיעים');
                  setShowReportModal(true);
                } catch (e) {
                  console.error('Load approved guests failed', e);
                  alert('שגיאה בטעינת הדוח');
                }
              }}
              className="w-full bg-[#FCE6AC] text-black border border-primary rounded-full px-4 py-2 font-medium ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 transition-all"
            >
              דו"ח אורחים מגיעים
            </button>
            <button
              onClick={async () => {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    alert('יש להתחבר כדי להציג דוח.');
                    return;
                  }

                  const { data, error } = await supabase
                    .from('invited_guests')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'rejected');
                  if (error) throw error;

                  setReportGuests(data || []);
                  setReportTitle('אורחים לא מגיעים');
                  setShowReportModal(true);
                } catch (e) {
                  console.error('Load rejected guests failed', e);
                  alert('שגיאה בטעינת הדוח');
                }
              }}
              className="w-full bg-[#FCE6AC] text-black border border-primary rounded-full px-4 py-2 font-medium ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 transition-all"
            >
              דו"ח אורחים לא מגיעים
            </button>
            <button
              onClick={async () => {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    alert('יש להתחבר כדי להציג דוח.');
                    return;
                  }

                  const { data, error } = await supabase
                    .from('invited_guests')
                    .select('*')
                    .eq('user_id', user.id)
                    .or('status.is.null,status.eq.pending,status.eq.""');
                  if (error) throw error;

                  setReportGuests(data || []);
                  setReportTitle('אורחים שטרם הגיבו');
                  setShowReportModal(true);
                } catch (e) {
                  console.error('Load pending guests failed', e);
                  alert('שגיאה בטעינת הדוח');
                }
              }}
              className="w-full bg-[#FCE6AC] text-black border border-primary rounded-full px-4 py-2 font-medium ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 transition-all"
            >
              דו"ח אורחים שטרם הגיבו
            </button>
          </div>
        </div>
      )}

      {/* Step 3 - Design chooser */}
      {showDesignChooser && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowDesignChooser(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4 text-center">בחר עיצוב הזמנה</h2>

            {/* Styled Container */}
            <div className="mb-6 bg-[#FFF9E8] border-2 border-primary rounded-lg p-4 shadow-sm space-y-4">
              {/* Font chooser */}
              <div className="text-right">
                <label className="block mb-1 font-bold">אפשרות לשינוי גופן</label>
                <select
                  value={selectedFontKey}
                  onChange={(e)=>setSelectedFontKey(e.target.value)}
                  className="w-full border border-primary rounded-md p-2 bg-white"
                >
                  {fontsOptions.map(f=>(
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Invitation text editor */}
              <div>
                <label className="block mb-1 font-bold text-right">אפשרות לשינוי נוסח הזמנה</label>
                <textarea
                  value={customInvitationText}
                  onChange={(e) => setCustomInvitationText(e.target.value)}
                  rows={4}
                  className="w-full border border-primary rounded-md p-2"
                  placeholder="כתבו כאן נוסח הזמנה משלכם..."
                />
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={() => setCustomInvitationText('')}
                    className="text-base underline font-bold text-primary hover:text-primary/80"
                  >חזרה לנוסח ברירת מחדל</button>
                </div>
              </div>
            </div>

            {designImages.length === 0 ? (
              <p className="text-center text-gray-600">לא נמצאו תמונות בתיקייה /public/images</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto">
                {designImages.map((src) => (
                  <div
                    key={src}
                    className={`relative cursor-pointer hover:opacity-80 ${selectedDesign===src? 'ring-4 ring-primary':'border'} rounded-md`}
                    onClick={() => {
                      setLightboxSrc(src);
                      setShowLightbox(true);
                    }}
                  >
                    <img
                      src={src}
                      alt="Invitation design"
                      className="w-full h-40 object-cover rounded-md"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p
                        className="whitespace-pre-line text-center text-black font-medium text-sm leading-8 w-full h-full flex items-center justify-center bg-white/70 px-3"
                        style={{fontFamily:selectedFontCss}}
                      >
                        {invitationText || 'דוגמת טקסט להזמנה'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox for design preview */}
      {showLightbox && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
          <div className="relative bg-white rounded-lg p-4 max-w-3xl w-full">
            <button onClick={()=> setShowLightbox(false)} className="absolute top-2 left-2 text-2xl text-gray-200 hover:text-white">&times;</button>
            <div className="relative">
              <img src={lightboxSrc} alt="preview" className="w-full h-auto rounded-md" />
              <div className="absolute inset-0 flex items-center justify-center">
                <p
                  className="whitespace-pre-line text-center text-black font-medium text-2xl leading-[3.5rem] w-full h-full flex items-center justify-center bg-white/70 px-4"
                  style={{fontFamily:selectedFontCss}}
                >
                  {invitationText || 'דוגמת טקסט להזמנה'}
                </p>
              </div>
            </div>
            <div className="flex justify-center mt-4 gap-4">
              <button onClick={() => setShowLightbox(false)} className="border px-6 py-2 rounded-full hover:bg-gray-100">סגור</button>
              {/* Replace choose button */}
              {uploadingInvite ? (
                <button disabled className="bg-gray-400 text-white px-6 py-2 rounded-full cursor-not-allowed">מעלה...</button>
              ) : (
                <button onClick={() => handleChooseDesign(lightboxSrc)} className="bg-primary text-white px-6 py-2 rounded-full hover:bg-primary/90">בחר עיצוב זה</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview as guest button */}
      {previewLink && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => window.open(previewLink, '_blank', 'noopener,noreferrer')}
            className="bg-primary text-white border border-primary rounded-full px-6 py-2 font-medium hover:bg-primary/90 transition-all"
          >
            תצוגת מסך אורח
          </button>
          <div className="ml-4 flex items-center gap-2 bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-sm">
            <span className="select-all" title="RSVP link">{previewLink}</span>
            <button
              onClick={() => navigator.clipboard?.writeText(previewLink)}
              className="text-primary underline hover:text-primary/80"
            >
              העתק
            </button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-5xl event-form">
            <button onClick={() => setShowReportModal(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4 text-center">{reportTitle}</h2>
            {reportGuests.length === 0 ? (
              <p className="text-center text-gray-600">אין נתונים להצגה</p>
            ) : (
              <div className="max-h-96 overflow-y-auto overflow-x-auto">
                <table className="w-full text-right border text-sm min-w-max">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">#</th>
                      <th className="p-2 border">שם פרטי</th>
                      <th className="p-2 border">שם משפחה</th>
                      <th className="p-2 border">טלפון</th>
                      <th className="p-2 border">בוגרים</th>
                      <th className="p-2 border">ילדים</th>
                      <th className="p-2 border">סה"כ</th>
                      <th className="p-2 border">צמחוני</th>
                      <th className="p-2 border">טבעוני</th>
                      <th className="p-2 border">גלאט</th>
                      <th className="p-2 border">אלרגיה</th>
                      <th className="p-2 border">סוג אלרגיה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportGuests.map((g, idx) => (
                      <tr key={g.id} className="odd:bg-white even:bg-gray-50">
                        <td className="p-1 border text-center">{idx + 1}</td>
                        <td className="p-1 border">{g.first_name}</td>
                        <td className="p-1 border">{g.last_name}</td>
                        <td className="p-1 border">{g.phone}</td>
                        <td className="p-1 border text-center">{g.adults ?? '-'}</td>
                        <td className="p-1 border text-center">{g.children ?? '-'}</td>
                        <td className="p-1 border text-center">{(g.adults||0)+(g.children||0)}</td>
                        <td className="p-1 border text-center">{(g.veg_adults+g.veg_children)|| '-'}</td>
                        <td className="p-1 border text-center">{(g.vegan_adults+g.vegan_children)|| '-'}</td>
                        <td className="p-1 border text-center">{(g.glatt_adults+g.glatt_children)|| '-'}</td>
                        <td className="p-1 border text-center">{(g.allergy_adults+g.allergy_children)|| '-'}</td>
                        <td className="p-1 border text-center">{g.allergy_note || g.allergy_description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-lg">
                      <td className="p-2 border text-center" colSpan={4}>סה"כ</td>
                      <td className="p-2 border text-center">{totalReportAdults}</td>
                      <td className="p-2 border text-center">{totalReportChildren}</td>
                      <td className="p-2 border text-center">{totalReportAdults + totalReportChildren}</td>
                      <td className="p-2 border text-center">{totalVeg}</td>
                      <td className="p-2 border text-center">{totalVegan}</td>
                      <td className="p-2 border text-center">{totalGlatt}</td>
                      <td className="p-2 border text-center">{totalAllergy}</td>
                      <td className="p-2 border text-center"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div className="flex justify-center mt-6">
              <button onClick={() => setShowReportModal(false)} className="bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all">סגור</button>
            </div>
          </div>
        </div>
      )}

      {/* search button accessible inside guest modal */}
      {showGuestListModal && (
        <div className="fixed inset-0" />
      )}

      {/* Reports menu modal */}
      {typeof showReportsOptions !== 'undefined' && showReportsOptions && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm text-center space-y-4 relative">
            <button onClick={()=>setShowReportsOptions(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4">בחר דו"ח להצגה</h2>
            <button onClick={()=>{setShowReportsOptions(false);setShowApprovedReport(true);}} className="w-full bg-[#FCE6AC] text-primary border border-primary rounded-full px-4 py-2 font-medium hover:bg-[#FCE6AC]/90 transition-all">אישרו הגעה</button>
            <button onClick={()=>{setShowReportsOptions(false);setShowRejectedReport(true);}} className="w-full bg-[#FCE6AC] text-primary border border-primary rounded-full px-4 py-2 font-medium hover:bg-[#FCE6AC]/90 transition-all">לא מגיעים</button>
            <button onClick={()=>{setShowReportsOptions(false);setShowPendingReport(true);}} className="w-full bg-[#FCE6AC] text-primary border border-primary rounded-full px-4 py-2 font-medium hover:bg-[#FCE6AC]/90 transition-all">טרם הגיבו</button>
            {/* Guest status query button */}
            <button onClick={()=>{setShowReportsOptions(false);setShowSearchGuest(true);}} className="w-full bg-[#FCE6AC] text-primary border border-primary rounded-full px-4 py-2 font-medium hover:bg-[#FCE6AC]/90 transition-all">שאילתת סטטוס אורח</button>
          </div>
        </div>
      )}

      {/* Approved report modal */}
      {showApprovedReport && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-[90vw] max-w-none">
            <button onClick={()=>setShowApprovedReport(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4 text-center">דוח אורחים שאישרו הגעה</h2>
            <div className="max-h-[75vh] overflow-y-auto overflow-x-auto">
              <table className="w-full table-fixed text-right border text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-1 border">#</th>
                    <th className="p-1 border">שם פרטי</th>
                    <th className="p-1 border">שם משפחה</th>
                    <th className="p-1 border">טלפון</th>
                    <th className="p-1 border">בוגרים</th>
                    <th className="p-1 border">ילדים</th>
                    <th className="p-1 border">סה"כ</th>
                    <th className="p-1 border">צמחוני</th>
                    <th className="p-1 border">טבעוני</th>
                    <th className="p-1 border">גלאט</th>
                    <th className="p-1 border">אלרגיות</th>
                    <th className="p-1 border">הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedGuests.map((g,idx)=>(
                    <tr key={idx} className="odd:bg-white even:bg-gray-50">
                      <td className="p-1 border text-center">{idx+1}</td>
                      <td className="p-1 border">{g.first_name}</td>
                      <td className="p-1 border">{g.last_name}</td>
                      <td className="p-1 border">{g.phone}</td>
                      <td className="p-1 border text-center">{g.adults}</td>
                      <td className="p-1 border text-center">{g.children}</td>
                      <td className="p-1 border text-center">{(g.adults||0)+(g.children||0)}</td>
                      <td className="p-1 border text-center">{g.veg_adults+g.veg_children}</td>
                      <td className="p-1 border text-center">{g.vegan_adults+g.vegan_children}</td>
                      <td className="p-1 border text-center">{g.glatt_adults+g.glatt_children}</td>
                      <td className="p-1 border text-center">{g.allergy_adults+g.allergy_children}</td>
                      <td className="p-1 border text-center">{g.allergy_note || ((g.allergy_adults+g.allergy_children)>0? 'אלרגיה' : '-')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold">
                    <td className="p-1 border text-center" colSpan={4}>סה"כ</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.adults,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.children,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.adults+g.children,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.veg_adults+g.veg_children,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.vegan_adults+g.vegan_children,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.glatt_adults+g.glatt_children,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.allergy_adults+g.allergy_children,0)}</td>
                    <td className="p-1 border text-center"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
+            <div className="flex justify-center mt-4">
+              <button onClick={exportApprovedCsv} className="bg-[#FCE6AC] text-primary border border-primary rounded-full px-6 py-2 font-medium hover:bg-[#FCE6AC]/90 transition-all">צור קובץ אקסל - ושמור בהורדות</button>
+            </div>
          </div>
        </div>
      )}

      {/* Rejected report modal */}
      {showRejectedReport && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-[90vw] max-w-none">
            <button onClick={()=>setShowRejectedReport(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4 text-center">דוח אורחים שלא מגיעים</h2>
            <div className="max-h-[75vh] overflow-y-auto overflow-x-auto">
              <table className="w-full table-fixed text-right border text-xs min-w-[1600px]">
                <thead>
                  <tr className="bg-gray-100 text-sm font-bold whitespace-nowrap">
                    <th className="p-1 border">#</th>
                    <th className="p-1 border">שם פרטי</th>
                    <th className="p-1 border">שם משפחה</th>
                    <th className="p-1 border">טלפון</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedGuests.map((g,idx)=>(
                    <tr key={idx} className="odd:bg-white even:bg-gray-50">
                      <td className="p-1 border text-center">{idx+1}</td>
                      <td className="p-1 border">{g.first_name}</td>
                      <td className="p-1 border">{g.last_name}</td>
                      <td className="p-1 border">{g.phone}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold">
                    <td className="p-1 border text-center" colSpan={4}>סה"כ אורחים שלא מגיעים: {rejectedGuests.length}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pending report modal */}
      {showPendingReport && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-[90vw] max-w-none">
            <button onClick={()=>setShowPendingReport(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4 text-center">דוח אורחים שטרם הגיבו</h2>
            <div className="max-h-[75vh] overflow-y-auto overflow-x-auto">
              <table className="w-full table-fixed text-right border text-xs min-w-[1600px]">
                <thead>
                  <tr className="bg-gray-100 text-sm font-bold whitespace-nowrap">
                    <th className="p-1 border">#</th>
                    <th className="p-1 border">שם פרטי</th>
                    <th className="p-1 border">שם משפחה</th>
                    <th className="p-1 border">טלפון</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingGuests.map((g,idx)=>(
                    <tr key={idx} className="odd:bg-white even:bg-gray-50">
                      <td className="p-1 border text-center">{idx+1}</td>
                      <td className="p-1 border">{g.first_name}</td>
                      <td className="p-1 border">{g.last_name}</td>
                      <td className="p-1 border">{g.phone}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold">
                    <td className="p-1 border text-center" colSpan={4}>סה"כ אורחים שלא הגיבו: {pendingGuests.length}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Guest status query modal */}
      {showSearchGuest && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto event-form">
            <button onClick={()=>setShowSearchGuest(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4 text-center">חיפוש אורח</h2>
            <div className="flex justify-center gap-2 mb-4">
              <input
                type="text"
                placeholder="שם פרטי / שם משפחה / טלפון"
                value={searchTerm}
                onChange={(e)=>setSearchTerm(e.target.value)}
                className="w-full border rounded-md p-2"
              />
              <button onClick={handleGuestSearch} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 whitespace-nowrap">חפש</button>
            </div>
            {searchError && <p className="text-center text-red-600 mb-4">{searchError}</p>}
            {searchResults.length>0 && (
              <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
                <table className="w-full text-right border text-sm min-w-max">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">#</th>
                      <th className="p-2 border">שם פרטי</th>
                      <th className="p-2 border">שם משפחה</th>
                      <th className="p-2 border">טלפון</th>
                      <th className="p-2 border">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((g,idx)=>(
                      <tr key={g.id} className="odd:bg-white even:bg-gray-50">
                        <td className="p-1 border text-center">{idx+1}</td>
                        <td className="p-1 border">{g.first_name}</td>
                        <td className="p-1 border">{g.last_name}</td>
                        <td className="p-1 border">{g.phone}</td>
                        <td className="p-1 border text-center">{g.status==='approved'? 'מגיע' : g.status==='rejected'? 'לא מגיע' : 'טרם הגיב'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-center mt-6">
              <button onClick={()=>setShowSearchGuest(false)} className="bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all">סגור</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default StepButtons;
