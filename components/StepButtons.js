import React, { useState, forwardRef, useImperativeHandle, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import DatePicker, { registerLocale } from 'react-datepicker';
import he from 'date-fns/locale/he';
import 'react-datepicker/dist/react-datepicker.css';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useToast } from './Toast';
import TranzilaPayment from './TranzilaPayment';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';

const RADIAN = Math.PI / 180;

// Register Hebrew locale for datepicker
registerLocale('he', he);

// Helper to check missing details based on selectedEventType
function computeMissingDetails(formData, selectedEventType){
  return Object.entries(formData).filter(([key,value])=>{
    if(key==='customEventDescription') return false;
    if(key==='chuppahTime' && selectedEventType!=='חתונה') return false;
    if(['groomName','brideName'].includes(key) && !['חתונה','חינה','מסיבת אירוסין'].includes(selectedEventType)) return false;
    if(['brideParents','groomParents'].includes(key) && !['חתונה','חינה'].includes(selectedEventType)) return false;
    if(['boyName','boyParents'].includes(key) && selectedEventType!=='בר מצווה') return false;
    if(['girlName','girlParents'].includes(key) && selectedEventType!=='בת מצווה') return false;
    if(['babyParents'].includes(key)&& !['ברית','בריתה'].includes(selectedEventType)) return false;
    if(['birthdayName','birthdayAge'].includes(key)&& selectedEventType!=='יום הולדת') return false;
    if(['businessName','businessContact'].includes(key)&& selectedEventType!=='אירוע עסקי') return false;
    if(key==='hostName' && selectedEventType!=='הפרשת חלה') return false;
    const normalizedValue = typeof value === 'string'
      ? value.trim()
      : value === null || value === undefined
        ? ''
        : String(value).trim();
    return !normalizedValue;
  });
}

// Hebrew labels for form keys – used across component
const fieldLabels = {
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
  hostName: 'שם המארחת',
};

const StepButtons = forwardRef(function StepButtons({ session, onAuthClick, triggerCreateEvent, onConsumedCreateTrigger }, ref) {
  const { addToast } = useToast();
  const sessionRef = useRef(session);
  // After the user מחק אירוע קיים once successfully in this session, we don't need
  // to לבקש מחיקה שוב בכל לחיצה על "צור אירוע חדש".
  const [hasClearedExistingEvent, setHasClearedExistingEvent] = useState(false);
  // הודעה לאחר שהמערכת זיהתה שהאירוע עבר – מאפשרת למשתמש להבין ש"האירוע הסתיים, אפשר לפתוח אירוע חדש"
  const [showEventEndedNotice, setShowEventEndedNotice] = useState(false);
  
  // Keep session ref updated
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // כשאין כניסה – לא להציג מסלול שנשמר ב-localStorage (תיקון: בווב מוצג מסלול גם בלי סשן)
  useEffect(() => {
    if (!session) {
      setSelectedPlan(null);
    }
  }, [session]);

  // כשהדף מעלה triggerCreateEvent – מריצים זרימת יצירת אירוע (בלי תלות ב-ref)
  useEffect(() => {
    if (!triggerCreateEvent) return;
    onConsumedCreateTrigger?.();
    let hasSession = !!sessionRef.current;
    const run = async () => {
      if (!hasSession) {
        const { data: { user } } = await supabase.auth.getUser();
        hasSession = !!user;
      }
      if (!hasSession) {
        setShowPricingPlan(true);
        setPlanAddOnMode(false);
        return;
      }
      if (!selectedPlan) {
        setShowPricingPlan(true);
        setPlanAddOnMode(false);
        return;
      }
      setSelectedFlowStep(null);
      setStepErrorMsg('');
      // אם כבר בוצעה מחיקה מוצלחת של האירוע הקיים בסשן הזה – אין צורך לבקש מחיקה שוב.
      if (hasClearedExistingEvent) {
        await handleNewEvent();
        // אחרי שמתחילים אירוע חדש אחרי מחיקה – לפתוח מיד את שלב 1 (בחירת סוג אירוע)
        setShowEventTypes(true);
      } else {
        const hasActive = await checkActiveEventExists();
        if (hasActive) {
          setShowExistingEventWarning(true);
        } else {
          handleNewEvent();
        }
      }
    };
    run().catch((err) => {
      console.error('createNewEvent error', err);
      setShowPricingPlan(true);
      setPlanAddOnMode(false);
    });
  }, [triggerCreateEvent, hasClearedExistingEvent]);
  const steps = ['צור אירוע חדש', '📅 שלב 1 - סוג אירוע', '📝 שלב 2 - פרטי האירוע', '🎨 שלב 3 - עיצוב הזמנה', '📤 שלב 4 - שליחת הזמנה לאורח', '📊 שלב 5 - דוחו"ת אישורי הגעה'];
  const stepsMobile = ['', 'סוג אירוע', 'פרטי האירוע', 'עיצוב', 'שליחה', 'דוחות'];
  const eventTypes = ['חתונה', 'חינה', 'מסיבת אירוסין', 'בר מצווה', 'בת מצווה', 'ברית', 'בריתה', 'יום הולדת', 'אירוע עסקי', 'הפרשת חלה'];
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
    hostName: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [eventDetailsCompleted, setEventDetailsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Global error message for skipped steps
  const [stepErrorMsg, setStepErrorMsg] = useState('');
  const [clickedStepName, setClickedStepName] = useState('');
  const [showStepError, setShowStepError] = useState(false);

  // ---- finished steps persistence ----
  const [finishedSteps, setFinishedSteps] = useState(()=>{
    if(typeof window==='undefined') return [];
    try{ return JSON.parse(localStorage.getItem('finishedSteps')||'[]'); }catch(e){return[];}
  });

  // ---- guest summary stats ----
  const [guestSummary, setGuestSummary] = useState({ approved: 0, adults: 0, children: 0 });
  const [capacityWarningGuests, setCapacityWarningGuests] = useState({ adults: 0, children: 0, totalGuests: 0 });
  const resetCapacityWarningGuests = React.useCallback(() => {
    setCapacityWarningGuests({ adults: 0, children: 0, totalGuests: 0 });
  }, []);
  const [guestStatusSummary, setGuestStatusSummary] = useState({ approved: 0, rejected: 0, pending: 0 });
  const [guestSummaryRefreshKey, setGuestSummaryRefreshKey] = useState(0);
  const [specialMealsSummary, setSpecialMealsSummary] = useState({ 
    veg: { adults: 0, children: 0, total: 0 },
    vegan: { adults: 0, children: 0, total: 0 },
    glatt: { adults: 0, children: 0, total: 0 },
    allergy: { adults: 0, children: 0, total: 0 }
  });
  const statusChartData = React.useMemo(() => ([
    { key: 'approved', name: 'אישרו הגעה', value: guestStatusSummary.approved, color: '#16a34a' },
    { key: 'pending', name: 'טרם הגיבו', value: guestStatusSummary.pending, color: '#facc15' },
    { key: 'rejected', name: 'לא אישרו', value: guestStatusSummary.rejected, color: '#dc2626' }
  ]), [guestStatusSummary]);
  const hasStatusData = statusChartData.some(item => item.value > 0);
  const guestSummaryChartData = React.useMemo(() => ([
    { key: 'adults', name: 'מבוגרים', value: guestSummary.adults, color: '#16a34a' },
    { key: 'children', name: 'ילדים', value: guestSummary.children, color: '#f97316' },
    { key: 'total', name: 'סה״כ', value: guestSummary.adults + guestSummary.children, color: '#7c3aed' }
  ]), [guestSummary]);
  const hasGuestSummaryData = guestSummaryChartData.some(item => item.value > 0);
  const renderGuestSummaryLabel = React.useCallback(({
    x,
    y,
    width,
    height,
    value,
    index
  }) => {
    if (value === undefined || value === null) return null;
    const dataItem = guestSummaryChartData[index];
    const isDarkBar = dataItem?.key === 'adults' || dataItem?.key === 'total';
    const insideBar = (height ?? 0) >= 24;
    const labelX = x + (width ?? 0) / 2;
    const labelY = insideBar ? y + (height ?? 0) / 2 : (y ?? 0) - 6;
    const color = insideBar ? (isDarkBar ? '#FFFFFF' : '#111827') : '#111827';
    return (
      <text
        x={labelX}
        y={labelY}
        fill={color}
        textAnchor="middle"
        dominantBaseline={insideBar ? 'middle' : 'baseline'}
        fontWeight="700"
        fontSize="14"
      >
        {value}
      </text>
    );
  }, [guestSummaryChartData]);
  const renderStatusLabel = React.useCallback(({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    index,
    value
  }) => {
    if (!value) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const slice = statusChartData[index];
    const color = slice?.key === 'approved' || slice?.key === 'rejected' ? '#FFFFFF' : '#1f2937';
    return (
      <text
        x={x}
        y={y}
        fill={color}
        textAnchor={x >= cx ? 'start' : 'end'}
        dominantBaseline="central"
        style={{ fontWeight: 700, fontSize: '14px' }}
      >
        {value}
      </text>
    );
  }, [statusChartData]);

  const markStepDone=(idx)=>{
    console.log('markStepDone called with idx:', idx);
    setFinishedSteps(prev=>{
      console.log('Current finishedSteps:', prev);
      if(prev.includes(idx)) {
        console.log('Step already marked as done');
        return prev;
      }
      const next=[...prev,idx];
      console.log('New finishedSteps:', next);
      try{ localStorage.setItem('finishedSteps',JSON.stringify(next)); }catch(e){}
      return next;
    });
  };

  // Reports menu visibility
  const [showReportsOptions, setShowReportsOptions] = useState(false);
  const [showApprovedReport, setShowApprovedReport] = useState(false);
  const [approvedGuests, setApprovedGuests] = useState([]);
  const [showRejectedReport, setShowRejectedReport] = useState(false);
  const [rejectedGuests, setRejectedGuests] = useState([]);
  const [showPendingReport, setShowPendingReport] = useState(false);
  const [pendingGuests, setPendingGuests] = useState([]);
  // Selected event context for reports
  const [selectedEventForReport,setSelectedEventForReport]=useState(null);

  // Clear global "missing details" error once all required fields are provided
  React.useEffect(() => {
    if (errorMsg !== 'נא למלא את כל הפרטים.') return;

    // Re-evaluate missing fields with the same rules used in handleSaveDetails
    const missing = computeMissingDetails(formData, selectedEventType);
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
    guestTable: '',
  });
  const [guestErrors, setGuestErrors] = useState({});
  const [guestErrorMsg, setGuestErrorMsg] = useState('');
  const [invitationSent, setInvitationSent] = useState(false);
  const [rsvpConfirmed, setRsvpConfirmed] = useState(false);
  // Invitation send result modal
  const [showInvitationResultModal, setShowInvitationResultModal] = useState(false);
  const [invitationResult, setInvitationResult] = useState({ type: 'success', message: '' });
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);
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

  // Archive events list modal
  const [showArchiveList,setShowArchiveList]=useState(false);
  const [archiveEvents,setArchiveEvents]=useState([]);
  const [archiveLoading,setArchiveLoading]=useState(false);

  // Excel import preview modal
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [showExcelInstructions, setShowExcelInstructions] = useState(false);
  const [excelPreviewData, setExcelPreviewData] = useState([]);
  const [excelErrors, setExcelErrors] = useState([]);
  const [isSavingExcelGuests, setIsSavingExcelGuests] = useState(false);

  // Process flow diagram modal
  const [showFlowDiagram, setShowFlowDiagram] = useState(false);
  const [selectedFlowStep, setSelectedFlowStep] = useState(null);

  // Pricing plan selection modal
  const [showPricingPlan, setShowPricingPlan] = useState(false);
  React.useEffect(() => {
    if (!showPricingPlan) {
      setPlanAddOnMode(false);
      setPlanSelectionError('');
    }
  }, [showPricingPlan]);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [pendingAddonCount, setPendingAddonCount] = useState(1);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentPlanName, setPaymentPlanName] = useState('');
  // Payment result modal state
  const [showPaymentResultModal, setShowPaymentResultModal] = useState(false);
  const [paymentResultType, setPaymentResultType] = useState(null); // 'success' or 'error'
  const [paymentResultMessage, setPaymentResultMessage] = useState('');
  const [paymentWasPlanPurchase, setPaymentWasPlanPurchase] = useState(false); // true if plan purchase, false if addon
  // Message quota limit per plan – used for all plans (א–ו); same logic for blocking, balance panel, and addon modal
  const getPlanBaseLimit = React.useCallback((plan) => {
    switch(plan) {
      case 'free':
      case 'basic':
        return 5;
      case 'standard':
        return 200;
      case 'premium':
        return 350;
      case 'luxury':
        return 500;
      case 'elite':
        return 650;
      case 'supreme':
        return 1000;
      case 'addon':
        return 100;
      default:
        return 5;
    }
  },[]);

  const [selectedPlan, setSelectedPlan] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('selectedPlan');
      // If user explicitly chose 'free' or 'basic', always respect that choice
      if (stored === 'free' || stored === 'basic') {
        return stored;
      }
      return stored || null;
    } catch(e) { return null; }
  });

  const getPlanLabel = React.useCallback((plan) => {
    switch(plan){
      case 'basic':
      case 'free':
        return 'מסלול א';
      case 'standard':
        return 'מסלול ב';
      case 'premium':
        return 'מסלול ג';
      case 'luxury':
        return 'מסלול ד';
      case 'elite':
        return 'מסלול ה';
      case 'supreme':
        return 'מסלול ו';
      default:
        return plan || '';
    }
  },[]);

const [additionalPackages, setAdditionalPackages] = useState([]);
const [dbAddonCount, setDbAddonCount] = useState(null);
const [eventDataLoaded, setEventDataLoaded] = useState(false);
const [planLimitWarningError, setPlanLimitWarningError] = useState('');
const [planAddOnMode, setPlanAddOnMode] = useState(false);
const [planSelectionError, setPlanSelectionError] = useState('');
const [planWarningSuppressed, setPlanWarningSuppressed] = useState(false);
const [eventMessagesSentCount, setEventMessagesSentCount] = useState(0);
const [invitedGuestsCount, setInvitedGuestsCount] = useState(0);
const [currentEventId,setCurrentEventId]=useState(null);
const [eventRefreshKey, setEventRefreshKey] = useState(0);

  // Persist additionalPackages after currentEventId is known (see effect below).

  const totalGuestsCount = guestSummary.adults + guestSummary.children;
  // הודעות שנשלחו: מקור אמת = messages_sent_count (אם קיים) עם fallback למספר אורחים שנוצרו באירוע.
  const invitedCountFromStatus =
    (guestStatusSummary?.approved ?? 0) + (guestStatusSummary?.rejected ?? 0) + (guestStatusSummary?.pending ?? 0);
  const invitedCount = Math.max(invitedGuestsCount || 0, invitedCountFromStatus || 0);
  const effectiveMessagesSentCount = Math.max(eventMessagesSentCount || 0, invitedCount || 0);

  React.useEffect(() => {
    if (!showPricingPlan) {
      if (planWarningSuppressed && eventDataLoaded) {
        const baseLimit = getPlanBaseLimit(selectedPlan);
        const extraCapacity = additionalPackages.reduce((sum, planId) => sum + getPlanBaseLimit(planId), 0);
        const totalLimit = (baseLimit || 0) + extraCapacity;
        if (effectiveMessagesSentCount > totalLimit) {
          setPendingAddonCount(1);
          setShowPlanLimitWarning(true);
        }
        setPlanWarningSuppressed(false);
      }
      setPlanSelectionError('');
    }
  }, [showPricingPlan, planWarningSuppressed, effectiveMessagesSentCount, selectedPlan, additionalPackages, getPlanBaseLimit, eventDataLoaded]);

const basePlanLimit = getPlanBaseLimit(selectedPlan);
const additionalCapacity = additionalPackages.reduce((sum, planId) => sum + getPlanBaseLimit(planId), 0);
const totalPlanCapacity = (basePlanLimit || 0) + additionalCapacity;
const basePlanOverCapacity = basePlanLimit ? effectiveMessagesSentCount > basePlanLimit : false;
const activePlanDescription =
  selectedPlan === 'basic' || selectedPlan === 'free'
    ? 'מסלול א - 5₪ לאירועים קטנים עם כל הפיצ\'רים הבסיסיים'
    : selectedPlan === 'standard'
      ? 'מסלול ב - מקצועי עם תמיכה מלאה ועיצובים מתקדמים'
      : selectedPlan === 'premium'
        ? 'מסלול ג - כולל את כל הפיצ\'רים ותמיכה 24/7'
        : selectedPlan === 'luxury'
          ? 'מסלול ד - מתאים לאירועים גדולים מאוד עם יכולות מתקדמות'
          : selectedPlan === 'elite'
            ? 'מסלול ה - מעטפת מלאה לאירועים ענקיים'
            : selectedPlan === 'supreme'
              ? ''
              : '';
const additionalPackageCounts = React.useMemo(() => {
  return additionalPackages.reduce((acc, planId) => {
    acc[planId] = (acc[planId] || 0) + 1;
    return acc;
  }, {});
}, [additionalPackages]);

const addonUnitSize = getPlanBaseLimit('addon') || 0;
const displayTotalPlanCapacityValue = Math.max(0, Math.round(totalPlanCapacity));
const displayAdditionalCapacityValue = Math.max(0, Math.round(additionalCapacity));
const effectiveAddonCount = additionalPackageCounts['addon'] || 0;
const packageEntriesFromState = Object.entries(additionalPackageCounts)
  .filter(([planId, count]) => planId !== 'addon' && count > 0)
  .map(([planId, count]) => ({
    id: planId,
    label: planId === 'addon' ? 'חבילת הודעות נוספות' : getPlanLabel(planId) || planId,
    count,
    extra: getPlanBaseLimit(planId) * count,
  }));
const packageEntries = [...packageEntriesFromState];
if (effectiveAddonCount > 0) {
  packageEntries.push({
    id: 'addon',
    label: 'חבילת הודעות נוספות',
    count: effectiveAddonCount,
    extra: addonUnitSize * effectiveAddonCount,
  });
}
const displayPackageEntries = packageEntries;

// No longer needed - removed complex plan selection
// Users just purchase addon packages as needed

const handleOpenAddonModal = React.useCallback(() => {
  const hasPaidPlan = selectedPlan && selectedPlan !== 'basic' && selectedPlan !== 'free';
  setPlanLimitWarningError('');
  setPlanSelectionError(hasPaidPlan ? '' : 'בחר מסלול בתשלום כדי להמשיך ולהוסיף אורחים.');
  setPlanAddOnMode(Boolean(hasPaidPlan));
  setPlanWarningSuppressed(true);
  setShowPlanLimitWarning(false);
  resetCapacityWarningGuests();
  setShowPricingPlan(true);
}, [selectedPlan, resetCapacityWarningGuests]);

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
    { key: 'celiac', label: 'צליאקים' },
  ];
  const [specialMeals, setSpecialMeals] = useState({
    vegetarian: { adults: 0, children: 0 },
    vegan: { adults: 0, children: 0 },
    glatt: { adults: 0, children: 0 },
    celiac: { adults: 0, children: 0 },
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
    // Clear error when user updates values
    if (countError && field !== 'description') {
      setCountError('');
    }
  };

  const updateAllergy = (idx, field, val) => {
    setAllergies((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: field==='description'? val : val<0?0:val } : a))
    );
    // Clear error when user updates values
    if (countError && field !== 'description') {
      setCountError('');
    }
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

  const handleSaveDetails = async () => {
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
      hostName: 'שם המארחת',
    };

    function getMissingDetails() {
      return Object.entries(formData).filter(([key, value]) => {
        if (key === 'customEventDescription') return false; // שדה טקסט חופשי – לא חובה
        if (key === 'chuppahTime' && selectedEventType !== 'חתונה') return false;
        if (['groomName', 'brideName'].includes(key) && !['חתונה', 'חינה', 'מסיבת אירוסין'].includes(selectedEventType)) return false;
        if (['brideParents', 'groomParents'].includes(key) && !['חתונה', 'חינה'].includes(selectedEventType)) return false;
        if (['boyName', 'boyParents'].includes(key) && selectedEventType !== 'בר מצווה') return false;
        if (['girlName', 'girlParents'].includes(key) && selectedEventType !== 'בת מצווה') return false;
        if (['babyParents'].includes(key) && !['ברית','בריתה'].includes(selectedEventType)) return false;
        if (['birthdayName', 'birthdayAge'].includes(key) && selectedEventType !== 'יום הולדת') return false;
        if (['businessName', 'businessContact'].includes(key) && selectedEventType !== 'אירוע עסקי') return false;
        if (key === 'hostName' && selectedEventType !== 'הפרשת חלה') return false;
        const normalizedValue = typeof value === 'string'
          ? value.trim()
          : value === null || value === undefined
            ? ''
            : String(value).trim();
        return !normalizedValue;
      });
    }

    const missing = computeMissingDetails(formData, selectedEventType);
    if (missing.length) {
      const errs = missing.reduce((acc, [key]) => ({ ...acc, [key]: true }), {});
      setFormErrors(errs);
      const missingLabels = missing.map(([key]) => fieldLabels[key] || key);
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

    // Save draft event so summary component recognizes it
    console.debug('[StepButtons] Calling saveEventToSupabase (draft)');
    await saveEventToSupabase(null, selectedDesign);
    console.debug('[StepButtons] saveEventToSupabase returned');
  };

  const handleSelectEvent = (type) => {
    const normalizedType = normalizeType(type);
    setSelectedEventType(normalizedType);
    try { localStorage.setItem('selectedEventType', normalizedType); } catch(e){}
    setEventDetailsCompleted(false);
    // ensure button dark if user arrived here by page reload without clicking new event button
    if(!newEventStarted){ setNewEventStarted(true); try{localStorage.setItem('newEventStarted','1');}catch(e){} }
    markStepDone(0);
    // If there's already an active event, persist the new type immediately
    if (currentEventId) {
      (async () => {
        try {
          await supabase
            .from('events')
            .update({ event_type: normalizedType })
            .eq('id', currentEventId);
        } catch (e) {
          console.error('Failed to update event_type for current event', e);
        }
      })();
    }
  };

      // Helper to format ISO date (YYYY-MM-DD) to Hebrew format (DD/MM/YYYY)
    const formatDateToHebrew = (isoDate) => {
      if (!isoDate) return '';
      const [year, month, day] = isoDate.split('-');
      return `${day}/${month}/${year}`;
    };
    // יום בשבוע בעברית (להזמנות)
    const getDayOfWeekHebrew = (isoDate) => {
      if (!isoDate) return '';
      const d = new Date(isoDate + 'T12:00:00');
      const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
      return days[d.getDay()] || '';
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
      // Persist current event details so they survive any reloads after sending
      try{ localStorage.setItem('savedEventDetails', JSON.stringify(formData)); }catch{}

      const required = ['guestFirstName', 'guestLastName', 'guestPhone', 'guestTable'];
    const missingFields = required.filter((key) => !guestData[key].toString().trim());

    if (missingFields.length) {
      const errs = missingFields.reduce((acc, key) => ({ ...acc, [key]: true }), {});
      setGuestErrors(errs);
      setGuestErrorMsg('נא למלא שם פרטי, שם משפחה, מספר טלפון ומספר שולחן תקינים.');
      return;
    }

    // Validate phone - must contain exactly 10 digits (Israeli format e.g., 05XXXXXXXX)
    const digitsOnly = guestData.guestPhone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setGuestErrors({ guestPhone: true });
      setGuestErrorMsg('מספר טלפון לא תקין – יש להזין 10 ספרות.');
      return;
    }


    // Attempt to save guest to Supabase (optional – will work only if table exists)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setGuestErrorMsg('יש להתחבר כדי לשלוח הזמנות');
        return;
      }

      // Block sending when over message quota (same limit for all plans; effective = sync with status panel)
      const totalLimitForSend = (getPlanBaseLimit(selectedPlan) || 0) + additionalPackages.reduce((s, id) => s + (getPlanBaseLimit(id) || 0), 0);
      if (totalLimitForSend > 0 && effectiveMessagesSentCount >= totalLimitForSend) {
        setPendingAddonCount(1);
        setShowPlanLimitWarning(true);
        setPlanAddOnMode(true);
        return;
      }

      const { data: evRow } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const eventIdForInvite = currentEventId || evRow?.id || null;

      // Quota is by messages sent only - adding guests is not limited by count
      const { data: newGuest, error } = await supabase
        .from('invited_guests')
        .insert([
          {
            user_id: user.id,
            event_id: eventIdForInvite,
            first_name: guestData.guestFirstName,
            last_name: guestData.guestLastName,
            phone: guestData.guestPhone,
            email: null,
            total_guests: 1,
            adults: 1,
            table_number: guestData.guestTable.trim(),
          },
        ])
        .select()
        .single();
      if (error) throw error;
      if (eventIdForInvite) {
        setInvitedGuestsCount((prev) => prev + 1);
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://meet-m.co.il');
      const inviteLink = `${baseUrl}/${eventIdForInvite}/${newGuest.id}`;

      // Dev helper: log the RSVP link so it can be copied from the browser console
      if (process.env.NODE_ENV !== 'production') {
        console.log('RSVP link:', inviteLink);
      }

      // Fetch invitation public URL
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('User session lost during invitation send');
          setInvitationResult({ 
            type: 'error', 
            message: 'אירעה שגיאה בשליחת ההזמנה.' 
          });
          setShowInvitationResultModal(true);
          return;
        }

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
          `לאישור הגעה:\n${inviteLink}`
        );
        const waWin = window.open(`https://wa.me/972${waNumber.slice(1)}?text=${waText}`, '_blank','noopener,noreferrer');
        if (waWin) {
          waWin.opener = null; // prevent redirect effect
          // Count this message toward quota – atomic DB increment so WhatsApp + SMS in quick succession both count
          if (eventIdForInvite) {
            try {
              const { data: newCount, error: rpcErr } = await supabase.rpc('increment_event_messages_sent', {
                p_event_id: eventIdForInvite,
                p_delta: 1
              });
              if (!rpcErr && typeof newCount === 'number') {
                setEventMessagesSentCount(newCount);
              } else {
                const fallback = (eventMessagesSentCount || 0) + 1;
                setEventMessagesSentCount(fallback);
                await supabase.from('events').update({ messages_sent_count: fallback }).eq('id', eventIdForInvite);
              }
            } catch (e) {
              const fallback = (eventMessagesSentCount || 0) + 1;
              setEventMessagesSentCount(fallback);
              try { await supabase.from('events').update({ messages_sent_count: fallback }).eq('id', eventIdForInvite); } catch (_) {}
            }
          } else {
            setEventMessagesSentCount((prev) => (prev || 0) + 1);
          }
          setInvitationResult({ 
            type: 'success', 
            message: 'ההזמנה נשלחה בהצלחה בוואטסאפ!' 
          });
          setShowInvitationResultModal(true);
        } else {
          console.warn('WhatsApp popup possibly blocked');
          // Show error modal
          setInvitationResult({ 
            type: 'error', 
            message: 'אירעה שגיאה בשליחת ההזמנה. ייתכן שחלון הוואטסאפ נחסם.' 
          });
          setShowInvitationResultModal(true);
        }
      } catch (err) {
        console.error('Failed to send invitation:', err);
        setInvitationResult({ 
          type: 'error', 
          message: 'אירעה שגיאה בשליחת ההזמנה.' 
        });
        setShowInvitationResultModal(true);
      }
    } catch (err) {
      console.error('Failed to send invitation:', err);
      setInvitationResult({ 
        type: 'error', 
        message: 'אירעה שגיאה בשליחת ההזמנה.' 
      });
      setShowInvitationResultModal(true);
    }
  };

  // Quick SMS sender – opens default SMS app with pre-filled text (mobile browsers)
  const handleSendInvitationSms = async () => {
    // Show loading modal IMMEDIATELY
    setIsSendingInvitation(true);
    
    // Persist event details before SMS flow (may trigger navigation)
    try{ localStorage.setItem('savedEventDetails', JSON.stringify(formData)); }catch{}

    const digitsOnly = guestData.guestPhone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setIsSendingInvitation(false);
      setGuestErrors({ guestPhone: true });
      setInvitationResult({ 
        type: 'error', 
        message: 'מספר טלפון לא תקין – יש להזין 10 ספרות.' 
      });
      setShowInvitationResultModal(true);
      return;
    }

    try {
      // create guest in DB (similar to WA function but without opening WA)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsSendingInvitation(false);
        setInvitationResult({ 
          type: 'error', 
          message: 'יש להתחבר כדי לשלוח הזמנות' 
        });
        setShowInvitationResultModal(true);
        return;
      }

      const { data: evRow } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const eventIdForInvite = currentEventId || evRow?.id || null;

      // Quota is by messages sent only - adding guests is not limited by count
      const { data: newGuest, error } = await supabase
        .from('invited_guests')
        .insert([
          {
            user_id: user.id,
            event_id: eventIdForInvite,
            first_name: guestData.guestFirstName,
            last_name: guestData.guestLastName,
            phone: guestData.guestPhone,
            email: null,
            total_guests: 1,
            adults: 1,
            table_number: guestData.guestTable.trim(),
          },
        ])
        .select()
        .single();
      if (error) throw error;
      if (eventIdForInvite) {
        setInvitedGuestsCount((prev) => prev + 1);
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://meet-m.co.il');
      const inviteLink = `${baseUrl}/${eventIdForInvite}/${newGuest.id}`;

      // Send SMS via API - check message quota first (effective = sync with status panel)
      const totalLimitSms = (getPlanBaseLimit(selectedPlan) || 0) + additionalPackages.reduce((s, id) => s + (getPlanBaseLimit(id) || 0), 0);
      if (totalLimitSms > 0 && effectiveMessagesSentCount >= totalLimitSms) {
        setInvitationResult({ type: 'error', message: 'אין מספיק הודעות במכסה. נא לרכוש חבילת הרחבה.' });
        setShowInvitationResultModal(true);
        setIsSendingInvitation(false);
        return;
      }
      try {
        const smsMessage = `${invitationText}\n\nלאישור הגעה:\n{inviteLink}`;
        const smsResponse = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guests: [{
              phone: guestData.guestPhone,
              firstName: guestData.guestFirstName,
              lastName: guestData.guestLastName,
              inviteLink: inviteLink,
            }],
            message: smsMessage,
            eventId: eventIdForInvite || null,
          }),
        });

        const smsResult = await smsResponse.json();

        if (smsResult.success && smsResult.sent > 0) {
          if (typeof smsResult.updatedMessagesSentCount === 'number') {
            setEventMessagesSentCount(smsResult.updatedMessagesSentCount);
          } else {
            setEventMessagesSentCount((prev) => (prev || 0) + smsResult.sent);
          }
          setInvitationSent(true);
          setIsSendingInvitation(false);
          setInvitationResult({ 
            type: 'success', 
            message: 'ההזמנה נשלחה בהצלחה ב-SMS!' 
          });
          setShowInvitationResultModal(true);
        } else {
          setIsSendingInvitation(false);
          // Show error modal
          const errorMsg = smsResult.failed > 0 
            ? `אירעה שגיאה בשליחת ההזמנה ב-SMS. ${smsResult.errors?.[0]?.error || ''}`
            : 'אירעה שגיאה בשליחת ההזמנה ב-SMS.';
          setInvitationResult({ 
            type: 'error', 
            message: errorMsg
          });
          setShowInvitationResultModal(true);
        }
      } catch (smsError) {
        console.error('SMS sending error:', smsError);
        setIsSendingInvitation(false);
        setInvitationResult({ 
          type: 'error', 
          message: 'אירעה שגיאה בשליחת ההזמנה ב-SMS.' 
        });
        setShowInvitationResultModal(true);
      }
    } catch (err) {
      console.error('Failed to send SMS invitation', err);
      setIsSendingInvitation(false);
      setInvitationResult({ 
        type: 'error', 
        message: err.message || 'אירעה שגיאה בשליחת ההזמנה בסמס.' 
      });
      setShowInvitationResultModal(true);
    }
  };

  // כל קבצי העיצוב הקיימים בתיקייה public/images
  const designImages = [
    '/images/background-flowers-light.png',
    '/images/background-flowers-bright.png',
    '/images/background-stairs-flowers.png',
    '/images/wedding-couple-bright-luxury.jpg',
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
    '/images/תמונה חדשה 1.jpg',
    '/images/תמונה חדשה 2.jpg',
    '/images/תמונה חדשה 3.jpg',
    '/images/תמונה חדשה 4.jpg',
    '/images/תמונה חדשה 5.jpg',
    '/images/תמונה חדשה 6.jpg',
    '/images/תמונה חדשה 7.jpg',
    '/images/תמונה חדשה 8.jpg',
    '/images/תמונה חדשה 9.jpg',
    '/images/תמונה חדשה 10.jpg',
    '/images/background-01.png',
    '/images/background-02.png',
    '/images/background-03.png',
    '/images/background-04.png',
    '/images/background-05.png',
    '/images/background-06.png',
    '/images/background-07.png',
    '/images/background-08.png',
    '/images/background-09.png',
    '/images/background-10.png',
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
    'חתונה': (d) => `${d.brideName} ו${d.groomName} מתחתנים\n\nשמחים להזמינכם לחגוג עמנו את יום הנישואין\nביום ${getDayOfWeekHebrew(d.date)} ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}\nהחופה תתקיים בשעה ${d.chuppahTime}\n\nהורי הכלה: ${d.brideParents}\nהורי החתן: ${d.groomParents}`,
    'חינה': (d) => `${d.brideParents} ובתם ${d.brideName} יחד עם ${d.groomParents} ובנם ${d.groomName}\nמזמינים אתכם לחגוג עמנו בחינה\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'מסיבת אירוסין': (d) => `של ${d.brideName} ו${d.groomName}\nשמחים להזמינכם למסיבת האירוסין שלנו\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'הפרשת חלה': (d) => `${d.hostName}\nמזמינה אתכן לטקס הפרשת חלה מרגש\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nב${d.hallName}, ${d.hallAddress}`,
    'בר מצווה': (d)=> `אנו, ${d.boyParents},\nמזמינים אתכם לחגוג עמנו את בר המצווה של בננו ${d.boyName}\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'בת מצווה': (d)=> `אנו, ${d.girlParents},\nמזמינים אתכם לחגוג עמנו את בת המצווה של בתנו ${d.girlName}\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'ברית': (d)=> `אנו, ${d.babyParents},\nשמחים להזמינכם לברית בננו\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'בריתה': (d)=> `אנו, ${d.babyParents},\nשמחים להזמינכם לבריתה בתנו\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'יום הולדת': (d)=> `את/ה מוזמנ/ת לחגוג עם ${d.birthdayName}\nיום הולדתו ה- ${d.birthdayAge}\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nב-${d.hallName}, ${d.hallAddress}`,
    'אירוע עסקי': (d)=> `חברת ${d.businessName} (${d.businessContact})\nמתכבדת להזמינך לאירוע העסקי שלנו\nבתאריך ${formatDateToHebrew(d.date)} בשעה ${d.time}\nב-${d.hallName}, ${d.hallAddress}`,
  };

  const normalizeType = (t) => (t === 'ברית/ה' || t === 'בריתה' ? 'ברית' : t);

  // עיצוב ברירת מחדל להזמנת חתונה – שורה ראשונה (שמות) ותאריך מודגשים מאוד
  const defaultLineStylesForWedding = {
    0: { fontSize: 30, fontWeight: 'bold', textAlign: 'center', color: 'black' }, // שמות – מודגש מאוד
    1: { fontSize: 18, textAlign: 'center', color: 'black' },
    2: { fontSize: 18, textAlign: 'center', color: 'black' },
    3: { fontSize: 19, fontWeight: 'bold', textAlign: 'center', color: 'black' }, // תאריך ושעה – מודגש
    4: { fontSize: 17, textAlign: 'center', color: 'black' },
    5: { fontSize: 17, textAlign: 'center', color: 'black' },
    6: { fontSize: 15, textAlign: 'center', color: 'black' },
    7: { fontSize: 15, textAlign: 'center', color: 'black' },
    8: { fontSize: 15, textAlign: 'center', color: 'black' },
  };

  // ברירת מחדל לכל סוגי האירועים: שורה ראשונה (שמות/כותרת) מודגשת מאוד
  const defaultFirstLineStyle = { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: 'black' };

  const [customInvitationText, setCustomInvitationText] = useState('');
  const [lineStyles, setLineStyles] = useState({});
  const [openMenu, setOpenMenu] = useState(null); // Format: "lineIndex-menuType" or null
  const [showAdvancedEdit, setShowAdvancedEdit] = useState(null); // Format: lineIndex or null
  const [showColorPalette, setShowColorPalette] = useState(false);

  useEffect(() => {
    if (showAdvancedEdit !== null) setShowColorPalette(false);
  }, [showAdvancedEdit]);

  const colorClasses = {
    black: 'bg-black',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    brown: 'bg-amber-700',
    gold: 'bg-yellow-400',
    pink: 'bg-pink-500',
    cyan: 'bg-cyan-500',
    indigo: 'bg-indigo-500',
    teal: 'bg-teal-500',
    navy: 'bg-blue-900',
    maroon: 'bg-[#800020]',
    lime: 'bg-lime-500',
    olive: 'bg-yellow-700',
    coral: 'bg-orange-400',
    lavender: 'bg-violet-300',
    slate: 'bg-slate-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-600',
    darkgreen: 'bg-green-800',
    crimson: 'bg-red-700',
    turquoise: 'bg-teal-400'
  };
  const colorKeys = ['black', 'red', 'blue', 'green', 'purple', 'orange', 'brown', 'gold', 'pink', 'cyan', 'indigo', 'teal', 'navy', 'maroon', 'lime', 'olive', 'coral', 'lavender', 'slate', 'rose', 'violet', 'darkgreen', 'crimson', 'turquoise'];

  const invitationTextDefault = selectedEventType && invitationTemplates[normalizeType(selectedEventType)]
    ? (normalizeType(selectedEventType) === 'חתונה'
        ? invitationTemplates['חתונה'](formData)
        : `הזמנה ל${selectedEventType}\n\n` + invitationTemplates[normalizeType(selectedEventType)](formData))
    : '';
  const invitationText = customInvitationText.trim() || invitationTextDefault;

  // Advanced text formatting functions - defined after state variables
  const updateLineStyle = (lineIndex, property, value) => {
    setLineStyles(prev => ({
      ...prev,
      [lineIndex]: {
        ...prev[lineIndex],
        [property]: value
      }
    }));
  };

  const updateLineText = (lineIndex, newText) => {
    const lines = customInvitationText.split('\n');
    lines[lineIndex] = newText;
    setCustomInvitationText(lines.join('\n'));
  };

  const addNewLine = () => {
    setCustomInvitationText(prev => prev + '\n');
  };

  const addNewLineAtTop = () => {
    setCustomInvitationText(prev => '\n' + prev);
    // Shift all line styles down by one index
    setLineStyles(prev => {
      const newStyles = {};
      Object.keys(prev).forEach(key => {
        const oldIndex = parseInt(key);
        newStyles[oldIndex + 1] = prev[key];
      });
      return newStyles;
    });
  };
  const deleteLine = (lineIndex) => {
    const lines = customInvitationText.split('\n');
    if (lines.length > 1) {
      lines.splice(lineIndex, 1);
      setCustomInvitationText(lines.join('\n'));
      
      // Update line styles to match new indices
      const newLineStyles = {};
      lines.forEach((_, index) => {
        if (lineStyles[index + 1]) {
          newLineStyles[index] = lineStyles[index + 1];
        }
      });
      setLineStyles(newLineStyles);
    }
  };
  // Close menu when clicking outside
  React.useEffect(() => {
    if (!openMenu) return;
    
    const handleClickOutside = (event) => {
      // Check if click is outside all menu containers
      const menuContainers = document.querySelectorAll('[data-menu-container="true"]');
      let clickedInside = false;
      
      menuContainers.forEach(container => {
        if (container.contains(event.target)) {
          clickedInside = true;
        }
      });
      
      if (!clickedInside) {
        setOpenMenu(null);
      }
    };
    
    // Use a small delay to avoid closing menu immediately when opening it
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenu]);

  // Reset custom text when event type changes so default reflects new event
  React.useEffect(() => {
    setCustomInvitationText('');
  }, [selectedEventType]);

  // When design chooser opens the first time, prefill the textarea with default text and default line styles
  React.useEffect(() => {
    if (showDesignChooser && !customInvitationText) {
      setCustomInvitationText(invitationTextDefault);
      if (normalizeType(selectedEventType) === 'חתונה') {
        setLineStyles(defaultLineStylesForWedding);
      } else if (selectedEventType) {
        // לכל שאר סוגי האירועים: שורה ראשונה מודגשת מאוד, ושורות תאריך (בדרך כלל 2–3) מודגשות
        const lines = (invitationTextDefault || '').split('\n');
        const defaultStyles = { 0: { ...defaultFirstLineStyle } };
        if (lines.length > 2) defaultStyles[2] = { fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: 'black' };
        if (lines.length > 3) defaultStyles[3] = { fontSize: 17, fontWeight: 'bold', textAlign: 'center', color: 'black' };
        setLineStyles(defaultStyles);
      }
    }
  }, [showDesignChooser, invitationTextDefault, customInvitationText, selectedEventType]);

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
      markStepDone(1);
      try { localStorage.setItem('savedEventDetails', JSON.stringify(formData)); } catch(e){}
    })();
  }, []);

  // restore details
  React.useEffect(()=>{
    if(!finishedSteps.includes(1)) return;
    if(Object.values(formData).some(v=>v)) return;
    try{
      const saved=JSON.parse(localStorage.getItem('savedEventDetails')||'{}');
      if(Object.keys(saved).length) setFormData(saved);
    }catch{}
  },[finishedSteps]);

  // Restore selected event type from localStorage if Supabase didn't set it
  // Removed useEffect that was loading selectedEventType from localStorage on page load
  // This ensures clean state on initial page load

  // ניתן לאפס newEventStarted רק כאשר האירוע נסגר לארכיון, לכן לא מנקים אוטומטית עם selectedEventType ריק.

  // Helper function to check if there's an active event
  const hasActiveEvent = () => {
    return currentEventId || newEventStarted;
  };

  // Expose imperative methods to parent components
  useImperativeHandle(ref, () => ({
    startFlow: () => {
      setShowFlowDiagram(true);
      setStepErrorMsg('');
    },
    goToReportsStep: () => {
      setSelectedFlowStep(5);
    },
    createNewEvent: async () => {
      try {
        setSelectedFlowStep(null);
        let hasSession = !!sessionRef.current;
        if (!hasSession) {
          const { data: { user } } = await supabase.auth.getUser();
          hasSession = !!user;
        }
        if (!hasSession) {
          setShowPricingPlan(true);
          setPlanAddOnMode(false);
          return;
        }
        if (!selectedPlan) {
          setShowPricingPlan(true);
          setPlanAddOnMode(false);
          return;
        }
        setStepErrorMsg('');
        const hasActive = await checkActiveEventExists();
        if (hasActive) {
          setShowExistingEventWarning(true);
        } else {
          handleNewEvent();
        }
      } catch (err) {
        console.error('createNewEvent error', err);
        setShowPricingPlan(true);
        setPlanAddOnMode(false);
      }
    },
  }));

  // designFile is the stored image file name in storage (or null). templateSrc is the relative path of template image chosen
  const saveEventToSupabase = async (designFile, templateSrc) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const progress = templateSrc ? 3 : 2; // Progress based on design selection, not file
      
      // Determine which text to save - prefer customInvitationText if it exists
      const textToSave = customInvitationText || invitationText || '';
      const textLines = textToSave.split('\n');
      
      console.log('💾 Saving event details with text:', {
        textToSave: textToSave,
        textLinesCount: textLines.length,
        textLines: textLines,
        lineStyles: lineStyles,
        hasLineStyles: Object.keys(lineStyles).length > 0
      });
      
      const eventDetails = {
        ...formData,
        invitation_text: invitationText,
        custom_invitation_text: textToSave, // Save custom text
        invitation_text_lines: textLines, // Save as array for easier display
        line_styles: lineStyles, // Save all line styles
        font: selectedFontKey,
        font_css: selectedFontCss, // Save font CSS for display
        template_src: templateSrc || selectedDesign || null,
        status: templateSrc ? 'active' : 'draft',
        progress_step: progress,
        pricing_plan: selectedPlan,
      };
      
      // If currentEventId exists, update existing event; otherwise insert new one
      if (currentEventId) {
        console.log('💾 Saving to database:', {
          eventId: currentEventId,
          invitation_path: designFile,
          hasDesignFile: !!designFile
        });

        // Calculate allowed guests based on plan and addons
        const basePlanLimit = getPlanBaseLimit(selectedPlan) || 50;
        const extraCapacity = additionalPackages.reduce(
          (sum, planId) => sum + getPlanBaseLimit(planId),
          0
        );
        const totalAllowedGuests = basePlanLimit + extraCapacity;
        const addonCountForDb = additionalPackageCounts['addon'] || 0;

        // Build update object - only include progress_step if it exists
        const updateData = {
          event_details: eventDetails,
          invitation_path: designFile,
          allowed_guests: totalAllowedGuests,
          additional_packages: addonCountForDb,
          event_type: selectedEventType || null,
        };

        // Try to update progress_step, but don't fail if column doesn't exist
        try {
          updateData.progress_step = progress;
        } catch (e) {
          // Ignore - column might not exist
        }
        
        const { data: updated, error: updateErr } = await supabase
          .from('events')
          .update(updateData)
          .eq('id', currentEventId)
          .select('id, invitation_path, event_details') // Select event_details to verify it was saved
          .single();
        
        if (updateErr) {
          // If error is about progress_step, try again without it
          if (updateErr.code === 'PGRST204' && updateErr.message?.includes('progress_step')) {
            console.warn('[StepButtons] progress_step column not found, retrying without it');
            const { data: retryData, error: retryErr } = await supabase
              .from('events')
              .update({
                event_details: eventDetails,
                invitation_path: designFile,
                allowed_guests: totalAllowedGuests,
                additional_packages: addonCountForDb,
                event_type: selectedEventType || null,
              })
              .eq('id', currentEventId)
              .select('id, invitation_path, event_details')
              .single();
            
            if (retryErr) {
              console.error('[StepButtons] Update error (retry)', retryErr);
              throw retryErr;
            } else {
              console.log('[StepButtons] ✅ Update success (without progress_step):', {
                eventId: retryData.id,
                has_event_details: !!retryData.event_details,
                invitation_path: retryData.invitation_path
              });
              
              // Verify event_details was saved
              const savedDetails = typeof retryData.event_details === 'string'
                ? JSON.parse(retryData.event_details)
                : retryData.event_details;
              console.log('✅ Verified event_details saved:', {
                has_custom_invitation_text: !!savedDetails?.custom_invitation_text,
                has_invitation_text_lines: !!savedDetails?.invitation_text_lines,
                invitation_text_lines_count: savedDetails?.invitation_text_lines?.length || 0
              });
            }
          } else {
            console.error('[StepButtons] Update error', updateErr);
            throw updateErr;
          }
        } else {
          console.log('[StepButtons] ✅ Update success - invitation_path saved:', {
            eventId: updated.id,
            invitation_path: updated.invitation_path,
            matches: updated.invitation_path === designFile
          });
          
          // Verify event_details was saved
          if (updated.event_details) {
            const savedDetails = typeof updated.event_details === 'string'
              ? JSON.parse(updated.event_details)
              : updated.event_details;
            console.log('✅ Verified event_details saved:', {
              has_custom_invitation_text: !!savedDetails?.custom_invitation_text,
              has_invitation_text_lines: !!savedDetails?.invitation_text_lines,
              invitation_text_lines_count: savedDetails?.invitation_text_lines?.length || 0
            });
          }
        }

        // allowed_guests is persisted in DB; UI quota uses selectedPlan/addons from state.
      } else {
        // Calculate allowed guests based on plan and addons
        const basePlanLimit = getPlanBaseLimit(selectedPlan) || 50;
        const extraCapacity = additionalPackages.reduce(
          (sum, planId) => sum + getPlanBaseLimit(planId),
          0
        );
        const totalAllowedGuests = basePlanLimit + extraCapacity;

        const payload = {
          user_id: user?.id || null,
          event_type: selectedEventType,
          event_details: eventDetails,
          invitation_path: designFile,
          allowed_guests: totalAllowedGuests,
          additional_packages: addonCountForDb,
        };

        console.debug('[StepButtons] Inserting event', payload);

        const {data:inserted, error:insertErr}=await supabase.from('events').insert(payload).select('id').single();
        if(inserted){
          console.debug('[StepButtons] Insert success', inserted);
          setCurrentEventId(inserted.id);
          setEventMessagesSentCount(0);
        }
        if(insertErr){
          console.error('[StepButtons] Insert error', insertErr);
        }
      }

      markStepDone(2);
    } catch (err) {
      console.error('Failed to save event', err);
    }
  };

  /**
   * Generate canvas image with overlayed text and selected font.
   * @param {string} imgSrc local image url
   * @param {string} txt invitation text (may contain \n)
   * @param {string} fontCSS e.g. "'Macondo', cursive"
   * @param {object} styles lineStyles object with styling for each line
   * @returns {Promise<Blob>} image/jpeg blob
   */
  // NEW APPROACH: Instead of creating image with text, we'll save text separately
  // and display it as overlay on guest page. This works perfectly with Hebrew!
  const generateInvitationBlob = (imgSrc, txt, fontCSS, styles = {}) => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('🎨 Saving invitation text and styles (no image generation):', {
          textLength: txt?.length || 0,
          stylesCount: Object.keys(styles || {}).length,
          fontCSS: fontCSS
        });

        // Just save the background image - text will be displayed as overlay
        // Load image to verify it exists
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((imgResolve, imgReject) => {
          img.onload = imgResolve;
          img.onerror = imgReject;
          img.src = imgSrc;
        });

        console.log('✅ Background image verified:', {
          width: img.width,
          height: img.height,
          src: imgSrc
        });

        // Return null - we'll handle text display separately
        // The actual image will be saved later without text
        resolve(null);
      } catch (error) {
        console.error('❌ Error:', error);
        reject(error);
      }
    });
  };

  const handleChooseDesign = async (src) => {
    setUploadingInvite(true);
    try {
      // Get the actual text to use
      const textToUse = invitationText || invitationTextDefault || ' ';
      
      // Debug: Check what we're sending
      console.log('📤 Creating invitation with:', {
        customInvitationText: customInvitationText,
        invitationTextDefault: invitationTextDefault,
        finalText: textToUse,
        textLength: textToUse?.length || 0,
        font: selectedFontCss,
        lineStylesCount: Object.keys(lineStyles || {}).length,
        lineStyles: lineStyles
      });
      
      if (!textToUse || textToUse.trim() === '') {
        console.error('❌ ERROR: No text to draw on invitation!');
        alert('שגיאה: אין טקסט להזמנה. אנא הוסף טקסט לפני בחירת עיצוב.');
        setUploadingInvite(false);
        return;
      }
      
      // NEW APPROACH: No image generation - just save text and styles
      // Text will be displayed as overlay on guest page
      await generateInvitationBlob(src, textToUse, selectedFontCss, lineStyles);
      
      console.log('✅ Invitation text and styles saved - will be displayed as overlay');

      // Save event with text and styles - NO invitation_path needed!
      // The guest page will display text overlay on top of template_src
      await saveEventToSupabase(null, src); // Pass null for designFile - no image needed
      console.log('✅ Event saved with text overlay data');
      setSelectedDesign(src);
      setStepErrorMsg('');
      setShowLightbox(false);
      setShowDesignChooser(false);
      setShowGuestForm(true);
      // Note: progress_step column may not exist in all schemas, so we skip it if it fails
      if(currentEventId){ 
        try {
          await supabase.from('events').update({progress_step:3}).eq('id',currentEventId);
        } catch (progressErr) {
          // Ignore progress_step errors if column doesn't exist
          console.warn('Could not update progress_step (column may not exist):', progressErr);
        }
      }
      try{ localStorage.setItem('selectedDesign', src);}catch{}
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
  
  // --- Table summary state ---
  const [tableSummary, setTableSummary] = useState([]);
  
  // --- Plan limit warning state ---
  const [showPlanLimitWarning, setShowPlanLimitWarning] = useState(false);
React.useEffect(() => {
  if (!showPlanLimitWarning) {
    setPlanLimitWarningError('');
  }
}, [showPlanLimitWarning]);

  // Compute totals for report (only for guests, not summary rows)
  const totalReportAdults = reportGuests.reduce((sum, g) => {
    if (g.isSummary) return sum;
    return sum + (g.adults || 0);
  }, 0);
  const totalReportChildren = reportGuests.reduce((sum, g) => {
    if (g.isSummary) return sum;
    return sum + (g.children || 0);
  }, 0);
  const totalVeg = reportGuests.reduce((sum, g) => {
    if (g.isSummary) return sum;
    return sum + ((g.veg_adults||0)+(g.veg_children||0));
  }, 0);
  const totalVegan = reportGuests.reduce((sum, g) => {
    if (g.isSummary) return sum;
    return sum + ((g.vegan_adults||0)+(g.vegan_children||0));
  }, 0);
  const totalGlatt = reportGuests.reduce((sum, g) => {
    if (g.isSummary) return sum;
    return sum + ((g.glatt_adults||0)+(g.glatt_children||0));
  }, 0);
  const totalCeliac = reportGuests.reduce((sum, g) => {
    if (g.isSummary) return sum;
    return sum + ((g.celiac_adults||0)+(g.celiac_children||0));
  }, 0);
  const totalAllergy = reportGuests.reduce((sum, g) => {
    if (g.isSummary) return sum;
    return sum + ((g.allergy_adults||0)+(g.allergy_children||0));
  }, 0);


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
          .eq('event_id', currentEventId)
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


  // Helper to export report guests (sorted by table) to Excel
  const exportReportXlsx = () => {
    if (!reportGuests.length) return;

    const buildRow = (arr)=>[...arr].reverse();
    const data = [
      ['#','שם פרטי','שם משפחה','מספר שולחן','טלפון','בוגרים','ילדים','סה"כ','צמחוני','טבעוני','גלאט','צליאקים','אלרגיה','סוג אלרגיה'],
    ];

    // Add guest rows and summary rows
    let rowNum = 0;
    reportGuests.forEach((g, idx) => {
      if (g.isSummary) {
        // Summary row
        data.push([
          '',
          g.summary_label,
          '',
          g.table_number || '',
          '',
          g.adults || 0,
          g.children || 0,
          g.total || 0,
          g.veg || 0,
          g.vegan || 0,
          g.glatt || 0,
          g.celiac || 0,
          g.allergy || 0,
          ''
        ]);
      } else {
        // Guest row
        rowNum++;
        data.push([
          rowNum,
          g.first_name || '',
          g.last_name || '',
          g.table_number || '-',
          g.phone || '',
          g.adults || 0,
          g.children || 0,
          (g.adults||0)+(g.children||0),
          (g.veg_adults||0)+(g.veg_children||0),
          (g.vegan_adults||0)+(g.vegan_children||0),
          (g.glatt_adults||0)+(g.glatt_children||0),
          ((g.celiac_adults||0)+(g.celiac_children||0)),
          (g.allergy_adults||0)+(g.allergy_children||0),
          g.allergy_note || g.allergy_description || ''
        ]);
      }
    });

    // Totals row
    data.push(['','סה"כ','','','',totalReportAdults,totalReportChildren,totalReportAdults+totalReportChildren,totalVeg,totalVegan,totalGlatt,totalCeliac,totalAllergy,'']);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!dir'] = 'rtl';
    // Set column widths (wch = char width)
    ws['!cols'] = [
      {wch:3}, // #
      {wch:12}, // שם פרטי
      {wch:12}, // שם משפחה
      {wch:10}, // מספר שולחן
      {wch:12}, // phone
      {wch:6}, // בוגרים
      {wch:6}, // ילדים
      {wch:6}, // סה"כ
      {wch:7}, // צמחוני
      {wch:7}, // טבעוני
      {wch:6}, // גלאט
      {wch:7}, // צליאקים
      {wch:7}, // אלרגיה
      {wch:18}, // סוג אלרגיה
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'report_by_table');
    const wbout = XLSX.write(wb,{bookType:'xlsx',type:'array'});
    const blob = new Blob([wbout],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guests_by_table.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper to export approved guests to CSV (Excel)
  const exportApprovedXlsx = () => {
    if (!approvedGuests.length) return;

    const buildRow = (arr)=>[...arr].reverse();
    const data = [
      ['#','שם פרטי','שם משפחה','מספר שולחן','טלפון','בוגרים','ילדים','סה"כ','צמחוני','טבעוני','גלאט','צליאקים','אלרגיות','הערות'],
      ...approvedGuests.map((g,idx)=>[
        idx+1,
        g.first_name,
        g.last_name,
        g.table_number || '-',
        g.phone,
        g.adults||0,
        g.children||0,
        (g.adults||0)+(g.children||0),
        (g.veg_adults||0)+(g.veg_children||0),
        (g.vegan_adults||0)+(g.vegan_children||0),
        (g.glatt_adults||0)+(g.glatt_children||0),
        (g.celiac_adults||0)+(g.celiac_children||0),
        (g.allergy_adults||0)+(g.allergy_children||0),
        g.allergy_note || (((g.allergy_adults||0)+(g.allergy_children||0))>0?'אלרגיה':'-')
      ])
    ];

    // Totals row
    const totalAdults = approvedGuests.reduce((s,g)=>s+(g.adults||0),0);
    const totalChildren = approvedGuests.reduce((s,g)=>s+(g.children||0),0);
    const totalVeg = approvedGuests.reduce((s,g)=>s+(g.veg_adults||0)+(g.veg_children||0),0);
    const totalVegan = approvedGuests.reduce((s,g)=>s+(g.vegan_adults||0)+(g.vegan_children||0),0);
    const totalGlatt = approvedGuests.reduce((s,g)=>s+(g.glatt_adults||0)+(g.glatt_children||0),0);
    const totalCeliac = approvedGuests.reduce((s,g)=>s+(g.celiac_adults||0)+(g.celiac_children||0),0);
    const totalAllergy = approvedGuests.reduce((s,g)=>s+(g.allergy_adults||0)+(g.allergy_children||0),0);

    data.push(['','סה"כ','','','',totalAdults,totalChildren,totalAdults+totalChildren,totalVeg,totalVegan,totalGlatt,totalCeliac,totalAllergy,'']);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!dir'] = 'rtl';
    // Set column widths (wch = char width)
    ws['!cols'] = [
      {wch:3}, // #
      {wch:12}, // שם פרטי
      {wch:12}, // שם משפחה
      {wch:10}, // מספר שולחן
      {wch:12}, // phone
      {wch:6}, // בוגרים
      {wch:6}, // ילדים
      {wch:6}, // סה"כ
      {wch:7}, // צמחוני
      {wch:7}, // טבעוני
      {wch:6}, // גלאט
      {wch:7}, // צליאקים
      {wch:7}, // אלרגיות
      {wch:18}, // הערות
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'approved');
    const wbout = XLSX.write(wb,{bookType:'xlsx',type:'array'});
    const blob = new Blob([wbout],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'approved_guests.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileInputRef = useRef();

  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Column positions are fixed: A=שם פרטי, B=שם משפחה, C=מס׳ שולחן, D=טלפון
      // First row is header (skipped), data starts from row 2
      const firstNameIdx = 0; // Column A
      const lastNameIdx = 1;  // Column B
      const tableIdx = 2;     // Column C (optional)
      const phoneIdx = 3;     // Column D

      const imported = [];
      const errors = [];

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r.length) continue;

        // Skip completely empty rows
        const hasAnyData = r.some(cell => cell !== undefined && cell !== null && cell.toString().trim() !== '');
        if (!hasAnyData) continue;

        // Get raw phone and normalize it (add leading 0 for Israeli numbers if missing)
        let rawPhone = (r[phoneIdx] || '').toString().trim();
        let digitsOnly = rawPhone.replace(/\D/g, '');
        // Israeli mobile numbers: if 9 digits starting with 5, add leading 0
        if (digitsOnly.length === 9 && digitsOnly.startsWith('5')) {
          digitsOnly = '0' + digitsOnly;
        }

        const guest = {
          guestFirstName: (r[firstNameIdx] || '').toString().trim(),
          guestLastName: (r[lastNameIdx] || '').toString().trim(),
          guestPhone: digitsOnly,
          guestTable: (r[tableIdx] || '').toString().trim(),
          rowNumber: i + 1,
        };

        // Validate guest data
        const rowErrors = [];
        if (!guest.guestFirstName) rowErrors.push('שם פרטי חסר (עמודה A)');
        if (!guest.guestLastName) rowErrors.push('שם משפחה חסר (עמודה B)');
        if (!guest.guestTable) rowErrors.push('מס׳ שולחן חסר (עמודה C)');
        if (!guest.guestPhone) {
          rowErrors.push('טלפון חסר (עמודה D)');
        } else if (guest.guestPhone.length !== 10) {
          rowErrors.push(`טלפון לא תקין (${guest.guestPhone.length} ספרות במקום 10)`);
        }

        guest.errors = rowErrors;
        imported.push(guest);
        if (rowErrors.length > 0) {
          errors.push({ row: i + 1, errors: rowErrors });
        }
      }

      if (imported.length) {
        setExcelPreviewData(imported);
        setExcelErrors(errors);
        setShowExcelPreview(true);
        // No message here - file is displayed, message will appear only after sending
      } else {
        // Only show error if no guests found at all - this prevents continuation
        setInvitationResult({ 
          type: 'error', 
          message: 'לא נמצאו אורחים בקובץ' 
        });
        setShowInvitationResultModal(true);
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveExcelGuests = async (sendSms = false, sendWhatsApp = false) => {
    // Filter out guests with errors
    const validGuests = excelPreviewData.filter(g => !g.errors || g.errors.length === 0);

    if (validGuests.length === 0) {
      setInvitationResult({ 
        type: 'error', 
        message: 'אין אורחים תקינים לשמירה. נא לתקן את השגיאות תחילה.' 
      });
      setShowInvitationResultModal(true);
      return;
    }

    setIsSavingExcelGuests(true);

    try {
      // Get current user and event
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsSavingExcelGuests(false);
        setInvitationResult({ 
          type: 'error', 
          message: 'יש להתחבר כדי לשמור אורחים' 
        });
        setShowInvitationResultModal(true);
        return;
      }

      const { data: evRow } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!evRow) {
        setIsSavingExcelGuests(false);
        setInvitationResult({ 
          type: 'error', 
          message: 'לא נמצא אירוע פעיל. יש ליצור אירוע תחילה.' 
        });
        setShowInvitationResultModal(true);
        return;
      }

      // Check capacity before saving
      const { data: existingGuests } = await supabase
        .from('invited_guests')
        .select('adults, children')
        .eq('event_id', evRow.id);

      const currentAdultsCount = (existingGuests || []).reduce((sum, g) => sum + (g.adults || 0), 0);
      const currentChildrenCount = (existingGuests || []).reduce((sum, g) => sum + (g.children || 0), 0);
      const currentGuestCount = currentAdultsCount + currentChildrenCount;
      const newGuestsToAdd = validGuests.length; // Each guest in Excel = 1 person
      // Quota is by messages sent only - saving guests is allowed; we check message limit when sending SMS below
      // Prepare guests for bulk insert
      const guestsToInsert = validGuests.map(g => ({
        user_id: user.id,
        event_id: evRow.id,
        first_name: g.guestFirstName.trim(),
        last_name: g.guestLastName.trim(),
        phone: g.guestPhone.toString().trim(),
        email: null,
        total_guests: 1,
        adults: 1,
        children: 0,
        table_number: g.guestTable.toString().trim() || null,
        status: 'pending',
      }));

      // Bulk insert
      const { data: insertedGuests, error } = await supabase
        .from('invited_guests')
        .insert(guestsToInsert)
        .select();

      if (error) throw error;

      // Send SMS to all guests if requested
      if (sendSms && insertedGuests && insertedGuests.length > 0) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://meet-m.co.il');
        const smsGuests = insertedGuests.map(g => {
          const inviteLink = `${baseUrl}/${evRow.id}/${g.id}`;
          return {
            phone: g.phone,
            firstName: g.first_name,
            lastName: g.last_name,
            inviteLink,
          };
        });

        // Build SMS message with invitation text and RSVP link
        const smsMessage = `${invitationText}\n\nשלום {firstName},\nלאישור הגעה:\n{inviteLink}`;

        const totalLimitBulk = (getPlanBaseLimit(selectedPlan) || 0) + additionalPackages.reduce((s, id) => s + (getPlanBaseLimit(id) || 0), 0);
        if (totalLimitBulk > 0 && effectiveMessagesSentCount + smsGuests.length > totalLimitBulk) {
          setShowExcelPreview(false);
          setExcelPreviewData([]);
          setExcelErrors([]);
          setIsSavingExcelGuests(false);
          setSentGuests((prev) => [...prev, ...validGuests]);
          setInvitationResult({ 
            type: 'error', 
            message: `נשמרו ${validGuests.length} אורחים. אין מספיק הודעות במכסה לשליחת SMS (נשלחו ${effectiveMessagesSentCount}, מכסה ${totalLimitBulk}). נא לרכוש חבילת הרחבה.` 
          });
          setShowInvitationResultModal(true);
          return;
        }

        try {
          const bulkEventId = currentEventId || evRow?.id || null;
          const smsResponse = await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guests: smsGuests.map(g => ({
                ...g,
                message: smsMessage.replace('{inviteLink}', g.inviteLink),
              })),
              message: smsMessage,
              eventId: bulkEventId,
            }),
          });

          const smsResult = await smsResponse.json();

          // Close preview modal first
          setShowExcelPreview(false);
          setExcelPreviewData([]);
          setExcelErrors([]);
          setIsSavingExcelGuests(false);

          // Add to local state
          setSentGuests((prev) => [...prev, ...validGuests]);

          if (smsResult.sent > 0) {
            if (typeof smsResult.updatedMessagesSentCount === 'number') {
              setEventMessagesSentCount(smsResult.updatedMessagesSentCount);
            } else {
              setEventMessagesSentCount((prev) => (prev || 0) + smsResult.sent);
            }
          }
          if (smsResult.success && smsResult.sent === validGuests.length) {
            setInvitationResult({ 
              type: 'success', 
              message: `נשמרו ${validGuests.length} אורחים ונשלחו ${smsResult.sent} הודעות SMS בהצלחה!` 
            });
            setShowInvitationResultModal(true);
          } else if (smsResult.sent > 0) {
            // Partial success
            setInvitationResult({ 
              type: 'error', 
              message: `נשמרו ${validGuests.length} אורחים. נשלחו ${smsResult.sent} הודעות, ${smsResult.failed} נכשלו.` 
            });
            setShowInvitationResultModal(true);
          } else {
            // All failed
            setInvitationResult({ 
              type: 'error', 
              message: `נשמרו ${validGuests.length} אורחים, אך אירעה שגיאה בשליחת ה-SMS.` 
            });
            setShowInvitationResultModal(true);
          }
        } catch (smsError) {
          console.error('SMS sending error:', smsError);
          // Close preview modal
          setShowExcelPreview(false);
          setExcelPreviewData([]);
          setExcelErrors([]);
          setIsSavingExcelGuests(false);
          // Add to local state
          setSentGuests((prev) => [...prev, ...validGuests]);
          // Show error modal
          setInvitationResult({ 
            type: 'error', 
            message: `נשמרו ${validGuests.length} אורחים, אך אירעה שגיאה בשליחת ה-SMS.` 
          });
          setShowInvitationResultModal(true);
        }
      } else if (sendWhatsApp && insertedGuests && insertedGuests.length > 0) {
        // Save + open WhatsApp for first guest
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://meet-m.co.il');
        const first = insertedGuests[0];
        const inviteLink = `${baseUrl}/${evRow.id}/${first.id}`;
        const digitsOnly = (first.phone || '').replace(/\D/g, '');
        const waText = encodeURIComponent(
          `${invitationText}\n\nלאישור הגעה:\n${inviteLink}`
        );
        setShowExcelPreview(false);
        setExcelPreviewData([]);
        setExcelErrors([]);
        setIsSavingExcelGuests(false);
        setSentGuests((prev) => [...prev, ...validGuests]);
        if (digitsOnly.length >= 9) {
          window.open(`https://wa.me/972${digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly}?text=${waText}`, '_blank', 'noopener,noreferrer');
        }
        setInvitationResult({ 
          type: 'success', 
          message: `נשמרו ${validGuests.length} אורחים. נפתח חלון וואטסאפ לאורח הראשון – שלח וחפש "שלח הזמנה" ברשימה לשאר.` 
        });
        setShowInvitationResultModal(true);
      } else {
        // Close preview modal - save only
        setShowExcelPreview(false);
        setExcelPreviewData([]);
        setExcelErrors([]);
        setIsSavingExcelGuests(false);
        setSentGuests((prev) => [...prev, ...validGuests]);
        setInvitationResult({ 
          type: 'success', 
          message: `נשמרו בהצלחה ${validGuests.length} אורחים למסד הנתונים!` 
        });
        setShowInvitationResultModal(true);
      }

    } catch (error) {
      console.error('Error saving guests:', error);
      setIsSavingExcelGuests(false);
      setInvitationResult({ 
        type: 'error', 
        message: 'אירעה שגיאה בשמירת האורחים: ' + (error.message || 'שגיאה לא ידועה') 
      });
      setShowInvitationResultModal(true);
    }
  };

  const handleRemoveExcelRow = (index) => {
    setExcelPreviewData(prev => prev.filter((_, i) => i !== index));
    // Recalculate errors
    const newErrors = excelPreviewData
      .filter((_, i) => i !== index)
      .filter(g => g.errors && g.errors.length > 0)
      .map((g, idx) => ({ row: g.rowNumber, errors: g.errors }));
    setExcelErrors(newErrors);
  };

  const handleEditExcelRow = (index, field, value) => {
    setExcelPreviewData(prev => {
      const updated = [...prev];
      updated[index][field] = value;

      // Re-validate the row
      const guest = updated[index];
      const rowErrors = [];
      if (!guest.guestFirstName.trim()) rowErrors.push('שם פרטי חסר');
      if (!guest.guestLastName.trim()) rowErrors.push('שם משפחה חסר');
      if (!guest.guestPhone.toString().trim()) {
        rowErrors.push('טלפון חסר');
      } else {
        const digitsOnly = guest.guestPhone.toString().replace(/\D/g, '');
        if (digitsOnly.length !== 10) {
          rowErrors.push('טלפון לא תקין (נדרש 10 ספרות)');
        }
      }
      updated[index].errors = rowErrors;

      return updated;
    });

    // Recalculate error summary
    setTimeout(() => {
      const errors = excelPreviewData
        .filter(g => g.errors && g.errors.length > 0)
        .map(g => ({ row: g.rowNumber, errors: g.errors }));
      setExcelErrors(errors);
    }, 0);
  };

  // ----- New Event helper -----
  const initialFormState = {
    brideName: '', groomName: '', brideParents: '', groomParents: '',
    boyName: '', boyParents: '', girlName: '', girlParents: '', babyParents: '',
    birthdayName: '', birthdayAge: '', businessName: '', businessContact: '',
    date: '', time: '19:30', chuppahTime: '21:00', hallName: '', hallAddress: '',
    customEventDescription: 'תיאור האירוע',
  };
  const handleNewEvent = async (showDeletionMessage = false) => {
    setShowExistingEventWarning(false);
    setShowArchiveConfirm(false);
    let eventWasDeleted = false;
    // "Deletion completed" means: we deleted the event successfully OR there was no DB event to delete.
    // This better matches the user expectation when they confirm deletion and the UI resets cleanly.
    let deletionCompleted = false;
    let deletionErrorAlertShown = false;
    let eventIdToDelete = currentEventId;

    if (!eventIdToDelete) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: ev, error: evErr } = await supabase
            .from('events')
            .select('id, status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (evErr && (evErr.message || '').toLowerCase().includes('column')) {
            const { data: evFallback } = await supabase
              .from('events')
              .select('id')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (evFallback) eventIdToDelete = evFallback.id;
          } else if (ev && ev.status !== 'archived') {
            eventIdToDelete = ev.id;
          }
        }
      } catch (e) {
        console.warn('Could not fetch event to delete', e);
      }
    }

    if (!eventIdToDelete) {
      // Nothing to delete in DB (e.g. event only existed in UI/localStorage).
      deletionCompleted = true;
    } else {
      try {
        let skipDelete = false;
        const { data: eventData, error: fetchError } = await supabase
          .from('events')
          .select('id, status')
          .eq('id', eventIdToDelete)
          .maybeSingle();
        if (!fetchError && eventData && eventData.status === 'archived') {
          skipDelete = true;
        }
        if (!skipDelete) {
          const { error: guestsError } = await supabase
            .from('invited_guests')
            .delete()
            .eq('event_id', eventIdToDelete);
          if (guestsError) {
            console.error('Error deleting guests:', guestsError);
            alert('שגיאה במחיקת האורחים של האירוע הקיים.');
            deletionErrorAlertShown = true;
            // If guests couldn't be deleted, don't show "success" at the end.
            deletionCompleted = false;
            throw guestsError;
          }
          const { error: rsvpsErr } = await supabase.from('event_rsvps').delete().eq('event_id', eventIdToDelete);
          if (rsvpsErr) {
            // event_rsvps או event_id אולי לא קיימים – לא חוסם
          }
          const { error: deleteError } = await supabase
            .from('events')
            .delete()
            .eq('id', eventIdToDelete);
          if (deleteError) {
            console.error('Error deleting current event:', deleteError);
            alert('שגיאה במחיקת האירוע הקיים.');
            deletionErrorAlertShown = true;
            deletionCompleted = false;
          } else {
            eventWasDeleted = true;
            deletionCompleted = true;
          }
        } else {
          // Event is archived (or treated as such) -> no hard delete is needed for "new event" flow.
          deletionCompleted = true;
        }
      } catch (err) {
        console.error('Failed to delete current event:', err);
        if (!deletionErrorAlertShown) {
          alert('שגיאה במחיקת האירוע הקיים.');
        }
        deletionCompleted = false;
      }
    }

    // Now reset the state for new event
    setSelectedEventType('');
    setFormData(initialFormState);
    setEventDetailsCompleted(false);
    setSelectedDesign(null);
    setInvitationSent(false);
    setRsvpConfirmed(false);
    setShowGuestForm(false);
    setShowReportsOptions(false);
    setStepErrorMsg('');
    setErrorMsg('');
    setFinishedSteps([]); // Reset finished steps for new event
    setCurrentEventId(null);
    setEventDataLoaded(false);
    
    // If event was actually deleted (not just archived), reset everything פרט לחבילה:
    // המשתמש כבר רכש/בחר מסלול, אין סיבה לבקש ממנו לבחור שוב.
    if (eventWasDeleted) {
      setNewEventStarted(false); // Clear "event in progress" message
      setEventMessagesSentCount(0);
      try { localStorage.removeItem('newEventStarted'); } catch(e){}
    } else {
      // Event was archived or doesn't exist - start new event process
      setNewEventStarted(true);
      try { localStorage.setItem('newEventStarted','1'); } catch(e){}
    }
    
    // Reset guest data and reports (these are UI state only, data is preserved in DB)
    setGuestSummary({ approved: 0, adults: 0, children: 0 });
    resetCapacityWarningGuests();
    setGuestStatusSummary({ approved: 0, rejected: 0, pending: 0 });
    setSpecialMealsSummary({ 
      veg: { adults: 0, children: 0, total: 0 },
      vegan: { adults: 0, children: 0, total: 0 },
      glatt: { adults: 0, children: 0, total: 0 },
      allergy: { adults: 0, children: 0, total: 0 }
    });
    setDbGuests([]);
    setSentGuests([]);
    setReportGuests([]);
    setShowGuestListModal(false);
    setShowReportModal(false);
    setSelectedEventForReport(null);
    setAdditionalPackages([]);
    
    try{ localStorage.removeItem('selectedDesign'); }catch{}
    try{ localStorage.removeItem('finishedSteps'); }catch{} // Clear finished steps from local storage
    try{ localStorage.removeItem('selectedEventType'); }catch{} // Clear selected event type from local storage
    try{ localStorage.removeItem('additionalPackages'); }catch{}
    try{ localStorage.removeItem('additionalPackagesEventId'); }catch{}
    try{ if (currentEventId) localStorage.removeItem(`additionalPackages:${currentEventId}`); }catch{}

    // Check if user has a plan - if not, show pricing modal
    if (!selectedPlan) {
      setShowPricingPlan(true);
      setPlanAddOnMode(false); // Ensure we're in plan selection mode, not addon mode
    }

    if (showDeletionMessage && (eventWasDeleted || deletionCompleted)) {
      // סימון ש"ניקינו" את האירוע הקודם – כדי לא לבקש מחיקה שוב בכל לחיצה על "צור אירוע חדש"
      setHasClearedExistingEvent(true);
      setShowDeletionSuccess(true);
      setShowEventTypes(true);
    }
  };

  // Get price for each plan
  const getPlanPrice = (plan) => {
    switch(plan) {
      case 'free':
      case 'basic':
        return 5;
      case 'standard':
        return 149;
      case 'premium':
        return 199;
      case 'luxury':
        return 259;
      default:
        return 49;
    }
  };

  // Get plan display name
  const getPlanDisplayName = (plan) => {
    switch(plan) {
      case 'free':
      case 'basic':
        return 'מסלול א - 5₪';
      case 'standard':
        return 'מסלול ב - 149₪';
      case 'premium':
        return 'מסלול ג - 199₪';
      case 'luxury':
        return 'מסלול ד - 259₪';
      default:
        return plan;
    }
  };

  // Get allowed guests for a plan
  const getPlanGuestLimit = (plan) => {
    switch(plan) {
      case 'free':
      case 'basic':
        return 50;
      case 'standard':
        return 200;
      case 'premium':
        return 350;
      case 'luxury':
        return 500;
      default:
        return 50;
    }
  };

  // Handle plan selection in pricing modal
  const handleSelectPlan = (plan) => {
    // Check if user is logged in
    if (!session) {
      setInvitationResult({ 
        type: 'error', 
        message: 'עליך להתחבר כדי לרכוש חבילה' 
      });
      setShowInvitationResultModal(true);
      setShowPricingPlan(false);
      onAuthClick('sign_in');
      return;
    }

    const price = getPlanPrice(plan);

    // All plans now require payment
    setPendingPlan(plan);
    setPaymentAmount(price);
    setPaymentPlanName(getPlanDisplayName(plan));
    setShowPricingPlan(false);
    setShowPaymentModal(true);
  };

  // Handle adding package plan (for addon mode)
  const handleAddPackagePlan = (plan) => {
    // Add the selected plan to additional packages
    setAdditionalPackages((prev) => [...prev, plan]);
    setShowPricingPlan(false);
  };

  // Helper function to get addon package price (100 guests for 100 shekel)
  const getAddonPrice = () => {
    return 100;
  };

  // Helper function to get addon display name
  const getAddonDisplayName = () => {
    return 'חבילת הרחבה - 100 הודעות נוספות';
  };

  // Purchase addon: הלקוח בחר כמה חבילות (100 הודעות כל אחת), 100₪ לחבילה
  const handlePurchaseAddon = () => {
    if (!session) {
      setInvitationResult({ type: 'error', message: 'עליך להתחבר כדי לרכוש חבילה' });
      setShowInvitationResultModal(true);
      setShowPlanLimitWarning(false);
      resetCapacityWarningGuests();
      onAuthClick('sign_in');
      return;
    }

    const numPackages = Math.max(1, pendingAddonCount);
    const totalCost = numPackages * 100;

    setPendingPlan('addon');
    setPaymentAmount(totalCost);
    setPaymentPlanName(numPackages === 1 ? getAddonDisplayName() : `${numPackages} חבילות הרחבה - ${numPackages * 100} הודעות (₪${totalCost})`);
    setShowPaymentModal(true);
    setShowPlanLimitWarning(false);
    resetCapacityWarningGuests();
  };

  // Handle successful payment
  const handlePaymentSuccess = async (transactionData) => {
    try {
      console.log('Payment successful:', transactionData);

      // Validate transaction data
      if (!transactionData) {
        console.error('No transaction data received');
        setPaymentResultType('error');
        setPaymentResultMessage('לא התקבלו נתוני תשלום');
        setShowPaymentModal(false);
        setShowPaymentResultModal(true);
        return;
      }

      // Check if transaction was actually successful
      const responseCode = transactionData.Response || transactionData.response_code;
      if (responseCode && responseCode !== '000' && responseCode !== 0 && responseCode !== '0') {
        console.error('Transaction failed with response code:', responseCode);
        setPaymentResultType('error');
        setPaymentResultMessage(`שגיאה בתשלום (קוד: ${responseCode})`);
        setShowPaymentModal(false);
        setShowPaymentResultModal(true);
        return;
      }

      // Handle plan purchase (ב, ג, ד)
      if (pendingPlan && pendingPlan !== 'addon') {
        try {
          setSelectedPlan(pendingPlan);
          try { localStorage.setItem('selectedPlan', pendingPlan); } catch(e){
            console.warn('Failed to save plan to localStorage:', e);
          }
          if (currentEventId) {
            supabase.from('events').update({ selected_plan: pendingPlan }).eq('id', currentEventId).then(({ error }) => {
              if (error) console.error('Failed to persist selected_plan to DB', error);
            });
          }

          const planDisplayName = getPlanDisplayName(pendingPlan);
          // Show success modal instead of toast
          setPaymentResultType('success');
          setPaymentResultMessage(`התשלום בוצע בהצלחה! ${planDisplayName} הופעל`);
          setPaymentWasPlanPurchase(true);
          setShowPaymentModal(false);
          setShowPaymentResultModal(true);
        } catch (error) {
          console.error('Error handling plan purchase:', error);
          setPaymentResultType('error');
          setPaymentResultMessage('שגיאה בעדכון המסלול. אנא פנה לתמיכה.');
          setShowPaymentModal(false);
          setShowPaymentResultModal(true);
        }
      }
      // Handle addon packages (100 guests for 100 shekel each)
      else if (pendingPlan === 'addon') {
        try {
          const newAddons = Array(pendingAddonCount).fill('addon');
          const updatedPackages = [...additionalPackages, ...newAddons];
          setAdditionalPackages(updatedPackages);
          const newAddonTotal = updatedPackages.filter((p) => p === 'addon').length;
          setDbAddonCount(newAddonTotal);
          let eventIdForSave = currentEventId;
          if (!eventIdForSave) {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const { data: latestEv } = await supabase.from('events')
                  .select('id').eq('user_id', user.id)
                  .order('created_at', { ascending: false }).limit(1).single();
                if (latestEv) {
                  eventIdForSave = latestEv.id;
                  setCurrentEventId(latestEv.id);
                }
              }
            } catch (_) {}
          }
          if (eventIdForSave) {
            const { error: updErr } = await supabase
              .from('events')
              .update({ additional_packages: newAddonTotal })
              .eq('id', eventIdForSave);
            if (updErr) {
              console.error('Failed to persist additional_packages in DB', updErr);
            }
            const { data: verify } = await supabase
              .from('events')
              .select('additional_packages')
              .eq('id', eventIdForSave)
              .single();
            if (verify && typeof verify.additional_packages === 'number' && verify.additional_packages !== newAddonTotal) {
              console.warn('additional_packages mismatch after update, retrying');
              await supabase.from('events').update({ additional_packages: newAddonTotal }).eq('id', eventIdForSave);
            }
          }
          try { localStorage.setItem('additionalPackages_' + (eventIdForSave || 'global'), JSON.stringify(newAddonTotal)); } catch (_) {}
          setPlanSelectionError('');

          const totalGuestsAdded = pendingAddonCount * 100;
          setPaymentResultType('success');
          setPaymentResultMessage(`התשלום בוצע בהצלחה! ${totalGuestsAdded} מקומות נוספים נוספו לאירוע שלך.`);
          setPaymentWasPlanPurchase(false);

          // מכסת הודעות נגזרת מ-selectedPlan + additionalPackages (state/localStorage).

          setShowPaymentModal(false);
          setShowPaymentResultModal(true);
        } catch (error) {
          console.error('Error handling addon purchase:', error);
          setPaymentResultType('error');
          setPaymentResultMessage('שגיאה בעדכון החבילות. אנא פנה לתמיכה.');
          setShowPaymentModal(false);
          setShowPaymentResultModal(true);
        }
      } else {
        // No pending plan - this shouldn't happen, but handle gracefully
        console.warn('Payment succeeded but no pending plan found');
        setPaymentResultType('success');
        setPaymentResultMessage('התשלום בוצע בהצלחה!');
        setShowPaymentModal(false);
        setShowPaymentResultModal(true);
      }

      // Clear pending state
      setPendingPlan(null);
      setPendingAddonCount(1);
    } catch (error) {
      console.error('Error in handlePaymentSuccess:', error);
      setPaymentResultType('error');
      setPaymentResultMessage('אירעה שגיאה בעיבוד התשלום. אנא פנה לתמיכה עם מספר אישור: ' + (transactionData?.ConfirmationCode || 'לא זמין'));
      setShowPaymentModal(false);
      setShowPaymentResultModal(true);
    }
  };

  // Handle payment failure
  const handlePaymentFailure = (errorData) => {
    try {
      console.log('Payment failed:', errorData);

      // Determine error message
      let errorMessage = 'התשלום נכשל. אנא נסה שוב או בחר מסלול אחר.';
      
      // Check for Response code in different locations
      const responseCode = errorData?.Response || 
                          errorData?.transactionData?.Response || 
                          errorData?.response_code;
      
      if (responseCode) {
        // Tranzila error codes
        const errorCodes = {
          '001': 'כרטיס אשראי נדחה על ידי הבנק',
          '002': 'פג תוקף כרטיס האשראי',
          '003': 'מספר כרטיס לא תקין',
          '004': 'סכום לא תקין',
          '005': 'בעיה בשרת התשלומים',
          '006': 'כרטיס חסום',
          '007': 'סכום חריג - נדרש אישור מהבנק',
          '008': 'בעיה בהתחברות למערכת הסליקה',
        };
        errorMessage = errorCodes[responseCode] || `שגיאה בתשלום (קוד: ${responseCode})`;
      } else if (errorData?.error) {
        errorMessage = typeof errorData.error === 'string' ? errorData.error : 'אירעה שגיאה בעת ביצוע התשלום';
      } else if (errorData?.reason) {
        errorMessage = typeof errorData.reason === 'string' ? errorData.reason : errorMessage;
      } else if (errorData?.message) {
        errorMessage = typeof errorData.message === 'string' ? errorData.message : errorMessage;
      }

      // Show error modal instead of toast
      setPaymentResultType('error');
      setPaymentResultMessage(errorMessage);
      setShowPaymentModal(false);
      setShowPaymentResultModal(true);

      // Clear pending state
      setPendingPlan(null);
      setPendingAddonCount(1);
    } catch (error) {
      console.error('Error in handlePaymentFailure:', error);
      // Fallback error message
      setPaymentResultType('error');
      setPaymentResultMessage('אירעה שגיאה בעיבוד התשלום. אנא נסה שוב או פנה לתמיכה.');
      setShowPaymentModal(false);
      setShowPaymentResultModal(true);
    }
  };

  // Check if there's an existing event in progress
  const hasExistingEvent = () => {
    return Boolean(currentEventId || newEventStarted || finishedSteps.length > 0 || selectedEventType || Object.values(formData || {}).some(Boolean));
  };

  // Confirmation for creating a new event
  const [showNewEventConfirm, setShowNewEventConfirm] = useState(false);
  const [showExistingEventWarning, setShowExistingEventWarning] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeletionSuccess, setShowDeletionSuccess] = useState(false);
  const [newEventStarted, setNewEventStarted] = useState(()=>{
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('newEventStarted') === '1';
    } catch(e) { return false; }
  });

  // State for Tranzila terminal info
  const [tranzilaTerminalInfo, setTranzilaTerminalInfo] = useState(null);

  // ---------------- helper to archive past event and check active -----------------
  React.useEffect(()=>{
    (async ()=>{
      try{
        const { data:{user} } = await supabase.auth.getUser();
        if(!user) return;
        let ev = null;
        let messagesSent = 0;
        const { data: evData, error: evError } = await supabase
          .from('events')
          .select('id,event_details,allowed_guests,messages_sent_count,additional_packages,selected_plan')
          .eq('user_id',user.id)
          .order('created_at',{ascending:false})
          .limit(1)
          .single();
        if (evError && (evError.message || '').toLowerCase().includes('column')) {
          const { data: evF } = await supabase
            .from('events')
            .select('id,event_details,allowed_guests')
            .eq('user_id',user.id)
            .order('created_at',{ascending:false})
            .limit(1)
            .single();
          ev = evF;
        } else {
          ev = evData;
          messagesSent = ev?.messages_sent_count ?? 0;
        }
        if(!ev) return;
        setEventMessagesSentCount(messagesSent);
        let addonCount = 0;
        if (typeof ev.additional_packages === 'number') {
          addonCount = ev.additional_packages;
        }
        try {
          const lsKey = 'additionalPackages_' + ev.id;
          const lsVal = parseInt(localStorage.getItem(lsKey), 10);
          if (!isNaN(lsVal) && lsVal > addonCount) addonCount = lsVal;
        } catch (_) {}
        setDbAddonCount((prev) => Math.max(prev ?? 0, addonCount));
        setAdditionalPackages((prev) => {
          const prevCount = prev ? prev.length : 0;
          if (addonCount > prevCount) return Array(addonCount).fill('addon');
          return prev;
        });
        setEventDataLoaded(true);
        const dbPlan = ev.selected_plan || null;
        const storedPlan = typeof window !== 'undefined' ? localStorage.getItem('selectedPlan') : null;
        const planToUse = dbPlan || storedPlan || null;
        if (planToUse && !selectedPlan) {
          setSelectedPlan(planToUse);
          try { localStorage.setItem('selectedPlan', planToUse); } catch(e){}
        } else if (!planToUse && ev.allowed_guests && !selectedPlan) {
          const inferredPlan = ev.allowed_guests <= 50 ? 'free' :
                               ev.allowed_guests <= 200 ? 'standard' :
                               ev.allowed_guests <= 350 ? 'premium' :
                               ev.allowed_guests <= 500 ? 'luxury' : 'supreme';
          setSelectedPlan(inferredPlan);
          try { localStorage.setItem('selectedPlan', inferredPlan); } catch(e){}
        }
        const details=typeof ev.event_details==='string'?JSON.parse(ev.event_details):ev.event_details||{};
        const dateStr=details.date||details.start_datetime;
        const parsedDate = parseEventDate(dateStr);
        if(parsedDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const eventDate = new Date(parsedDate);
          eventDate.setHours(0, 0, 0, 0);
          if(eventDate < today){
            // Event has ended - no need to update status since column doesn't exist
          }
        }
      }catch(e){console.error('archive check failed',e);}  
    })();
  },[eventRefreshKey]);

  // Realtime sync: when current event or its guests change in Supabase, refresh state.
  React.useEffect(() => {
    if (!currentEventId) return;
    const channel = supabase.channel(`event-sync-${currentEventId}`);
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `id=eq.${currentEventId}` },
        (payload) => {
          const ev = payload.new || payload.old || {};
          if (typeof ev.messages_sent_count === 'number') {
            setEventMessagesSentCount(ev.messages_sent_count);
          }
          if (typeof ev.additional_packages === 'number') {
            setDbAddonCount((prev) => Math.max(prev ?? 0, ev.additional_packages));
            setAdditionalPackages((prev) => {
              const prevCount = prev ? prev.length : 0;
              if (ev.additional_packages > prevCount) return Array(ev.additional_packages).fill('addon');
              return prev;
            });
          }
          if (ev.selected_plan) {
            setSelectedPlan(ev.selected_plan);
            try { localStorage.setItem('selectedPlan', ev.selected_plan); } catch (_) {}
          }
          setEventRefreshKey((k) => k + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invited_guests', filter: `event_id=eq.${currentEventId}` },
        () => {
          setGuestSummaryRefreshKey((k) => k + 1);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentEventId]);

  const checkActiveEventExists = async () => {
    try{
      const { data:{user} } = await supabase.auth.getUser();
      if(!user) return false;
      let ev = null;
      const { data: evData, error: evError } = await supabase
        .from('events')
        .select('id,event_details,status,allowed_guests,messages_sent_count')
        .eq('user_id',user.id)
        .neq('status','archived')
        .order('created_at',{ascending:false})
        .limit(1)
        .maybeSingle();
      if (evError && (evError.message || '').toLowerCase().includes('column')) {
        const { data: evF } = await supabase
          .from('events')
          .select('id,event_details,status,allowed_guests')
          .eq('user_id',user.id)
          .order('created_at',{ascending:false})
          .limit(1)
          .maybeSingle();
        ev = evF;
      } else {
        ev = evData;
      }
      if(!ev) return false;
      const details=typeof ev.event_details==='string'?JSON.parse(ev.event_details):ev.event_details||{};
      const dateStr=details.date||details.start_datetime||details.end_datetime;
      if(!dateStr) return true;
      const today = new Date();
      today.setHours(0,0,0,0);
      const eventDate = new Date(dateStr);
      eventDate.setHours(0,0,0,0);
      return eventDate >= today;
    }catch(e){ console.error('checkActiveEventExists err', e); return false; }
  }

  // Persist formData whenever step 1 completed
  React.useEffect(()=>{
    if(!finishedSteps.includes(1)) return;
    try{ localStorage.setItem('savedEventDetails', JSON.stringify(formData)); }catch{}
  },[formData, finishedSteps]);

  // ---- auto mark steps when flags change ----
  React.useEffect(()=>{
    if(selectedEventType) markStepDone(0);
  },[selectedEventType]);

  React.useEffect(()=>{
    if(eventDetailsCompleted) markStepDone(1);
  },[eventDetailsCompleted]);

  React.useEffect(()=>{
    if(selectedDesign) markStepDone(2);
  },[selectedDesign]);

  const [showActiveError,setShowActiveError]=useState(false);

  // When returning to the tab, refresh event state from Supabase (keeps web/mobile in sync).
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setEventRefreshKey((k) => k + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Keep a robust count of invited guests for this event (fallback for message counter/report).
  React.useEffect(() => {
    if (!currentEventId) {
      setInvitedGuestsCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { count, error } = await supabase
          .from('invited_guests')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', currentEventId);
        if (!cancelled && !error) {
          setInvitedGuestsCount(count || 0);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to count invited guests', e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentEventId]);

  // Auto-save invitation text and styles to database when they change (with debounce)
  useEffect(() => {
    if (!currentEventId || !selectedDesign) return;
    
    // Don't auto-save on initial load - wait for user to make changes
    const textToSave = customInvitationText || invitationText || '';
    if (!textToSave.trim()) return;

    const debounceTimer = setTimeout(async () => {
      try {
        console.log('💾 Auto-saving invitation text and styles:', {
          textLength: textToSave.length,
          lineStylesCount: Object.keys(lineStyles || {}).length,
          hasSelectedDesign: !!selectedDesign
        });
        
        // Use the functions directly - they're defined in the component scope
        await generateInvitationBlob(selectedDesign, textToSave, selectedFontCss, lineStyles);
        await saveEventToSupabase(null, selectedDesign);
        console.log('✅ Auto-save completed');
      } catch (err) {
        console.error('Auto-save failed:', err);
        // Don't show alert for auto-save failures
      }
    }, 1500); // Wait 1.5 seconds after last change

    return () => clearTimeout(debounceTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customInvitationText, invitationText, lineStyles, selectedDesign, selectedFontCss, currentEventId]);

  // fetch approved guests when report opens
  React.useEffect(() => {
    if (!showApprovedReport) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Use selectedEventForReport for archived events, otherwise use currentEventId
        const eventIdToUse = selectedEventForReport?.id || currentEventId;
        if (!eventIdToUse) {
          setApprovedGuests([]);
          return;
        }

        const { data } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('event_id', eventIdToUse)
          .eq('status', 'approved');
        setApprovedGuests(data || []);
      } catch (e) {
        console.error('fetch approved guests failed', e);
      }
    })();
  }, [showApprovedReport, currentEventId, selectedEventForReport]);

  // fetch rejected guests
  React.useEffect(() => {
    if (!showRejectedReport) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Use selectedEventForReport for archived events, otherwise use currentEventId
        const eventIdToUse = selectedEventForReport?.id || currentEventId;
        if (!eventIdToUse) {
          setRejectedGuests([]);
          return;
        }
        
        const { data } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('event_id', eventIdToUse)
          .eq('status', 'rejected');
        setRejectedGuests(data || []);
      } catch (e) {
        console.error('fetch rejected guests failed', e);
      }
    })();
  }, [showRejectedReport, currentEventId, selectedEventForReport]);

  // fetch pending guests
  React.useEffect(() => {
    if (!showPendingReport) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Use selectedEventForReport for archived events, otherwise use currentEventId
        const eventIdToUse = selectedEventForReport?.id || currentEventId;
        if (!eventIdToUse) {
          setPendingGuests([]);
          return;
        }
        
        const { data } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('event_id', eventIdToUse)
          .or('status.is.null,status.eq.pending,status.eq.""');
        setPendingGuests(data || []);
      } catch (e) {
        console.error('fetch pending guests failed', e);
      }
    })();
  }, [showPendingReport, currentEventId, selectedEventForReport]);

  // Fetch guests when guest list modal opens - only if there's an active event
  React.useEffect(() => {
    if (!showGuestListModal) {
      setDbGuests([]);
      return;
    }
    
    // If no active event, force close modal and reset data
    if (!currentEventId) {
      console.log('No active event, closing modal and resetting data');
      setShowGuestListModal(false);
      setDbGuests([]);
      setGuestSummary({ approved: 0, adults: 0, children: 0 });
      resetCapacityWarningGuests();
      setGuestStatusSummary({ approved: 0, rejected: 0, pending: 0 });
      return;
    }
    
    (async () => {
      try {
        const { data: guests } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('event_id', currentEventId);

        setDbGuests(guests || []);
      } catch (e) {
        console.error('Failed to fetch guest list', e);
        setDbGuests([]);
      }
    })();
  }, [showGuestListModal, currentEventId]);

  // ---- Auto-archive when event ends (after date has passed) ----
  React.useEffect(() => {
    if (!formData.date || !currentEventId) return;
    
    const eventDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // אם התאריך עבר – מסמנים את האירוע כ"archived" (אם יש עמודת status) ומציגים הודעה למשתמש
    if (diffDays < 0) {
      (async () => {
        try {
          // ננסה לסמן את האירוע כ"archived" – אם אין עמודת status פשוט נתעלם מהשגיאה
          const { error } = await supabase
            .from('events')
            .update({ status: 'archived' })
            .eq('id', currentEventId);
          if (error && !(error.message || '').toLowerCase().includes('column')) {
            console.error('Failed to archive past event:', error);
          }
        } catch (e) {
          console.error('Failed to archive past event:', e);
        }
        
        // מנקים את סימון "אירוע בתהליך"
        setNewEventStarted(false);
        try { localStorage.removeItem('newEventStarted'); } catch(e){}

        // מנקים את האירוע הפעיל כך שהמערכת תראה שאין אירוע פעיל כרגע
        setCurrentEventId(null);
        
        // מאחר שהאירוע הסתיים באופן טבעי (עבר התאריך) – המסלול הנוכחי "נצרך"
        // וליצירת אירוע חדש יש לבחור ולשלם על מסלול מחדש.
        setSelectedPlan(null);
        setEventMessagesSentCount(0);
        try { localStorage.removeItem('selectedPlan'); } catch(e){}
        
        // מציגים למשתמש הודעה ברורה שאפשר לפתוח אירוע חדש
        setShowEventEndedNotice(true);
      })();
    }
  }, [formData.date, currentEventId]);

  // Fetch Tranzila terminal info
  React.useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/tranzila/terminal-info');
        if (response.ok) {
          const data = await response.json();
          setTranzilaTerminalInfo(data);
        }
      } catch (e) {
        console.error('Failed to fetch terminal info:', e);
      }
    })();
  }, []);

  // ---- Check if there's an active event in database but currentEventId is null ----
  React.useEffect(() => {
    (async () => {
      if (!currentEventId && !newEventStarted) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          
          const { data: ev } = await supabase
            .from('events')
            .select('id, event_details, allowed_guests, messages_sent_count, additional_packages, selected_plan')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (ev) {
            const details = typeof ev.event_details === 'string' 
              ? JSON.parse(ev.event_details) 
              : ev.event_details;
            
            if (details && details.date) {
              const eventDate = new Date(details.date);
              eventDate.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              if (eventDate >= today) {
                console.log('Found future event in database, restoring...', ev);
                setCurrentEventId(ev.id);
                setEventMessagesSentCount(ev.messages_sent_count ?? 0);
                let restoreAddonCount = 0;
                if (typeof ev.additional_packages === 'number') {
                  restoreAddonCount = ev.additional_packages;
                }
                try {
                  const lsVal = parseInt(localStorage.getItem('additionalPackages_' + ev.id), 10);
                  if (!isNaN(lsVal) && lsVal > restoreAddonCount) restoreAddonCount = lsVal;
                } catch (_) {}
                setDbAddonCount((prev) => Math.max(prev ?? 0, restoreAddonCount));
                setAdditionalPackages((prev) => {
                  const prevCount = prev ? prev.length : 0;
                  if (restoreAddonCount > prevCount) return Array(restoreAddonCount).fill('addon');
                  return prev;
                });
                setEventDataLoaded(true);
                const dbPlan = ev.selected_plan || null;
                const storedPlan = typeof window !== 'undefined' ? localStorage.getItem('selectedPlan') : null;
                const planToUse = dbPlan || storedPlan || null;
                if (planToUse && !selectedPlan) {
                  setSelectedPlan(planToUse);
                  try { localStorage.setItem('selectedPlan', planToUse); } catch(e){}
                } else if (!planToUse && ev.allowed_guests && !selectedPlan) {
                  const inferredPlan = ev.allowed_guests <= 50 ? 'free' :
                                       ev.allowed_guests <= 200 ? 'standard' :
                                       ev.allowed_guests <= 350 ? 'premium' :
                                       ev.allowed_guests <= 500 ? 'luxury' : 'supreme';
                  setSelectedPlan(inferredPlan);
                  try { localStorage.setItem('selectedPlan', inferredPlan); } catch(e){}
                }
                setFormData(prev => ({ ...prev, ...details }));
                
                // Restore design if available
                const tpl = details?.template_src || null;
                if (tpl) {
                  setSelectedDesign(tpl);
                  markStepDone(2);
                }
              } else {
                console.log('Event found but has ended, not restoring');
                // Close any open modals when no active event
                setShowGuestListModal(false);
                setShowReportsOptions(false);
              }
            }
          } else {
            console.log('No event found in database');
            // Close any open modals when no event exists
            setShowGuestListModal(false);
            setShowReportsOptions(false);
          }
          // Mark initial load as complete after first load attempt
          isInitialLoadRef.current = false;
        } catch (e) {
          console.error('Failed to check for active event:', e);
          isInitialLoadRef.current = false;
        }
      }
    })();
  }, [currentEventId, newEventStarted, eventRefreshKey]);

  // ---- Close modals when no active event ----
  React.useEffect(() => {
    if (!currentEventId && !newEventStarted) {
      // Close all modals when no active event
      setShowGuestListModal(false);
      setShowReportModal(false);
      setShowReportsOptions(false);
      setSelectedEventForReport(null);
      setDbGuests([]);
      setSentGuests([]);
      setReportGuests([]);
      
      // Force reset all guest-related state
      setGuestSummary({ approved: 0, adults: 0, children: 0 });
      resetCapacityWarningGuests();
      setGuestStatusSummary({ approved: 0, rejected: 0, pending: 0 });
      setApprovedGuests([]);
      setRejectedGuests([]);
      setPendingGuests([]);
    }
  }, [currentEventId, newEventStarted]);

  // ---- Debounced autosave of event_details to Supabase ----
  const formSaveTimer = useRef(null);
  const isInitialLoadRef = useRef(true); // Track if we're in initial load phase

  React.useEffect(()=>{
    if(!currentEventId) return;           // need event id
    if(!finishedSteps.includes(1)) return; // only after step 2 completed

    if(formSaveTimer.current) clearTimeout(formSaveTimer.current);
    formSaveTimer.current = setTimeout(async ()=>{
      try{
        await supabase.from('events').update({ event_details: formData }).eq('id', currentEventId);
      }catch(e){ console.error('auto-save event_details failed', e); }
    },1500);

    return ()=>{ if(formSaveTimer.current) clearTimeout(formSaveTimer.current);}  // cleanup on unmount
  },[formData, currentEventId, finishedSteps]);

  const formatISODateLocal=(d)=>{
    const tzOff=d.getTimezoneOffset()*60000;
    return new Date(d.getTime()-tzOff).toISOString().slice(0,10);
  };

  // Restore selectedDesign and event details from last saved event on mount
  React.useEffect(()=>{
    (async()=>{
      try{
        const { data:{user} } = await supabase.auth.getUser();
        if(!user) return;
        let ev = null;
        let messagesSent = 0;
        const { data: evData, error: evError } = await supabase
          .from('events')
          .select('id,event_details,allowed_guests,messages_sent_count,additional_packages,selected_plan')
          .eq('user_id', user.id)
          .order('created_at',{ascending:false})
          .limit(1)
          .maybeSingle();
        if (evError && (evError.message || '').toLowerCase().includes('column')) {
          const { data: evFallback } = await supabase
            .from('events')
            .select('id,event_details,allowed_guests')
            .eq('user_id', user.id)
            .order('created_at',{ascending:false})
            .limit(1)
            .maybeSingle();
          ev = evFallback;
          messagesSent = 0;
        } else {
          ev = evData;
          messagesSent = ev?.messages_sent_count ?? 0;
        }
        if(ev){
          setCurrentEventId(ev.id);
          setEventMessagesSentCount(messagesSent);
          let addonCount = 0;
          if (typeof ev.additional_packages === 'number') {
            addonCount = ev.additional_packages;
          }
          try {
            const lsVal = parseInt(localStorage.getItem('additionalPackages_' + ev.id), 10);
            if (!isNaN(lsVal) && lsVal > addonCount) addonCount = lsVal;
          } catch (_) {}
          setDbAddonCount((prev) => Math.max(prev ?? 0, addonCount));
          setAdditionalPackages((prev) => {
            const prevCount = prev ? prev.length : 0;
            if (addonCount > prevCount) return Array(addonCount).fill('addon');
            return prev;
          });
          setEventDataLoaded(true);
          const dbPlan = ev.selected_plan || null;
          const storedPlan = typeof window !== 'undefined' ? localStorage.getItem('selectedPlan') : null;
          const planToUse = dbPlan || storedPlan || null;
          if (planToUse && !selectedPlan) {
            setSelectedPlan(planToUse);
            try { localStorage.setItem('selectedPlan', planToUse); } catch(e){}
          } else if (!planToUse && ev.allowed_guests && !selectedPlan) {
            const inferredPlan = ev.allowed_guests <= 50 ? 'free' :
                                 ev.allowed_guests <= 200 ? 'standard' :
                                 ev.allowed_guests <= 350 ? 'premium' :
                                 ev.allowed_guests <= 500 ? 'luxury' : 'supreme';
            setSelectedPlan(inferredPlan);
            try { localStorage.setItem('selectedPlan', inferredPlan); } catch(e){}
          }
          const details = typeof ev.event_details === 'string' 
            ? JSON.parse(ev.event_details) 
            : ev.event_details;
          const tpl = details?.template_src || null;
          if(tpl){
            setSelectedDesign(tpl);
            markStepDone(2);
          }
          if(Object.values(formData).every(v=>!v) && details){
            setFormData(prev=>({ ...prev, ...details }));
            setEventDetailsCompleted(true);
            markStepDone(1);
          }
        }
        isInitialLoadRef.current = false;
      }catch(e){ console.error('restore event failed', e);}  
    })();
  },[]);

  // Load selectedDesign from localStorage if not already set from database
  React.useEffect(()=>{
    if(typeof window==='undefined') return;
    if(selectedDesign) return; // Don't override if already set from database
    try{
      const saved = localStorage.getItem('selectedDesign');
      if(saved) setSelectedDesign(saved);
      // Mark initial load as complete after localStorage check
      isInitialLoadRef.current = false;
    }catch{}
  },[]);

  // Load guest summary stats - only if there's an active event
  React.useEffect(()=>{
    (async ()=>{
      try{
        const { data: {user} } = await supabase.auth.getUser();
        if(!user || !currentEventId) return;
        
        const { data: guests, error: guestsError } = await supabase
          .from('invited_guests')
          .select('status, adults, children, veg_adults, veg_children, vegan_adults, vegan_children, glatt_adults, glatt_children, allergy_adults, allergy_children')
          .eq('event_id', currentEventId);

        if(guestsError) console.error('StepButtons - guests fetch error:', guestsError);

        let summary = { approved: 0, adults: 0, children: 0 };
        let statusSummary = { approved: 0, rejected: 0, pending: 0 };
        let specialMeals = { 
          veg: { adults: 0, children: 0, total: 0 },
          vegan: { adults: 0, children: 0, total: 0 },
          glatt: { adults: 0, children: 0, total: 0 },
          allergy: { adults: 0, children: 0, total: 0 }
        };
        
        if(guests){
          guests.forEach(g => {
            
            // Count by status
            if(g.status === 'approved') {
              statusSummary.approved += 1;
              // Only count adults/children for approved guests
              summary.adults += g.adults || 0;
              summary.children += g.children || 0;
              
              // Count special meals for approved guests only
              specialMeals.veg.adults += g.veg_adults || 0;
              specialMeals.veg.children += g.veg_children || 0;
              specialMeals.vegan.adults += g.vegan_adults || 0;
              specialMeals.vegan.children += g.vegan_children || 0;
              specialMeals.glatt.adults += g.glatt_adults || 0;
              specialMeals.glatt.children += g.glatt_children || 0;
              specialMeals.allergy.adults += g.allergy_adults || 0;
              specialMeals.allergy.children += g.allergy_children || 0;
            } else if(g.status === 'rejected') {
              statusSummary.rejected += 1;
            } else {
              statusSummary.pending += 1;
            }
          });
          // Don't show "טרם הגיבו" when no invitations were effectively sent: if no one has responded yet (0 approved, 0 rejected), treat as "no RSVP data yet" and show 0 pending so we don't show misleading counts
          if (statusSummary.approved === 0 && statusSummary.rejected === 0) {
            statusSummary.pending = 0;
          }
          // "הודעות שנשלחו" comes from eventMessagesSentCount (DB), not from guest count
          // Calculate totals
          specialMeals.veg.total = specialMeals.veg.adults + specialMeals.veg.children;
          specialMeals.vegan.total = specialMeals.vegan.adults + specialMeals.vegan.children;
          specialMeals.glatt.total = specialMeals.glatt.adults + specialMeals.glatt.children;
          specialMeals.allergy.total = specialMeals.allergy.adults + specialMeals.allergy.children;
        }
        
        setGuestSummary(summary);
        setGuestStatusSummary(statusSummary);
        setSpecialMealsSummary(specialMeals);
      }catch(e){
        console.error('❌ Failed to load guest summary', e);
      }
    })();
  },[currentEventId, guestSummaryRefreshKey]);

  // Refresh guest summary when user opens reports or returns to tab (so RSVP updates appear without full page reload)
  const prevShowReportsRef = React.useRef(false);
  React.useEffect(() => {
    const didOpen = showReportsOptions && !prevShowReportsRef.current;
    prevShowReportsRef.current = !!showReportsOptions;
    if (didOpen) setGuestSummaryRefreshKey((k) => k + 1);
  }, [showReportsOptions]);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && currentEventId) setGuestSummaryRefreshKey((k) => k + 1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [currentEventId]);

  // persist selectedDesign changes
  React.useEffect(()=>{
    if(typeof window==='undefined') return;
    if(!selectedDesign) return;
    
    // Don't update database during initial load - only on user changes
    if(isInitialLoadRef.current) {
      // Still save to localStorage during initial load
      try{ localStorage.setItem('selectedDesign', selectedDesign);}catch{}
      return;
    }
    
    try{ localStorage.setItem('selectedDesign', selectedDesign);}catch{}
    
    // Also update event_details in database to persist the selection
    if(currentEventId) {
      (async () => {
        try {
          // Get current event_details
          const { data: eventData, error: fetchError } = await supabase
            .from('events')
            .select('event_details')
            .eq('id', currentEventId)
            .single();
          
          if (!fetchError && eventData && eventData.event_details) {
            // Parse event_details if it's a string
            let details = {};
            try {
              details = typeof eventData.event_details === 'string'
                ? JSON.parse(eventData.event_details)
                : (eventData.event_details || {});
            } catch (parseErr) {
              console.error('Error parsing event_details:', parseErr);
              details = {};
            }
            
            // Only update if template_src has actually changed
            if(details.template_src !== selectedDesign) {
              // Update template_src
              const updatedDetails = { ...details, template_src: selectedDesign };
              
              // Update event_details in database
              const { error: updateError } = await supabase
                .from('events')
                .update({ event_details: updatedDetails })
                .eq('id', currentEventId);
              
              if (updateError) {
                console.error('Error updating event_details with template_src:', updateError);
              }
            }
          }
        } catch (err) {
          console.error('Failed to update event_details with template_src:', err);
        }
      })();
    }
  },[selectedDesign, currentEventId]);

  // clear guests when switching to a new event
  React.useEffect(()=>{ setSentGuests([]); }, [currentEventId]);

  // Load table summary data from approved guests
  React.useEffect(()=>{
    if(!currentEventId) {
      setTableSummary([]);
      return;
    }
    
    (async ()=>{
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data, error } = await supabase
          .from('invited_guests')
          .select('*')
          .eq('event_id', currentEventId)
          .eq('status', 'approved');
        
        if (error) throw error;
        
        // Group guests by table_number
        const groupedByTable = {};
        (data || []).forEach(guest => {
          const table = guest.table_number || 'ללא שולחן';
          if (!groupedByTable[table]) {
            groupedByTable[table] = [];
          }
          groupedByTable[table].push(guest);
        });
        
        // Calculate summary for each table
        const summaries = Object.keys(groupedByTable)
          .sort((a, b) => {
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (!isNaN(numA)) return -1;
            if (!isNaN(numB)) return 1;
            if (a === 'ללא שולחן') return 1;
            if (b === 'ללא שולחן') return -1;
            return a.localeCompare(b, 'he');
          })
          .map(table => {
            const guests = groupedByTable[table];
            const adults = guests.reduce((sum, g) => sum + (g.adults || 0), 0);
            const children = guests.reduce((sum, g) => sum + (g.children || 0), 0);
            return {
              table_number: table,
              adults,
              children,
              total: adults + children
            };
          });
        
        setTableSummary(summaries);
      } catch (e) {
        console.error('Failed to load table summary', e);
        setTableSummary([]);
      }
    })();
  }, [currentEventId, guestStatusSummary.approved]);

  // Check for plan limit violation and show warning (only after DB data loaded)
  React.useEffect(() => {
    if (!eventDataLoaded) return;
    if (!selectedPlan || !currentEventId) {
      setShowPlanLimitWarning(false);
      setPlanAddOnMode(false);
      resetCapacityWarningGuests();
      return;
    }
    
    const baseLimit = getPlanBaseLimit(selectedPlan);
    const extraCapacity = additionalPackages.reduce((sum, planId) => sum + getPlanBaseLimit(planId), 0);
    if (!baseLimit && extraCapacity === 0) {
      setShowPlanLimitWarning(false);
      setPlanAddOnMode(false);
      resetCapacityWarningGuests();
      return;
    }
    const totalLimit = (baseLimit || 0) + extraCapacity;
    if (effectiveMessagesSentCount > totalLimit) {
      setPendingAddonCount(1);
      setShowPlanLimitWarning(true);
      setPlanAddOnMode(true);
    } else {
      setShowPlanLimitWarning(false);
      setPlanAddOnMode(false);
      resetCapacityWarningGuests();
    }
  }, [selectedPlan, eventMessagesSentCount, invitedCount, currentEventId, additionalPackages, getPlanBaseLimit, resetCapacityWarningGuests, eventDataLoaded]);

  // helper to open guest report with fresh data
  const openGuestReport = async () => {
    if(!currentEventId){ 
      // No active event - show empty report
      console.log('No active event - showing empty report');
      setSentGuests([]);
      setDbGuests([]);
      setReportGuests([]);
    setGuestSummary({ approved: 0, adults: 0, children: 0 });
    resetCapacityWarningGuests();
      setGuestStatusSummary({ approved: 0, rejected: 0, pending: 0 });
      setShowGuestListModal(true);
      return; 
    }
    
    const { data } = await supabase
      .from('invited_guests')
      .select('*')
      .eq('event_id', currentEventId)
      .order('created_at');
    setSentGuests(data || []);
    setShowGuestListModal(true);
  };

  // Robust date parsing for event date strings that may use DD-MM-YYYY, DD.MM.YYYY or DD/MM/YYYY formats.
  const parseEventDate = (str)=>{
    if(!str) return null;
    // If string contains time, take only the date portion
    const dateOnly = str.split(/[T ]/)[0];
    const native = new Date(dateOnly);
    if(!isNaN(native)) return native;
    const m = dateOnly.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if(m){
      const [, d,mn,y] = m;
      return new Date(Number(y), Number(mn)-1, Number(d));
    }
    return null;
  };

  // Reset form and steps when no active event exists AND no new event started
  React.useEffect(()=>{
    if(currentEventId || newEventStarted) return; // Don't reset if new event is in progress
    // No active event – reset wizard
    setFormData(initialFormState);
    setFinishedSteps([]);
    setSelectedEventType(null);
    setNewEventStarted(false);
    try{ localStorage.removeItem('draftEvent'); localStorage.removeItem('newEventStarted'); }catch{}
  },[currentEventId, newEventStarted]);

  if (!session) {
    return (
      <>
        {showFlowDiagram && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-2">
            <div className="relative bg-white rounded-lg p-4 w-full max-w-6xl h-[98vh] overflow-hidden flex flex-col">
              <button
                onClick={() => setShowFlowDiagram(false)}
                className="absolute top-4 left-4 text-3xl text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center font-bold transition-all z-10"
                aria-label="\u05E1\u05D2\u05D5\u05E8"
              >&times;</button>
              <h2 className="text-2xl md:text-3xl font-bold mb-3 text-center text-primary">{'\u05EA\u05D9\u05D0\u05D5\u05E8 \u05EA\u05D4\u05DC\u05D9\u05DA \u05D9\u05E6\u05D9\u05E8\u05EA \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D1-Meet-M'}</h2>
              <p className="text-center text-gray-600 text-base mb-3">{'\u05DB\u05DA \u05E0\u05E8\u05D0\u05D4 \u05D4\u05EA\u05D4\u05DC\u05D9\u05DA \u05DC\u05D9\u05E6\u05D9\u05E8\u05EA \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DA'}</p>
              <div className="border-b-2 border-primary mb-3"></div>
              <div className="w-full mx-auto flex-1 overflow-y-auto px-2">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">{'\u05D4\u05EA\u05D7\u05DC\u05D4:'}</h3>
                    <div className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\u2705'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E4\u05EA\u05D9\u05D7\u05EA \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D7\u05D3\u05E9'}</h3>
                        <p className="text-base text-gray-600">{'\u05D0\u05D9\u05E9\u05D5\u05E8 \u05D5\u05D0\u05D9\u05E4\u05D5\u05E1 \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 \u05D7\u05D3\u05E9'}</p>
                      </div>
                    </div>
                    <div className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83D\uDCB0'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05D1\u05D7\u05D9\u05E8\u05EA \u05DE\u05E1\u05DC\u05D5\u05DC'}</h3>
                        <p className="text-base text-gray-600">{'\u05D1\u05D7\u05E8 \u05D0\u05EA \u05D4\u05D7\u05D1\u05D9\u05DC\u05D4 \u05D4\u05DE\u05EA\u05D0\u05D9\u05DE\u05D4 \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DA'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">{'\u05D4\u05D2\u05D3\u05E8\u05EA \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2:'}</h3>
                    <div className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83C\uDF89'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E9\u05DC\u05D1 1: \u05E1\u05D5\u05D2 \u05D0\u05D9\u05E8\u05D5\u05E2'}</h3>
                        <p className="text-base text-gray-600">{'\u05D7\u05EA\u05D5\u05E0\u05D4, \u05D1\u05E8 \u05DE\u05E6\u05D5\u05D5\u05D4, \u05D9\u05D5\u05DD \u05D4\u05D5\u05DC\u05D3\u05EA \u05D5\u05E2\u05D5\u05D3'}</p>
                      </div>
                    </div>
                    <div className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83D\uDCDD'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E9\u05DC\u05D1 2: \u05E4\u05E8\u05D8\u05D9 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2'}</h3>
                        <p className="text-base text-gray-600">{'\u05EA\u05D0\u05E8\u05D9\u05DA, \u05E9\u05E2\u05D4, \u05DE\u05E7\u05D5\u05DD \u05D5\u05E4\u05E8\u05D8\u05D9\u05DD \u05E0\u05D5\u05E1\u05E4\u05D9\u05DD'}</p>
                      </div>
                    </div>
                    <div className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83C\uDFA8'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E9\u05DC\u05D1 3: \u05E2\u05D9\u05E6\u05D5\u05D1 \u05D4\u05D6\u05DE\u05E0\u05D4'}</h3>
                        <p className="text-base text-gray-600">{'\u05D1\u05D7\u05E8 \u05DE\u05EA\u05D5\u05DA 45 \u05EA\u05D1\u05E0\u05D9\u05D5\u05EA \u05DE\u05E2\u05D5\u05E6\u05D1\u05D5\u05EA'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">{'\u05E0\u05D9\u05D4\u05D5\u05DC \u05D5\u05DE\u05E2\u05E7\u05D1:'}</h3>
                    <div className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83D\uDCF1'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E9\u05DC\u05D1 4: \u05E9\u05DC\u05D9\u05D7\u05EA \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA'}</h3>
                        <p className="text-base text-gray-600">{'\u05E9\u05DC\u05D9\u05D7\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05DC SMS \u05D5-WhatsApp'}</p>
                      </div>
                    </div>
                    <div className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83D\uDCCA'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E9\u05DC\u05D1 5: \u05D3\u05D5\u05D7\u05D5\u05EA'}</h3>
                        <p className="text-base text-gray-600">{'\u05DE\u05E2\u05E7\u05D1 \u05D0\u05D9\u05E9\u05D5\u05E8\u05D9 \u05D4\u05D2\u05E2\u05D4 \u05D5\u05D9\u05D9\u05E6\u05D5\u05D0 \u05DC\u05D0\u05E7\u05E1\u05DC'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-4 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setShowFlowDiagram(false)}
                  className="bg-gray-200 text-gray-700 border border-gray-300 rounded-full px-8 py-3 font-medium hover:bg-gray-300 transition-all"
                >{'\u05E1\u05D2\u05D5\u05E8'}</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Capacity Limit Warning Modal */}
      {showPlanLimitWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-[100]">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg mx-3 text-center shadow-2xl">
            {(() => {
              const baseLimit = getPlanBaseLimit(selectedPlan) || 0;
              const extraCapacity = additionalPackages.reduce(
                (sum, planId) => sum + getPlanBaseLimit(planId),
                0
              );
              const totalLimit = baseLimit + extraCapacity;
              const messagesOverQuota = Math.max(0, effectiveMessagesSentCount - totalLimit);
              const addonUnit = getPlanBaseLimit('addon') || 100;
              const numPackages = Math.max(1, pendingAddonCount);
              const totalMessages = numPackages * addonUnit;
              const totalCost = numPackages * 100;

              return (
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">חרגת ממכסת ההודעות!</h2>
                  <p className="text-sm text-gray-700 mb-3">
                    נשלחו <strong className="text-primary">{effectiveMessagesSentCount}</strong> הודעות
                  </p>

                  <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-center gap-3 mb-1">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{totalLimit}</div>
                        <div className="text-xs text-gray-600">מכסת הודעות נוכחית</div>
                      </div>
                      <div className="text-xl text-gray-400">→</div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{effectiveMessagesSentCount}</div>
                        <div className="text-xs text-gray-600">הודעות שנשלחו</div>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">
                      נדרשים עוד <strong className="text-red-600">{messagesOverQuota}</strong> הודעות במכסה
                    </p>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg p-3 mb-3">
                    <h3 className="text-base font-bold text-green-800 mb-1">💰 חבילות הרחבה – 100 הודעות / ₪100</h3>
                    <p className="text-xs text-gray-700 font-semibold mb-2">בחר כמה חבילות לרכוש:</p>
                    <div className="flex flex-wrap justify-center gap-1.5 mb-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPendingAddonCount(n)}
                          className={`w-9 h-9 rounded-full font-bold border-2 text-sm transition-all ${
                            numPackages === n
                              ? 'bg-green-600 text-white border-green-700'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-gray-700">
                      <strong>{numPackages}</strong> {numPackages === 1 ? 'חבילה' : 'חבילות'} = <strong>{totalMessages}</strong> הודעות נוספות
                      {' · '}
                      <strong>סה"כ:</strong> <span className="text-lg font-bold text-green-600">₪{totalCost}</span>
                    </p>
                  </div>

                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handlePurchaseAddon}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 text-white border-2 border-green-700 rounded-full px-6 py-3 font-bold text-base hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
                    >
                      🛒 רכוש {numPackages} {numPackages === 1 ? 'חבילה' : 'חבילות'} (₪{totalCost})
                    </button>
                    <button
                      onClick={() => {
                        setShowPlanLimitWarning(false);
                        resetCapacityWarningGuests();
                      }}
                      className="bg-gray-200 text-gray-700 border border-gray-300 rounded-full px-5 py-3 font-medium text-sm hover:bg-gray-300 transition-all"
                    >
                      ביטול
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    * תשלום חד פעמי לאירוע • ללא מנויים
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* הודעה כשהאירוע הסתיים (עבר התאריך) – מאפשר למשתמש להבין שאפשר לפתוח אירוע חדש */}
      {showEventEndedNotice && (
        <div className="fixed left-4 right-4 bottom-32 z-40 max-w-2xl mx-auto bg-green-50 border-2 border-green-500 rounded-xl shadow-lg p-4 flex flex-col gap-3">
          <p className="text-green-900 font-semibold text-center text-lg">
            האירוע הסתיים. כעת ניתן לפתוח אירוע חדש באותו מסלול.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShowEventEndedNotice(false);
              }}
              className="bg-white border border-green-400 text-green-800 font-medium py-2 px-6 rounded-full hover:bg-green-50"
            >
              הבנתי
            </button>
          </div>
        </div>
      )}

      {/* הודעה כשהמשתמש לוחץ על שלב 1–4 בלי ליצור אירוע ולבחור מסלול */}
      {showStepError && (
        <div className="fixed left-4 right-4 bottom-24 z-30 max-w-2xl mx-auto bg-amber-50 border-2 border-amber-500 rounded-xl shadow-lg p-4 flex flex-col gap-3">
          <p className="text-amber-900 font-semibold text-center text-lg">{stepErrorMsg}</p>
          <button
            type="button"
            onClick={() => { setShowStepError(false); setStepErrorMsg(''); }}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-6 rounded-full mx-auto"
          >
            הבנתי
          </button>
        </div>
      )}

      <div className="fixed left-0 right-0 bottom-0 z-20 w-full bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] py-2 px-2 sm:pt-3 sm:px-2" style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom, 0.4rem))' }}>
        <div className="flex flex-col gap-1.5 sm:hidden px-1">
          <div className="grid grid-cols-3 gap-1.5">
            {steps.slice(1, 4).map((step, idx) => {
              const realIdx = idx + 1;
              const isFinished = finishedSteps.includes(realIdx) || (realIdx === 3 && finishedSteps.includes(2));
              const isDesign = realIdx === 3;
              return (
                <button
                  key={realIdx}
                  type="button"
                  style={{ cursor: 'pointer', position: 'relative', zIndex: 21, pointerEvents: 'auto' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const mustStartFirst = !hasActiveEvent() || !selectedPlan;
                    if (mustStartFirst) {
                      setStepErrorMsg('\u05D9\u05E9 \u05EA\u05D7\u05D9\u05DC\u05D4 \u05DC\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D5\u05DC\u05D1\u05D7\u05D5\u05E8 \u05DE\u05E1\u05DC\u05D5\u05DC \u05EA\u05E9\u05DC\u05D5\u05DD.');
                      setShowStepError(true);
                      return;
                    }
                    if (realIdx === 1) { setShowEventTypes(true); setStepErrorMsg(''); }
                    else if (realIdx === 2) { setShowEventDetails(true); setStepErrorMsg(''); }
                    else if (realIdx === 3) { setShowDesignChooser(true); setStepErrorMsg(''); }
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-center transition-all ${
                    isFinished
                      ? 'bg-primary text-white shadow-md'
                      : isDesign
                        ? 'bg-gradient-to-r from-pink-50 to-purple-50 text-purple-800 border border-purple-300 shadow'
                        : 'bg-[#FCE6AC] text-primary border border-primary/40'
                  }`}
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/80 text-xs font-bold text-primary shrink-0">{realIdx}</span>
                  <span className="text-sm font-bold leading-tight">{stepsMobile[realIdx]}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {steps.slice(4).map((step, idx) => {
              const realIdx = idx + 4;
              const isFinished = finishedSteps.includes(realIdx);
              return (
                <button
                  key={realIdx}
                  type="button"
                  style={{ cursor: 'pointer', position: 'relative', zIndex: 21, pointerEvents: 'auto' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (realIdx === 4) {
                      const mustStartFirst = !hasActiveEvent() || !selectedPlan;
                      if (mustStartFirst) {
                        setStepErrorMsg('\u05D9\u05E9 \u05EA\u05D7\u05D9\u05DC\u05D4 \u05DC\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D5\u05DC\u05D1\u05D7\u05D5\u05E8 \u05DE\u05E1\u05DC\u05D5\u05DC \u05EA\u05E9\u05DC\u05D5\u05DD.');
                        setShowStepError(true);
                        return;
                      }
                      setShowGuestForm(true); setStepErrorMsg('');
                    } else if (realIdx === 5) {
                      setShowReportsOptions(true); setShowGuestListModal(false); setStepErrorMsg('');
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-center transition-all ${
                    isFinished
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-[#FCE6AC] text-primary border border-primary/40'
                  }`}
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/80 text-xs font-bold text-primary shrink-0">{realIdx}</span>
                  <span className="text-sm font-bold leading-tight">{stepsMobile[realIdx]}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="hidden sm:flex flex-row justify-center gap-4 flex-wrap">
          {steps.slice(1).map((step, idx) => {
            const realIdx = idx + 1;
            return (
              <button
                key={realIdx}
                type="button"
                style={{ cursor: 'pointer', position: 'relative', zIndex: 21, pointerEvents: 'auto' }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const mustStartFirst = !hasActiveEvent() || !selectedPlan;
                  const stepRequiresFlow = realIdx >= 1 && realIdx <= 4;
                  if (stepRequiresFlow && mustStartFirst) {
                    setStepErrorMsg('\u05D9\u05E9 \u05EA\u05D7\u05D9\u05DC\u05D4 \u05DC\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D5\u05DC\u05D1\u05D7\u05D5\u05E8 \u05DE\u05E1\u05DC\u05D5\u05DC \u05EA\u05E9\u05DC\u05D5\u05DD.');
                    setShowStepError(true);
                    return;
                  }
                  if (realIdx === 1) { setShowEventTypes(true); setStepErrorMsg(''); }
                  else if (realIdx === 2) { setShowEventDetails(true); setStepErrorMsg(''); }
                  else if (realIdx === 3) { setShowDesignChooser(true); setStepErrorMsg(''); }
                  else if (realIdx === 4) { setShowGuestForm(true); setStepErrorMsg(''); }
                  else if (realIdx === 5) { setShowReportsOptions(true); setShowGuestListModal(false); setStepErrorMsg(''); }
                }}
                className={`${
                  finishedSteps.includes(realIdx) || (realIdx === 3 && finishedSteps.includes(2))
                    ? 'bg-primary text-white border border-primary rounded-full px-8 py-4 font-bold ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 transition-all text-lg shrink-0'
                    : realIdx === 3
                      ? 'bg-gradient-to-r from-pink-100 to-purple-100 text-purple-800 border-2 border-purple-400 ring-2 ring-purple-400 ring-offset-2 ring-offset-purple-100 shadow-lg rounded-full px-8 py-4 font-bold transition-all text-lg shrink-0'
                      : 'bg-[#FCE6AC] text-primary border border-primary rounded-full px-8 py-4 font-bold ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 transition-all text-lg shrink-0'
                }`}
              >
                {step}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error message is now displayed in HeroSection instead */}
      {/* Status and Summary Tables */}
      <div className="w-full px-4 mb-0 mt-4 pb-24" style={{ marginBottom: '200px' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          
          {/* First Column - Event Status */}
          <div className="w-full flex flex-col gap-6">
            {/* Tranzila terminal name - always visible */}
            {tranzilaTerminalInfo && (
              <div className="bg-slate-50 p-2 text-center shadow w-full text-sm" style={{
                border: '1px solid #94a3b8',
                borderRadius: '6px',
              }}>
                מסוף טרנזילה: <strong>{tranzilaTerminalInfo.terminal}</strong>
                {tranzilaTerminalInfo.isTestTerminal && (
                  <span className="text-orange-600 mr-1">(מסוף בדיקות)</span>
                )}
              </div>
            )}
            {currentEventId ? (
              <div className="bg-green-50 p-3 text-center shadow-lg w-full" style={{
                border: '3px solid #D4AF37',
                outline: '2px solid #B8860B',
                outlineOffset: '2px',
                borderRadius: '8px',
                minHeight: '280px'
              }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">✅</span>
                  <h3 className="text-lg font-bold text-green-800">יש אירוע פעיל במערכת</h3>
                </div>
                <p className="text-green-700">
                  <strong>סוג האירוע:</strong> {selectedEventType || 'לא מוגדר'}
                </p>
                {formData.date && (
                  <p className="text-green-700">
                    <strong>תאריך האירוע:</strong> {new Date(formData.date).toLocaleDateString('he-IL')}
                  </p>
                )}
                {formData.hallName && (
                  <p className="text-green-700">
                    <strong>אולם:</strong> {formData.hallName}
                  </p>
                )}
                {formData.date && (
                  <div className="bg-green-100 border-2 border-green-600 rounded-lg p-3 mt-3 mb-2">
                    <p className="text-green-800 font-bold text-2xl text-center">
                      {(() => {
                        const eventDate = new Date(formData.date);
                        const today = new Date();
                        const diffTime = eventDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays > 0) {
                          return `נותרו ${diffDays} ימים עד האירוע!`;
                        } else if (diffDays === 0) {
                          return "האירוע היום!";
                        } else {
                          return `האירוע היה לפני ${Math.abs(diffDays)} ימים`;
                        }
                      })()}
                    </p>
                  </div>
                )}
                <p className="text-green-600 text-base mt-2 font-bold">
                  האירוע מוכן לשליחת הזמנות ואישורי הגעה
                </p>
              </div>
            ) : newEventStarted ? (
              <div className="bg-blue-50 p-4 text-center shadow-lg flex-1" style={{
                border: '3px solid #3b82f6',
                outline: '2px solid #1d4ed8',
                outlineOffset: '2px',
                borderRadius: '8px',
              }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">🚀</span>
                  <h3 className="text-lg font-bold text-blue-800">תהליך יצירת אירוע חדש החל</h3>
                </div>
                <p className="text-blue-700">
                  אתה נמצא בתהליך יצירת אירוע חדש. המשך עם השלבים הבאים.
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 text-center shadow-lg flex-1" style={{
                border: '3px solid #6b7280',
                outline: '2px solid #374151',
                outlineOffset: '2px',
                borderRadius: '8px',
              }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">📅</span>
                  <h3 className="text-lg font-bold text-gray-800">אין אירוע פעיל</h3>
                </div>
                <p className="text-gray-700">
                  אין אירוע פעיל במערכת. לחץ על "צור אירוע חדש" כדי להתחיל.
                </p>
              </div>
            )}
            {session && selectedPlan && (
              <div className="bg-yellow-50 p-3 text-center shadow-lg w-full" style={{
                border: '3px solid #D4AF37',
                outline: '2px solid #B8860B',
                outlineOffset: '2px',
                borderRadius: '8px',
                minHeight: '280px'
              }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">💰</span>
                  <h3 className="text-lg font-bold text-yellow-800">מסלול פעיל</h3>
                </div>
                {/* Display Tranzila Terminal Info */}
                {tranzilaTerminalInfo && (
                  <div className="text-xs text-gray-600 mb-2 px-2">
                    מסוף טרנזילה: <strong>{tranzilaTerminalInfo.terminal}</strong>
                    {tranzilaTerminalInfo.isTestTerminal && (
                      <span className="text-orange-600 ml-1">(מסוף בדיקות)</span>
                    )}
                  </div>
                )}
                <div className="mt-3">
                  <div className="bg-white p-3 rounded-lg border border-yellow-200 mb-3 space-y-3">
                    <div>
                      <div className="text-lg font-bold text-yellow-700 mb-1">
                        {selectedPlan === 'basic' || selectedPlan === 'free' ? 'מסלול א' : 
                         selectedPlan === 'standard' ? 'מסלול ב' : 
                         selectedPlan === 'premium' ? 'מסלול ג' : 
                         selectedPlan === 'luxury' ? 'מסלול ד' : 
                         selectedPlan === 'elite' ? 'מסלול ה' : 
                         selectedPlan === 'supreme' ? 'מסלול ו' : 'לא נבחר מסלול'}
                      </div>
                      <div className="text-base text-gray-700 font-semibold">
                        {selectedPlan === 'basic' || selectedPlan === 'free' ? '5₪ - עד 5 הודעות' :
                         selectedPlan === 'standard' ? '149₪ - מ 51 עד 200 הודעות' :
                         selectedPlan === 'premium' ? '199₪ - מ 201 עד 350 הודעות' :
                         selectedPlan === 'luxury' ? '259₪ - מ 351 עד 500 הודעות' :
                         selectedPlan === 'elite' ? '349₪ - מ 501 עד 650 הודעות' :
                         selectedPlan === 'supreme' ? '499₪ - מ 651 עד 1000 הודעות' : ''}
                      </div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="text-sm font-semibold text-yellow-800 flex items-center justify-center gap-2 mb-2">
                        <span className="text-lg">📦</span>
                        <span>חבילות נוספות שנרכשו:</span>
                      </div>
                      {displayPackageEntries.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-2 mb-3">
                          {displayPackageEntries.map(({ id, label, count, extra }) => (
                            <div key={id} className="flex items-center gap-2 bg-white border border-yellow-300 rounded-full px-3 py-1 shadow-sm">
                              <span className="text-sm font-semibold text-yellow-700">
                                {label} × {count}
                              </span>
                              {extra > 0 && (
                                <span className="text-xs text-yellow-500">
                                  +{extra} הודעות נוספות
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : displayAdditionalCapacityValue > 0 ? (
                        <p className="text-sm text-yellow-700 text-center">
                          הקיבולת הוגדלה ב-{displayAdditionalCapacityValue} באמצעות חבילות הרחבה.
                        </p>
                      ) : (
                        <p className="text-sm text-yellow-700 text-center">לא נרכשו חבילות נוספות</p>
                      )}
                      <div className="text-base font-bold text-yellow-800">
                        סה״כ כיסוי: {totalPlanCapacity} הודעות
                        {additionalCapacity > 0 && (
                          <> (מתוכם {additionalCapacity} באמצעות חבילות הרחבה)</>
                        )}
                      </div>
                    </div>
                    {activePlanDescription && (
                      <div className="bg-white p-2 rounded-lg border border-yellow-200">
                        <div className="text-base text-gray-700 text-right leading-relaxed">
                          {activePlanDescription}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Second Column - Guest Summary + Table Report */}
          {currentEventId && (
            <div className="w-full flex flex-col gap-6">
              <div className="bg-blue-50 p-3 text-center shadow-lg w-full" style={{
                border: '3px solid #D4AF37',
                outline: '2px solid #B8860B',
                outlineOffset: '2px',
                borderRadius: '8px',
                minHeight: '280px'
              }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xl">👥</span>
                  <h3 className="text-base font-bold text-blue-800">סיכום כל האורחים המוזמנים</h3>
                </div>
                <div className="mt-1">
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    {hasGuestSummaryData ? (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={guestSummaryChartData}
                            margin={{ top: 16, right: 20, left: -10, bottom: 8 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                              dataKey="name"
                              stroke="#1f2937"
                              tick={{ fontSize: 16, fontWeight: 600 }}
                              interval={0}
                            />
                            <YAxis hide />
                            <Tooltip
                              formatter={(value, name) => [`${value}`, name]}
                              wrapperStyle={{ direction: 'rtl', textAlign: 'right' }}
                            />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={60}>
                              {guestSummaryChartData.map((item) => (
                                <Cell key={item.key} fill={item.color} />
                              ))}
                              <LabelList dataKey="value" content={renderGuestSummaryLabel} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="py-10 text-sm text-gray-500 text-center">אין נתונים להצגה עדיין</div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-base">
                    <div className="bg-white p-2 rounded-lg border border-green-100 text-right">
                      <div className="text-sm font-semibold text-green-600">מבוגרים</div>
                      <div className="text-2xl font-bold text-green-700">{guestSummary.adults}</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-orange-100 text-right">
                      <div className="text-sm font-semibold text-orange-600">ילדים</div>
                      <div className="text-2ל font-bold text-orange-700">{guestSummary.children}</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-purple-100 text-right">
                      <div className="text-sm font-semibold text-purple-600">סה"כ</div>
                      <div className="text-2ל font-bold text-purple-700">{guestSummary.adults + guestSummary.children}</div>
                    </div>
                  </div>
                </div>
              </div>

              {tableSummary.length > 0 && (
                <div className="bg-orange-50 p-3 text-center shadow-lg w-full" style={{
                  border: '3px solid #D4AF37',
                  outline: '2px solid #B8860B',
                  outlineOffset: '2px',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div className="flex items-center justify-center gap-3 mb-3 flex-shrink-0">
                    <span className="text-2xl">📊</span>
                    <h3 className="text-lg font-extrabold text-orange-900 tracking-wide">דוח סיכום שולחנות</h3>
                  </div>
                  <div className="mt-3 overflow-x-auto flex-grow">
                    <table className="w-full text-right border text-sm min-w-full">
                      <thead>
                        <tr className="bg-white">
                          <th className="p-2 border font-bold text-center text-orange-800">מס. שולחן</th>
                          <th className="p-2 border font-bold text-center text-green-700">בוגרים</th>
                          <th className="p-2 border font-bold text-center text-purple-700">ילדים</th>
                          <th className="p-2 border font-bold text-center text-blue-700">סה"כ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableSummary.map((row, idx) => (
                          <tr key={`table-${row.table_number}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-orange-100'}>
                            <td className="p-2 border text-center font-semibold text-orange-800 text-xl">{row.table_number}</td>
                            <td className="p-2 border text-center font-semibold text-green-700 text-xl">{row.adults}</td>
                            <td className="p-2 border text-center font-semibold text-purple-700 text-xl">{row.children}</td>
                            <td className="p-2 border text-center font-bold text-blue-700 text-2xl">{row.total}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-orange-200 font-bold">
                          <td className="p-2 border text-center text-orange-900 text-xl">סה"כ</td>
                          <td className="p-2 border text-center text-green-800 text-xl">{tableSummary.reduce((sum, r) => sum + r.adults, 0)}</td>
                          <td className="p-2 border text-center text-purple-800 text-xl">{tableSummary.reduce((sum, r) => sum + r.children, 0)}</td>
                          <td className="p-2 border text-center text-blue-800 text-2xl">{tableSummary.reduce((sum, r) => sum + r.total, 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Third Column - Guest Status Summary */}
          {currentEventId && (
            <div className="w-full flex flex-col gap-6">
              <div className="bg-purple-50 p-3 text-center shadow-lg w-full" style={{
                border: '3px solid #D4AF37',
                outline: '2px solid #B8860B',
                outlineOffset: '2px',
                borderRadius: '8px',
                minHeight: '280px'
              }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xl">📊</span>
                  <h3 className="text-base font-bold text-purple-800">סטטוס אישורי הגעה</h3>
                </div>
                <div className="bg-white rounded-lg text-right p-2 mt-3">
                  {hasStatusData ? (
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusChartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={95}
                            paddingAngle={3}
                            labelLine={false}
                            label={renderStatusLabel}
                          >
                            {statusChartData.map((item) => (
                              <Cell key={item.key} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => [`${value}`, name]}
                            wrapperStyle={{ direction: 'rtl', textAlign: 'right' }}
                          />
                          <Legend
                            iconType="circle"
                            wrapperStyle={{ direction: 'rtl', textAlign: 'right', color: '#111827' }}
                            formatter={(value) => (
                              <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-10 text-sm text-gray-500">אין נתונים להצגה עדיין</div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-base">
                  <div className="bg-white p-2 rounded-lg border border-green-100 text-right">
                    <div className="text-sm font-semibold text-green-600">אישרו הגעה</div>
                    <div className="text-2xl font-bold text-green-700">{guestStatusSummary.approved}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-yellow-200 text-right">
                    <div className="text-sm font-semibold text-black">טרם הגיבו</div>
                    <div className="text-2xl font-bold text-black">{guestStatusSummary.pending}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-red-100 text-right">
                    <div className="text-sm font-semibold text-red-600">לא אישרו</div>
                    <div className="text-2xl font-bold text-red-700">{guestStatusSummary.rejected}</div>
                  </div>
                </div>
                {!hasStatusData && (
                  <p className="text-xs text-gray-500 mt-2 text-center">נתוני אישור הגעה יופיעו לאחר שליחת הזמנות ותגובות אורחים</p>
                )}
              </div>
              {session && selectedPlan && (() => {
                // התאמה לסטטוס אישורי הגעה: אותו מספר הודעות שנשלחו בכל הדוחות
                const messagesSent = effectiveMessagesSentCount;
                const messageLimit = totalPlanCapacity;
                const remainingMessagesRaw = messageLimit - messagesSent;
                const remainingMessages = Math.max(0, remainingMessagesRaw);
                const overMessages = remainingMessagesRaw < 0 ? Math.abs(remainingMessagesRaw) : 0;
                const capacityChartData = [
                  { key: 'limit', name: 'מגבלת הודעות', value: messageLimit, color: '#facc15' },
                  { key: 'sent', name: 'הודעות שנשלחו', value: messagesSent, color: '#7c3aed' },
                  {
                    key: overMessages > 0 ? 'over' : 'remaining',
                    name: overMessages > 0 ? 'חריגה' : 'יתרה',
                    value: overMessages > 0 ? overMessages : remainingMessages,
                    color: overMessages > 0 ? '#dc2626' : '#22c55e'
                  }
                ];
                const hasCapacityChartData = capacityChartData.some(item => Number.isFinite(item.value) && item.value > 0);
                const renderCapacityLabel = ({ x, y, width, height, value, index }) => {
                  if (!value) return null;
                  const dataItem = capacityChartData[index];
                  const isDarkBar = ['sent', 'over', 'remaining'].includes(dataItem?.key);
                  const insideBar = (height ?? 0) >= 24;
                  const labelX = x + (width ?? 0) / 2;
                  const labelY = insideBar ? y + (height ?? 0) / 2 : (y ?? 0) - 6;
                  const color = insideBar ? (isDarkBar ? '#FFFFFF' : '#111827') : '#111827';
                  return (
                    <text
                      x={labelX}
                      y={labelY}
                      fill={color}
                      textAnchor="middle"
                      dominantBaseline={insideBar ? 'middle' : 'baseline'}
                      fontWeight="700"
                      fontSize="14"
                    >
                      {value}
                    </text>
                  );
                };
                
                return (
                  <div className="bg-yellow-50 p-3 text-center shadow-lg w-full" style={{
                    border: '3px solid #D4AF37',
                    outline: '2px solid #B8860B',
                    outlineOffset: '2px',
                    borderRadius: '8px',
                    minHeight: '280px'
                  }}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-xl">📈</span>
                      <h3 className="text-base font-bold text-yellow-800">יתרת הודעות</h3>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-yellow-200">
                      {hasCapacityChartData ? (
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={capacityChartData}
                              margin={{ top: 16, right: 20, left: -10, bottom: 8 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis
                                dataKey="name"
                                stroke="#1f2937"
                                tick={{ fontSize: 16, fontWeight: 600 }}
                                interval={0}
                              />
                              <YAxis hide />
                              <Tooltip
                                formatter={(value, name) => [`${value}`, name]}
                                wrapperStyle={{ direction: 'rtl', textAlign: 'right' }}
                              />
                              <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={60}>
                                {capacityChartData.map((item) => (
                                  <Cell key={item.key} fill={item.color} />
                                ))}
                                <LabelList dataKey="value" content={renderCapacityLabel} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="py-10 text-sm text-gray-500 text-center">אין נתונים להצגה עדיין</div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-base">
                      <div className="bg-white p-2 rounded-lg border border-yellow-100 text-right">
                        <div className="text-sm font-semibold text-yellow-600">מגבלת הודעות</div>
                        <div className="text-2xl font-bold text-yellow-800">{messageLimit}</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-purple-100 text-right">
                            <div className="text-sm font-semibold text-purple-600">הודעות שנשלחו</div>
                        <div className="text-2xl font-bold text-purple-700">{messagesSent}</div>
                      </div>
                      <div className={`bg-white p-2 rounded-lg border ${overMessages > 0 ? 'border-red-200' : 'border-green-200'} text-right`}>
                        <div className={`text-sm font-semibold ${overMessages > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {overMessages > 0 ? 'חריגה' : 'יתרה'}
                        </div>
                        <div className={`text-2xl font-bold ${overMessages > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {overMessages > 0 ? `-${overMessages}` : remainingMessages}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}


        </div>
      </div>

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
                     className={`w-full ${selectedEventType === type ? 'bg-primary text-white' : 'bg-[#FCE6AC] text-primary'} border border-primary rounded-full px-4 py-2 text-lg font-medium hover:bg-[#FCE6AC]/90 transition-all`}
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
              onClick={() => { 
                console.log('Save and close button clicked');
                setShowEventTypes(false); 
                setShowEventDetails(true);
                markStepDone(0); // Mark step 1 as completed when saving
                console.log('markStepDone(0) called');
              }}
              className="mt-6 w-full bg-primary text-white border border-primary rounded-full px-4 py-2 font-medium hover:bg-primary/90 transition-all"
            >
              שמור וסגור
            </button>
          </div>
        </div>
      )}

      {showEventDetails && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-4xl h-[95vh] overflow-y-auto event-form">
            <button onClick={() => setShowEventDetails(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-3xl font-bold mb-6 text-center">{`פרטי האירוע - ${selectedEventType}`}</h2>
            {errorMsg && <p className="text-red-600 text-xl text-center mb-3">{errorMsg}</p>}
            <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Existing event details form (unchanged) */}
              {['חתונה', 'חינה', 'מסיבת אירוסין'].includes(selectedEventType) && (
                <div>
                  <label className="block mb-2 font-bold text-lg">שם הכלה</label>
                  <input type="text" placeholder="שם הכלה" value={formData.brideName} onChange={(e) => setFormData({ ...formData, brideName: e.target.value })} className={`w-full border-2 border-gray-300 rounded-lg p-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all ${formErrors.brideName ? 'border-red-500 ring-2 ring-red-200' : ''}`} />
                </div>
              )}
              {['חתונה', 'חינה', 'מסיבת אירוסין'].includes(selectedEventType) && (
                <div>
                  <label className="block mb-2 font-bold text-lg">שם החתן</label>
                  <input type="text" placeholder="שם החתן" value={formData.groomName} onChange={(e) => setFormData({ ...formData, groomName: e.target.value })} className={`w-full border-2 border-gray-300 rounded-lg p-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all ${formErrors.groomName ? 'border-red-500 ring-2 ring-red-200' : ''}`} />
                </div>
              )}
              {selectedEventType === 'הפרשת חלה' && (
                <div>
                  <label className="block mb-2 font-bold text-lg">שם המארחת</label>
                  <input
                    type="text"
                    placeholder="שם המארחת"
                    value={formData.hostName}
                    onChange={(e) => setFormData({ ...formData, hostName: e.target.value })}
                    className={`w-full border-2 border-gray-300 rounded-lg p-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all ${formErrors.hostName ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                  />
                </div>
              )}
              {['חתונה', 'חינה'].includes(selectedEventType) && (
                <div>
                  <label className="block mb-2 font-bold text-lg">שם הורי הכלה</label>
                  <input type="text" placeholder="שם הורי הכלה" value={formData.brideParents} onChange={(e) => setFormData({ ...formData, brideParents: e.target.value })} className={`w-full border-2 border-gray-300 rounded-lg p-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all ${formErrors.brideParents ? 'border-red-500 ring-2 ring-red-200' : ''}`} />
                </div>
              )}
              {['חתונה', 'חינה'].includes(selectedEventType) && (
                <div>
                  <label className="block mb-2 font-bold text-lg">שם הורי החתן</label>
                  <input type="text" placeholder="שם הורי החתן" value={formData.groomParents} onChange={(e) => setFormData({ ...formData, groomParents: e.target.value })} className={`w-full border-2 border-gray-300 rounded-lg p-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all ${formErrors.groomParents ? 'border-red-500 ring-2 ring-red-200' : ''}`} />
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
              <div className="md:col-span-2">
                <label className="block mb-2 font-bold text-lg">תאריך האירוע</label>
                <DatePicker
                  selected={formData.date ? new Date(formData.date) : null}
                  onChange={(date)=> setFormData({ ...formData, date: date ? formatISODateLocal(date) : '' })}
                  dateFormat="dd/MM/yyyy"
                  locale="he"
                  placeholderText="בחר תאריך"
                  className={`w-full border-2 border-gray-300 rounded-lg p-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all ${formErrors.date ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                  calendarStartDay={0}
                />
              </div>
              <div>
                <label className="block mb-2 font-bold text-lg">שעת האירוע</label>
                <select value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className={`w-full border-2 border-gray-300 rounded-lg p-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all ${formErrors.time ? 'border-red-500 ring-2 ring-red-200' : ''}`}>
                  <option value="">בחר שעה</option>
                  {times.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {selectedEventType === 'חתונה' && (
                <div>
                  <label className="block mb-2 font-bold text-lg">שעת החופה</label>
                  <select value={formData.chuppahTime} onChange={(e) => setFormData({ ...formData, chuppahTime: e.target.value })} className={`w-full border-2 border-gray-300 rounded-lg p-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all ${formErrors.chuppahTime ? 'border-red-500 ring-2 ring-red-200' : ''}`}>
                    <option value="">בחר שעה</option>
                    {times.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block mb-2 font-bold text-lg">שם האולם</label>
                <input type="text" placeholder="שם האולם" value={formData.hallName} onChange={(e) => setFormData({ ...formData, hallName: e.target.value })} className={`w-full border-2 border-gray-300 rounded-lg p-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all ${formErrors.hallName ? 'border-red-500 ring-2 ring-red-200' : ''}`} />
              </div>
              <div>
                <label className="block mb-2 font-bold text-lg">כתובת האולם</label>
                <input type="text" placeholder="כתובת האולם" value={formData.hallAddress} onChange={(e) => setFormData({ ...formData, hallAddress: e.target.value })} className={`w-full border-2 border-gray-300 rounded-lg p-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all ${formErrors.hallAddress ? 'border-red-500 ring-2 ring-red-200' : ''}`} />
              </div>
              <div className="md:col-span-2 flex justify-center pt-4">
                <button type="button" onClick={handleSaveDetails} className="bg-[#FCE6AC] text-primary border border-primary rounded-full px-10 py-4 font-bold text-xl ring-2 ring-primary ring-offset-2 ring-offset-[#FCE6AC] hover:bg-[#FCE6AC]/90 transition-all">
                  שמור וסגור
                </button>
              </div>
              {errorMsg && <p className="text-red-600 text-lg text-center mt-2">{errorMsg}</p>}
            </form>
          </div>
        </div>
      )}

      {/* Hidden file input for Excel upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleExcelImport}
        style={{ display: 'none' }}
      />

      {showGuestForm && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-t-2xl sm:rounded-lg p-6 w-full max-w-md min-h-[85vh] sm:min-h-0 sm:max-h-[90vh] overflow-y-auto event-form">
            <button onClick={() => setShowGuestForm(false)} className="absolute top-2 left-2 text-4xl leading-none w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-bold text-primary text-center mb-5">שליחת הזמנות</h2>

            <div className="flex flex-col gap-3 mb-6">
              <button
                type="button"
                onClick={() => setShowExcelInstructions(true)}
                className="w-full text-primary font-medium border-2 border-primary rounded-lg px-4 py-3 hover:bg-primary hover:text-white transition-colors"
              >
                ייבוא קובץ אורחים - אקסל
              </button>
              <button
                type="button"
                onClick={() => { addToast?.('שליחה לקבוצת וואטסאפ – בתהליך פיתוח'); }}
                className="w-full text-primary font-medium border-2 border-primary rounded-lg px-4 py-3 hover:bg-primary hover:text-white transition-colors"
              >
                שלח לקבוצת וואטסאפ
              </button>
            </div>

            <h3 className="text-lg font-semibold text-gray-800 mb-3">שלח הזמנה לאורח בודד - פרטי אורח:</h3>
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
                <label className="block mb-1 font-medium">מספר שולחן</label>
                <input type="text" placeholder="מספר שולחן" value={guestData.guestTable} onChange={(e) => setGuestData({ ...guestData, guestTable: e.target.value })} required className={`w-full border rounded-md p-2 ${guestErrors.guestTable ? 'border-red-500' : ''}`} />
              </div>
              <div>
                <label className="block mb-1 font-medium">טלפון</label>
                <input type="tel" placeholder="טלפון" value={guestData.guestPhone} onChange={(e) => setGuestData({ ...guestData, guestPhone: e.target.value })} className={`w-full border rounded-md p-2 ${guestErrors.guestPhone ? 'border-red-500' : ''}`} />
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
                <button type="button" onClick={handleSendInvitationSms} className="bg-green-600 text-white border border-green-700 rounded-full px-8 py-3 font-medium hover:bg-green-700 transition-all">
                  שלח הזמנה ב-SMS
                </button>
                <button type="button" onClick={handleSendInvitation} className="bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all">
                  שלח הזמנה בוואטסאפ
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

      {/* Excel Instructions Modal */}
      {showExcelInstructions && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-lg">
            <button
              onClick={() => setShowExcelInstructions(false)}
              className="absolute top-2 left-2 text-3xl text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold text-primary text-center mb-4">הנחיות לייבוא קובץ אקסל</h2>

            <div className="space-y-4 text-right">
              <p className="text-gray-700">
                הקובץ צריך להכיל <strong>4 עמודות</strong> בסדר הבא:
              </p>

              <div className="bg-gray-50 rounded-lg p-3 border overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-green-100">
                      <th className="border border-gray-300 px-3 py-2 text-center font-bold text-primary">A</th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-bold text-primary">B</th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-bold text-primary">C</th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-bold text-primary">D</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-gray-100">
                      <td className="border border-gray-300 px-3 py-2 text-center font-medium">שם פרטי</td>
                      <td className="border border-gray-300 px-3 py-2 text-center font-medium">שם משפחה</td>
                      <td className="border border-gray-300 px-3 py-2 text-center font-medium">מס׳ שולחן</td>
                      <td className="border border-gray-300 px-3 py-2 text-center font-medium">טלפון</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-3 py-2 text-center text-gray-600">ישראל</td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-gray-600">ישראלי</td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-gray-600">1</td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-gray-600">0501234567</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-3 py-2 text-center text-gray-600">שרה</td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-gray-600">כהן</td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-gray-600">2</td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-gray-600">0529876543</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="text-blue-800">
                  <strong>שם העמודות לא משנה</strong> - רק הסדר חשוב. השורה הראשונה היא שורת כותרות.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                <p className="text-yellow-800">
                  <strong>שימו לב:</strong> מספר הטלפון צריך להכיל 10 ספרות (לדוגמה: 0501234567)
                </p>
              </div>

              <div className="flex justify-center gap-4 pt-4">
                <button
                  onClick={() => {
                    setShowExcelInstructions(false);
                    fileInputRef.current.click();
                  }}
                  className="bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-primary/90 transition-all"
                >
                  בחר קובץ אקסל
                </button>
                <button
                  onClick={() => setShowExcelInstructions(false)}
                  className="border border-gray-400 px-6 py-3 rounded-full font-medium hover:bg-gray-100 transition-all"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Excel Preview Modal */}
      {showExcelPreview && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <button
              onClick={() => {
                setShowExcelPreview(false);
                setExcelPreviewData([]);
                setExcelErrors([]);
              }}
              className="absolute top-2 left-2 text-3xl text-gray-500 hover:text-gray-700 z-10"
            >
              &times;
            </button>

            <h2 className="text-2xl font-bold text-center mb-4 text-primary">תצוגה מקדימה - ייבוא אורחים מאקסל</h2>

            {/* Error Summary */}
            {excelErrors.length > 0 && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-red-700 mb-2">נמצאו {excelErrors.length} שורות עם שגיאות:</h3>
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {excelErrors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>שורה {err.row}: {err.errors.join(', ')}</li>
                  ))}
                  {excelErrors.length > 5 && <li>...ועוד {excelErrors.length - 5} שגיאות</li>}
                </ul>
                <p className="text-sm text-red-600 mt-2">רק שורות תקינות יישמרו למסד הנתונים.</p>
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-4 mb-4 justify-center">
              <div className="bg-blue-50 border border-blue-300 rounded-lg px-4 py-2">
                <span className="font-bold text-blue-700">סה"כ שורות:</span> {excelPreviewData.length}
              </div>
              <div className="bg-green-50 border border-green-300 rounded-lg px-4 py-2">
                <span className="font-bold text-green-700">תקינות:</span> {excelPreviewData.filter(g => !g.errors || g.errors.length === 0).length}
              </div>
              {excelErrors.length > 0 && (
                <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-2">
                  <span className="font-bold text-red-700">שגיאות:</span> {excelErrors.length}
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1 border border-gray-300 rounded-lg">
              <table className="w-full text-right" dir="rtl">
                <thead className="bg-primary text-white sticky top-0">
                  <tr>
                    <th className="p-2 border-b border-gray-300">#</th>
                    <th className="p-2 border-b border-gray-300">שם פרטי</th>
                    <th className="p-2 border-b border-gray-300">שם משפחה</th>
                    <th className="p-2 border-b border-gray-300">מספר שולחן</th>
                    <th className="p-2 border-b border-gray-300">טלפון</th>
                    <th className="p-2 border-b border-gray-300">סטטוס</th>
                    <th className="p-2 border-b border-gray-300">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {excelPreviewData.map((guest, idx) => (
                    <tr
                      key={idx}
                      className={`${guest.errors && guest.errors.length > 0 ? 'bg-red-50' : 'bg-white'} hover:bg-gray-50 border-b`}
                    >
                      <td className="p-2 text-center">{idx + 1}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={guest.guestFirstName}
                          onChange={(e) => handleEditExcelRow(idx, 'guestFirstName', e.target.value)}
                          className="w-full border rounded px-2 py-1"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={guest.guestLastName}
                          onChange={(e) => handleEditExcelRow(idx, 'guestLastName', e.target.value)}
                          className="w-full border rounded px-2 py-1"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={guest.guestTable}
                          onChange={(e) => handleEditExcelRow(idx, 'guestTable', e.target.value)}
                          className="w-full border rounded px-2 py-1"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={guest.guestPhone}
                          onChange={(e) => handleEditExcelRow(idx, 'guestPhone', e.target.value)}
                          className="w-full border rounded px-2 py-1"
                        />
                      </td>
                      <td className="p-2 text-center">
                        {guest.errors && guest.errors.length > 0 ? (
                          <span className="text-red-600 text-xs">{guest.errors.join(', ')}</span>
                        ) : (
                          <span className="text-green-600 font-bold">✓</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleRemoveExcelRow(idx)}
                          className="text-red-600 hover:text-red-800 font-bold"
                          title="מחק שורה"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4 mt-6 flex-wrap">
              <button
                onClick={() => handleSaveExcelGuests(true)}
                disabled={isSavingExcelGuests || excelPreviewData.filter(g => !g.errors || g.errors.length === 0).length === 0}
                className="bg-green-600 text-white px-8 py-3 rounded-full font-medium hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingExcelGuests ? 'שומר ושולח...' : `שמור ושלח SMS ל-${excelPreviewData.filter(g => !g.errors || g.errors.length === 0).length} אורחים`}
              </button>
              <button
                onClick={() => handleSaveExcelGuests(false, true)}
                disabled={isSavingExcelGuests || excelPreviewData.filter(g => !g.errors || g.errors.length === 0).length === 0}
                className="bg-primary text-white px-8 py-3 rounded-full font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingExcelGuests ? 'שומר...' : `שמור ושלח בוואטסאפ ל-${excelPreviewData.filter(g => !g.errors || g.errors.length === 0).length} אורחים`}
              </button>
              <button
                onClick={() => {
                  setShowExcelPreview(false);
                  setExcelPreviewData([]);
                  setExcelErrors([]);
                }}
                className="border border-gray-400 px-8 py-3 rounded-full font-medium hover:bg-gray-100 transition-all"
              >
                ביטול
              </button>
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
          <div className="bg-white rounded-lg p-6 w-full max-w-[95vw] mx-4 my-8 text-center space-y-6 relative event-form">
            <button onClick={() => setShowCountModal(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium">כמה אורחים מגיעים?</h2>
            {countError && (
              <div className="bg-red-100 border-2 border-red-500 rounded-lg p-4 text-right">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-red-600 text-2xl mr-2">✗</span>
                  <p className="text-red-600 text-lg font-medium">{countError}</p>
                </div>
              </div>
            )}
            <div className="space-y-4 text-right">
              <div>
                <label className="block mb-1 font-medium">סה"כ בוגרים</label>
                <input type="number" min="0" value={adultsCount} onChange={(e)=>{
                  setAdultsCount(parseInt(e.target.value)||0);
                  if (countError) setCountError('');
                }} className="w-full border rounded-md p-2" />
              </div>
              <div>
                <label className="block mb-1 font-medium">סה"כ ילדים</label>
                <input type="number" min="0" value={childrenCount} onChange={(e)=>{
                  setChildrenCount(parseInt(e.target.value)||0);
                  if (countError) setCountError('');
                }} className="w-full border rounded-md p-2" />
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
                if (totalSpecialAdults > adultsCount) {
                  setCountError(`מספר המנות המיוחדות למבוגרים (${totalSpecialAdults}) גדול ממספר המבוגרים (${adultsCount}).`);
                  return;
                }
                if (totalSpecialChildren > childrenCount) {
                  setCountError(`מספר המנות המיוחדות לילדים (${totalSpecialChildren}) גדול ממספר הילדים (${childrenCount}).`);
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
                openGuestReport();
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

                  const eventIdToUse = selectedEventForReport?.id || currentEventId;
                  if (!eventIdToUse) {
                    setReportGuests([]);
                    setReportTitle('אורחים מגיעים (אין אירוע נבחר)');
                    setShowReportModal(true);
                    return;
                  }

                  const { data, error } = await supabase
                    .from('invited_guests')
                    .select('*')
                    .eq('event_id', eventIdToUse)
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

                  const eventIdToUse = selectedEventForReport?.id || currentEventId;
                  if (!eventIdToUse) {
                    setReportGuests([]);
                    setReportTitle('אורחים לא מגיעים (אין אירוע נבחר)');
                    setShowReportModal(true);
                    return;
                  }

                  const { data, error } = await supabase
                    .from('invited_guests')
                    .select('*')
                    .eq('event_id', eventIdToUse)
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

                  const eventIdToUse = selectedEventForReport?.id || currentEventId;
                  if (!eventIdToUse) {
                    setReportGuests([]);
                    setReportTitle('אורחים שטרם הגיבו (אין אירוע נבחר)');
                    setShowReportModal(true);
                    return;
                  }

                  const { data, error } = await supabase
                    .from('invited_guests')
                    .select('*')
                    .eq('event_id', eventIdToUse)
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
        <div className="fixed inset-0 bg-black/50 z-50">
          <div className="w-full h-full bg-white flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-start gap-2">
                <h2 className="flex-1 text-2xl font-bold text-center border-b-2 border-primary pb-1 mb-4">
                  עיצוב הזמנה.
                </h2>
                <button onClick={() => setShowDesignChooser(false)} className="text-3xl text-gray-500 hover:text-gray-700">&times;</button>
              </div>
            </div>
            
            {/* Main content area - split into two columns */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left side - Text editing section */}
              <div className="w-1/2 border-r overflow-y-auto p-6">
                <h3 className="text-xl font-semibold text-primary mb-4 text-center">א. עצב טקסט הזמנה.</h3>
                {/* Styled Container */}
                <div className="bg-[#FFF9E8] border-2 border-primary rounded-lg p-4 shadow-sm space-y-4">
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

              {/* Invitation text editor with advanced formatting */}
              <div>
                <label className="block mb-1 font-bold text-right">אפשרות לשינוי נוסח ועיצוב ההזמנה</label>
                <div className="border border-primary rounded-md p-3 bg-white">
                  <div className="flex justify-center items-center mb-3">
                    <button
                      onClick={addNewLineAtTop}
                      className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 font-medium"
                    >
                      + הוסף שורה למעלה
                    </button>
                    <span className="text-sm text-gray-600 mr-4">
                      {customInvitationText.split('\n').length} שורות
                    </span>
                  </div>
                  
                  {customInvitationText.split('\n').map((line, index) => (
                    <div key={index} className="mb-1 p-1 border border-gray-200 rounded bg-gray-50">
                      <div className="flex items-center gap-2">
                        {/* Text area */}
                        <div className="flex-1">
                          <textarea
                            value={line}
                            onChange={(e) => updateLineText(index, e.target.value)}
                            className="w-full border border-gray-300 rounded p-1 text-right"
                            style={{
                              fontSize: `${lineStyles[index]?.fontSize || 16}px`,
                              color: lineStyles[index]?.color || 'black',
                              fontWeight: lineStyles[index]?.fontWeight || 'normal'
                            }}
                            rows={1}
                          />
                        </div>

                        {/* Right side - Icon controls in horizontal row */}
                        <div className="flex flex-col items-center gap-1">
                          {index === 0 && (
                            <div className="flex gap-2 text-sm font-bold text-gray-700">
                              <span className="w-24 text-center">עיצוב מתקדם</span>
                              <span className="w-8 text-center">מחק</span>
                            </div>
                          )}
                          <div className="flex gap-2">
                            {/* Advanced Edit Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAdvancedEdit(index);
                              }}
                              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition-colors font-medium text-sm"
                              title="עיצוב מתקדם"
                            >
                              ✨ עיצוב מתקדם
                            </button>
                            {/* Delete Icon */}
                            <button
                              onClick={() => deleteLine(index)}
                              className="p-2 bg-red-400 hover:bg-red-500 rounded-lg transition-colors"
                              title="מחק שורה"
                            >
                              <span className="text-lg">🗑️</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add Row Button at Bottom */}
                  <div className="flex justify-center mt-3">
                    <button
                      onClick={addNewLine}
                      className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 font-medium"
                    >
                      + הוסף שורה למטה
                    </button>
                  </div>
                </div>
                <div className="text-right mt-2 flex gap-4 justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomInvitationText('');
                      if (normalizeType(selectedEventType) === 'חתונה') {
                        setLineStyles(defaultLineStylesForWedding);
                      }
                    }}
                    className="text-base underline font-bold text-primary hover:text-primary/80"
                  >חזרה לנוסח ברירת מחדל</button>
                </div>
                
                {/* Preview of formatted text */}
                <div className="mt-4 p-4 border border-gray-300 rounded bg-white">
                  <h3 className="text-lg font-bold mb-2 text-center">תצוגה מקדימה:</h3>
                  <div className="bg-gray-50 p-4 rounded border text-right">
                    {customInvitationText.split('\n').map((line, index) => (
                      <div
                        key={index}
                        style={{
                          fontSize: `${lineStyles[index]?.fontSize || 16}px`,
                          color: lineStyles[index]?.color || 'black',
                          fontWeight: lineStyles[index]?.fontWeight || 'normal',
                          lineHeight: lineStyles[index]?.lineHeight || 1.5,
                          letterSpacing: `${lineStyles[index]?.letterSpacing || 0}px`,
                          textAlign: lineStyles[index]?.textAlign || 'right',
                          textDecoration: lineStyles[index]?.textDecoration || 'none',
                          fontStyle: 'normal',
                          textShadow: 'none',
                          transform: lineStyles[index]?.fontStyle === 'italic' ? 'skewX(20deg)' : lineStyles[index]?.fontStyle === 'back-slant' ? 'skewX(-20deg)' : 'none',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          marginBottom: '8px'
                        }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
              </div>

              {/* Right side - Background images section */}
              <div className="w-1/2 overflow-y-auto p-6">
                <h3 className="text-xl font-semibold text-primary mb-4 text-center">ב. לחץ לבחירת הזמנה.</h3>
                {designImages.length === 0 ? (
                  <p className="text-center text-gray-600 mt-10">לא נמצאו תמונות בתיקייה /public/images</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {designImages.map((src) => {
                      // Improved comparison logic to handle different path formats
                      const isSelected = (()=>{ 
                        if(!selectedDesign) return false;
                        
                        // Normalize paths for comparison
                        const normalizePath = (path) => {
                          if (!path) return '';
                          try {
                            // Decode URI components
                            let normalized = decodeURIComponent(path);
                            // Remove leading/trailing slashes and normalize separators
                            normalized = normalized.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');
                            // Convert to lowercase for case-insensitive comparison
                            return normalized.toLowerCase();
                          } catch(e) {
                            // If decode fails, try without decoding
                            return path.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/').toLowerCase();
                          }
                        };
                        
                        const selNormalized = normalizePath(selectedDesign);
                        const srcNormalized = normalizePath(src);
                        
                        // Check if full paths match
                        if (selNormalized === srcNormalized) {
                          return true;
                        }
                        
                        // Check if filenames match (extract filename from path)
                        const getFilename = (path) => {
                          const normalized = normalizePath(path);
                          return normalized.split('/').pop() || normalized;
                        };
                        
                        const selFile = getFilename(selectedDesign);
                        const srcFile = getFilename(src);
                        
                        const matches = selFile === srcFile && selFile !== '';
                        return matches;
                      })();
                      
                      return (
                        <div
                          key={src}
                          className={`relative cursor-pointer hover:opacity-80 rounded-md ${
                            isSelected 
                              ? 'ring-4 ring-green-600 ring-offset-4 ring-offset-white border-4 border-green-600' 
                              : 'border-2 border-gray-300'
                          }`}
                          onClick={() => {
                            setLightboxSrc(src);
                            setShowLightbox(true);
                          }}
                          onDoubleClick={async () => {
                            // Double-click to select design directly
                            setSelectedDesign(src);
                            try { 
                              localStorage.setItem('selectedDesign', src);
                            } catch(e) {}
                            
                            // Update event_details in database
                            if(currentEventId) {
                              try {
                                const { data: eventData, error: fetchError } = await supabase
                                  .from('events')
                                  .select('event_details')
                                  .eq('id', currentEventId)
                                  .single();
                                
                                if (!fetchError && eventData && eventData.event_details) {
                                  let details = {};
                                  try {
                                    details = typeof eventData.event_details === 'string'
                                      ? JSON.parse(eventData.event_details)
                                      : (eventData.event_details || {});
                                  } catch (parseErr) {
                                    details = {};
                                  }
                                  
                                  const updatedDetails = { ...details, template_src: src };
                                  await supabase
                                    .from('events')
                                    .update({ event_details: updatedDetails })
                                    .eq('id', currentEventId);
                                }
                              } catch (err) {
                                console.error('Failed to save design selection:', err);
                              }
                            }
                          }}
                        >
                          <div className="relative w-full rounded-md overflow-hidden border border-gray-200 bg-white">
                            <div className="relative pt-[100%]">
                              <img
                                src={src}
                                alt="Invitation design"
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 rounded-md pointer-events-none" style={{ background: 'rgba(255,255,255,0.22)' }} aria-hidden />
                              <div className="absolute inset-0 flex flex-col items-center justify-center px-4" dir="rtl">
                                {(customInvitationText || invitationText || 'דוגמת טקסט להזמנה').split('\n').map((line, lineIndex) => {
                                  if (!line || !line.trim()) return <div key={lineIndex} style={{ height: '0.5em' }} />;
                                  const style = lineStyles[lineIndex] || {};
                                  const baseFontSize = style.fontSize ? parseInt(style.fontSize) : 20;
                                  const fontSize = lineIndex === 0 ? baseFontSize + 6 : baseFontSize;
                                  let textColor = style.color || '#000000';
                                  if (!textColor.startsWith('#')) {
                                    const colorMap = {
                                      'black': '#000000', 'red': '#FF0000', 'blue': '#0000FF', 'green': '#008000',
                                      'purple': '#800080', 'orange': '#FFA500', 'brown': '#A52A2A', 'gold': '#FFD700',
                                      'pink': '#FFC0CB', 'cyan': '#00FFFF', 'indigo': '#4B0082', 'teal': '#008080'
                                    };
                                    textColor = colorMap[textColor.toLowerCase()] || '#000000';
                                  }
                                  return (
                                    <div
                                      key={lineIndex}
                                      style={{
                                        fontSize: `${fontSize}px`,
                                        fontFamily: selectedFontCss || 'Assistant, sans-serif',
                                        // Requirement: first line is always bold (all event types)
                                        fontWeight: lineIndex === 0 ? 'bold' : (style.fontWeight || 'normal'),
                                        color: textColor,
                                    lineHeight: style.lineHeight ? `${style.lineHeight}` : '1.4',
                                        letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : '0',
                                        textAlign: style.textAlign || 'center',
                                        textDecoration: style.textDecoration || 'none',
                                        fontStyle: style.fontStyle || 'normal',
                                        textShadow: 'none',
                                        transform: style.fontStyle === 'italic' ? 'skewX(20deg)' : style.fontStyle === 'back-slant' ? 'skewX(-20deg)' : 'none',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        marginBottom: lineIndex < (customInvitationText || invitationText || '').split('\n').length - 1 ? '0.25em' : '0',
                                      }}
                                    >
                                      {line.trim()}
                                    </div>
                                  );
                                })}
                              </div>
                              {isSelected && (
                                <div className="absolute top-2 left-2 bg-green-500 rounded-none w-8 h-8 flex items-center justify-center shadow-lg z-10">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
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
              <div className="absolute inset-0 rounded-md pointer-events-none" style={{ background: 'rgba(255,255,255,0.22)' }} aria-hidden />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-4" dir="rtl">
                {(customInvitationText || invitationText || 'דוגמת טקסט להזמנה').split('\n').map((line, lineIndex) => {
                  if (!line || !line.trim()) return <div key={lineIndex} style={{ height: '0.5em' }} />;
                  const style = lineStyles[lineIndex] || {};
                  const baseFontSize = style.fontSize ? parseInt(style.fontSize) : 24;
                  const fontSize = lineIndex === 0 ? baseFontSize + 6 : baseFontSize;
                  let textColor = style.color || '#000000';
                  if (!textColor.startsWith('#')) {
                    const colorMap = {
                      'black': '#000000', 'red': '#FF0000', 'blue': '#0000FF', 'green': '#008000',
                      'purple': '#800080', 'orange': '#FFA500', 'brown': '#A52A2A', 'gold': '#FFD700',
                      'pink': '#FFC0CB', 'cyan': '#00FFFF', 'indigo': '#4B0082', 'teal': '#008080'
                    };
                    textColor = colorMap[textColor.toLowerCase()] || '#000000';
                  }
                  return (
                    <div
                      key={lineIndex}
                      style={{
                        fontSize: `${fontSize}px`,
                        fontFamily: selectedFontCss || 'Assistant, sans-serif',
                        // Requirement: first line is always bold (all event types)
                        fontWeight: lineIndex === 0 ? 'bold' : (style.fontWeight || 'normal'),
                        color: textColor,
                        lineHeight: style.lineHeight ? `${style.lineHeight}` : '1.5',
                        letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : '0',
                        textAlign: style.textAlign || 'center',
                        textDecoration: style.textDecoration || 'none',
                        fontStyle: style.fontStyle || 'normal',
                        textShadow: 'none',
                        transform: style.fontStyle === 'italic' ? 'skewX(20deg)' : style.fontStyle === 'back-slant' ? 'skewX(-20deg)' : 'none',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        marginBottom: lineIndex < (customInvitationText || invitationText || '').split('\n').length - 1 ? '0.5em' : '0',
                      }}
                    >
                      {line.trim()}
                    </div>
                  );
                })}
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

      {/* Advanced Edit Modal */}
      {showAdvancedEdit !== null && (
        <>
          {/* Full-screen color picker */}
          {showColorPalette ? (
            <div className="fixed inset-0 z-[60] bg-white flex flex-col" dir="rtl">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-primary text-center">בחירת צבע פונט</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
                  {colorKeys.map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        updateLineStyle(showAdvancedEdit, 'color', color);
                      }}
                      className={`aspect-square rounded-xl border-4 transition-all hover:scale-105 ${
                        lineStyles[showAdvancedEdit]?.color === color ? 'border-gray-800 ring-4 ring-primary/30' : 'border-gray-300'
                      } ${colorClasses[color] || 'bg-gray-300'}`}
                      title={color}
                    ></button>
                  ))}
                </div>
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setShowColorPalette(false)}
                    className="px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    חזרה לעיצוב
                  </button>
                </div>
              </div>
            </div>
          ) : (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 p-4" onClick={() => setShowAdvancedEdit(null)}>
          <div className="relative bg-white rounded-lg w-full max-w-4xl h-[92vh] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowAdvancedEdit(null)} 
              className="absolute top-2 left-2 text-3xl text-gray-500 hover:text-gray-700 z-10"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold py-3 text-center flex-shrink-0">עיצוב מתקדם - שורה {showAdvancedEdit + 1}</h2>
            
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              {/* Left Column */}
              <div className="space-y-3">
                {/* Font Color */}
                <div>
                  <label className="block mb-2 font-bold text-right">צבע פונט</label>
                  <button
                    type="button"
                    onClick={() => setShowColorPalette(true)}
                    className="w-full py-2 px-4 border-2 border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center font-medium"
                  >
                    לחץ לבחירת צבע
                  </button>
                </div>

                {/* Font Size */}
                <div>
                  <label className="block mb-2 font-bold text-right">גודל פונט</label>
                  <select
                    value={lineStyles[showAdvancedEdit]?.fontSize || '16'}
                    onChange={(e) => updateLineStyle(showAdvancedEdit, 'fontSize', e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2"
                  >
                    <option value="12">12px</option>
                    <option value="14">14px</option>
                    <option value="16">16px</option>
                    <option value="18">18px</option>
                    <option value="20">20px</option>
                    <option value="24">24px</option>
                    <option value="28">28px</option>
                    <option value="32">32px</option>
                    <option value="36">36px</option>
                    <option value="40">40px</option>
                    <option value="48">48px</option>
                  </select>
                </div>

                {/* Font Weight */}
                <div>
                  <label className="block mb-2 font-bold text-right">הדגשת פונט</label>
                  <select
                    value={lineStyles[showAdvancedEdit]?.fontWeight || 'normal'}
                    onChange={(e) => updateLineStyle(showAdvancedEdit, 'fontWeight', e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2"
                  >
                    <option value="normal">רגיל</option>
                    <option value="bold">מודגש</option>
                    <option value="lighter">דק</option>
                    <option value="100">100 - דק מאוד</option>
                    <option value="300">300 - דק</option>
                    <option value="400">400 - רגיל</option>
                    <option value="500">500 - בינוני</option>
                    <option value="600">600 - חצי מודגש</option>
                    <option value="700">700 - מודגש</option>
                    <option value="800">800 - מודגש מאוד</option>
                    <option value="900">900 - כבד ביותר</option>
                  </select>
                </div>

                {/* Text Shadow - positioned to align with סגנון פונט */}
                <div>
                  <label className="block mb-2 font-bold text-right">צל טקסט</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const current = lineStyles[showAdvancedEdit]?.textShadow || 'none';
                        updateLineStyle(showAdvancedEdit, 'textShadow', current === 'none' ? '2px 2px 4px rgba(0,0,0,0.3)' : 'none');
                      }}
                      className={`flex-1 p-3 border-2 rounded-lg ${lineStyles[showAdvancedEdit]?.textShadow && lineStyles[showAdvancedEdit]?.textShadow !== 'none' ? 'border-primary bg-primary/10' : 'border-gray-300'} hover:border-primary transition-colors`}
                    >
                      <span className={`text-lg ${lineStyles[showAdvancedEdit]?.textShadow && lineStyles[showAdvancedEdit]?.textShadow !== 'none' ? 'drop-shadow-md' : ''}`}>A</span>
                      <div className="text-xs mt-1">צל</div>
                    </button>
                  </div>
                </div>

                {/* Text Alignment */}
                <div>
                  <label className="block mb-2 font-bold text-right">יישור טקסט</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'right', icon: '←', label: 'ימין' },
                      { value: 'center', icon: '↔', label: 'מרכז' },
                      { value: 'left', icon: '→', label: 'שמאל' }
                    ].map(align => (
                      <button
                        key={align.value}
                        onClick={() => updateLineStyle(showAdvancedEdit, 'textAlign', align.value)}
                        className={`flex-1 p-3 border-2 rounded-lg ${lineStyles[showAdvancedEdit]?.textAlign === align.value ? 'border-primary bg-primary/10' : 'border-gray-300'} hover:border-primary transition-colors`}
                        title={align.label}
                      >
                        <div className="text-2xl mb-1">{align.icon}</div>
                        <div className="text-xs">{align.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                {/* Line Height */}
                <div>
                  <label className="block mb-2 font-bold text-right">מרווח בין שורות</label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={lineStyles[showAdvancedEdit]?.lineHeight || 1.5}
                    onChange={(e) => updateLineStyle(showAdvancedEdit, 'lineHeight', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-sm text-gray-600 text-center mt-1">
                    {lineStyles[showAdvancedEdit]?.lineHeight?.toFixed(1) || '1.5'}
                  </div>
                </div>

                {/* Letter Spacing */}
                <div>
                  <label className="block mb-2 font-bold text-right">מרווח בין אותיות</label>
                  <input
                    type="range"
                    min="-2"
                    max="10"
                    step="0.5"
                    value={lineStyles[showAdvancedEdit]?.letterSpacing || 0}
                    onChange={(e) => updateLineStyle(showAdvancedEdit, 'letterSpacing', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-sm text-gray-600 text-center mt-1">
                    {lineStyles[showAdvancedEdit]?.letterSpacing?.toFixed(1) || '0.0'}px
                  </div>
                </div>

                {/* Text Decoration */}
                <div>
                  <label className="block mb-2 font-bold text-right">קווי טקסט</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: 'none', label: 'ללא', icon: 'טקסט' },
                      { value: 'underline', label: 'קו תחתון', icon: 'U̲' },
                      { value: 'line-through', label: 'קו חוצה', icon: 'S̶' },
                      { value: 'overline', label: 'קו עליון', icon: 'O̅' }
                    ].map(dec => (
                      <button
                        key={dec.value}
                        onClick={() => {
                          const current = lineStyles[showAdvancedEdit]?.textDecoration || 'none';
                          updateLineStyle(showAdvancedEdit, 'textDecoration', current === dec.value ? 'none' : dec.value);
                        }}
                        className={`px-4 py-2 border-2 rounded-lg ${lineStyles[showAdvancedEdit]?.textDecoration === dec.value ? 'border-primary bg-primary/10' : 'border-gray-300'} hover:border-primary transition-colors`}
                        title={dec.label}
                      >
                        <span className={`text-lg ${dec.value === 'underline' ? 'underline' : dec.value === 'line-through' ? 'line-through' : dec.value === 'overline' ? 'overline' : ''}`}>
                          {dec.icon}
                        </span>
                        <div className="text-xs mt-1">{dec.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Style (Italic - Both Directions) */}
                <div>
                  <label className="block mb-2 font-bold text-right">סגנון פונט - הטיה</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateLineStyle(showAdvancedEdit, 'fontStyle', 'normal')}
                      className={`flex-1 p-3 border-2 rounded-lg ${(lineStyles[showAdvancedEdit]?.fontStyle || 'normal') === 'normal' ? 'border-primary bg-primary/10' : 'border-gray-300'} hover:border-primary transition-colors`}
                      title="ישר"
                    >
                      <span className="text-lg">I</span>
                      <div className="text-xs mt-1">ישר</div>
                    </button>
                    <button
                      onClick={() => {
                        const current = lineStyles[showAdvancedEdit]?.fontStyle || 'normal';
                        updateLineStyle(showAdvancedEdit, 'fontStyle', current === 'italic' ? 'normal' : 'italic');
                      }}
                      className={`flex-1 p-3 border-2 rounded-lg ${lineStyles[showAdvancedEdit]?.fontStyle === 'italic' ? 'border-primary bg-primary/10' : 'border-gray-300'} hover:border-primary transition-colors`}
                      title="נטוי שמאלה"
                    >
                      <span className="text-lg" style={{ 
                        fontStyle: 'normal',
                        transform: lineStyles[showAdvancedEdit]?.fontStyle === 'italic' ? 'skewX(20deg)' : 'none'
                      }}>I</span>
                      <div className="text-xs mt-1">נטוי שמאלה</div>
                    </button>
                    <button
                      onClick={() => {
                        const current = lineStyles[showAdvancedEdit]?.fontStyle || 'normal';
                        updateLineStyle(showAdvancedEdit, 'fontStyle', current === 'back-slant' ? 'normal' : 'back-slant');
                      }}
                      className={`flex-1 p-3 border-2 rounded-lg ${lineStyles[showAdvancedEdit]?.fontStyle === 'back-slant' ? 'border-primary bg-primary/10' : 'border-gray-300'} hover:border-primary transition-colors`}
                      title="נטוי ימינה"
                    >
                      <span className="text-lg" style={{ 
                        fontStyle: 'normal',
                        transform: lineStyles[showAdvancedEdit]?.fontStyle === 'back-slant' ? 'skewX(-20deg)' : 'none'
                      }}>I</span>
                      <div className="text-xs mt-1">נטוי ימינה</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Preview - centered at bottom, above buttons */}
            <div className="flex flex-col items-center px-6 py-3 flex-shrink-0 border-t border-gray-200 bg-gray-50/50">
              <label className="block mb-1 font-bold text-center text-sm">תצוגה מקדימה</label>
              <div className="w-full max-w-xl border border-gray-300 rounded-md p-3 bg-white min-h-[70px]" style={{ textAlign: lineStyles[showAdvancedEdit]?.textAlign || 'right' }}>
                <div
                  style={{
                    fontSize: `${lineStyles[showAdvancedEdit]?.fontSize || 16}px`,
                    color: lineStyles[showAdvancedEdit]?.color || 'black',
                    fontWeight: lineStyles[showAdvancedEdit]?.fontWeight || 'normal',
                    lineHeight: lineStyles[showAdvancedEdit]?.lineHeight || 1.5,
                    letterSpacing: `${lineStyles[showAdvancedEdit]?.letterSpacing || 0}px`,
                    textAlign: lineStyles[showAdvancedEdit]?.textAlign || 'right',
                    textDecoration: lineStyles[showAdvancedEdit]?.textDecoration || 'none',
                    fontStyle: 'normal',
                    textShadow: 'none',
                    transform: lineStyles[showAdvancedEdit]?.fontStyle === 'italic' ? 'skewX(20deg)' : lineStyles[showAdvancedEdit]?.fontStyle === 'back-slant' ? 'skewX(-20deg)' : 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {customInvitationText.split('\n')[showAdvancedEdit] || 'דוגמת טקסט להזמנה'}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 flex-shrink-0 border-t border-gray-200">
              <button
                onClick={() => {
                  const updatedStyles = { ...lineStyles };
                  delete updatedStyles[showAdvancedEdit];
                  setLineStyles(updatedStyles);
                }}
                className="flex-1 bg-red-500 text-white border border-red-600 rounded-full px-6 py-3 font-bold hover:bg-red-600 transition-all"
              >
                תחזיר עיצוב שורה לעיצוב ברירת מחדל
              </button>
              <button
                onClick={() => setShowAdvancedEdit(null)}
                className="flex-1 bg-green-600 text-white border border-green-700 rounded-full px-6 py-3 font-bold hover:bg-green-700 transition-all"
              >
                שמור וסגור
              </button>
            </div>
          </div>
        </div>
          )}
        </>
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
                      <th className="p-2 border">מספר שולחן</th>
                      <th className="p-2 border">טלפון</th>
                      <th className="p-2 border">בוגרים</th>
                      <th className="p-2 border">ילדים</th>
                      <th className="p-2 border">סה"כ</th>
                      <th className="p-2 border">צמחוני</th>
                      <th className="p-2 border">טבעוני</th>
                      <th className="p-2 border">גלאט</th>
                      <th className="p-2 border">צליאקים</th>
                      <th className="p-2 border">אלרגיה</th>
                      <th className="p-2 border">סוג אלרגיה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportGuests.map((g, idx) => {
                      if (g.isSummary) {
                        // Summary row
                        return (
                          <tr key={`summary-${g.table_number}-${idx}`} className="bg-yellow-100 font-bold">
                            <td className="p-2 border text-center"></td>
                            <td className="p-2 border text-right" colSpan={3}>{g.summary_label}</td>
                            <td className="p-2 border"></td>
                            <td className="p-2 border text-center">{g.adults}</td>
                            <td className="p-2 border text-center">{g.children}</td>
                            <td className="p-2 border text-center">{g.total}</td>
                            <td className="p-2 border text-center">{g.veg || '-'}</td>
                            <td className="p-2 border text-center">{g.vegan || '-'}</td>
                            <td className="p-2 border text-center">{g.glatt || '-'}</td>
                            <td className="p-2 border text-center">{g.celiac || '-'}</td>
                            <td className="p-2 border text-center">{g.allergy || '-'}</td>
                            <td className="p-2 border"></td>
                          </tr>
                        );
                      }
                      // Guest row - count only guest rows before this one
                      let rowNum = 0;
                      for (let i = 0; i < idx; i++) {
                        if (!reportGuests[i].isSummary) {
                          rowNum++;
                        }
                      }
                      rowNum++;
                      return (
                        <tr key={g.id || `guest-${idx}`} className="odd:bg-white even:bg-gray-50">
                          <td className="p-1 border text-center">{rowNum}</td>
                          <td className="p-1 border">{g.first_name}</td>
                          <td className="p-1 border">{g.last_name}</td>
                          <td className="p-1 border text-center">{g.table_number || '-'}</td>
                          <td className="p-1 border">{`="${g.phone}"`}</td>
                          <td className="p-1 border text-center">{g.adults ?? '-'}</td>
                          <td className="p-1 border text-center">{g.children ?? '-'}</td>
                          <td className="p-1 border text-center">{(g.adults||0)+(g.children||0)}</td>
                          <td className="p-1 border text-center">{(g.veg_adults+g.veg_children)|| '-'}</td>
                          <td className="p-1 border text-center">{(g.vegan_adults+g.vegan_children)|| '-'}</td>
                          <td className="p-1 border text-center">{(g.glatt_adults+g.glatt_children)|| '-'}</td>
                          <td className="p-1 border text-center">{((g.celiac_adults||0)+(g.celiac_children||0))|| '-'}</td>
                          <td className="p-1 border text-center">{(g.allergy_adults+g.allergy_children)|| '-'}</td>
                          <td className="p-1 border text-center">{g.allergy_note || g.allergy_description || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-lg">
                      <td className="p-2 border text-center" colSpan={5}>סה"כ</td>
                      <td className="p-2 border text-center">{totalReportAdults}</td>
                      <td className="p-2 border text-center">{totalReportChildren}</td>
                      <td className="p-2 border text-center">{totalReportAdults + totalReportChildren}</td>
                      <td className="p-2 border text-center">{totalVeg}</td>
                      <td className="p-2 border text-center">{totalVegan}</td>
                      <td className="p-2 border text-center">{totalGlatt}</td>
                      <td className="p-2 border text-center">{totalCeliac}</td>
                      <td className="p-2 border text-center">{totalAllergy}</td>
                      <td className="p-2 border text-center"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {reportGuests.length > 0 && reportTitle === 'אורחים מגיעים ממוינים לפי שולחן' && (
              <div className="mt-4 flex justify-center">
                <button 
                  onClick={exportReportXlsx} 
                  className="bg-[#FCE6AC] text-primary border border-primary rounded-full px-6 py-2 font-medium hover:bg-[#FCE6AC]/90 transition-all"
                >
                  צור קובץ אקסל - ושמור בהורדות
                </button>
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
            <h2 className="text-xl font-medium mb-2">בחר דו"ח להצגה</h2>
            {selectedEventForReport && (
              <p className="text-base md:text-lg font-bold text-gray-800 mb-4 rtl text-right">
                אירוע מהעבר: {selectedEventForReport.event_type || 'אירוע'} – {selectedEventForReport._eventDate?format(selectedEventForReport._eventDate,'dd/MM/yyyy',{locale:he}):''}
              </p>
            )}
            <button onClick={()=>{setShowReportsOptions(false);setShowApprovedReport(true);}} className="w-full bg-[#FCE6AC] text-primary border border-primary rounded-full px-4 py-2 text-lg font-medium hover:bg-[#FCE6AC]/90 transition-all">אישרו הגעה</button>
            <button onClick={async () => {
              setShowReportsOptions(false);
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                  alert('יש להתחבר כדי להציג דו"ח.');
                  return;
                }

                const eventIdToUse = selectedEventForReport?.id || currentEventId;
                if (!eventIdToUse) {
                  setReportGuests([]);
                  setReportTitle('אורחים מגיעים ממוינים לפי שולחן (אין אירוע נבחר)');
                  setShowReportModal(true);
                  return;
                }

                const { data, error } = await supabase
                  .from('invited_guests')
                  .select('*')
                  .eq('event_id', eventIdToUse)
                  .eq('status', 'approved');
                if (error) throw error;

                // Sort by table_number
                const sortedData = (data || []).sort((a, b) => {
                  const tableA = a.table_number || '';
                  const tableB = b.table_number || '';
                  const numA = parseFloat(tableA);
                  const numB = parseFloat(tableB);
                  
                  if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                  } else if (!isNaN(numA) && isNaN(numB)) {
                    return -1;
                  } else if (isNaN(numA) && !isNaN(numB)) {
                    return 1;
                  } else {
                    if (tableA === '' && tableB !== '') return 1;
                    if (tableA !== '' && tableB === '') return -1;
                    return tableA.localeCompare(tableB, 'he');
                  }
                });

                // Group guests by table and add summary rows
                const groupedByTable = {};
                sortedData.forEach(guest => {
                  const table = guest.table_number || 'ללא שולחן';
                  if (!groupedByTable[table]) {
                    groupedByTable[table] = [];
                  }
                  groupedByTable[table].push(guest);
                });

                // Create array with guests and summary rows
                const dataWithSummaries = [];
                Object.keys(groupedByTable).sort((a, b) => {
                  const numA = parseFloat(a);
                  const numB = parseFloat(b);
                  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                  if (!isNaN(numA)) return -1;
                  if (!isNaN(numB)) return 1;
                  if (a === 'ללא שולחן') return 1;
                  if (b === 'ללא שולחן') return -1;
                  return a.localeCompare(b, 'he');
                }).forEach(table => {
                  const guests = groupedByTable[table];
                  // Add all guests for this table
                  guests.forEach(guest => {
                    dataWithSummaries.push({ ...guest, isGuest: true });
                  });
                  
                  // Calculate summary for this table
                  const tableTotalAdults = guests.reduce((sum, g) => sum + (g.adults || 0), 0);
                  const tableTotalChildren = guests.reduce((sum, g) => sum + (g.children || 0), 0);
                  const tableTotalVeg = guests.reduce((sum, g) => sum + ((g.veg_adults||0)+(g.veg_children||0)), 0);
                  const tableTotalVegan = guests.reduce((sum, g) => sum + ((g.vegan_adults||0)+(g.vegan_children||0)), 0);
                  const tableTotalGlatt = guests.reduce((sum, g) => sum + ((g.glatt_adults||0)+(g.glatt_children||0)), 0);
                  const tableTotalCeliac = guests.reduce((sum, g) => sum + ((g.celiac_adults||0)+(g.celiac_children||0)), 0);
                  const tableTotalAllergy = guests.reduce((sum, g) => sum + ((g.allergy_adults||0)+(g.allergy_children||0)), 0);
                  
                  // Add summary row for this table
                  dataWithSummaries.push({
                    isSummary: true,
                    table_number: table,
                    summary_label: `סה"כ שולחן ${table}`,
                    adults: tableTotalAdults,
                    children: tableTotalChildren,
                    total: tableTotalAdults + tableTotalChildren,
                    veg: tableTotalVeg,
                    vegan: tableTotalVegan,
                    glatt: tableTotalGlatt,
                    celiac: tableTotalCeliac,
                    allergy: tableTotalAllergy
                  });
                });

                setReportGuests(dataWithSummaries);
                setReportTitle('אורחים מגיעים ממוינים לפי שולחן');
                setShowReportModal(true);
              } catch (e) {
                console.error('Load approved guests by table failed', e);
                alert('שגיאה בטעינת הדוח');
              }
            }} className="w-full bg-[#FCE6AC] text-primary border border-primary rounded-full px-4 py-2 text-lg font-medium hover:bg-[#FCE6AC]/90 transition-all">אישרו הגעה ממוינים לפי שולחן</button>
            <button onClick={()=>{setShowReportsOptions(false);setShowRejectedReport(true);}} className="w-full bg-[#FCE6AC] text-primary border border-primary rounded-full px-4 py-2 text-lg font-medium hover:bg-[#FCE6AC]/90 transition-all">לא מגיעים</button>
            <button onClick={()=>{setShowReportsOptions(false);setShowPendingReport(true);}} className="w-full bg-[#FCE6AC] text-primary border border-primary rounded-full px-4 py-2 text-lg font-medium hover:bg-[#FCE6AC]/90 transition-all">טרם הגיבו</button>
            {/* Guest status query button */}
            <button onClick={()=>{setShowReportsOptions(false);setShowSearchGuest(true);}} className="w-full bg-[#FCE6AC] text-primary border border-primary rounded-full px-4 py-2 text-lg font-medium hover:bg-[#FCE6AC]/90 transition-all">שאילתת סטטוס אורח</button>
            <button onClick={async ()=>{
              setShowReportsOptions(false);
              try{
                const {data:{user}}=await supabase.auth.getUser();
                if(!user){alert('יש להתחבר כדי להציג.');return;}
                
                // Show loading indicator
                setArchiveLoading(true);
                setArchiveEvents([]);
                setShowArchiveList(true);
                
                // Fetch all events (including invalid types) to show all past events, then filter client-side
                const {data: allEv, error} = await supabase
                  .from('events')
                  .select('id,event_type,event_details')
                  .eq('user_id',user.id)
                  .order('created_at',{ascending:false})
                  .limit(100); // Limit to prevent loading too many events
                
                if(error) throw error;
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // Process events efficiently - include all past events with valid event_type
                // Deduplicate by event_type + date combination to prevent same event appearing multiple times
                const pastEvMap = new Map(); // Use Map keyed by event_type + date to ensure uniqueness
                
                (allEv || []).forEach(ev => {
                  try {
                    // Only include events with valid event_type
                    if (!ev.event_type || !eventTypes.includes(ev.event_type)) return;
                    
                    const details = typeof ev.event_details === 'string' 
                      ? JSON.parse(ev.event_details) 
                      : ev.event_details || {};
                    const dateStr = details.date || details.start_datetime;
                    if (!dateStr) return;
                    
                    const dt = parseEventDate(dateStr);
                    if (!dt) return;
                    
                    const eventDate = new Date(dt);
                    eventDate.setHours(0, 0, 0, 0);
                    
                    // Only include past events (not today)
                    if (eventDate >= today) return;
                    
                    // Create unique key for deduplication: type + date (not id, as same event can have multiple ids)
                    const eventKey = `${ev.event_type}-${eventDate.toISOString().slice(0,10)}`;
                    
                    // Only add if we haven't seen this exact type+date combination
                    // If we've seen it, keep the one with the most recent created_at (already sorted descending)
                    if (!pastEvMap.has(eventKey)) {
                      pastEvMap.set(eventKey, {
                        ...ev,
                        event_details: details,
                        _eventDate: eventDate
                      });
                    }
                  } catch (e) {
                    console.error('Error processing event:', e);
                  }
                });
                
                // Convert map values to array - each event will appear only once
                const pastEvArray = Array.from(pastEvMap.values());
                
                // Sort by date descending (most recent first)
                pastEvArray.sort((a, b) => {
                  if (!a._eventDate || !b._eventDate) return 0;
                  return b._eventDate - a._eventDate;
                });
                
                setArchiveEvents(pastEvArray);
                setArchiveLoading(false);
              }catch(e){
                console.error(e);
                setArchiveLoading(false);
                alert('שגיאה בטעינת אירועי ארכיון');
                setShowArchiveList(false);
              }
            }} className="w-full bg-[#FCE6AC] text-primary border border-primary rounded-full px-4 py-2 text-lg font-medium hover:bg-[#FCE6AC]/90 transition-all">אירועים מהעבר</button>

            {/* Exit archive event button */}
            {selectedEventForReport && (
              <button onClick={()=>{
                setSelectedEventForReport(null);
                // Don't reset currentEventId - it should remain as the active event
                setShowReportsOptions(false);
              }} className="w-full bg-primary text-[#FCE6AC] border border-primary rounded-full px-4 py-2 text-lg font-medium hover:bg-primary/90 transition-all mt-2">יציאה מאירוע עבר</button>
            )}
          </div>
        </div>
      )}

      {/* Approved report modal */}
      {showApprovedReport && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-[90vw] max-w-none">
            <button onClick={()=>{setShowApprovedReport(false);setShowReportsOptions(true);}} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4 text-center">דוח אורחים שאישרו הגעה</h2>
            <div className="max-h-[75vh] overflow-y-auto overflow-x-auto">
              <table className="w-full text-right border text-xs min-w-max">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-1 border w-8">#</th>
                    <th className="p-1 border w-20">שם פרטי</th>
                    <th className="p-1 border w-20">שם משפחה</th>
                    <th className="p-1 border w-16">מספר שולחן</th>
                    <th className="p-1 border w-20">טלפון</th>
                    <th className="p-1 border w-12">בוגרים</th>
                    <th className="p-1 border w-12">ילדים</th>
                    <th className="p-1 border w-12">סה"כ</th>
                    <th className="p-1 border w-14">צמחוני</th>
                    <th className="p-1 border w-14">טבעוני</th>
                    <th className="p-1 border w-12">גלאט</th>
                    <th className="p-1 border w-14">צליאקים</th>
                    <th className="p-1 border w-14">אלרגיות</th>
                    <th className="p-1 border w-24">הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedGuests.map((g,idx)=>(
                    <tr key={idx} className="odd:bg-white even:bg-gray-50">
                      <td className="p-1 border text-center">{idx+1}</td>
                      <td className="p-1 border">{g.first_name}</td>
                      <td className="p-1 border">{g.last_name}</td>
                      <td className="p-1 border text-center">{g.table_number || '-'}</td>
                      <td className="p-1 border">{`="${g.phone}"`}</td>
                      <td className="p-1 border text-center">{g.adults}</td>
                      <td className="p-1 border text-center">{g.children}</td>
                      <td className="p-1 border text-center">{(g.adults||0)+(g.children||0)}</td>
                      <td className="p-1 border text-center">{g.veg_adults+g.veg_children}</td>
                      <td className="p-1 border text-center">{g.vegan_adults+g.vegan_children}</td>
                      <td className="p-1 border text-center">{g.glatt_adults+g.glatt_children}</td>
                      <td className="p-1 border text-center">{(g.celiac_adults||0)+(g.celiac_children||0)}</td>
                      <td className="p-1 border text-center">{g.allergy_adults+g.allergy_children}</td>
                      <td className="p-1 border text-center">{g.allergy_note || ((g.allergy_adults+g.allergy_children)>0? 'אלרגיה' : '-')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold">
                    <td className="p-1 border text-center" colSpan={5}>סה"כ</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.adults,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.children,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.adults+g.children,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.veg_adults+g.veg_children,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.vegan_adults+g.vegan_children,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.glatt_adults+g.glatt_children,0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+(g.celiac_adults||0)+(g.celiac_children||0),0)}</td>
                    <td className="p-1 border text-center">{approvedGuests.reduce((s,g)=>s+g.allergy_adults+g.allergy_children,0)}</td>
                    <td className="p-1 border text-center"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
+            <div className="flex justify-center mt-4">
+              <button onClick={exportApprovedXlsx} className="bg-[#FCE6AC] text-primary border border-primary rounded-full px-6 py-2 font-medium hover:bg-[#FCE6AC]/90 transition-all">צור קובץ אקסל - ושמור בהורדות</button>
+            </div>
          </div>
        </div>
      )}

      {/* Rejected report modal */}
      {showRejectedReport && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-[90vw] max-w-none">
            <button onClick={()=>{setShowRejectedReport(false);setShowReportsOptions(true);}} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
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
                      <td className="p-1 border">{`="${g.phone}"`}</td>
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
            <button onClick={()=>{setShowPendingReport(false);setShowReportsOptions(true);}} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
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
                      <td className="p-1 border">{`="${g.phone}"`}</td>
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
            <button onClick={()=>{setShowSearchGuest(false); setShowReportsOptions(true);}} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
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
                        <td className="p-1 border">{`="${g.phone}"`}</td>
                        <td className="p-1 border text-center">{g.status==='approved'? 'מגיע' : g.status==='rejected'? 'לא מגיע' : 'טרם הגיב'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-center mt-6">
              <button onClick={()=>{setShowSearchGuest(false); setShowReportsOptions(true);}} className="bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all">סגור</button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Event Warning Modal */}
      {showExistingEventWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-red-50 border-4 border-red-400 rounded-lg p-6 w-full max-w-md text-center">
            <button 
              onClick={() => setShowExistingEventWarning(false)} 
              className="absolute top-2 left-2 text-2xl text-red-600 hover:text-red-800" 
              aria-label="סגור"
            >
              &times;
            </button>
            <div className="mb-4">
              <span className="text-4xl mb-2 block">⚠️</span>
              <h2 className="text-2xl font-bold text-red-800 mb-4">יש אירוע קיים במערכת!</h2>
              <p className="text-lg text-red-700 mb-4">
                כבר יש אירוע פעיל או בתהליך יצירה. האם אתה בטוח שברצונך ליצור אירוע חדש?
              </p>
              <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4 mb-4 text-right">
                <h3 className="text-lg font-bold text-red-800 mb-3 text-center">הבהרות חשובות</h3>
                <div className="space-y-2">
                  <p className="text-base font-bold text-red-800">
                    • במערכת זו לא ניתן לנהל שני אירועים במקביל. בכל פעם ניתן לנהל אירוע אחד בלבד.
                  </p>
                  <p className="text-base font-bold text-red-800">
                    • יצירת אירוע חדש תתאפשר רק אחרי מחיקה מלאה של האירוע הקיים: כולל דוחות בקרה, רשימת אורחים וכל הנתונים. מה שבארכיון יישאר ללא שינוי.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => setShowExistingEventWarning(false)}
                className="w-full bg-green-600 text-white border border-green-700 rounded-full px-6 py-3 font-bold hover:bg-green-700 transition-all"
              >
                חזור לאירוע הקיים
              </button>
              <button
                onClick={() => {
      setShowExistingEventWarning(false);
      setShowArchiveConfirm(true);
                }}
                className="w-full bg-red-600 text-white border border-red-700 rounded-full px-6 py-3 font-bold hover:bg-red-700 transition-all"
              >
                מחק אירוע קיים
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white border-4 border-orange-400 rounded-lg p-6 w-full max-w-md text-center shadow-2xl">
            <button 
              onClick={() => setShowArchiveConfirm(false)} 
              className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700" 
              aria-label="סגור"
            >
              &times;
            </button>
            <div className="mb-6">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-red-800 mb-4">אישור סופי נדרש</h2>
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 mb-4 text-right">
                <p className="text-base font-bold text-gray-800 mb-3">
                  האם אתה בטוח שברצונך למחוק את האירוע הקיים וליצור אירוע חדש?
                </p>
                <div className="space-y-3 text-base text-gray-700">
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 font-bold text-lg">⚠️</span>
                    <p className="text-right flex-1 text-base font-semibold">
                      האירוע הקיים יימחק לגמרי מהמערכת ולא יהיה זמין יותר.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 font-bold text-lg">⚠️</span>
                    <p className="text-right flex-1 text-base font-semibold">
                      דוחות הבקרה וכל נתוני האירוע יימחקו לגמרי. יצירת אירוע חדש תתאפשר רק לאחר סיום המחיקה.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="flex-1 bg-green-600 text-white border border-green-700 rounded-full px-6 py-3 font-bold text-lg hover:bg-green-700 transition-all"
              >
                ביטול מחיקה
              </button>
              <button
                onClick={() => {
                  setShowArchiveConfirm(false);
                  handleNewEvent(true);
                }}
                className="flex-1 bg-red-600 text-white border border-red-700 rounded-full px-6 py-3 font-bold hover:bg-red-700 transition-all"
              >
                מחק אירוע
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Success Modal – מוצג מעל כל המודלים אחרי מחיקה מוצלחת */}
      {showDeletionSuccess && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[60]">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-md text-center shadow-2xl border-4 border-green-500">
            <button
              onClick={() => { setShowDeletionSuccess(false); setShowEventTypes(true); }}
              className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700"
              aria-label="סגור"
            >
              &times;
            </button>
            <div className="mb-6">
              <div className="text-5xl mb-4 text-green-600">✅</div>
              <h2 className="text-2xl font-bold text-green-700 mb-3">המחיקה בוצעה בהצלחה</h2>
              <p className="text-base text-gray-700 leading-relaxed">
                האירוע הקודם, דוחות הבקרה וכל הנתונים הוסרו מהמערכת. כעת ניתן ליצור אירוע חדש.
              </p>
            </div>
            <button
              onClick={() => { setShowDeletionSuccess(false); setShowEventTypes(true); }}
              className="bg-green-600 text-white border border-green-700 rounded-full px-8 py-3 font-bold text-lg hover:bg-green-700 transition-all"
            >
              בחר סוג אירוע חדש
            </button>
          </div>
        </div>
      )}

      {/* New Event confirmation modal */}
      {showNewEventConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-sm text-center">
            <button onClick={()=>setShowNewEventConfirm(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700" aria-label="סגור">&times;</button>
            <h2 className="text-xl font-medium mb-6">האם אתה רוצה ליצור אירוע חדש?</h2>
            <button
              onClick={() => { setShowNewEventConfirm(false); handleNewEvent(); }}
              className="bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all"
            >
              אשר ושמור
            </button>
          </div>
        </div>
      )}
      {/* Flow Diagram Modal */}
      {showFlowDiagram && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-2">
          <div className="relative bg-white rounded-lg p-4 w-full max-w-6xl h-[98vh] overflow-hidden flex flex-col">
            <button 
              onClick={()=>setShowFlowDiagram(false)} 
              className="absolute top-4 left-4 text-3xl text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center font-bold transition-all z-10" 
              aria-label="סגור"
            >
              &times;
            </button>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 text-center text-primary">תיאור תהליך יצירת אירוע ב-Meet-M</h2>
            <p className="text-center text-gray-600 text-base mb-3">כך נראה התהליך ליצירת האירוע שלך</p>
            <div className="border-b-2 border-primary mb-3"></div>
            
            {/* Flow Steps - Horizontal Layout */}
            <div className="w-full mx-auto flex-1 overflow-y-auto px-2">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Column 1: Getting Started */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">התחלה:</h3>
                
                {/* Step 0.5: New Event Confirmation */}
                <div 
                  className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">✅</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">פתיחת אירוע חדש</h3>
                    <p className="text-base text-gray-600">אישור ואיפוס המערכת לאירוע חדש</p>
                  </div>
                </div>
                
                {/* Step 0: Pricing */}
                <div 
                  className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">💰</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">בחירת מסלול</h3>
                    <p className="text-base text-gray-600">בחר את החבילה המתאימה לאירוע שלך</p>
                  </div>
                </div>
              </div>

              {/* Column 2: Event Setup */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">הגדרת האירוע:</h3>

                {/* Step 1: Event Type */}
                <div 
                  className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">🎉</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">שלב 1: סוג אירוע</h3>
                    <p className="text-base text-gray-600">חתונה, בר מצווה, יום הולדת ועוד</p>
                  </div>
                </div>

                {/* Step 2: Event Details */}
                <div 
                  className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">📝</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">שלב 2: פרטי האירוע</h3>
                    <p className="text-base text-gray-600">תאריך, שעה, מקום ופרטים נוספים</p>
                  </div>
                </div>

                {/* Step 3: Design */}
                <div 
                  className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">🎨</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">שלב 3: עיצוב הזמנה</h3>
                    <p className="text-base text-gray-600">בחר מתוך 45 תבניות מעוצבות</p>
                  </div>
                </div>
              </div>

              {/* Column 3: Management and Tracking */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">ניהול ומעקב:</h3>

                {/* Step 4: Send Invitations */}
                <div 
                  className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">📱</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">שלב 4: שליחת הזמנות</h3>
                    <p className="text-base text-gray-600">שליחה אוטומטית מקובץ ל SMS ו-WhatsApp</p>
                  </div>
                </div>

                {/* Step 5: Reports */}
                <div 
                  className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">📊</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">שלב 5: דוחות</h3>
                    <p className="text-base text-gray-600">מעקב אישורי הגעה ויצוא לאקסל</p>
                  </div>
                </div>
              </div>
              </div>
            </div>
            
            {/* Step Details Box */}
            {selectedFlowStep !== null && (
              <div className="bg-[#FFF9E8] border-2 border-primary rounded-lg p-5 mt-3 text-right relative max-h-[35vh] overflow-y-auto">
                <button 
                  onClick={() => setSelectedFlowStep(null)} 
                  className="absolute top-2 left-2 text-xl text-gray-500 hover:text-gray-700 font-bold transition-colors"
                  aria-label="סגור פירוט"
                >
                  &times;
                </button>
                <h3 className="text-lg font-bold text-primary mb-3">
                  {selectedFlowStep === 0 && '💰 בחירת מסלול תמחור'}
                  {selectedFlowStep === 0.5 && '✅ פתיחת אירוע חדש'}
                  {selectedFlowStep === 1 && '🎉 שלב 1: בחירת סוג אירוע'}
                  {selectedFlowStep === 2 && '📝 שלב 2: פרטי האירוע'}
                  {selectedFlowStep === 3 && '🎨 שלב 3: בחירת עיצוב הזמנה'}
                  {selectedFlowStep === 4 && '📱 שלב 4: שליחת הזמנות'}
                  {selectedFlowStep === 5 && '📊 שלב 5: דוחות אישורי הגעה'}
                </h3>
                
                {selectedFlowStep === 0 && (
                  <div className="space-y-2">
                    <p className="text-gray-700 text-base leading-relaxed">בשלב זה תבחר את המסלול המתאים לאירוע שלך:</p>
                    <ul className="list-disc list-inside space-y-1.5 mr-3 text-base">
                      <li><strong>מסלול א (5₪)</strong> - עד 5 הודעות</li>
                      <li><strong>מסלול ב (149₪)</strong> - מ 51 עד 200 הודעות</li>
                      <li><strong>מסלול ג (199₪)</strong> - מ 201 עד 350 הודעות</li>
                      <li><strong>מסלול ד (259₪)</strong> - מ 351 עד 500 הודעות</li>
                    </ul>
                    <p className="text-gray-600 text-sm mt-2">המחירים הם חד פעמיים לכל אירוע</p>
                  </div>
                )}
                
                {selectedFlowStep === 0.5 && (
                  <div className="space-y-2">
                    <p className="text-gray-700 text-base leading-relaxed">בשלב זה המערכת מתכוננת לאירוע חדש:</p>
                    <ul className="list-disc list-inside space-y-1.5 mr-3 text-base">
                      <li><strong>אישור יצירת אירוע</strong> - מודל אישור</li>
                      <li><strong>איפוס מלא</strong> - ניקוי כל הנתונים</li>
                      <li><strong>איפוס טפסים</strong> - חזרה למצב התחלתי</li>
                      <li><strong>מחיקת עיצוב קודם</strong> - איפוס העיצוב</li>
                      <li><strong>הכנה לאירוע חדש</strong> - המערכת מוכנה</li>
                    </ul>
                    <p className="text-gray-600 text-sm mt-2">ניתן ליצור אירוע חדש רק לאחר ארכיון האירוע הקודם</p>
                  </div>
                )}
                
                {selectedFlowStep === 1 && (
                  <div className="space-y-2">
                    <p className="text-gray-700 text-base leading-relaxed">בשלב זה תבחר את סוג האירוע שלך מתוך 10 אפשרויות:</p>
                    <ul className="list-disc list-inside space-y-1.5 mr-3 text-base">
                      <li>חתונה, חינה, מסיבת אירוסין, הפרשת חלה - טקסים לשמחת המשפחה</li>
                      <li>בר/בת מצווה - חגיגת בגרות</li>
                      <li>ברית/בריתה - טקס ברית מילה או שמות</li>
                      <li>יום הולדת, אירוע עסקי</li>
                    </ul>
                    <p className="text-gray-600 text-sm mt-2">בחירת סוג האירוע תתאים את השדות בשלבים הבאים</p>
                  </div>
                )}
                
                {selectedFlowStep === 2 && (
                  <div className="space-y-2">
                    <p className="text-gray-700 text-base leading-relaxed">בשלב זה תמלא את כל הפרטים החשובים לאירוע:</p>
                    <ul className="list-disc list-inside space-y-1.5 mr-3 text-base">
                      <li><strong>פרטים אישיים</strong> - שמות והורים</li>
                      <li><strong>תאריך ושעה</strong> - תאריך עתידי חובה</li>
                      <li><strong>שעת חופה</strong> - רק לחתונה</li>
                      <li><strong>מיקום</strong> - שם האולם וכתובת</li>
                    </ul>
                    <p className="text-gray-600 text-sm mt-2">הפרטים נשמרים ויופיעו בהזמנה</p>
                  </div>
                )}
                
                {selectedFlowStep === 3 && (
                  <div className="space-y-3">
                    <p className="text-gray-700 leading-relaxed">בשלב זה תבחר את העיצוב המושלם להזמנה שלך:</p>
                    <ul className="list-disc list-inside space-y-2 mr-4">
                      <li><strong>45 תבניות מעוצבות</strong> - מגוון רחב של עיצובים לכל סוג אירוע</li>
                      <li><strong>התאמה אישית</strong> - הטקסט שלך יתווסף אוטומטית על התבנית</li>
                      <li><strong>צפייה מקדימה</strong> - ראה איך ההזמנה תיראה לפני השמירה</li>
                      <li><strong>שמירה בענן</strong> - ההזמנה נשמרת ב-Supabase Storage</li>
                    </ul>
                    <p className="text-gray-600 text-base mt-3">תוכל לשנות את העיצוב בכל שלב של התהליך</p>
                  </div>
                )}
                
                {selectedFlowStep === 4 && (
                  <div className="space-y-3">
                    <p className="text-gray-700 leading-relaxed">בשלב זה תשלח את ההזמנות לאורחים:</p>
                    <ul className="list-disc list-inside space-y-2 mr-4">
                      <li><strong>מילוי פרטי אורח</strong> - שם פרטי, שם משפחה וטלפון</li>
                      <li><strong>שליחה בוואטסאפ</strong> - הזמנה מעוצבת + קישור RSVP ייחודי</li>
                      <li><strong>שליחה ב-SMS</strong> - הודעת טקסט + קישור RSVP</li>
                      <li><strong>קישור RSVP ייחודי</strong> - כל אורח מקבל קישור אישי לאישור הגעה</li>
                      <li><strong>ניהול רשימת אורחים</strong> - צפייה, חיפוש ועריכת אורחים</li>
                    </ul>
                    <p className="text-gray-600 text-base mt-3">ניתן לשלוח הזמנות לכמה שיותר אורחים</p>
                  </div>
                )}
                
                {selectedFlowStep === 5 && (
                  <div className="space-y-3">
                    <p className="text-gray-700 leading-relaxed">בשלב זה תעקוב אחר אישורי ההגעה:</p>
                    <ul className="list-disc list-inside space-y-2 mr-4">
                      <li><strong>דוח מאושרים</strong> - רשימת כל האורחים שאישרו הגעה + פרטים מלאים (מספר בוגרים, ילדים, ארוחות מיוחדות, אלרגיות)</li>
                      <li><strong>דוח דחיות</strong> - אורחים שהודיעו שלא מגיעים</li>
                      <li><strong>דוח ממתינים</strong> - אורחים שעדיין לא הגיבו</li>
                      <li><strong>יצוא לאקסל</strong> - הורדת כל הנתונים לקובץ Excel מסודר</li>
                      <li><strong>ארכיון אירועים</strong> - גישה לדוחות של אירועים קודמים</li>
                    </ul>
                    <p className="text-gray-600 text-base mt-3">עדכון בזמן אמת - הדוחות מתעדכנים אוטומטית</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setShowFlowDiagram(false)}
                className="bg-gray-200 text-gray-700 border border-gray-300 rounded-full px-8 py-3 font-medium hover:bg-gray-300 transition-all"
              >
                סגור
              </button>
              <button
                onClick={async () => {
                  setShowFlowDiagram(false);
                  try {
                    setSelectedFlowStep(null);
                    let hasSession = !!sessionRef.current;
                    if (!hasSession) {
                      const { data: { user } } = await supabase.auth.getUser();
                      hasSession = !!user;
                    }
                    if (!hasSession || !selectedPlan) {
                      setShowPricingPlan(true);
                      setPlanAddOnMode(false);
                      return;
                    }
                    setStepErrorMsg('');
                    const hasActive = await checkActiveEventExists();
                    if (hasActive) {
                      setShowExistingEventWarning(true);
                    } else {
                      handleNewEvent();
                    }
                  } catch (err) {
                    console.error('createNewEvent error', err);
                    setShowPricingPlan(true);
                    setPlanAddOnMode(false);
                  }
                }}
                className="bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all text-lg"
              >
                בואו נתחיל - צור אירוע חדש! 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Plan Selection Modal */}
      {showPricingPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-lg p-6 sm:p-8 w-full max-w-[98vw] my-8">
            <button onClick={()=>setShowPricingPlan(false)} className="absolute top-4 left-4 text-3xl text-gray-500 hover:text-gray-700" aria-label="סגור">&times;</button>
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-center text-primary">בחר את המסלול המתאים לאירוע שלך</h2>
            {planAddOnMode && (
              <div className="text-center text-sm font-semibold text-primary mb-4">
                בחר חבילת הרחבה בתשלום כדי להוסיף עוד הודעות למכסה.
              </div>
            )}
            {planSelectionError && (
              <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-lg p-3 text-red-700 font-semibold text-sm text-center">
                {planSelectionError}
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
              {/* Plan A - Up to 50 guests */}
              <div className="border-2 border-gray-300 rounded-lg p-6 hover:border-primary transition-all hover:shadow-lg text-center">
                <h3 className="text-xl font-bold mb-2 text-primary">מסלול א</h3>
                <p className="text-gray-600 mb-4">מתאים לאירועים קטנים</p>
                <div className="mb-4">
                  <span className="text-base md:text-xl font-bold text-primary">5 ₪</span>
                </div>
                <div className="mb-6 text-right">
                  <p className="text-base md:text-xl font-semibold text-primary mb-3 whitespace-nowrap tracking-wide">✓ עד 5 הודעות</p>
                  <p className="text-gray-600 mb-2">✓ הזמנות מעוצבות מקצועית</p>
                  <p className="text-gray-600 mb-2">✓ שליחה אוטומטית לכל האורחים</p>
                  <p className="text-gray-600 mb-2">✓ שליחת הודעות SMS ו-WhatsApp ב-2 סבבים</p>
                  <p className="text-gray-600 mb-2">✓ מעקב אישורי הגעה</p>
                  <p className="text-gray-600 mb-2">✓ הצגת דוחות סיכום מתעדכנים בזמן אמת בדף הבית</p>
                  <p className="text-gray-600 mb-2">✓ ניהול פרטי אורחים</p>
                  <p className="text-gray-600 mb-2">✓ ניהול העדפות מזון ואלרגיות</p>
                  <p className="text-gray-600 mb-2">✓ דוחות מפורטים + ייצוא ל-Excel</p>
                  <p className="text-gray-600 mb-2">✓ שמירת אירועי עבר בארכיון</p>
                  <p className="text-gray-600 mb-2">✓ הצגת מפת אזור האירוע + ניווט לאולם</p>
                </div>
                <button
                  onClick={() => planAddOnMode ? handleAddPackagePlan('free') : handleSelectPlan('free')}
                  disabled={planAddOnMode}
                  className={`w-full ${planAddOnMode ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : selectedPlan === 'free' ? 'bg-primary text-white' : 'bg-[#FCE6AC] text-primary hover:bg-primary hover:text-white'} border border-primary rounded-full px-6 py-3 font-medium transition-all`}
                >
                  {planAddOnMode ? 'לא זמין להרחבה' : 'בחר מסלול זה'}
                </button>
              </div>

              {/* Standard Plan - 51-200 guests */}
              <div className="border-2 border-primary rounded-lg p-6 hover:shadow-xl transition-all text-center relative bg-[#FFF9E8]">
                <div className="absolute top-0 right-1/2 transform translate-x-1/2 -translate-y-1/2 bg-primary text-white px-4 py-1 rounded-full text-sm font-medium">
                  מומלץ
                </div>
                <h3 className="text-xl font-bold mb-2 text-primary">מסלול ב</h3>
                <p className="text-gray-600 mb-4">מתאים לרוב האירועים</p>
                <div className="mb-4">
                  <span className="text-base md:text-xl font-bold text-primary">149 ₪</span>
                </div>
                <div className="mb-6 text-right">
                  <p className="text-base md:text-xl font-semibold text-primary mb-3 whitespace-nowrap tracking-wide">✓ מ 51 עד 200 הודעות</p>
                  <p className="text-gray-600 mb-2">✓ הזמנות מעוצבות מקצועית</p>
                  <p className="text-gray-600 mb-2">✓ שליחה אוטומטית לכל האורחים</p>
                  <p className="text-gray-600 mb-2">✓ שליחת הודעות SMS ו-WhatsApp ב-2 סבבים</p>
                  <p className="text-gray-600 mb-2">✓ מעקב אישורי הגעה</p>
                  <p className="text-gray-600 mb-2">✓ הצגת דוחות סיכום מתעדכנים בזמן אמת בדף הבית</p>
                  <p className="text-gray-600 mb-2">✓ ניהול פרטי אורחים</p>
                  <p className="text-gray-600 mb-2">✓ ניהול העדפות מזון ואלרגיות</p>
                  <p className="text-gray-600 mb-2">✓ דוחות מפורטים + ייצוא ל-Excel</p>
                  <p className="text-gray-600 mb-2">✓ שמירת אירועי עבר בארכיון</p>
                  <p className="text-gray-600 mb-2">✓ הצגת מפת אזור האירוע + ניווט לאולם</p>
                </div>
                <button
                  onClick={() => planAddOnMode ? handleAddPackagePlan('standard') : handleSelectPlan('standard')}
                  className={`w-full ${planAddOnMode ? 'bg-green-600 text-white hover:bg-green-700' : selectedPlan === 'standard' ? 'bg-primary text-white' : 'bg-[#FCE6AC] text-primary hover:bg-primary hover:text-white'} border border-primary rounded-full px-6 py-3 font-medium transition-all`}
                >
                  {planAddOnMode ? 'הוסף חבילת מסלול ב' : 'בחר מסלול זה'}
                </button>
              </div>

              {/* Premium Plan - 201-350 guests */}
              <div className="border-2 border-gray-300 rounded-lg p-6 hover:border-primary transition-all hover:shadow-lg text-center">
                <h3 className="text-xl font-bold mb-2 text-primary">מסלול ג</h3>
                <p className="text-gray-600 mb-4">לאירועים גדולים</p>
                <div className="mb-4">
                  <span className="text-base md:text-xl font-bold text-primary">199 ₪</span>
                </div>
                <div className="mb-6 text-right">
                  <p className="text-base md:text-xl font-semibold text-primary mb-3 whitespace-nowrap tracking-wide">✓ מ 201 עד 350 הודעות</p>
                  <p className="text-gray-600 mb-2">✓ הזמנות מעוצבות מקצועית</p>
                  <p className="text-gray-600 mb-2">✓ שליחה אוטומטית לכל האורחים</p>
                  <p className="text-gray-600 mb-2">✓ שליחת הודעות SMS ו-WhatsApp ב-2 סבבים</p>
                  <p className="text-gray-600 mb-2">✓ מעקב אישורי הגעה</p>
                  <p className="text-gray-600 mb-2">✓ הצגת דוחות סיכום מתעדכנים בזמן אמת בדף הבית</p>
                  <p className="text-gray-600 mb-2">✓ ניהול פרטי אורחים</p>
                  <p className="text-gray-600 mb-2">✓ ניהול העדפות מזון ואלרגיות</p>
                  <p className="text-gray-600 mb-2">✓ דוחות מפורטים + ייצוא ל-Excel</p>
                  <p className="text-gray-600 mb-2">✓ שמירת אירועי עבר בארכיון</p>
                  <p className="text-gray-600 mb-2">✓ הצגת מפת אזור האירוע + ניווט לאולם</p>
                </div>
                <button
                  onClick={() => planAddOnMode ? handleAddPackagePlan('premium') : handleSelectPlan('premium')}
                  className={`w-full ${planAddOnMode ? 'bg-green-600 text-white hover:bg-green-700' : selectedPlan === 'premium' ? 'bg-primary text-white' : 'bg-[#FCE6AC] text-primary hover:bg-primary hover:text-white'} border border-primary rounded-full px-6 py-3 font-medium transition-all`}
                >
                  {planAddOnMode ? 'הוסף חבילת מסלול ג' : 'בחר מסלול זה'}
                </button>
              </div>

              {/* Luxury Plan - 351-500 guests */}
              <div className="border-2 border-gray-300 rounded-lg p-6 hover:border-primary transition-all hover:shadow-lg text-center">
                <h3 className="text-xl font-bold mb-2 text-primary">מסלול ד</h3>
                <p className="text-gray-600 mb-4">לאירועים גדולים מאוד</p>
                <div className="mb-4">
                  <span className="text-base md:text-xl font-bold text-primary">259 ₪</span>
                </div>
                <div className="mb-6 text-right">
                  <p className="text-base md:text-xl font-semibold text-primary mb-3 whitespace-nowrap tracking-wide">✓ מ 351 עד 500 הודעות</p>
                  <p className="text-gray-600 mb-2">✓ הזמנות מעוצבות מקצועית</p>
                  <p className="text-gray-600 mb-2">✓ שליחה אוטומטית לכל האורחים</p>
                  <p className="text-gray-600 mb-2">✓ שליחת הודעות SMS ו-WhatsApp ב-2 סבבים</p>
                  <p className="text-gray-600 mb-2">✓ מעקב אישורי הגעה</p>
                  <p className="text-gray-600 mb-2">✓ הצגת דוחות סיכום מתעדכנים בזמן אמת בדף הבית</p>
                  <p className="text-gray-600 mb-2">✓ ניהול פרטי אורחים</p>
                  <p className="text-gray-600 mb-2">✓ ניהול העדפות מזון ואלרגיות</p>
                  <p className="text-gray-600 mb-2">✓ דוחות מפורטים + ייצוא ל-Excel</p>
                  <p className="text-gray-600 mb-2">✓ שמירת אירועי עבר בארכיון</p>
                  <p className="text-gray-600 mb-2">✓ הצגת מפת אזור האירוע + ניווט לאולם</p>
                </div>
                <button
                  onClick={() => planAddOnMode ? handleAddPackagePlan('luxury') : handleSelectPlan('luxury')}
                  className={`w-full ${planAddOnMode ? 'bg-green-600 text-white hover:bg-green-700' : selectedPlan === 'luxury' ? 'bg-primary text-white' : 'bg-[#FCE6AC] text-primary hover:bg-primary hover:text-white'} border border-primary rounded-full px-6 py-3 font-medium transition-all`}
                >
                  {planAddOnMode ? 'הוסף חבילת מסלול ד' : 'בחר מסלול זה'}
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-center text-gray-500 text-base">* המחירים הם חד פעמיים לאירוע</p>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center">
                <p className="text-blue-800 font-bold text-lg mb-1">💡 צריך יותר מ-500 הודעות?</p>
                <p className="text-blue-700 text-base">ניתן לרכוש חבילות הרחבה של 100 הודעות נוספות ב-100 ₪ בלבד!</p>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Tranzila Payment Modal */}
      <TranzilaPayment
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        amount={paymentAmount}
        planName={paymentPlanName}
        onSuccess={handlePaymentSuccess}
        onFailure={handlePaymentFailure}
      />

      {/* Payment Result Modal - Success or Error */}
      {showPaymentResultModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[60]">
          <div className="relative bg-white rounded-2xl p-8 md:p-12 w-full max-w-lg mx-4 shadow-2xl text-center">
            {paymentResultType === 'success' ? (
              <>
                <div className="text-6xl md:text-7xl mb-6">✅</div>
                <h2 className="text-2xl md:text-3xl font-bold text-green-600 mb-4">
                  התשלום בוצע בהצלחה!
                </h2>
                <p className="text-lg md:text-xl text-gray-700 mb-8">
                  {paymentResultMessage}
                </p>
                <button
                  onClick={() => {
                    setShowPaymentResultModal(false);
                    // If it was a plan purchase (not addon), continue with event creation
                    if (paymentWasPlanPurchase) {
                      if (typeof window !== 'undefined') {
                        try { localStorage.removeItem('pendingCreateEvent'); } catch(e){}
                      }
                      setShowEventTypes(true);
                    }
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-full transition-all shadow-lg transform hover:scale-105"
                >
                  המשך
                </button>
              </>
            ) : (
              <>
                <div className="text-6xl md:text-7xl mb-6">❌</div>
                <h2 className="text-2xl md:text-3xl font-bold text-red-600 mb-4">
                  התשלום נכשל
                </h2>
                <p className="text-lg md:text-xl text-gray-700 mb-8">
                  {paymentResultMessage}
                </p>
                <button
                  onClick={() => {
                    setShowPaymentResultModal(false);
                    setShowPricingPlan(true);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-full transition-all shadow-lg transform hover:scale-105"
                >
                  חזור למסלולים
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Invitation Send Loading Modal */}
      {isSendingInvitation && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[60]">
          <div className="relative bg-white rounded-2xl p-8 md:p-12 w-full max-w-lg mx-4 shadow-2xl text-center">
            <div className="text-6xl md:text-7xl mb-6 animate-spin">⏳</div>
            <h2 className="text-2xl md:text-3xl font-bold text-primary mb-4">
              שולח הזמנה...
            </h2>
            <p className="text-lg md:text-xl text-gray-700">
              אנא המתן, ההזמנה נשלחת כעת
            </p>
          </div>
        </div>
      )}

      {/* Invitation Send Result Modal */}
      {showInvitationResultModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[60]">
          <div className="relative bg-white rounded-2xl p-8 md:p-12 w-full max-w-lg mx-4 shadow-2xl text-center">
            {invitationResult.type === 'success' ? (
              <>
                <div className="text-6xl md:text-7xl mb-6">✅</div>
                <h2 className="text-2xl md:text-3xl font-bold text-green-600 mb-4">
                  השליחה הצליחה!
                </h2>
                <p className="text-lg md:text-xl text-gray-700 mb-8">
                  {invitationResult.message}
                </p>
                <button
                  onClick={() => {
                    setShowInvitationResultModal(false);
                    // Reset guest form
                    setGuestData({
                      guestFirstName: '',
                      guestLastName: '',
                      guestPhone: '',
                      guestTable: '',
                    });
                    setGuestErrors({});
                    setGuestErrorMsg('');
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-full transition-all shadow-lg transform hover:scale-105"
                >
                  המשך
                </button>
              </>
            ) : (
              <>
                <div className="text-6xl md:text-7xl mb-6">❌</div>
                <h2 className="text-2xl md:text-3xl font-bold text-red-600 mb-4">
                  השליחה נכשלה
                </h2>
                <p className="text-lg md:text-xl text-gray-700 mb-8">
                  {invitationResult.message}
                </p>
                <button
                  onClick={() => {
                    setShowInvitationResultModal(false);
                    // כשהשגיאה קשורה למכסה – פתיחת מסך רכישת חבילות הרחבה (ברירת מחדל: 1 חבילה)
                    const isQuotaError = invitationResult.message && (
                      invitationResult.message.includes('מכסה') ||
                      invitationResult.message.includes('חבילת הרחבה')
                    );
                    if (isQuotaError) {
                      setPendingAddonCount(1);
                      setShowPlanLimitWarning(true);
                      setPlanAddOnMode(true);
                    }
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-full transition-all shadow-lg transform hover:scale-105"
                >
                  המשך
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Archive events list modal */}
      {showArchiveList && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-sm text-center space-y-4">
            <button onClick={()=>{setShowArchiveList(false);setShowReportsOptions(true);}} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-xl font-medium mb-4">אירועים מהעבר (ארכיון)</h2>
            {archiveLoading ? (
              <p className="text-gray-600">טוען אירועים...</p>
            ) : archiveEvents.length===0 ? (
              <p className="text-gray-600">אין אירועים בארכיון.</p>
            ):(
              <ul className="space-y-3 max-h-[60vh] overflow-y-auto px-2">
                {archiveEvents.map(ev=>{
                  const dateObj=ev._eventDate;
                  const date=dateObj?format(dateObj,'dd/MM/yyyy',{locale:he}):'-';
                  return (
                    <li key={ev.id} className="border-2 border-primary rounded-lg p-4 bg-gradient-to-br from-[#FCE6AC] to-[#FFF9E8] hover:from-[#F9D978] hover:to-[#FCE6AC] cursor-pointer flex flex-col items-center justify-center text-center shadow-md hover:shadow-lg transition-all transform hover:scale-105" onClick={()=>{
                      // IMPORTANT: Don't set currentEventId for archive events - this would reset the active event!
                      // Only use selectedEventForReport for viewing reports from archive
                      setShowArchiveList(false);
                      setSelectedEventForReport(ev);
                      setShowReportsOptions(true);
                    }}>
                      <span className="font-bold text-lg text-primary mb-1">{ev.event_type||'אירוע'}</span>
                      <span className="text-sm font-medium text-gray-700">{date}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {showActiveError && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-sm text-center rtl">
            <button onClick={()=>setShowActiveError(false)} className="absolute top-2 left-2 text-2xl text-gray-500 hover:text-gray-700">&times;</button>
            <p className="text-lg font-medium text-primary mb-6">כבר קיים אירוע פעיל.<br/>ניתן ליצור אירוע חדש רק לאחר שהאירוע יעבור לארכיון.</p>
            <button onClick={()=>setShowActiveError(false)} className="bg-primary text-white rounded-full px-8 py-2 font-medium hover:bg-primary/90 transition-all">סגור</button>
          </div>
        </div>
      )}
    </>
  );
});

export default StepButtons;