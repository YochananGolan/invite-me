import React, { useState, forwardRef, useImperativeHandle, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { getInviteBaseUrl } from '../lib/inviteUrl';
import { normalizePhoneNumber } from '../lib/whatsappClient';
import DatePicker, { registerLocale } from 'react-datepicker';
import he from 'date-fns/locale/he';
import 'react-datepicker/dist/react-datepicker.css';
import * as XLSX from 'xlsx-js-style';
import { format } from 'date-fns';
import { useToast } from './Toast';
import TranzilaPayment from './TranzilaPayment';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal';
import Drawer, { DrawerHeader, DrawerBody, DrawerFooter } from './Drawer';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';

const RADIAN = Math.PI / 180;
const previewMetricValueClass = 'max-w-full min-w-0 break-all tabular-nums leading-tight';
const previewTableNumberClass = 'inline-block max-w-full min-w-0 break-all tabular-nums leading-tight';
const invitationPreviewLineContainmentStyle = {
  width: '100%',
  maxWidth: '88%',
  minWidth: 0,
  boxSizing: 'border-box',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};

const getContainedChartNumberProps = (value, width) => {
  const text = String(value ?? '');
  const availableWidth = Math.max(10, (Number(width) || 0) - 8);
  const estimatedTextWidth = text.length * 8;

  return {
    style: { fontVariantNumeric: 'tabular-nums' },
    ...(text && estimatedTextWidth > availableWidth
      ? { textLength: availableWidth, lengthAdjust: 'spacingAndGlyphs' }
      : {}),
  };
};

const getContainedStatusSliceLabelProps = (value, innerRadius, isOnlySlice) => {
  const text = String(value ?? '');
  const availableWidth = Math.max(14, (Number(innerRadius) || 0) * (isOnlySlice ? 1.25 : 0.85));
  const estimatedTextWidth = text.length * (isOnlySlice ? 8 : 7);

  return {
    style: { fontVariantNumeric: 'tabular-nums' },
    ...(text && estimatedTextWidth > availableWidth
      ? { textLength: availableWidth, lengthAdjust: 'spacingAndGlyphs' }
      : {}),
  };
};

const CANONICAL_PLAN_CODES = new Set([
  'free',
  'basic',
  'standard',
  'premium',
  'luxury',
  'elite',
  'supreme',
]);

function parseNonNegativeInt(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function getGuestIdentityKey(guest = {}) {
  const phone = guest.phone ?? guest.guestPhone ?? guest.phoneOriginal ?? guest.phoneNormalized ?? '';
  const normalizedPhone = normalizePhoneNumber(phone);
  if (normalizedPhone) return `phone:${normalizedPhone}`;

  const firstName = String(guest.first_name ?? guest.guestFirstName ?? '').trim().toLowerCase();
  const lastName = String(guest.last_name ?? guest.guestLastName ?? '').trim().toLowerCase();
  const tableNumber = String(guest.table_number ?? guest.guestTable ?? '').trim().toLowerCase();
  return `name:${firstName}|${lastName}|${tableNumber}`;
}

function getGuestStatusBucket(status) {
  return status === 'approved' || status === 'rejected' ? status : 'pending';
}

function dedupeGuestsByIdentity(guests = []) {
  const byIdentity = new Map();

  for (const guest of guests || []) {
    const key = getGuestIdentityKey(guest);
    const current = byIdentity.get(key);

    if (!current) {
      byIdentity.set(key, guest);
      continue;
    }

    const currentStatus = getGuestStatusBucket(current.status);
    const nextStatus = getGuestStatusBucket(guest.status);
    if (currentStatus === 'pending' && nextStatus !== 'pending') {
      byIdentity.set(key, guest);
    }
  }

  return Array.from(byIdentity.values());
}

function getPendingGuestsFromRows(guests = []) {
  return dedupeGuestsByIdentity(guests).filter((guest) => getGuestStatusBucket(guest.status) === 'pending');
}

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

const DEFAULT_EVENT_TIME = '19:30';
const DEFAULT_CHUPPAH_TIME = '21:00';
const DEFAULT_CUSTOM_DESCRIPTION = 'תיאור האירוע';
const STEP_BAR_SETTLE_DELAY_MS = 90;
const STEP_BAR_SETTLE_DURATION_MS = 180;

const parseEventDate = (str) => {
  if (!str) return null;
  const dateOnly = String(str).split(/[T ]/)[0];
  const native = new Date(dateOnly);
  if (!Number.isNaN(native.getTime())) return native;
  const match = dateOnly.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return null;
};

const computePlanRetentionDate = (rawDate) => {
  const parsed = parseEventDate(rawDate);
  if (!parsed) return null;
  parsed.setHours(0, 0, 0, 0);
  const retention = new Date(parsed);
  retention.setDate(retention.getDate() + 1);
  retention.setHours(0, 0, 0, 0);
  return retention;
};

/** מחיקה ידנית של אירוע לפני סיום — לא לאפס מסלול ב-bootstrap אחרי רענון */
const INVITEME_CARRY_PLAN_AFTER_DELETE_KEY = 'inviteMe_carryPlanAfterManualDelete';
const INVITEME_CARRY_PLAN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function markCarryPlanAfterManualDelete() {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(INVITEME_CARRY_PLAN_AFTER_DELETE_KEY, String(Date.now()));
  } catch (_) {}
}

function clearCarryPlanAfterManualDelete() {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(INVITEME_CARRY_PLAN_AFTER_DELETE_KEY);
  } catch (_) {}
}

function shouldRespectCarryPlanAfterManualDelete() {
  try {
    if (typeof window === 'undefined') return false;
    const v = localStorage.getItem(INVITEME_CARRY_PLAN_AFTER_DELETE_KEY);
    if (!v) return false;
    const ts = parseInt(v, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts <= INVITEME_CARRY_PLAN_MAX_AGE_MS;
  } catch (_) {
    return false;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveCurrentUserForSync() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user;
  } catch (err) {
    console.warn('[StepButtons] getUser failed while resolving sync user', err);
  }

  try {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (authSession?.user?.id) return authSession.user;
  } catch (err) {
    console.warn('[StepButtons] getSession failed while resolving sync user', err);
  }

  try {
    if (typeof window === 'undefined') return null;
    const storedUserId = localStorage.getItem('user_id');
    if (!storedUserId || !UUID_PATTERN.test(storedUserId)) return null;

    return {
      id: storedUserId,
      email: localStorage.getItem('user_email') || '',
    };
  } catch (err) {
    console.warn('[StepButtons] localStorage user lookup failed', err);
    return null;
  }
}

const hasMeaningfulFormValue = (key, value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (key === 'time' && trimmed === DEFAULT_EVENT_TIME) return false;
    if (key === 'chuppahTime' && trimmed === DEFAULT_CHUPPAH_TIME) return false;
    if (key === 'customEventDescription' && trimmed === DEFAULT_CUSTOM_DESCRIPTION) return false;
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulFormValue(key, item));
  }
  if (typeof value === 'object') {
    return Object.values(value).some((nested) => hasMeaningfulFormValue(key, nested));
  }
  return Boolean(value);
};

const StepButtons = forwardRef(function StepButtons({ session, onAuthClick, triggerCreateEvent, onConsumedCreateTrigger }, ref) {
  const router = useRouter();
  const { addToast } = useToast();
  const sessionRef = useRef(session);
  const hasSession = !!session;
  // After the user מחק אירוע קיים once successfully in this session, we don't need
  // to לבקש מחיקה שוב בכל לחיצה על "צור אירוע חדש".
  const [hasClearedExistingEvent, setHasClearedExistingEvent] = useState(false);
  // הודעה לאחר שהמערכת זיהתה שהאירוע עבר – מאפשרת למשתמש להבין ש"האירוע הסתיים, אפשר לפתוח אירוע חדש"
  const [showEventEndedNotice, setShowEventEndedNotice] = useState(false);
  
  // Keep session ref updated
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (session) {
      setEventRefreshKey((k) => k + 1);
    }
    // לא לאפס selectedPlan כאן ב־!session — גורם לריצה לפני שהסשן מוכן ומוחק מסלול מ־localStorage; איפוס רק באפקט session למטה
  }, [session]);

  // כשהדף מעלה triggerCreateEvent – מריצים זרימת יצירת אירוע (בלי תלות ב-ref)
  useEffect(() => {
    if (!triggerCreateEvent) return;
    onConsumedCreateTrigger?.();
    let hasSession = !!sessionRef.current;
    const run = async () => {
      if (!hasSession) {
        const user = await resolveCurrentUserForSync();
        hasSession = !!user;
      }
      if (!hasSession) {
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
        return;
      }
      // קודם: אם יש אירוע פעיל – להציג אזהרה/ארכיון, לא מסך מסלולים (גם כש־selectedPlan ריק ברגע)
      const hasActive = await checkActiveEventExists();
      if (hasActive) {
        setShowExistingEventWarning(true);
        return;
      }
      const planReady = selectedPlanRef.current || userPlanSettingsRef.current?.plan;
      if (!planReady) {
        setShowPricingPlan(true);
        setPlanAddOnMode(false);
        return;
      }
      await handleNewEvent();
    };
    run().catch((err) => {
      console.error('createNewEvent error', err);
      setShowPricingPlan(true);
      setPlanAddOnMode(false);
    });
  }, [triggerCreateEvent, hasClearedExistingEvent]);
  const steps = ['צור אירוע חדש', '📅 שלב 1 - סוג אירוע', '📝 שלב 2 - פרטי האירוע', '🎨 שלב 3 - עיצוב הזמנה', '📤 שלב 4 - שליחת הזמנה לאורח', '📊 שלב 5 - דוחו"ת בקרה'];
  const stepsMobile = ['', 'סוג אירוע', 'פרטי האירוע', 'עיצוב', 'שליחה', 'דוחות בקרה'];
  const eventTypes = ['חתונה', 'חינה', 'מסיבת אירוסין', 'בר מצווה', 'בת מצווה', 'ברית', 'בריתה', 'יום הולדת', 'אירוע עסקי', 'הפרשת חלה'];
  const eventTypeIcons = {
    'חתונה': '💍',
    'חינה': '🤲',
    'מסיבת אירוסין': '🥂',
    'בר מצווה': '✡️',
    'בת מצווה': '👑',
    'ברית': '🍼',
    'בריתה': '🎀',
    'יום הולדת': '🎂',
    'אירוע עסקי': '💼',
    'הפרשת חלה': '🥖',
  };
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
    time: DEFAULT_EVENT_TIME,
    chuppahTime: DEFAULT_CHUPPAH_TIME,
    hallName: '',
    hallAddress: '',
    customEventDescription: DEFAULT_CUSTOM_DESCRIPTION,
    hostName: '',
  });
  const formDataHasMeaningfulValues = React.useMemo(() => {
    return Object.entries(formData || {}).some(([key, value]) => hasMeaningfulFormValue(key, value));
  }, [formData]);
  const formDataIsMeaningfullyEmpty = !formDataHasMeaningfulValues;
  const [formErrors, setFormErrors] = useState({});
  const [eventDetailsCompleted, setEventDetailsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [eventDetailsSubmitAttempted, setEventDetailsSubmitAttempted] = useState(false);
  const visibleFormErrors = eventDetailsSubmitAttempted ? formErrors : {};
  // Global error message for skipped steps
  const [stepErrorMsg, setStepErrorMsg] = useState('');
  const [clickedStepName, setClickedStepName] = useState('');
  const [showStepError, setShowStepError] = useState(false);

  React.useEffect(() => {
    setEventDetailsSubmitAttempted(false);
    if (showEventDetails) {
      setErrorMsg('');
      setFormErrors({});
    }
  }, [showEventDetails]);

  // ---- finished steps persistence ----
  const [finishedSteps, setFinishedSteps] = useState(()=>{
    if(typeof window==='undefined') return [];
    try {
      const raw = localStorage.getItem('finishedSteps');
      return (raw && typeof raw === 'string' && raw.trim().startsWith('[')) ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  });

  // ---- guest summary stats ----
  const [guestSummary, setGuestSummary] = useState({ approved: 0, adults: 0, children: 0 });
  const [capacityWarningGuests, setCapacityWarningGuests] = useState({ adults: 0, children: 0, totalGuests: 0 });
  const resetCapacityWarningGuests = React.useCallback(() => {
    setCapacityWarningGuests({ adults: 0, children: 0, totalGuests: 0 });
  }, []);
  const [guestStatusSummary, setGuestStatusSummary] = useState({ approved: 0, rejected: 0, pending: 0 });
  const [guestSummaryRefreshKey, setGuestSummaryRefreshKey] = useState(0);
  const [mobileSummaryGuests, setMobileSummaryGuests] = useState([]);
  const [mobileSummarySearch, setMobileSummarySearch] = useState('');
  const [mobileSummaryFilter, setMobileSummaryFilter] = useState('all');
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
  const statusChartDataNonZero = React.useMemo(
    () => statusChartData.filter(item => Number(item.value) > 0),
    [statusChartData]
  );
  const statusTotal = React.useMemo(
    () => statusChartData.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
    [statusChartData]
  );
  const hasStatusData = statusChartData.some(item => item.value > 0);
  const mobileFilteredSummaryGuests = React.useMemo(() => {
    const term = mobileSummarySearch.trim().toLowerCase();
    return mobileSummaryGuests
      .filter((guest) => {
        const normalizedStatus = guest.status === 'approved' || guest.status === 'rejected' ? guest.status : 'pending';
        if (mobileSummaryFilter !== 'all' && normalizedStatus !== mobileSummaryFilter) return false;
        if (!term) return true;
        return [
          guest.first_name,
          guest.last_name,
          guest.phone,
          guest.table_number,
        ].some((value) => String(value || '').toLowerCase().includes(term));
      })
      .slice(0, 6);
  }, [mobileSummaryFilter, mobileSummaryGuests, mobileSummarySearch]);
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
        {...getContainedChartNumberProps(value, width)}
      >
        {value}
      </text>
    );
  }, [guestSummaryChartData]);
  const renderStatusSliceLabel = React.useCallback((props) => {
    const { value, cx, cy, midAngle, innerRadius, outerRadius } = props;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
    // Always render label at mid-radius inside the slice — no external labels, no clipping
    const labelRadius = innerRadius + (outerRadius - innerRadius) / 2;
    const x = cx + labelRadius * Math.cos(-midAngle * RADIAN);
    const y = cy + labelRadius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="3"
        paintOrder="stroke"
        textAnchor="middle"
        dominantBaseline="central"
        fontWeight="700"
        fontSize={13}
      >
        {numericValue}
      </text>
    );
  }, [statusChartData, statusTotal]);

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

  const syncFinishedStepsFromEvent = useCallback((eventType, details = {}) => {
    const progress = parseNonNegativeInt(details?.progress_step);
    const hasDetails = details && Object.entries(details).some(([key, value]) => hasMeaningfulFormValue(key, value));
    const restoredSteps = new Set();

    if (eventType) restoredSteps.add(0);
    if (hasDetails || progress >= 2) restoredSteps.add(1);
    if (details?.template_src || progress >= 3) restoredSteps.add(2);
    if (!restoredSteps.size) return;

    setFinishedSteps((prev) => {
      const merged = Array.from(new Set([...(prev || []), ...restoredSteps])).sort((a, b) => a - b);
      try { localStorage.setItem('finishedSteps', JSON.stringify(merged)); } catch (e) {}
      return merged;
    });
  }, []);

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

  // Keep details validation visible only after Save, and clear it once fixed.
  React.useEffect(() => {
    if (!eventDetailsSubmitAttempted || !errorMsg) return;

    // Re-evaluate missing fields with the same rules used in handleSaveDetails
    const missing = computeMissingDetails(formData, selectedEventType);
    if (missing.length === 0) {
      setErrorMsg('');
      setFormErrors({});
      return;
    }

    const nextErrors = missing.reduce((acc, [key]) => ({ ...acc, [key]: true }), {});
    setFormErrors(nextErrors);
  }, [formData, selectedEventType, errorMsg, eventDetailsSubmitAttempted]);

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
  const [guestSubmitAttempted, setGuestSubmitAttempted] = useState(false);
  const visibleGuestErrors = guestSubmitAttempted ? guestErrors : {};
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
  const [guestSearchAttempted, setGuestSearchAttempted] = useState(false);

  React.useEffect(() => {
    setGuestSubmitAttempted(false);
    if (showGuestForm) {
      setGuestErrorMsg('');
      setGuestErrors({});
    }
  }, [showGuestForm]);

  React.useEffect(() => {
    setGuestSearchAttempted(false);
    if (showSearchGuest) {
      setSearchError('');
      setSearchResults([]);
    }
  }, [showSearchGuest]);

  // Archive events list modal
  const [showArchiveList,setShowArchiveList]=useState(false);
  const [archiveEvents,setArchiveEvents]=useState([]);
  const [archiveLoading,setArchiveLoading]=useState(false);

  // Excel import preview modal
const [showExcelPreview, setShowExcelPreview] = useState(false);
const [showExcelInstructions, setShowExcelInstructions] = useState(false);
const [showMobileExcelNotice, setShowMobileExcelNotice] = useState(false);
const [showMobileExcelExportNotice, setShowMobileExcelExportNotice] = useState(false);
const [excelPreviewData, setExcelPreviewData] = useState([]);
const [excelErrors, setExcelErrors] = useState([]);
const [isSavingExcelGuests, setIsSavingExcelGuests] = useState(false);
const [showWhatsAppGroupModal, setShowWhatsAppGroupModal] = useState(false);
const [whatsAppGroupName, setWhatsAppGroupName] = useState('');
const [whatsAppGroupEventId, setWhatsAppGroupEventId] = useState(null);
const [whatsAppGroupGuestIds, setWhatsAppGroupGuestIds] = useState(null);
const [whatsAppGroupGuestCount, setWhatsAppGroupGuestCount] = useState(0);
const [isWhatsAppGroupSubmitting, setIsWhatsAppGroupSubmitting] = useState(false);
const [hasWhatsAppGroup, setHasWhatsAppGroup] = useState(false);

// Process flow diagram modal
  const [showFlowDiagram, setShowFlowDiagram] = useState(false);
  const [selectedFlowStep, setSelectedFlowStep] = useState(null);
  const [stepBarPhase, setStepBarPhase] = useState('fixed');
  const [stepBarTransform, setStepBarTransform] = useState('translate3d(0, 0, 0)');
  const [stepBarHeight, setStepBarHeight] = useState(null);
  const stepBarAnchorRef = useRef(null);
  const stepBarRef = useRef(null);
  const reportsSectionRef = useRef(null);

  useEffect(() => {
    const el = reportsSectionRef.current;
    if (!el || typeof window === 'undefined') return;
    const isMobile = window.innerWidth < 640;
    if (!isMobile) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          screen.orientation?.lock?.('landscape').catch(() => {});
        } else {
          screen.orientation?.unlock?.();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => { observer.disconnect(); screen.orientation?.unlock?.(); };
  }, []);

  useEffect(() => {
    if (!hasSession) {
      setStepBarPhase('fixed');
      setStepBarTransform('translate3d(0, 0, 0)');
      setStepBarHeight(null);
      return undefined;
    }

    let startTimer;
    let settleTimer;
    let firstFrame;
    let secondFrame;

    const settleImmediately = () => {
      setStepBarPhase('settled');
      setStepBarTransform('translate3d(0, 0, 0)');
    };

    setStepBarPhase('fixed');
    setStepBarTransform('translate3d(0, 0, 0)');

    startTimer = window.setTimeout(() => {
      const bar = stepBarRef.current;
      const anchor = stepBarAnchorRef.current;

      if (!bar || !anchor) {
        settleImmediately();
        return;
      }

      const barRect = bar.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      setStepBarHeight(barRect.height);

      if (prefersReducedMotion) {
        settleImmediately();
        return;
      }

      const deltaX = Math.round(anchorRect.left - barRect.left);
      const deltaY = Math.round(anchorRect.top - barRect.top);
      const nextTransform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;

      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          setStepBarPhase('settling');
          setStepBarTransform(nextTransform);
        });
      });

      settleTimer = window.setTimeout(settleImmediately, STEP_BAR_SETTLE_DURATION_MS + 80);
    }, STEP_BAR_SETTLE_DELAY_MS);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(settleTimer);
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [hasSession]);

  // Pricing plan selection modal
  const [showPricingPlan, setShowPricingPlan] = useState(false);
  React.useEffect(() => {
    if (showPricingPlan) {
      setEventRefreshKey((k) => k + 1);
    }
  }, [showPricingPlan]);
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
  const [paymentFailureWasAddon, setPaymentFailureWasAddon] = useState(false); // when payment fails, was it addon attempt?
  const [lastAddonCountForRetry, setLastAddonCountForRetry] = useState(1); // preserved for retry after addon payment failure
  // Message quota limit per plan – used for all plans (א–ו); same logic for blocking, balance panel, and addon modal
  const getPlanBaseLimit = React.useCallback((plan) => {
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
      case 'elite':
        return 650;
      case 'supreme':
        return 1000;
      case 'addon':
        return 100;
      default:
        return 50;
    }
  },[]);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const selectionSourceRef = useRef('manual');
  const planRetentionUntilRef = useRef(null);
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 640;

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

const planPersistenceRef = useRef(new Set());
const computePlanFromCapacity = React.useCallback((allowedGuestsValue, addonCountValue) => {
  const totalCapacity = typeof allowedGuestsValue === 'number' ? allowedGuestsValue : 0;
  const addonCount = Math.max(0, addonCountValue || 0);
  const addonUnit = getPlanBaseLimit('addon') || 100;
  const baseCapacity = Math.max(0, totalCapacity - addonCount * addonUnit);
  if (baseCapacity <= 0) return null;
  if (baseCapacity <= getPlanBaseLimit('basic')) return 'basic';
  if (baseCapacity <= getPlanBaseLimit('standard')) return 'standard';
  if (baseCapacity <= getPlanBaseLimit('premium')) return 'premium';
  if (baseCapacity <= getPlanBaseLimit('luxury')) return 'luxury';
  if (baseCapacity <= getPlanBaseLimit('elite')) return 'elite';
  return 'supreme';
}, [getPlanBaseLimit]);
const derivePlanFromRecord = React.useCallback((record) => {
  if (!record) return null;

  let detailsPlan = null;
  let detailsStatus = null;
  if (record.event_details) {
    try {
      const parsed =
        typeof record.event_details === 'string'
          ? JSON.parse(record.event_details)
          : record.event_details;
      if (parsed && typeof parsed === 'object') {
        if (parsed.pricing_plan && typeof parsed.pricing_plan === 'string') {
          detailsPlan = parsed.pricing_plan;
        }
        if (parsed.status && typeof parsed.status === 'string') {
          detailsStatus = parsed.status.toLowerCase();
        }
      }
    } catch (err) {
      console.warn('Failed to parse event_details while deriving plan', err);
    }
  }

  const dbPlan = record.selected_plan || null;
  if (dbPlan) {
    if (detailsPlan && typeof detailsPlan === 'string') {
      return detailsPlan;
    }
    const rawStatusForDbPlan = typeof record.status === 'string' ? record.status : detailsStatus;
    const normalizedStatusForDbPlan =
      typeof rawStatusForDbPlan === 'string' ? rawStatusForDbPlan.toLowerCase() : null;
    if (normalizedStatusForDbPlan && (normalizedStatusForDbPlan === 'draft' || normalizedStatusForDbPlan === 'pending' || normalizedStatusForDbPlan === 'pending_payment')) {
      return null;
    }
    return dbPlan;
  }

  if (detailsPlan) return detailsPlan;

  const rawStatus = typeof record.status === 'string' ? record.status : detailsStatus;
  const normalizedStatus = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : null;
  if (normalizedStatus === 'draft' || normalizedStatus === 'pending' || normalizedStatus === 'pending_payment') {
    return null;
  }

  const addonCount = parseNonNegativeInt(record.additional_packages);
  const allowedGuestsCoerced = parseNonNegativeInt(record.allowed_guests);
  const derivedPlan = computePlanFromCapacity(allowedGuestsCoerced, addonCount);
  if (derivedPlan && record.id && !planPersistenceRef.current.has(record.id)) {
    planPersistenceRef.current.add(record.id);
    supabase
      .from('events')
      .update({ selected_plan: derivedPlan })
      .eq('id', record.id)
      .then(({ error }) => {
        if (error) {
          console.error('Failed to persist derived selected_plan', error);
          planPersistenceRef.current.delete(record.id);
        }
      })
      .catch((persistError) => {
        console.error('Failed to persist derived selected_plan', persistError);
        planPersistenceRef.current.delete(record.id);
      });
  }
  return derivedPlan;
}, [computePlanFromCapacity]);
const [userPlanSettings, setUserPlanSettings] = useState({ plan: null, addonCount: 0 });
/** נכון אחרי ש־loadUserPlanSettings סיים (כולל שגיאה) — לא לאפס מסלול מ-localStorage לפני כן */
const userPlanSettingsHydratedRef = useRef(false);
const persistUserPlanSettings = React.useCallback(async (planCode, addonCount) => {
  try {
    const user = await resolveCurrentUserForSync();
    if (!user) return;
    const safePlan = planCode || null;
    const parsedAddon = Number(addonCount);
    const safeAddon = Number.isFinite(parsedAddon) ? Math.max(0, Math.floor(parsedAddon)) : 0;
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          plan_code: safePlan,
          addon_balance: safeAddon,
        },
        { onConflict: 'user_id' },
      );
    if (error) {
      console.error('persistUserPlanSettings failed', error);
      return;
    }
    setUserPlanSettings((prev) => {
      if (prev && prev.plan === safePlan && prev.addonCount === safeAddon) {
        return prev;
      }
      return { plan: safePlan, addonCount: safeAddon };
    });
    if (safePlan) {
      clearCarryPlanAfterManualDelete();
    }
    try { localStorage.setItem('user_plan_code', safePlan || ''); } catch (e) {}
    try { localStorage.setItem('additionalPackages_global', String(safeAddon)); } catch (e) {}
  } catch (err) {
    console.error('persistUserPlanSettings threw', err);
  }
}, []);
const loadUserPlanSettings = React.useCallback(async () => {
  const applyPlanToWizardUi = (planCode, addonBal) => {
    if (!planCode) return;
    const ac = Number.isFinite(addonBal) ? Math.max(0, Math.floor(addonBal)) : 0;
    setSelectedPlan(planCode);
    setDbAddonCount(ac);
    setAdditionalPackages((prev) => {
      const prevCount = Array.isArray(prev) ? prev.length : 0;
      if (prevCount === ac) return prev;
      return Array(ac).fill('addon');
    });
    try { localStorage.setItem('selectedPlan', planCode); } catch (e) {}
    try { localStorage.setItem('user_plan_code', planCode); } catch (e) {}
    try { localStorage.setItem('additionalPackages_global', String(ac)); } catch (e) {}
    selectionSourceRef.current = 'persistent';
  };
  try {
    const user = await resolveCurrentUserForSync();
    const userId = user?.id ?? sessionRef.current?.user?.id ?? null;
    if (!userId) {
      setUserPlanSettings((prev) => {
        if (prev && prev.plan === null && (prev.addonCount ?? 0) === 0) {
          return prev;
        }
        return { plan: null, addonCount: 0 };
      });
      setSelectedPlan(null);
      return { plan: null, addonCount: 0 };
    }
    const { data, error } = await supabase
      .from('user_settings')
      .select('plan_code, addon_balance')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('loadUserPlanSettings failed', error);
      return null;
    }
    if (!data) {
      selectionSourceRef.current = 'manual';
      setSelectedPlan(null);
      setDbAddonCount(0);
      setAdditionalPackages([]);
      try { localStorage.removeItem('selectedPlan'); } catch (e) {}
      try { localStorage.removeItem('user_plan_code'); } catch (e) {}
      try { localStorage.removeItem('additionalPackages_global'); } catch (e) {}
      setUserPlanSettings((prev) => {
        if (prev && prev.plan === null && (prev.addonCount ?? 0) === 0) {
          return prev;
        }
        return { plan: null, addonCount: 0 };
      });
      return { plan: null, addonCount: 0 };
    }
    let plan =
      typeof data.plan_code === 'string'
        ? data.plan_code.trim() || null
        : data.plan_code || null;
    const parsedAddon = Number(data.addon_balance);
    let addonCount = Number.isFinite(parsedAddon) ? Math.max(0, Math.floor(parsedAddon)) : 0;
    const settings = { plan, addonCount };
    setUserPlanSettings((prev) => {
      if (prev && prev.plan === settings.plan && (prev.addonCount ?? 0) === settings.addonCount) {
        return prev;
      }
      return settings;
    });
    if (plan) {
      applyPlanToWizardUi(plan, addonCount);
    } else {
      setSelectedPlan(null);
      setDbAddonCount(0);
      setAdditionalPackages([]);
      try { localStorage.removeItem('selectedPlan'); } catch (e) {}
      try { localStorage.removeItem('user_plan_code'); } catch (e) {}
      try { localStorage.removeItem('additionalPackages_global'); } catch (e) {}
    }
    if (plan) {
      try { localStorage.setItem('user_plan_code', plan); } catch (e) {}
      try { localStorage.setItem('additionalPackages_global', String(addonCount)); } catch (e) {}
    }
    selectionSourceRef.current = plan ? 'persistent' : 'manual';
    return settings;
  } catch (err) {
    console.error('loadUserPlanSettings threw', err);
    return null;
  } finally {
    userPlanSettingsHydratedRef.current = true;
  }
}, [persistUserPlanSettings]);
const [additionalPackages, setAdditionalPackages] = useState([]);
const [dbAddonCount, setDbAddonCount] = useState(null);
const [eventDataLoaded, setEventDataLoaded] = useState(false);
const [planLimitWarningError, setPlanLimitWarningError] = useState('');
const [planAddOnMode, setPlanAddOnMode] = useState(false);
const [planSelectionError, setPlanSelectionError] = useState('');
const [planWarningSuppressed, setPlanWarningSuppressed] = useState(false);
const [pricingActionAttempted, setPricingActionAttempted] = useState(false);
const [eventMessagesSentCount, setEventMessagesSentCount] = useState(0);
const [invitedGuestsCount, setInvitedGuestsCount] = useState(0);
const [currentEventId,setCurrentEventId]=useState(null);
const [eventRefreshKey, setEventRefreshKey] = useState(0);
/** מכסת הודעות כפי שנשמרה ב־DB (allowed_guests) — לזיהוי מסלול תצוגה כש־selected_plan חסר */
const [eventAllowedGuests, setEventAllowedGuests] = useState(null);

const progressStepSupportedRef = useRef(true);
const selectedPlanRef = useRef(selectedPlan);
useEffect(() => {
  selectedPlanRef.current = selectedPlan;
}, [selectedPlan]);

React.useEffect(() => {
  setPricingActionAttempted(false);
  if (showPricingPlan) {
    setPlanSelectionError('');
  }
}, [showPricingPlan]);

const userPlanSettingsRef = useRef(userPlanSettings);
useEffect(() => {
  userPlanSettingsRef.current = userPlanSettings;
}, [userPlanSettings]);
const planForDisplay = useMemo(() => {
    const normalizePlanToken = (raw) => {
      if (raw == null) return null;
      const s = String(raw).trim().toLowerCase();
      return s || null;
    };
    let fromState = normalizePlanToken(selectedPlan || userPlanSettings?.plan || null);
    if (fromState && CANONICAL_PLAN_CODES.has(fromState)) {
      return fromState;
    }

    const addonCount = Math.max(
      parseNonNegativeInt(dbAddonCount),
      Array.isArray(additionalPackages) ? additionalPackages.length : 0,
    );
    const addonUnit = getPlanBaseLimit('addon') || 100;

    if (typeof eventAllowedGuests === 'number' && eventAllowedGuests > 0) {
      const derived = computePlanFromCapacity(eventAllowedGuests, addonCount);
      if (derived) {
        return derived;
      }
    }

    // כיסוי מהמצב המקומי כשאין allowed_guests ב־state (למשל לפני סיום fetch) — כמו totalPlanCapacity
    if (addonCount > 0) {
      const baseCap = getPlanBaseLimit(selectedPlan || userPlanSettings?.plan || null);
      const syntheticTotal = baseCap + addonCount * addonUnit;
      const inferredLocal = computePlanFromCapacity(syntheticTotal, addonCount);
      if (inferredLocal) {
        return inferredLocal;
      }
    }

    if (!session) return null;
    return null;
  }, [
    session,
    selectedPlan,
    userPlanSettings?.plan,
    eventAllowedGuests,
    dbAddonCount,
    additionalPackages,
    computePlanFromCapacity,
    getPlanBaseLimit,
  ]);

const additionalPackagesRef = useRef(additionalPackages);
useEffect(() => {
  additionalPackagesRef.current = additionalPackages;
}, [additionalPackages]);

const lastRestoredEventIdRef = useRef(null);
const noEventLoggedRef = useRef(false);

  // Persist additionalPackages after currentEventId is known (see effect below).

  React.useEffect(() => {
    if (!session) {
      userPlanSettingsHydratedRef.current = false;
      setSelectedPlan(null);
      setEventAllowedGuests(null);
      setUserPlanSettings((prev) => {
        if (prev && prev.plan === null && (prev.addonCount ?? 0) === 0) {
          return prev;
        }
        return { plan: null, addonCount: 0 };
      });
      return;
    }
    loadUserPlanSettings();
  }, [session, loadUserPlanSettings]);

  React.useEffect(() => {
    if (currentEventId) return;
    if (!userPlanSettingsHydratedRef.current) return;
    let persistedPlan = userPlanSettings?.plan ?? null;
    let persistedAddonCount = Number.isFinite(userPlanSettings?.addonCount)
      ? Math.max(0, Math.floor(userPlanSettings.addonCount))
      : 0;

  if (persistedPlan) {
    setSelectedPlan(persistedPlan);
    setDbAddonCount(persistedAddonCount);
    setAdditionalPackages((prev) => {
      const prevCount = Array.isArray(prev) ? prev.length : 0;
      if (prevCount === persistedAddonCount) {
        return prev;
      }
      return Array(persistedAddonCount).fill('addon');
    });
    return;
  }

  setSelectedPlan(null);
  setDbAddonCount(0);
  setAdditionalPackages([]);
  try { localStorage.removeItem('selectedPlan'); } catch (_) {}
  try { localStorage.removeItem('user_plan_code'); } catch (_) {}
  try { localStorage.removeItem('additionalPackages_global'); } catch (_) {}
  }, [currentEventId, userPlanSettings, persistUserPlanSettings]);

const totalGuestsCount = guestSummary.adults + guestSummary.children;
// הודעות שנשלחו: מבוסס על ספירת הצלחות בפועל בלבד.
const invitedCountFromStatus =
  (guestStatusSummary?.approved ?? 0) + (guestStatusSummary?.rejected ?? 0) + (guestStatusSummary?.pending ?? 0);
const invitedCount = invitedCountFromStatus || invitedGuestsCount || 0;
const persistedMessagesSentCount = Number.isFinite(eventMessagesSentCount) ? eventMessagesSentCount : 0;
const effectiveMessagesSentCount = Math.max(persistedMessagesSentCount, invitedCountFromStatus || 0);
const addonCountForDisplay = Math.max(
  parseNonNegativeInt(dbAddonCount),
  parseNonNegativeInt(userPlanSettings?.addonCount),
  Array.isArray(additionalPackages) ? additionalPackages.length : 0,
);

  React.useEffect(() => {
    if (!showPricingPlan) {
      if (planWarningSuppressed && eventDataLoaded) {
        const baseLimit = getPlanBaseLimit(selectedPlan || planForDisplay || userPlanSettings?.plan || null);
        const extraCapacity = addonCountForDisplay * (getPlanBaseLimit('addon') || 100);
        const totalLimit = (baseLimit || 0) + extraCapacity;
        if (effectiveMessagesSentCount > totalLimit) {
          setPendingAddonCount(1);
          setShowPlanLimitWarning(true);
        }
        setPlanWarningSuppressed(false);
      }
      setPlanSelectionError('');
    }
  }, [showPricingPlan, planWarningSuppressed, effectiveMessagesSentCount, selectedPlan, planForDisplay, userPlanSettings?.plan, addonCountForDisplay, getPlanBaseLimit, eventDataLoaded]);

  React.useEffect(() => {
    if (showEventTypes) {
      setHasClearedExistingEvent(false);
    }
  }, [showEventTypes]);

const basePlanLimit = getPlanBaseLimit(selectedPlan || planForDisplay || userPlanSettings?.plan || null);
const additionalCapacity = addonCountForDisplay * (getPlanBaseLimit('addon') || 100);
const totalPlanCapacity = (basePlanLimit || 0) + additionalCapacity;
const basePlanOverCapacity = basePlanLimit ? effectiveMessagesSentCount > basePlanLimit : false;
const displayPlanCode =
  planForDisplay ||
  computePlanFromCapacity(Math.max(0, totalPlanCapacity), addonCountForDisplay) ||
  null;
const activePlanDescription =
  displayPlanCode === 'basic' || displayPlanCode === 'free'
    ? 'מסלול א - ₪1 לאירועים קטנים עם כל הפיצ\'רים הבסיסיים'
    : displayPlanCode === 'standard'
      ? 'מסלול ב - מקצועי עם תמיכה מלאה ועיצובים מתקדמים'
      : displayPlanCode === 'premium'
        ? 'מסלול ג - כולל את כל הפיצ\'רים ותמיכה 24/7'
        : displayPlanCode === 'luxury'
          ? 'מסלול ד - מתאים לאירועים גדולים מאוד עם יכולות מתקדמות'
          : displayPlanCode === 'elite'
            ? 'מסלול ה - מעטפת מלאה לאירועים ענקיים'
            : displayPlanCode === 'supreme'
              ? ''
              : '';
const additionalPackageCounts = React.useMemo(() => {
  const counts = additionalPackages.reduce((acc, planId) => {
    acc[planId] = (acc[planId] || 0) + 1;
    return acc;
  }, {});
  if (addonCountForDisplay > 0) {
    counts.addon = Math.max(counts.addon || 0, addonCountForDisplay);
  }
  return counts;
}, [additionalPackages, addonCountForDisplay]);
const canRenderCharts = Boolean(currentEventId && eventDataLoaded);
const [chartsReady, setChartsReady] = useState(false);
useEffect(() => {
  if (!canRenderCharts) {
    setChartsReady(false);
    return;
  }
  let cancelled = false;
  const raf = requestAnimationFrame(() => {
    if (!cancelled) {
      setChartsReady(true);
    }
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}, [canRenderCharts, currentEventId]);
const shouldShowCharts = canRenderCharts && chartsReady;
const shouldShowWhatsAppGroupUpdateButton = Boolean(currentEventId && (hasWhatsAppGroup || eventDataLoaded));

  /** נתוני גרף יתרת הודעות — useMemo כדי שלא ייווצר מערך חדש בכל רינדור (Recharts + הבהוב) */
  const messageCapacityChartModel = React.useMemo(() => {
    if (!displayPlanCode && !currentEventId) return null;
    const messagesSent = effectiveMessagesSentCount;
    const basePlanLimitForDisplay = getPlanBaseLimit(displayPlanCode);
    const messageLimit = (basePlanLimitForDisplay || 0) + additionalCapacity;
    const remainingMessagesRaw = messageLimit - messagesSent;
    const remainingMessages = Math.max(0, remainingMessagesRaw);
    const overMessages = remainingMessagesRaw < 0 ? Math.abs(remainingMessagesRaw) : 0;
    const capacityChartData = [
      { key: 'limit', name: 'מגבלה', value: messageLimit, color: '#facc15' },
      { key: 'sent', name: 'נשלחו', value: messagesSent, color: '#7c3aed' },
      {
        key: overMessages > 0 ? 'over' : 'remaining',
        name: overMessages > 0 ? 'חריגה' : 'יתרה',
        value: overMessages > 0 ? overMessages : remainingMessages,
        color: overMessages > 0 ? '#dc2626' : '#22c55e',
      },
    ];
    const hasCapacityChartData = capacityChartData.some(
      (item) => Number.isFinite(item.value) && item.value > 0,
    );
    return {
      capacityChartData,
      hasCapacityChartData,
      messagesSent,
      messageLimit,
      remainingMessages,
      overMessages,
    };
  }, [
    displayPlanCode,
    currentEventId,
    effectiveMessagesSentCount,
    additionalCapacity,
    isMobileView,
    getPlanBaseLimit,
  ]);

  const renderCapacityLabel = React.useCallback(
    ({ x, y, width, height, value, index }) => {
      if (!messageCapacityChartModel || value === undefined || value === null) return null;
      const { capacityChartData } = messageCapacityChartModel;
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
          {...getContainedChartNumberProps(value, width)}
        >
          {value}
        </text>
      );
    },
    [messageCapacityChartModel],
  );

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
  setPlanSelectionError('');
  setPricingActionAttempted(false);
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
  const [designMobileTab, setDesignMobileTab] = useState('templates');
  const [showCountModal, setShowCountModal] = useState(false);
  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [countError, setCountError] = useState('');
  const [countSubmitAttempted, setCountSubmitAttempted] = useState(false);
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

  React.useEffect(() => {
    setCountSubmitAttempted(false);
    if (showCountModal) {
      setCountError('');
    }
  }, [showCountModal]);

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
    setEventDetailsSubmitAttempted(true);
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
    // פורמט תאריך קצר להזמנות: DD.M.YY (למשל 11.3.26)
    const formatShortDate = (isoDate) => {
      if (!isoDate) return '';
      const [year, month, day] = isoDate.split('-');
      const yy = year.slice(-2);
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      return `${d}.${m}.${yy}`;
    };

    const handleSendInvitation = async () => {
      setGuestSubmitAttempted(true);
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

    const normalizedPhone = normalizePhoneNumber(guestData.guestPhone);
    if (!normalizedPhone) {
      setGuestErrors({ guestPhone: true });
      setGuestErrorMsg('מספר טלפון לא תקין – לא ניתן לקבוע קידומת 972.');
      return;
    }


    // Attempt to save guest to Supabase (optional – will work only if table exists)
    let newGuestRecord = null;
    try {
      const user = await resolveCurrentUserForSync();
      if (!user) {
        setGuestErrorMsg('יש להתחבר כדי לשלוח הזמנות');
        return;
      }

      // Block sending when over message quota (same limit for all plans; effective = sync with status panel)
      const totalLimitForSend =
        (getPlanBaseLimit(selectedPlan || planForDisplay || userPlanSettings?.plan || null) || 0) +
        addonCountForDisplay * (getPlanBaseLimit('addon') || 100);
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
        .or('status.neq.archived,status.is.null')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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
            phone: normalizedPhone,
            email: null,
            total_guests: 1,
            adults: 1,
            table_number: guestData.guestTable.trim(),
          },
        ])
        .select()
        .single();
      if (error) throw error;
      newGuestRecord = newGuest;
      if (eventIdForInvite) {
        setInvitedGuestsCount((prev) => prev + 1);
      }

      const baseUrl = getInviteBaseUrl();
      const inviteLink = `${baseUrl}/${eventIdForInvite}/${newGuestRecord.id}`;

      // Dev helper: log the RSVP link so it can be copied from the browser console
      if (process.env.NODE_ENV !== 'production') {
        console.log('RSVP link:', inviteLink);
      }

      // Send via Green API only. Do not use browser share here because it cannot confirm provider acceptance.
      try {
        // #region agent log
        fetch('http://127.0.0.1:7780/ingest/b5f4ac25-b263-42d9-8749-29626868bbeb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dcd254'},body:JSON.stringify({sessionId:'dcd254',runId:'initial',hypothesisId:'H3',location:'components/StepButtons.js:1103',message:'Single guest WhatsApp send invoked',data:{eventIdForInvite,guestId:newGuestRecord.id},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const apiResult = await sendWhatsAppInviteViaApi({
          eventId: eventIdForInvite,
          guestIds: newGuestRecord?.id ? [newGuestRecord.id] : [],
        });

        setIsSendingInvitation(false);

        if (apiResult.ok) {
          const results = apiResult.payload?.results || [];
          const success = results.some((r) => r.ok);
          if (success) {
            await supabase
              .from('invited_guests')
              .update({ invitation_channel: 'whatsapp' })
              .eq('id', newGuestRecord.id);
            setGuestSummaryRefreshKey((key) => key + 1);
            setSentGuests((prev) => [
              ...prev,
              {
                guestId: newGuestRecord.id,
                guestFirstName: guestData.guestFirstName,
                guestLastName: guestData.guestLastName,
                guestPhone: normalizedPhone,
                guestPhoneOriginal: guestData.guestPhone,
                guestTable: guestData.guestTable,
                channel: 'whatsapp',
              },
            ]);
          }
          setInvitationSent(true);
          setInvitationResult({
            type: 'success',
            message: 'ההזמנה נשלחה בהצלחה בוואטסאפ!',
          });
        } else {
          const failureEntry = Array.isArray(apiResult.payload?.failed) && apiResult.payload.failed.length > 0 ? apiResult.payload.failed[0] : null;
          const errMsg =
            apiResult.payload?.error ||
            apiResult.payload?.message ||
            failureEntry?.error?.message ||
            (typeof failureEntry?.error === 'string' ? failureEntry.error : null) ||
            apiResult.error?.message ||
            'אירעה שגיאה בשליחת ההזמנה בוואטסאפ.';
          if (newGuestRecord?.id) {
            await cleanupGuestsAfterFailedSend([newGuestRecord.id]);
          }
          setInvitationSent(false);
          setInvitationResult({
            type: 'error',
            message: errMsg,
          });
        }
        setShowInvitationResultModal(true);
      } catch (err) {
        console.error('Failed to send invitation:', err);
        setIsSendingInvitation(false);
        if (newGuestRecord?.id) {
          await cleanupGuestsAfterFailedSend([newGuestRecord.id]);
        }
        setInvitationSent(false);
        setInvitationResult({ 
          type: 'error', 
          message: 'אירעה שגיאה בשליחת ההזמנה.' 
        });
        setShowInvitationResultModal(true);
      }
    } catch (err) {
      console.error('Failed to send invitation:', err);
      if (newGuestRecord?.id) {
        await cleanupGuestsAfterFailedSend([newGuestRecord.id]);
      }
      setInvitationSent(false);
      setInvitationResult({ 
        type: 'error', 
        message: 'אירעה שגיאה בשליחת ההזמנה.' 
      });
      setShowInvitationResultModal(true);
    }
  };

  // Quick SMS sender – opens default SMS app with pre-filled text (mobile browsers)
  const handleSendInvitationSms = async () => {
    setGuestSubmitAttempted(true);
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
      const user = await resolveCurrentUserForSync();
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
        .or('status.neq.archived,status.is.null')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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

      const baseUrl = getInviteBaseUrl();
      const inviteLink = `${baseUrl}/${eventIdForInvite}/${newGuest.id}`;

      // Send SMS via API - check message quota first (effective = sync with status panel)
      const totalLimitSms =
        (getPlanBaseLimit(selectedPlan || planForDisplay || userPlanSettings?.plan || null) || 0) +
        addonCountForDisplay * (getPlanBaseLimit('addon') || 100);
      if (totalLimitSms > 0 && effectiveMessagesSentCount >= totalLimitSms) {
        setInvitationResult({ type: 'error', message: 'אין מספיק הודעות במכסה. נא לרכוש חבילת הרחבה.' });
        setShowInvitationResultModal(true);
        setPendingAddonCount(1);
        setShowPlanLimitWarning(true);
        setPlanAddOnMode(true);
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
              id: newGuest.id,
              phone: guestData.guestPhone,
              firstName: guestData.guestFirstName,
              lastName: guestData.guestLastName,
              inviteLink: inviteLink,
            }],
            message: smsMessage,
            eventId: eventIdForInvite || null,
          }),
        });

        let smsResult = {};
        try {
          const text = await smsResponse.text();
          if (text && text.trim().startsWith('{')) smsResult = JSON.parse(text);
        } catch (parseErr) {
          console.error('SMS response parse error:', parseErr);
        }

        if (smsResult.success && smsResult.sent > 0) {
          await supabase
            .from('invited_guests')
            .update({ invitation_channel: 'sms' })
            .eq('id', newGuest.id);
          setGuestSummaryRefreshKey((key) => key + 1);
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
    { key: 'assistant', label: 'Assistant',          css: "'Assistant', sans-serif" },
    { key: 'heebo',     label: 'Heebo',               css: "'Heebo', sans-serif" },
    { key: 'secular',   label: 'Secular One',         css: "'Secular One', sans-serif" },
    { key: 'rubik',     label: 'Rubik',               css: "'Rubik', sans-serif" },
    { key: 'noto',      label: 'Noto Sans Hebrew',    css: "'Noto Sans Hebrew', sans-serif" },
    { key: 'frank',     label: 'Frank Ruhl Libre',    css: "'Frank Ruhl Libre', serif" },
    { key: 'varela',    label: 'Varela Round',        css: "'Varela Round', sans-serif" },
    { key: 'alef',      label: 'Alef',                css: "'Alef', sans-serif" },
    { key: 'suez',      label: 'Suez One',            css: "'Suez One', serif" },
    { key: 'gveret',    label: 'Gveret Levin — כתב יד', css: "'Gveret Levin', cursive" },
  ];
  const [selectedFontKey, setSelectedFontKey] = useState('assistant');
  const selectedFontCss = fontsOptions.find(f=>f.key===selectedFontKey)?.css;
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [uploadingInvite, setUploadingInvite] = useState(false);

  // ---------- Invitation text templates ----------
  const invitationTemplates = {
    'חתונה': (d) => `${d.brideName} ו${d.groomName} מתחתנים\n\nשמחים להזמינכם לחגוג עמנו את יום הנישואין\nביום ${getDayOfWeekHebrew(d.date)} ${formatShortDate(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}\nהחופה תתקיים בשעה ${d.chuppahTime}\n\nהורי הכלה: ${d.brideParents}\nהורי החתן: ${d.groomParents}`,
    'חינה': (d) => `${d.brideParents} ובתם ${d.brideName} יחד עם ${d.groomParents} ובנם ${d.groomName}\nמזמינים אתכם לחגוג עמנו בחינה\nביום ${getDayOfWeekHebrew(d.date)} ${formatShortDate(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'מסיבת אירוסין': (d) => `של ${d.brideName} ו${d.groomName}\nשמחים להזמינכם למסיבת האירוסין שלנו\nביום ${getDayOfWeekHebrew(d.date)} ${formatShortDate(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'הפרשת חלה': (d) => `${d.hostName}\nמזמינה אתכן לטקס הפרשת חלה מרגש\nביום ${getDayOfWeekHebrew(d.date)} ${formatShortDate(d.date)} בשעה ${d.time}\nב${d.hallName}, ${d.hallAddress}`,
    'בר מצווה': (d)=> `אנו, ${d.boyParents},\nמזמינים אתכם לחגוג עמנו את בר המצווה של בננו ${d.boyName}\nביום ${getDayOfWeekHebrew(d.date)} ${formatShortDate(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'בת מצווה': (d)=> `אנו, ${d.girlParents},\nמזמינים אתכם לחגוג עמנו את בת המצווה של בתנו ${d.girlName}\nביום ${getDayOfWeekHebrew(d.date)} ${formatShortDate(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'ברית': (d)=> `אנו, ${d.babyParents},\nשמחים להזמינכם לברית בננו\nביום ${getDayOfWeekHebrew(d.date)} ${formatShortDate(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'בריתה': (d)=> `אנו, ${d.babyParents},\nשמחים להזמינכם לבריתה בתנו\nביום ${getDayOfWeekHebrew(d.date)} ${formatShortDate(d.date)} בשעה ${d.time}\nבאולם ${d.hallName}, ${d.hallAddress}`,
    'יום הולדת': (d)=> `את/ה מוזמנ/ת לחגוג עם ${d.birthdayName}\nיום הולדתו ה- ${d.birthdayAge}\nביום ${getDayOfWeekHebrew(d.date)} ${formatShortDate(d.date)} בשעה ${d.time}\nב-${d.hallName}, ${d.hallAddress}`,
    'אירוע עסקי': (d)=> `חברת ${d.businessName} (${d.businessContact})\nמתכבדת להזמינך לאירוע העסקי שלנו\nביום ${getDayOfWeekHebrew(d.date)} ${formatShortDate(d.date)} בשעה ${d.time}\nב-${d.hallName}, ${d.hallAddress}`,
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

  // ברירת מחדל לכל סוגי האירועים: שורה ראשונה (שמות/כותרת) גדולה ומודגשת – גם בנייד
  const defaultFirstLineStyle = { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: 'black' };
  const defaultOtherLineStyle = { fontSize: 16, fontWeight: 'normal', textAlign: 'center', color: 'black', lineHeight: 1.5, letterSpacing: 0, textDecoration: 'none', fontStyle: 'normal' };
  const getDefaultStyleForRow = (index) => index === 0 ? { ...defaultFirstLineStyle } : { ...defaultOtherLineStyle };
  const getEffectiveLineStyle = (index) => {
    const style = lineStyles[index] || {};
    const def = getDefaultStyleForRow(index);
    return { ...def, ...style };
  };
  const getDarkThemePreviewColor = (color) => {
    if (!color || color === 'black' || color === '#000000') return '#f8fafc';
    return color;
  };

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
    crimson: 'bg-red-600',
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
        const lines = (invitationTextDefault || '').split('\n');
        const defaultStyles = {};
        lines.forEach((_, i) => {
          if (i === 0) {
            defaultStyles[i] = { ...defaultFirstLineStyle };
          } else if (i === 2) {
            defaultStyles[i] = { fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: 'black' };
          } else if (i === 3) {
            defaultStyles[i] = { fontSize: 17, fontWeight: 'bold', textAlign: 'center', color: 'black' };
          } else {
            defaultStyles[i] = { fontSize: 16, textAlign: 'center', color: 'black' };
          }
        });
        setLineStyles(defaultStyles);
      }
    }
  }, [showDesignChooser, invitationTextDefault, customInvitationText, selectedEventType]);

  React.useEffect(()=>{
    (async () => {
      try {
        const user = await resolveCurrentUserForSync();
        if (!user) return;
        const { data, error } = await supabase
          .from('events')
          .select('id, event_type, event_details, invitation_path, status, allowed_guests')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const clearEventDetails = () => {
          setSelectedEventType('');
          setFormData(() => ({ ...initialFormState }));
          setEventDetailsCompleted(false);
          setSelectedDesign(null);
          setInvitationSent(false);
          setRsvpConfirmed(false);
          setShowGuestForm(false);
          setShowReportsOptions(false);
          setStepErrorMsg('');
          setErrorMsg('');
          setFinishedSteps([]);
          setCurrentEventId(null);
          lastRestoredEventIdRef.current = null;
          noEventLoggedRef.current = false;
          setEventDataLoaded(false);
          setEventAllowedGuests(null);
          setGuestSummary({ approved: 0, adults: 0, children: 0 });
          resetCapacityWarningGuests();
          setGuestStatusSummary({ approved: 0, rejected: 0, pending: 0 });
          setSpecialMealsSummary({
            veg: { adults: 0, children: 0, total: 0 },
            vegan: { adults: 0, children: 0, total: 0 },
            glatt: { adults: 0, children: 0, total: 0 },
            allergy: { adults: 0, children: 0, total: 0 },
          });
          setDbGuests([]);
          setSentGuests([]);
          setReportGuests([]);
          setApprovedGuests([]);
          setRejectedGuests([]);
          setPendingGuests([]);
          setShowGuestListModal(false);
          setShowReportModal(false);
          setSelectedEventForReport(null);
          setInvitedGuestsCount(0);
          setEventMessagesSentCount(0);
          setNewEventStarted(false);
          try {
            localStorage.removeItem('savedEventDetails');
            localStorage.removeItem('selectedEventType');
            localStorage.removeItem('selectedDesign');
            localStorage.removeItem('draftEvent');
            localStorage.removeItem('finishedSteps');
            localStorage.removeItem('newEventStarted');
          } catch (_) {}
        };

        if (error || !data) {
          clearEventDetails();
          return;
        }

        const details = data.event_details || {};
        const rawDate =
          details?.date ||
          details?.event_date ||
          details?.start_datetime ||
          details?.end_datetime ||
          null;
        const retentionDate = computePlanRetentionDate(rawDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isArchived = data.status === 'archived';
        const isPastEvent =
          retentionDate ? today >= retentionDate : false;

        if (isArchived || isPastEvent) {
          clearEventDetails();
          return;
        }

        setCurrentEventId(data.id);
        const capFromRow = parseNonNegativeInt(data?.allowed_guests);
        setEventAllowedGuests(capFromRow > 0 ? capFromRow : null);
        setSelectedEventType(data.event_type || '');
        syncFinishedStepsFromEvent(data.event_type || '', details || {});
        setFormData((prev)=>({ ...prev, ...(details || {}) }));
        if (details && Object.keys(details).length) {
          setEventDetailsCompleted(true);
          markStepDone(1);
        }
        try { localStorage.setItem('savedEventDetails', JSON.stringify(details || {})); } catch(e){}
      } catch (err) {
        console.error('Failed to restore latest event details', err);
      }
    })();
  }, [eventRefreshKey, resetCapacityWarningGuests, syncFinishedStepsFromEvent]);

  // restore details
  React.useEffect(()=>{
    if(!finishedSteps.includes(1)) return;
    if(formDataHasMeaningfulValues) return;
    try{
      const raw = localStorage.getItem('savedEventDetails');
      const saved = (raw && typeof raw === 'string' && raw.trim().startsWith('{')) ? JSON.parse(raw) : {};
      if (saved && typeof saved === 'object' && Object.keys(saved).length) setFormData(saved);
    }catch{}
  },[finishedSteps]);

  // Restore selected event type from localStorage if Supabase didn't set it
  // Removed useEffect that was loading selectedEventType from localStorage on page load
  // This ensures clean state on initial page load

  // ניתן לאפס newEventStarted רק כאשר האירוע נסגר לארכיון, לכן לא מנקים אוטומטית עם selectedEventType ריק.

  // Helper function to check if there's an active event
  const hasActiveEvent = () => {
    return Boolean(currentEventId);
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
    openSendStep: () => {
      const mustStartFirst = !currentEventId && !newEventStarted && !planForDisplay;
      if (mustStartFirst) {
        setStepErrorMsg('\u05D9\u05E9 \u05EA\u05D7\u05D9\u05DC\u05D4 \u05DC\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D5\u05DC\u05D1\u05D7\u05D5\u05E8 \u05DE\u05E1\u05DC\u05D5\u05DC \u05EA\u05E9\u05DC\u05D5\u05DD.');
        setShowStepError(true);
        return;
      }
      setShowGuestForm(true);
      setStepErrorMsg('');
    },
    openReportsStep: () => {
      setShowReportsOptions(true);
      setShowGuestListModal(false);
      setStepErrorMsg('');
    },
    createNewEvent: async () => {
      try {
        setSelectedFlowStep(null);
        let hasSession = !!sessionRef.current;
        if (!hasSession) {
          const user = await resolveCurrentUserForSync();
          hasSession = !!user;
        }
        if (!hasSession) {
          setShowPricingPlan(true);
          setPlanAddOnMode(false);
          return;
        }
        setStepErrorMsg('');
        const hasActive = await checkActiveEventExists();
        if (hasActive) {
          setShowExistingEventWarning(true);
          return;
        }
        const planReady = selectedPlanRef.current || userPlanSettingsRef.current?.plan;
        if (!planReady) {
          setShowPricingPlan(true);
          setPlanAddOnMode(false);
          return;
        }
        await handleNewEvent();
      } catch (err) {
        console.error('createNewEvent error', err);
        setShowPricingPlan(true);
        setPlanAddOnMode(false);
      }
    },
  }));

  const sendWhatsAppInviteViaApi = useCallback(async ({ eventId, guestIds }) => {
    // #region agent log
    fetch('http://127.0.0.1:7780/ingest/b5f4ac25-b263-42d9-8749-29626868bbeb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dcd254'},body:JSON.stringify({sessionId:'dcd254',runId:'initial',hypothesisId:'H2',location:'components/StepButtons.js:1686',message:'sendWhatsAppInviteViaApi entry',data:{eventId,guestIdsLength:Array.isArray(guestIds)?guestIds.length:null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!eventId) {
      addToast?.('לא ניתן לשלוח הודעת וואטסאפ לפני שמירת האירוע', 'error');
      return { ok: false, reason: 'missing_event' };
    }

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const accessToken = authSession?.access_token || null;
      if (!accessToken) {
        addToast?.('חיבור המשתמש פג. התחבר מחדש כדי לשלוח וואטסאפ.', 'error');
        return { ok: false, reason: 'missing_auth' };
      }
      const response = await fetch('/api/greenapi/send-event-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ eventId, guestIds }),
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch (err) {
        // ignore
      }

      // #region agent log
      fetch('http://127.0.0.1:7780/ingest/b5f4ac25-b263-42d9-8749-29626868bbeb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dcd254'},body:JSON.stringify({sessionId:'dcd254',runId:'initial',hypothesisId:'H2',location:'components/StepButtons.js:1706',message:'sendWhatsAppInviteViaApi response',data:{status:response.status,ok:response.ok,sent:payload?.sent||0,failedCount:Array.isArray(payload?.failed)?payload.failed.length:null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      const updatedCount = typeof payload?.updatedMessagesSentCount === 'number'
        ? payload.updatedMessagesSentCount
        : null;
      if (updatedCount !== null) {
        setEventMessagesSentCount(updatedCount);
      }

      const queuedCount = Number(payload?.queued ?? payload?.sent ?? 0);
      if (response.ok) {
        if (queuedCount > 0) {
          if (updatedCount === null) {
            setEventMessagesSentCount((prev) => (prev || 0) + queuedCount);
          }
          return { ok: true, payload };
        }

        const failureDetails = Array.isArray(payload.failed) && payload.failed.length > 0 ? payload.failed[0] : null;
        const failureMessage =
          payload.message ||
          failureDetails?.error?.message ||
          (typeof failureDetails?.error === 'string' ? failureDetails.error : null) ||
          'לא נמצאו מספרי וואטסאפ תקינים לשליחה';
        addToast?.(failureMessage, 'info');
        return { ok: false, payload };
      }

      addToast?.(payload.error || 'שליחת הודעת וואטסאפ נכשלה', 'error');
      return { ok: false, payload };
    } catch (err) {
      console.error('Failed to send WhatsApp invite via API', err);
      addToast?.('שליחת הודעת וואטסאפ נכשלה', 'error');
      return { ok: false, error: err };
    }
  }, [addToast]);

  const buildDefaultWhatsAppGroupName = useCallback(() => {
    const values = [
      formData?.brideName && formData?.groomName ? `${formData.brideName} ו${formData.groomName}` : '',
      formData?.birthdayName,
      formData?.businessName,
      formData?.hostName,
      selectedEventType,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    return `קבוצת וואטסאפ - ${values[0] || 'אירוע'}`;
  }, [formData, selectedEventType]);

  const openWhatsAppGroupModal = useCallback(async ({ eventId: explicitEventId = null, guestIds = null } = {}) => {
    const eventId = explicitEventId || currentEventId;
    if (!eventId) {
      setInvitationResult({
        type: 'error',
        message: 'לא ניתן ליצור קבוצת וואטסאפ לפני שמירת האירוע.',
      });
      setShowInvitationResultModal(true);
      return;
    }

    const normalizedGuestIds = Array.isArray(guestIds) && guestIds.length > 0
      ? guestIds.filter(Boolean)
      : null;

    let guestCount = normalizedGuestIds?.length || 0;
    if (!guestCount) {
      try {
        const { count, error } = await supabase
          .from('invited_guests')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId);
        if (!error) {
          guestCount = count || 0;
        }
      } catch (err) {
        console.warn('Failed to count guests for WhatsApp group', err);
      }
    }

    setWhatsAppGroupGuestIds(normalizedGuestIds);
    setWhatsAppGroupEventId(eventId);
    setWhatsAppGroupGuestCount(guestCount);
    setWhatsAppGroupName((prev) => prev || buildDefaultWhatsAppGroupName());
    setShowWhatsAppGroupModal(true);
  }, [buildDefaultWhatsAppGroupName, currentEventId]);

  const getWhatsAppGroupFailureReason = (entry) => {
    const rawReason =
      entry?.error?.message ||
      entry?.error ||
      entry?.data?.message ||
      entry?.data?.error ||
      entry?.data?.reason ||
      entry?.status ||
      'סיבה לא ידועה';

    return typeof rawReason === 'string' ? rawReason : JSON.stringify(rawReason);
  };

  const formatWhatsAppGroupFailureDetails = (failedEntries = []) => {
    if (!Array.isArray(failedEntries) || failedEntries.length === 0) return '';

    const maxDetails = 10;
    const detailLines = failedEntries.slice(0, maxDetails).map((entry, index) => {
      const guestName = [entry?.firstName, entry?.lastName].filter(Boolean).join(' ').trim() || `אורח ${index + 1}`;
      const phone = entry?.phoneOriginal || entry?.phoneNormalized || entry?.participantChatId || '';
      const reason = getWhatsAppGroupFailureReason(entry);
      const status = entry?.status ? ` | סטטוס: ${entry.status}` : '';
      const phoneText = phone ? ` | טלפון: ${phone}` : '';

      return `${index + 1}. ${guestName}${phoneText} | סיבה: ${reason}${status}`;
    });

    const remaining = failedEntries.length > maxDetails
      ? `\nועוד ${failedEntries.length - maxDetails} כשלים נוספים.`
      : '';

    return `\n\nפירוט הכשלים:\n${detailLines.join('\n')}${remaining}`;
  };

  const handleCreateWhatsAppGroup = useCallback(async () => {
    const eventIdForGroup = whatsAppGroupEventId || currentEventId;
    if (!eventIdForGroup) {
      setShowWhatsAppGroupModal(false);
      setInvitationResult({
        type: 'error',
        message: 'לא נמצא אירוע פעיל ליצירת קבוצת וואטסאפ.',
      });
      setShowInvitationResultModal(true);
      return;
    }

    const cleanGroupName = whatsAppGroupName.trim() || buildDefaultWhatsAppGroupName();
    if (!cleanGroupName) {
      addToast?.('יש להזין שם לקבוצת הוואטסאפ.', 'error');
      return;
    }

    setIsWhatsAppGroupSubmitting(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const accessToken = authSession?.access_token || null;
      if (!accessToken) {
        throw new Error('חיבור המשתמש פג. התחבר מחדש כדי ליצור קבוצת וואטסאפ.');
      }

      const response = await fetch('/api/greenapi/create-event-group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          eventId: eventIdForGroup,
          groupName: cleanGroupName,
          guestIds: whatsAppGroupGuestIds || undefined,
        }),
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch (err) {
        // ignore empty response
      }

      if (!response.ok) {
        const failureDetails = formatWhatsAppGroupFailureDetails(payload.failed);
        throw new Error(`${payload.error || `שגיאת שרת ${response.status}`}${failureDetails}`);
      }

      const failedCount = Array.isArray(payload.failed) ? payload.failed.length : 0;
      const added = Number(payload.added || 0);
      const total = Number(payload.total || added + failedCount);
      const duplicateSkippedCount = Array.isArray(payload.duplicateSkipped)
        ? payload.duplicateSkipped.length
        : 0;
      const linkText = payload.groupInviteLink ? `\nקישור קבוצה: ${payload.groupInviteLink}` : '';
      const duplicateText = duplicateSkippedCount > 0
        ? ` ${duplicateSkippedCount} אורחים דולגו כי מספר הטלפון שלהם מופיע יותר מפעם אחת.`
        : '';
      const persistenceText = payload.metadataPersisted === false
        ? '\nשים לב: פרטי הקבוצה לא נשמרו במסד הנתונים.'
        : '';
      const failureDetails = formatWhatsAppGroupFailureDetails(payload.failed);

      setShowWhatsAppGroupModal(false);
      setInvitationResult({
        type: failedCount > 0 ? 'warning' : 'success',
        message:
          `${payload.created ? 'קבוצת הוואטסאפ נוצרה' : 'קבוצת הוואטסאפ עודכנה'}: ` +
          `${added} מתוך ${total} אורחים נוספו/נשלחו להוספה.${failedCount > 0 ? ` ${failedCount} נכשלו.` : ''}` +
          duplicateText +
          failureDetails +
          linkText +
          persistenceText,
      });
      setShowInvitationResultModal(true);
      setWhatsAppGroupName(cleanGroupName);
      if (payload.groupId) {
        setHasWhatsAppGroup(true);
      }
    } catch (err) {
      console.error('Failed to create WhatsApp group', err);
      setInvitationResult({
        type: 'error',
        message: err?.message || 'אירעה שגיאה ביצירת קבוצת הוואטסאפ.',
      });
      setShowInvitationResultModal(true);
    } finally {
      setIsWhatsAppGroupSubmitting(false);
    }
  }, [
    addToast,
    buildDefaultWhatsAppGroupName,
    currentEventId,
    formatWhatsAppGroupFailureDetails,
    whatsAppGroupEventId,
    whatsAppGroupGuestIds,
    whatsAppGroupName,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!currentEventId) {
      setHasWhatsAppGroup(false);
      return undefined;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('whatsapp_group_id, event_details')
          .eq('id', currentEventId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          const errorText = `${error.message || ''} ${error.details || ''}`.toLowerCase();
          if (error.code === '42703' || errorText.includes('whatsapp_group_id')) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('events')
              .select('event_details')
              .eq('id', currentEventId)
              .maybeSingle();

            if (!cancelled && !fallbackError) {
              const fallbackDetails =
                typeof fallbackData?.event_details === 'string'
                  ? JSON.parse(fallbackData.event_details || '{}')
                  : fallbackData?.event_details || {};
              setHasWhatsAppGroup(Boolean(String(fallbackDetails?.whatsapp_group?.groupId || '').trim()));
            } else if (!cancelled) {
              setHasWhatsAppGroup(false);
            }
            return;
          }
          console.warn('Failed to load WhatsApp group metadata', error);
          return;
        }

        const details =
          typeof data?.event_details === 'string'
            ? JSON.parse(data.event_details || '{}')
            : data?.event_details || {};
        const groupId = data?.whatsapp_group_id || details?.whatsapp_group?.groupId || '';
        if (String(groupId || '').trim()) {
          setHasWhatsAppGroup(true);
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          setHasWhatsAppGroup(false);
          return;
        }

        const response = await fetch(`/api/greenapi/event-group-status?eventId=${encodeURIComponent(currentEventId)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (!cancelled) {
          setHasWhatsAppGroup(Boolean(response.ok && payload?.hasGroup));
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to load WhatsApp group metadata', err);
          setHasWhatsAppGroup(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentEventId]);

  // designFile is the stored image file name in storage (or null). templateSrc is the relative path of template image chosen
  const saveEventToSupabase = async (designFile, templateSrc) => {
    try {
      const user = await resolveCurrentUserForSync();
      if (!user?.id) {
        setStepErrorMsg('יש להתחבר כדי לשמור ולסנכרן את האירוע בין מכשירים.');
        addToast?.('יש להתחבר כדי לשמור ולסנכרן את האירוע בין מכשירים.', 'error');
        onAuthClick?.('sign_in');
        return;
      }

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

        let eventDetailsForSave = eventDetails;
        try {
          const { data: existingEvent } = await supabase
            .from('events')
            .select('event_details')
            .eq('id', currentEventId)
            .maybeSingle();
          const existingDetails =
            typeof existingEvent?.event_details === 'string'
              ? JSON.parse(existingEvent.event_details || '{}')
              : existingEvent?.event_details || {};
          if (existingDetails?.whatsapp_group && !eventDetailsForSave?.whatsapp_group) {
            eventDetailsForSave = {
              ...eventDetailsForSave,
              whatsapp_group: existingDetails.whatsapp_group,
            };
          }
        } catch (preserveGroupError) {
          console.warn('[StepButtons] Failed to preserve WhatsApp group metadata', preserveGroupError);
        }

        // Calculate allowed guests based on plan and addons – if no plan purchased yet, capacity is 0
        const basePlanLimit = selectedPlan || planForDisplay || userPlanSettings?.plan
          ? getPlanBaseLimit(selectedPlan || planForDisplay || userPlanSettings?.plan) || 0
          : 0;
        const extraCapacity = addonCountForDisplay * (getPlanBaseLimit('addon') || 100);
        const totalAllowedGuests = basePlanLimit + extraCapacity;
        const addonCountForDb = additionalPackageCounts['addon'] || 0;

        // Build update object - only include progress_step if it exists
        const updateData = {
          user_id: user.id,
          event_details: eventDetailsForSave,
          invitation_path: designFile,
          allowed_guests: totalAllowedGuests,
          additional_packages: addonCountForDb,
          event_type: selectedEventType || null,
          selected_plan: selectedPlan || planForDisplay || userPlanSettings?.plan || null,
        };

        if (progressStepSupportedRef.current) {
          updateData.progress_step = progress;
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
            progressStepSupportedRef.current = false;
            const { data: retryData, error: retryErr } = await supabase
              .from('events')
              .update({
                user_id: user.id,
                event_details: eventDetailsForSave,
                invitation_path: designFile,
                allowed_guests: totalAllowedGuests,
                additional_packages: addonCountForDb,
                event_type: selectedEventType || null,
                selected_plan: selectedPlan || planForDisplay || userPlanSettings?.plan || null,
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

        await supabase
          .from('user_settings')
          .upsert(
            {
              user_id: user.id,
              active_event_id: currentEventId,
              plan_code: selectedPlan || planForDisplay || userPlanSettings?.plan || null,
              addon_balance: addonCountForDb,
            },
            { onConflict: 'user_id' },
          );

        // Do not auto-send on every event update to avoid duplicate WhatsApp sends.
        // WhatsApp sending is handled explicitly on guest send actions and first event creation.

        // allowed_guests is persisted in DB; UI quota uses selectedPlan/addons from state.
      } else {
        // Calculate allowed guests based on plan and addons
        const basePlanLimit = selectedPlan || planForDisplay || userPlanSettings?.plan
          ? getPlanBaseLimit(selectedPlan || planForDisplay || userPlanSettings?.plan) || 0
          : 0;
        const extraCapacity = addonCountForDisplay * (getPlanBaseLimit('addon') || 100);
        const totalAllowedGuests = basePlanLimit + extraCapacity;
        const addonCountForDb = additionalPackageCounts['addon'] || 0;

        const payload = {
          user_id: user.id,
          event_type: selectedEventType,
          event_details: eventDetails,
          invitation_path: designFile,
          allowed_guests: totalAllowedGuests,
          additional_packages: addonCountForDb,
          selected_plan: selectedPlan || planForDisplay || userPlanSettings?.plan || null,
          status: 'active',
        };

        console.debug('[StepButtons] Inserting event', payload);

        const {data:inserted, error:insertErr}=await supabase.from('events').insert(payload).select('id').single();
        if(inserted){
          console.debug('[StepButtons] Insert success', inserted);
          setCurrentEventId(inserted.id);
          setEventMessagesSentCount(0);
          await supabase
            .from('user_settings')
            .upsert(
              {
                user_id: user.id,
                active_event_id: inserted.id,
                plan_code: selectedPlan || planForDisplay || userPlanSettings?.plan || null,
                addon_balance: addonCountForDb,
              },
              { onConflict: 'user_id' },
            );
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
  if (currentEventId && progressStepSupportedRef.current) { 
        try {
          await supabase.from('events').update({progress_step:3}).eq('id',currentEventId);
        } catch (progressErr) {
          // Ignore progress_step errors if column doesn't exist
      progressStepSupportedRef.current = false;
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
  const [showReportExcelSuccess, setShowReportExcelSuccess] = useState(false);
  const reportExcelSuccessTimeoutRef = useRef(null);
  
  const cleanupGuestsAfterFailedSend = useCallback(async (guestIds = []) => {
    const ids = (guestIds || []).filter(Boolean);
    if (!ids.length) return;

    try {
      await supabase.from('invited_guests').delete().in('id', ids);
    } catch (err) {
      console.error('Failed to roll back guests after failed WhatsApp send', err);
    }

    const refreshInvitedCount = async () => {
      if (!currentEventId) return;
      try {
        const { count, error } = await supabase
          .from('invited_guests')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', currentEventId);
        if (!error) {
          setInvitedGuestsCount(count || 0);
          return;
        }
        console.warn('Failed to refresh invited guests count after cleanup', error);
      } catch (countErr) {
        console.error('Error refreshing invited guests count after cleanup', countErr);
      }
    };
    await refreshInvitedCount();

    const filterByIds = (list, idKey = 'id') =>
      Array.isArray(list) ? list.filter((item) => !ids.includes(item?.[idKey])) : list;

    setDbGuests((prev) => filterByIds(prev));
    setReportGuests((prev) => filterByIds(prev));
    setApprovedGuests((prev) => filterByIds(prev));
    setRejectedGuests((prev) => filterByIds(prev));
    setPendingGuests((prev) => filterByIds(prev));
    setSentGuests((prev) =>
      Array.isArray(prev)
        ? prev.filter((item) => {
            const candidateId = item?.guestId ?? item?.id;
            return candidateId ? !ids.includes(candidateId) : true;
          })
        : prev
    );
    setGuestSummaryRefreshKey((key) => key + 1);
  }, [supabase, currentEventId]);

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
    setGuestSearchAttempted(true);
    setSearchError('');
    setSearchResults([]);
    if (!searchTerm.trim()) {
      setSearchError('נא להזין שם או טלפון');
      return;
    }

    try {
      const user = await resolveCurrentUserForSync();
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
  const styleReportWorksheet = (ws, {
    title,
    subtitle,
    headerRowIndex,
    totalRowIndex,
    summaryRowIndexes = [],
    columnCount,
  }) => {
    const primary = '002060';
    const headerAccent = '0070C0';
    const titleFill = '1F4E79';
    const gold = 'F59E0B';
    const softGold = 'FEF3C7';
    const softGreen = 'DCFCE7';
    const zebra = 'EFF6FF';
    const borderColor = '93C5FD';
    const ref = XLSX.utils.decode_range(ws['!ref']);
    const headerRow = headerRowIndex;
    const totalRow = totalRowIndex;
    const summaryRows = new Set(summaryRowIndexes);

    ws['!dir'] = 'rtl';
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRow, c: 0 },
        e: { r: Math.max(headerRow, totalRow - 1), c: columnCount - 1 },
      }),
    };
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: columnCount - 1 } },
    ];
    ws['!rows'] = [
      { hpt: 38 },
      { hpt: 23 },
      { hpt: 22 },
      { hpt: 8 },
      ...Array(Math.max(0, totalRow + 1 - 4)).fill({ hpt: 21 }),
    ];
    ws['!freeze'] = { xSplit: 0, ySplit: headerRow + 1 };
    ws['!views'] = [{ RTL: true, rightToLeft: true }];

    const border = {
      top: { style: 'thin', color: { rgb: borderColor } },
      bottom: { style: 'thin', color: { rgb: borderColor } },
      left: { style: 'thin', color: { rgb: borderColor } },
      right: { style: 'thin', color: { rgb: borderColor } },
    };
    const baseAlignment = { horizontal: 'center', vertical: 'center', readingOrder: 2, wrapText: true };

    for (let r = ref.s.r; r <= ref.e.r; r += 1) {
      for (let c = ref.s.c; c <= ref.e.c; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;

        const isTitle = r === 0;
        const isSubtitle = r === 1 || r === 2;
        const isHeader = r === headerRow;
        const isTotal = r === totalRow;
        const isSummary = summaryRows.has(r);
        const isData = r > headerRow && r < totalRow;
        const isTextColumn = c === 1 || c === 2 || c === 4 || c === columnCount - 1;

        ws[addr].s = {
          font: {
            name: 'Arial',
            sz: isTitle ? 24 : isHeader ? 12 : 11,
            bold: isTitle || isHeader || isTotal || isSummary,
            color: { rgb: isTitle || isHeader ? 'FFFFFFFF' : primary },
          },
          fill: {
            patternType: 'solid',
            fgColor: {
              rgb: isTitle
                ? titleFill
                : isHeader
                  ? headerAccent
                  : isTotal
                    ? softGold
                    : isSummary
                      ? softGreen
                      : isData && r % 2 === 0
                        ? zebra
                        : 'FFFFFF',
            },
          },
          alignment: {
            ...baseAlignment,
            horizontal: isTitle || isSubtitle ? 'center' : isTextColumn ? 'right' : 'center',
          },
          border,
        };

        if (isTitle) {
          ws[addr].s.font = {
            name: 'Arial Black',
            sz: 24,
            bold: true,
            color: { rgb: 'FFFFFFFF' },
          };
          ws[addr].s.fill = { patternType: 'solid', fgColor: { rgb: titleFill } };
        }

        if (isSubtitle) {
          ws[addr].s.font = { name: 'Arial', sz: 11, bold: r === 1, color: { rgb: primary } };
          ws[addr].s.fill = { patternType: 'solid', fgColor: { rgb: r === 1 ? softGold : 'FFFFFF' } };
        }
        if (isTotal) {
          ws[addr].s.border = {
            ...border,
            top: { style: 'medium', color: { rgb: gold } },
          };
        }
        if (c === 4 && r > headerRow) {
          ws[addr].t = 's';
          ws[addr].z = '@';
        }
      }
    }

    ws['!protect'] = undefined;
  };

  const createReportWorkbook = (sheetName, data, columns, styleOptions) => {
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = columns;
    styleReportWorksheet(ws, styleOptions);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    wb.Workbook = {
      Views: [{ RTL: true }],
      Sheets: [{ name: sheetName, Hidden: 0 }],
    };
    return wb;
  };

  const showReportExcelSuccessMessage = () => {
    if (reportExcelSuccessTimeoutRef.current) {
      clearTimeout(reportExcelSuccessTimeoutRef.current);
    }
    setShowReportExcelSuccess(true);
    reportExcelSuccessTimeoutRef.current = setTimeout(() => {
      setShowReportExcelSuccess(false);
      reportExcelSuccessTimeoutRef.current = null;
    }, 4000);
  };

  React.useEffect(() => () => {
    if (reportExcelSuccessTimeoutRef.current) {
      clearTimeout(reportExcelSuccessTimeoutRef.current);
    }
  }, []);

  const downloadWorkbook = (wb, fileName) => {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showReportExcelSuccessMessage();
  };

  const exportReportXlsx = () => {
    if (isMobileDevice()) {
      setShowMobileExcelExportNotice(true);
      return;
    }

    const generatedAt = new Date().toLocaleString('he-IL');
    const summaryRowIndexes = [];
    const data = [
      ['דוח אורחים מפורט לפי שולחנות'],
      [`סה"כ אורחים ברשימה: ${reportGuests.filter((g) => !g.isSummary).length}`],
      [`הופק בתאריך: ${generatedAt}`],
      [],
      ['#','שם פרטי','שם משפחה','מספר שולחן','טלפון','בוגרים','ילדים','סה"כ','צמחוני','טבעוני','גלאט','צליאקים','אלרגיה','סוג אלרגיה'],
    ];

    // Add guest rows and summary rows
    let rowNum = 0;
    reportGuests.forEach((g, idx) => {
      if (g.isSummary) {
        // Summary row
        summaryRowIndexes.push(data.length);
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

    const columns = [
      {wch:5}, // #
      {wch:18}, // שם פרטי
      {wch:18}, // שם משפחה
      {wch:22}, // מספר שולחן
      {wch:22}, // phone
      {wch:14}, // בוגרים
      {wch:14}, // ילדים
      {wch:14}, // סה"כ
      {wch:15}, // צמחוני
      {wch:15}, // טבעוני
      {wch:14}, // גלאט
      {wch:15}, // צליאקים
      {wch:15}, // אלרגיה
      {wch:30}, // סוג אלרגיה
    ];
    const wb = createReportWorkbook('דוח לפי שולחנות', data, columns, {
      title: 'דוח אורחים מפורט לפי שולחנות',
      subtitle: `סה"כ אורחים ברשימה: ${reportGuests.filter((g) => !g.isSummary).length}`,
      generatedAt,
      totalRowLabel: 'סה"כ משתתפים',
      totalRowValue: totalReportAdults + totalReportChildren,
      headerRowIndex: 4,
      totalRowIndex: data.length - 1,
      summaryRowIndexes,
      columnCount: columns.length,
    });
    downloadWorkbook(wb, 'דוח_אורחים_לפי_שולחנות_מעוצב.xlsx');
  };

  // Helper to export approved guests to CSV (Excel)
  const exportApprovedXlsx = () => {
    if (isMobileDevice()) {
      setShowMobileExcelExportNotice(true);
      return;
    }

    const generatedAt = new Date().toLocaleString('he-IL');
    const data = [
      ['דוח מאשרים מפורט'],
      [`סה"כ רשומות: ${approvedGuests.length}`],
      [`הופק בתאריך: ${generatedAt}`],
      [],
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

    const columns = [
      {wch:5}, // #
      {wch:18}, // שם פרטי
      {wch:18}, // שם משפחה
      {wch:22}, // מספר שולחן
      {wch:22}, // phone
      {wch:14}, // בוגרים
      {wch:14}, // ילדים
      {wch:14}, // סה"כ
      {wch:15}, // צמחוני
      {wch:15}, // טבעוני
      {wch:14}, // גלאט
      {wch:15}, // צליאקים
      {wch:15}, // אלרגיות
      {wch:30}, // הערות
    ];
    const wb = createReportWorkbook('מאשרים', data, columns, {
      title: 'דוח מאשרים מפורט',
      subtitle: `סה"כ רשומות: ${approvedGuests.length}`,
      generatedAt,
      totalRowLabel: 'סה"כ משתתפים מאושרים',
      totalRowValue: totalAdults + totalChildren,
      headerRowIndex: 4,
      totalRowIndex: data.length - 1,
      summaryRowIndexes: [],
      columnCount: columns.length,
    });
    downloadWorkbook(wb, 'דוח_מאשרים_מעוצב.xlsx');
  };

  const exportBasicGuestsXlsx = (rows, reportName, fileName, totalLabel) => {
    if (isMobileDevice()) {
      setShowMobileExcelExportNotice(true);
      return;
    }
    const safeRows = rows || [];
    const generatedAt = new Date().toLocaleString('he-IL');
    const data = [
      [reportName],
      [`סה"כ רשומות: ${safeRows.length}`],
      [`הופק בתאריך: ${generatedAt}`],
      [],
      ['#', 'שם פרטי', 'שם משפחה', 'טלפון'],
      ...safeRows.map((g, idx) => [
        idx + 1,
        g.first_name || '',
        g.last_name || '',
        g.phone || '',
      ]),
    ];

    data.push(['', totalLabel, '', safeRows.length]);

    const columns = [
      { wch: 5 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
    ];
    const wb = createReportWorkbook(reportName, data, columns, {
      title: reportName,
      subtitle: `סה"כ רשומות: ${safeRows.length}`,
      generatedAt,
      totalRowLabel: totalLabel,
      totalRowValue: safeRows.length,
      headerRowIndex: 4,
      totalRowIndex: data.length - 1,
      summaryRowIndexes: [],
      columnCount: columns.length,
    });
    downloadWorkbook(wb, fileName);
  };

  const exportRejectedXlsx = () => {
    exportBasicGuestsXlsx(rejectedGuests, 'דוח אורחים שלא מגיעים', 'דוח_אורחים_שלא_מגיעים.xlsx', 'סה"כ לא מגיעים');
  };

  const exportPendingXlsx = () => {
    exportBasicGuestsXlsx(pendingGuests, 'דוח אורחים שטרם הגיבו', 'דוח_אורחים_שטרם_הגיבו.xlsx', 'סה"כ טרם הגיבו');
  };

  const fileInputRef = useRef();
  const reportExportPressAtRef = useRef(0);

  const isMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    const userAgent = window.navigator?.userAgent || '';
    const hasTouch = Number(window.navigator?.maxTouchPoints || 0) > 0;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
    const narrowViewport = window.matchMedia?.('(max-width: 1024px)').matches;
    const mobileAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
    return mobileAgent || (hasTouch && coarsePointer && narrowViewport);
  };

  const isTouchLikeEvent = (event) => {
    const nativeEvent = event?.nativeEvent || event;
    return event?.type?.startsWith?.('touch') ||
      nativeEvent?.type?.startsWith?.('touch') ||
      nativeEvent?.pointerType === 'touch' ||
      nativeEvent?.pointerType === 'pen';
  };

  const openExcelImport = () => {
    if (isMobileDevice()) {
      setShowMobileExcelNotice(true);
      return;
    }

    setShowExcelInstructions(true);
  };

  const chooseExcelFile = () => {
    if (isMobileDevice()) {
      setShowExcelInstructions(false);
      setShowMobileExcelNotice(true);
      return;
    }

    setShowExcelInstructions(false);
    fileInputRef.current?.click();
  };

  const showMobileExcelExportMessage = (event) => {
    if (!isMobileDevice() && !isTouchLikeEvent(event)) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setShowMobileExcelExportNotice(true);
  };

  const handleReportExcelExportClick = (event, exportFn) => {
    const now = Date.now();
    if (event?.type === 'click' && now - reportExportPressAtRef.current < 700) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return;
    }
    reportExportPressAtRef.current = now;
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (isMobileDevice() || isTouchLikeEvent(event)) {
      setShowMobileExcelExportNotice(true);
      return;
    }

    exportFn();
  };

  const renderReportActions = (exportFn, closeFn) => (
    <div className="mt-4 flex flex-wrap items-start justify-end gap-3 pb-12">
      <div className="relative inline-flex flex-col items-center">
        <button
          type="button"
          data-mobile-excel-export-notice="true"
          data-report-export-action="true"
          onClick={(event) => handleReportExcelExportClick(event, exportFn)}
          onPointerDownCapture={(event) => {
            if (isTouchLikeEvent(event)) handleReportExcelExportClick(event, exportFn);
          }}
          className="relative z-50 pointer-events-auto touch-manipulation bg-white/[0.06] text-slate-100 border border-white/15 rounded-full px-6 py-2 font-medium hover:bg-indigo-500/15 hover:border-indigo-400/50 transition-all"
        >
          צור קובץ אקסל - ושמור בהורדות
        </button>
        {showReportExcelSuccess && (
          <div
            role="status"
            className="absolute right-1/2 top-full z-50 mt-2 w-max max-w-[min(90vw,420px)] translate-x-1/2 rounded-full bg-green-600 px-4 py-2 text-center text-sm font-medium text-white shadow-lg"
          >
            קובץ אקסל נוצר בהצלחה ונמצא בהורדות.
          </div>
        )}
      </div>
      <button
        type="button"
        data-report-close-action="true"
        onClick={closeFn}
        className="bg-red-600 text-white border border-red-400/50 rounded-full px-8 py-3 font-medium hover:bg-red-700 transition-all"
      >
        סגור
      </button>
    </div>
  );

  React.useEffect(() => {
    const hasOpenReport = showReportModal || showApprovedReport || showRejectedReport || showPendingReport;
    if (!hasOpenReport || typeof document === 'undefined') return;

    const getActiveActions = () => {
      if (showReportModal) {
        return { exportFn: exportReportXlsx, closeFn: () => setShowReportModal(false) };
      }
      if (showApprovedReport) {
        return { exportFn: exportApprovedXlsx, closeFn: () => { setShowApprovedReport(false); setShowReportsOptions(true); } };
      }
      if (showRejectedReport) {
        return { exportFn: exportRejectedXlsx, closeFn: () => { setShowRejectedReport(false); setShowReportsOptions(true); } };
      }
      if (showPendingReport) {
        return { exportFn: exportPendingXlsx, closeFn: () => { setShowPendingReport(false); setShowReportsOptions(true); } };
      }
      return null;
    };

    const handleNativeReportAction = (event) => {
      const exportButton = event.target?.closest?.('[data-report-export-action="true"]');
      const closeButton = event.target?.closest?.('[data-report-close-action="true"]');
      if (!exportButton && !closeButton) return;

      const actions = getActiveActions();
      if (!actions) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      if (exportButton) {
        if (isMobileDevice() || isTouchLikeEvent(event)) {
          setShowMobileExcelExportNotice(true);
          return;
        }
        actions.exportFn();
        return;
      }

      actions.closeFn();
    };

    document.addEventListener('click', handleNativeReportAction, true);
    return () => {
      document.removeEventListener('click', handleNativeReportAction, true);
    };
  }, [showReportModal, showApprovedReport, showRejectedReport, showPendingReport, reportGuests, approvedGuests, rejectedGuests, pendingGuests]);

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

  const handleSaveExcelGuests = async (sendSms = false, sendWhatsApp = false, sendWhatsAppGroup = false) => {
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
      const user = await resolveCurrentUserForSync();
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
        .or('status.neq.archived,status.is.null')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const bulkEventId = currentEventId || evRow?.id || null;
      if (!bulkEventId) {
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
        .select('id, first_name, last_name, phone, table_number, adults, children, status')
        .eq('event_id', bulkEventId);

      const currentAdultsCount = (existingGuests || []).reduce((sum, g) => sum + (g.adults || 0), 0);
      const currentChildrenCount = (existingGuests || []).reduce((sum, g) => sum + (g.children || 0), 0);
      const currentGuestCount = currentAdultsCount + currentChildrenCount;
      const existingGuestKeys = new Set((existingGuests || []).map(getGuestIdentityKey));
      const importedGuestKeys = new Set();
      const guestsToSave = validGuests.filter((guest) => {
        const key = getGuestIdentityKey(guest);
        if (existingGuestKeys.has(key) || importedGuestKeys.has(key)) {
          return false;
        }
        importedGuestKeys.add(key);
        return true;
      });
      const duplicateGuestsSkipped = validGuests.length - guestsToSave.length;
      const duplicateSkipText = duplicateGuestsSkipped > 0
        ? ` ${duplicateGuestsSkipped} אורחים כבר היו קיימים/כפולים ולכן לא נרשמו שוב ולא נספרו כשליחות.`
        : '';

      if (guestsToSave.length === 0) {
        setShowExcelPreview(false);
        setExcelPreviewData([]);
        setExcelErrors([]);
        setIsSavingExcelGuests(false);
        setGuestSummaryRefreshKey((k) => k + 1);
        setInvitationResult({
          type: 'warning',
          message: `לא נוספו אורחים חדשים. ${duplicateGuestsSkipped} אורחים כבר קיימים באירוע ולכן לא נרשמו שוב ולא נספרו כשליחות.`,
        });
        setShowInvitationResultModal(true);
        return;
      }

      const newGuestsToAdd = guestsToSave.length; // Each guest in Excel = 1 person
      // Quota is by messages sent only - saving guests is allowed; we check message limit when sending SMS below
      // Prepare guests for bulk insert
      const guestsToInsert = guestsToSave.map(g => {
        const normalizedBulkPhone = normalizePhoneNumber(g.guestPhone);
        return {
          user_id: user.id,
          event_id: bulkEventId,
          first_name: g.guestFirstName.trim(),
          last_name: g.guestLastName.trim(),
          phone: normalizedBulkPhone || g.guestPhone.toString().trim(),
          email: null,
          total_guests: 1,
          adults: 1,
          children: 0,
          table_number: g.guestTable.toString().trim() || null,
          status: 'pending',
        };
      });

      // Bulk insert
      const { data: insertedGuests, error } = await supabase
        .from('invited_guests')
        .insert(guestsToInsert)
        .select();

      if (error) throw error;

      if (sendWhatsAppGroup && insertedGuests && insertedGuests.length > 0) {
        setShowExcelPreview(false);
        setExcelPreviewData([]);
        setExcelErrors([]);
        setIsSavingExcelGuests(false);
        const guestIds = insertedGuests.map((g) => g.id).filter(Boolean);
        setSentGuests((prev) => [...prev, ...guestsToSave]);
        await openWhatsAppGroupModal({ eventId: bulkEventId, guestIds });
      // Send SMS to all guests if requested
      } else if (sendSms && insertedGuests && insertedGuests.length > 0) {
        const baseUrl = getInviteBaseUrl();
        const smsGuests = insertedGuests.map(g => {
          const inviteLink = `${baseUrl}/${bulkEventId}/${g.id}`;
          return {
            id: g.id,
            phone: g.phone,
            firstName: g.first_name,
            lastName: g.last_name,
            inviteLink,
          };
        });

        // Build SMS message with invitation text and RSVP link
        const smsMessage = `${invitationText}\n\nשלום {firstName},\nלאישור הגעה:\n{inviteLink}`;

        const totalLimitBulk =
          (getPlanBaseLimit(selectedPlan || planForDisplay || userPlanSettings?.plan || null) || 0) +
          addonCountForDisplay * (getPlanBaseLimit('addon') || 100);
        if (totalLimitBulk > 0 && effectiveMessagesSentCount + smsGuests.length > totalLimitBulk) {
          setShowExcelPreview(false);
          setExcelPreviewData([]);
          setExcelErrors([]);
          setIsSavingExcelGuests(false);
          setInvitationResult({ 
            type: 'error', 
            message: `נשמרו ${guestsToSave.length} אורחים חדשים.${duplicateSkipText} אין מספיק הודעות במכסה לשליחת SMS (נשלחו ${effectiveMessagesSentCount}, מכסה ${totalLimitBulk}). נא לרכוש חבילת הרחבה.` 
          });
          setShowInvitationResultModal(true);
          setPendingAddonCount(Math.max(1, Math.ceil((effectiveMessagesSentCount + smsGuests.length - totalLimitBulk) / 100)));
          setShowPlanLimitWarning(true);
          setPlanAddOnMode(true);
          return;
        }

        try {
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

          let smsResult = {};
          try {
            const text = await smsResponse.text();
            if (text && text.trim().startsWith('{')) smsResult = JSON.parse(text);
            else if (!smsResponse.ok && text) smsResult = { error: text.slice(0, 200) };
          } catch (parseErr) {
            console.error('SMS bulk response parse error:', parseErr);
          }
          if (!smsResponse.ok && !smsResult.error) smsResult.error = `שגיאת שרת ${smsResponse.status}`;

          // Close preview modal first
          setShowExcelPreview(false);
          setExcelPreviewData([]);
          setExcelErrors([]);
          setIsSavingExcelGuests(false);

          if (smsResult.sent > 0) {
            if (typeof smsResult.updatedMessagesSentCount === 'number') {
              setEventMessagesSentCount(smsResult.updatedMessagesSentCount);
            } else {
              setEventMessagesSentCount((prev) => (prev || 0) + smsResult.sent);
            }

            const successIds = new Set(
              (smsResult.results || [])
                .map((r) => r.guest?.id)
                .filter(Boolean)
            );
            if (successIds.size > 0) {
              await supabase
                .from('invited_guests')
                .update({ invitation_channel: 'sms' })
                .in('id', Array.from(successIds));
              setGuestSummaryRefreshKey((key) => key + 1);
              const guestsById = insertedGuests.reduce((acc, inserted, idx) => {
                acc[inserted.id] = { inserted, original: guestsToSave[idx] };
                return acc;
              }, {});
              const successfulGuests = Array.from(successIds)
                .map((id) => guestsById[id])
                .filter(Boolean)
                .map(({ inserted, original }) => ({
                  guestId: inserted.id,
                  guestFirstName: original?.guestFirstName || inserted.first_name || '',
                  guestLastName: original?.guestLastName || inserted.last_name || '',
                  guestPhone: inserted.phone || original?.guestPhone || '',
                  guestTable: original?.guestTable || inserted.table_number || '',
                  channel: 'sms',
                }));
              if (successfulGuests.length > 0) {
                setSentGuests((prev) => [...prev, ...successfulGuests]);
              }
            }
          }
          if (smsResult.success && smsResult.sent === guestsToSave.length) {
            setInvitationResult({ 
              type: 'success', 
              message: `נשמרו ${guestsToSave.length} אורחים חדשים ונשלחו ${smsResult.sent} הודעות SMS בהצלחה!${duplicateSkipText}` 
            });
            setShowInvitationResultModal(true);
          } else if (smsResult.sent > 0) {
            // Partial success
            setInvitationResult({ 
              type: 'error', 
              message: `נשמרו ${guestsToSave.length} אורחים חדשים. נשלחו ${smsResult.sent} הודעות, ${smsResult.failed} נכשלו.${duplicateSkipText}` 
            });
            setShowInvitationResultModal(true);
          } else {
            // All failed - show actual error if available
            const firstErr = smsResult.errors?.[0]?.error || smsResult.error;
            const errHint = firstErr ? ` (${firstErr})` : '';
            const apiErr = !smsResponse.ok ? ` קוד: ${smsResponse.status}` : '';
            if (firstErr && firstErr.includes('ACTIVETRAIL')) {
              setInvitationResult({ type: 'error', message: `נשמרו ${guestsToSave.length} אורחים חדשים.${duplicateSkipText} ${firstErr} הגדר ACTIVETRAIL_API_KEY ב-.env.local` });
            } else {
              setInvitationResult({ 
                type: 'error', 
                message: `נשמרו ${guestsToSave.length} אורחים חדשים, אך אירעה שגיאה בשליחת ה-SMS.${errHint}${apiErr}${duplicateSkipText}` 
              });
            }
            setShowInvitationResultModal(true);
          }
        } catch (smsError) {
          console.error('SMS sending error:', smsError);
          setShowExcelPreview(false);
          setExcelPreviewData([]);
          setExcelErrors([]);
          setIsSavingExcelGuests(false);
          const errMsg = smsError?.message || '';
          setInvitationResult({ 
            type: 'error', 
            message: `נשמרו ${guestsToSave.length} אורחים חדשים, אך אירעה שגיאה בשליחת ה-SMS. ${errMsg}${duplicateSkipText}` 
          });
          setShowInvitationResultModal(true);
        }
      } else if (sendWhatsApp && insertedGuests && insertedGuests.length > 0) {
        // Save + send WhatsApp via Meta API for inserted guests
        // #region agent log
        fetch('http://127.0.0.1:7780/ingest/b5f4ac25-b263-42d9-8749-29626868bbeb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dcd254'},body:JSON.stringify({sessionId:'dcd254',runId:'initial',hypothesisId:'H1',location:'components/StepButtons.js:2512',message:'Bulk WhatsApp branch triggered',data:{bulkEventId,insertedGuestsCount:insertedGuests.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setShowExcelPreview(false);
        setExcelPreviewData([]);
        setExcelErrors([]);
        setIsSavingExcelGuests(false);
        if (bulkEventId) {
          const guestIds = insertedGuests.map((g) => g.id).filter(Boolean);
          const apiResult = await sendWhatsAppInviteViaApi({
            eventId: bulkEventId,
            guestIds,
          });
          if (apiResult.ok) {
            const results = apiResult.payload?.results || [];
            const sent = apiResult.payload?.sent || 0;
            const successIds = new Set(
              results
                .filter((r) => r.ok)
                .map((r) => r.guestId)
                .filter(Boolean)
            );
            const failedIds = results
              .filter((r) => !r.ok && r.guestId)
              .map((r) => r.guestId)
              .filter(Boolean);
            if (failedIds.length > 0) {
              await cleanupGuestsAfterFailedSend(failedIds);
            }
            if (successIds.size > 0) {
              await supabase
                .from('invited_guests')
                .update({ invitation_channel: 'whatsapp' })
                .in('id', Array.from(successIds));
              setGuestSummaryRefreshKey((key) => key + 1);
              const guestsById = insertedGuests.reduce((acc, inserted, idx) => {
                acc[inserted.id] = { inserted, original: guestsToSave[idx] };
                return acc;
              }, {});
              const successfulGuests = Array.from(successIds)
                .map((id) => guestsById[id])
                .filter(Boolean)
                .map(({ inserted, original }) => ({
                  guestId: inserted.id,
                  guestFirstName: original?.guestFirstName || inserted.first_name || '',
                  guestLastName: original?.guestLastName || inserted.last_name || '',
                  guestPhone: inserted.phone || original?.guestPhone || '',
                  guestTable: original?.guestTable || inserted.table_number || '',
                  channel: 'whatsapp',
                }));
              if (successfulGuests.length > 0) {
                setSentGuests((prev) => [...prev, ...successfulGuests]);
              }
            }
            const msg =
              sent === guestIds.length
                ? `נשמרו ${guestsToSave.length} אורחים חדשים ונשלחו ${sent} הודעות וואטסאפ בהצלחה!${duplicateSkipText}`
                : `נשמרו ${guestsToSave.length} אורחים חדשים. נשלחו ${sent} הודעות וואטסאפ, בדוק את רשימת הכשלים.${duplicateSkipText}`;
            setInvitationResult({
              type: sent === guestIds.length ? 'success' : 'warning',
              message: msg,
            });
          } else {
            if (guestIds.length > 0) {
              await cleanupGuestsAfterFailedSend(guestIds);
            }
            const errMsg =
              apiResult.payload?.error ||
              apiResult.payload?.message ||
              apiResult.error?.message ||
              'אירעה שגיאה בשליחת הודעות הוואטסאפ.';
            setInvitationResult({
              type: 'error',
              message: `נשמרו ${guestsToSave.length} אורחים חדשים, אך שליחת הודעות וואטסאפ נכשלה. ${errMsg}${duplicateSkipText}`,
            });
          }
        } else {
          setInvitationResult({
            type: 'warning',
            message: `נשמרו ${guestsToSave.length} אורחים חדשים. שמור את האירוע לפני שליחת הודעות וואטסאפ.${duplicateSkipText}`,
          });
        }
        setShowInvitationResultModal(true);
      } else {
        // Close preview modal - save only
        setShowExcelPreview(false);
        setExcelPreviewData([]);
        setExcelErrors([]);
        setIsSavingExcelGuests(false);
        setSentGuests((prev) => [...prev, ...guestsToSave]);
        setInvitationResult({ 
          type: 'success', 
          message: `נשמרו בהצלחה ${guestsToSave.length} אורחים חדשים למסד הנתונים!${duplicateSkipText}` 
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
    date: '', time: DEFAULT_EVENT_TIME, chuppahTime: DEFAULT_CHUPPAH_TIME, hallName: '', hallAddress: '',
    customEventDescription: DEFAULT_CUSTOM_DESCRIPTION, hostName: '',
  };

  const isClearingPlanRef = useRef(false);

  const clearPlanState = useCallback(async () => {
    if (isClearingPlanRef.current) return;
    isClearingPlanRef.current = true;
    try {
      setSelectedPlan(null);
      setEventAllowedGuests(null);
      setAdditionalPackages([]);
      setDbAddonCount(0);
      setUserPlanSettings({ plan: null, addonCount: 0 });
      setNewEventStarted(false);
    planRetentionUntilRef.current = null;
      try { localStorage.removeItem('selectedPlan'); } catch (_) {}
      try { localStorage.removeItem('user_plan_code'); } catch (_) {}
      try { localStorage.removeItem('additionalPackages_global'); } catch (_) {}
      try { localStorage.removeItem('newEventStarted'); } catch (_) {}
      await persistUserPlanSettings(null, 0);
    } finally {
      isClearingPlanRef.current = false;
    }
  }, [persistUserPlanSettings]);

  // אין איפוס אוטומטי למסלול ששולם אחרי רענון/ארכוב.
  // איפוס מסלול מותר רק בתוך זרימת מחיקת אירוע לאחר סיום האירוע.

  const resetWizardStateForNoEvent = async () => {
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
    setFinishedSteps([]);
    setCurrentEventId(null);
    lastRestoredEventIdRef.current = null;
    noEventLoggedRef.current = false;
    setEventDataLoaded(false);
    setEventAllowedGuests(null);
    setGuestSummary({ approved: 0, adults: 0, children: 0 });
    resetCapacityWarningGuests();
    setGuestStatusSummary({ approved: 0, rejected: 0, pending: 0 });
    setSpecialMealsSummary({
      veg: { adults: 0, children: 0, total: 0 },
      vegan: { adults: 0, children: 0, total: 0 },
      glatt: { adults: 0, children: 0, total: 0 },
      allergy: { adults: 0, children: 0, total: 0 },
    });
    setDbGuests([]);
    setSentGuests([]);
    setReportGuests([]);
    setShowGuestListModal(false);
    setShowReportModal(false);
    setSelectedEventForReport(null);
    setInvitedGuestsCount(0);
    setEventMessagesSentCount(0);
  };

  const getEventDateFromRecord = (record) => {
    if (!record) return null;
    const details = typeof record.event_details === 'string'
      ? (() => {
          try {
            return JSON.parse(record.event_details);
          } catch (_) {
            return {};
          }
        })()
      : record.event_details || {};
    const rawDate =
      details.date ||
      details.event_date ||
      details.start_datetime ||
      details.end_datetime ||
      null;
    return parseEventDate(rawDate);
  };

  const hasEventEnded = (record) => {
    const eventDate = getEventDateFromRecord(record);
    if (!eventDate) return false;
    eventDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate < today;
  };

  const clearEndedEvent = async (eventId) => {
    if (!eventId) return;
    try {
      let { error } = await supabase
        .from('events')
        .update({ status: 'archived', selected_plan: null, additional_packages: 0 })
        .eq('id', eventId);
      if (error && (error.message || '').toLowerCase().includes('column')) {
        ({ error } = await supabase
          .from('events')
          .update({ status: 'archived' })
          .eq('id', eventId));
      }
      if (error) {
        console.error('Failed to clear ended event:', error);
        return;
      }
    } catch (err) {
      console.error('Failed to clear ended event:', err);
      return;
    }

    clearCarryPlanAfterManualDelete();
    await clearPlanState();
    await resetWizardStateForNoEvent();
    setShowEventEndedNotice(true);
  };

  const handleNewEvent = async (showDeletionMessage = false) => {
    setShowExistingEventWarning(false);
    setShowArchiveConfirm(false);
    if (!sessionRef.current) {
      await resetWizardStateForNoEvent();
      return;
    }
    let eventWasDeleted = false;
    let deletionCompleted = false;
    let deletionErrorAlertShown = false;
    let eventIdToDelete = currentEventId;
    const addonCountFromSettings = Number.isFinite(userPlanSettings?.addonCount)
      ? Math.max(0, userPlanSettings.addonCount)
      : 0;
    let addonCountBeforeReset = addonCountFromSettings;
    let planToCarryForward = selectedPlanRef.current || userPlanSettings?.plan || null;
    if (!planToCarryForward && typeof window !== 'undefined') {
      try {
        const storedPlan =
          localStorage.getItem('selectedPlan') ||
          localStorage.getItem('user_plan_code') ||
          null;
        if (storedPlan) {
          planToCarryForward = storedPlan;
        }
      } catch (storageErr) {
        console.warn('Failed to recover plan from storage during deletion', storageErr);
      }
    }
    if (!planToCarryForward) {
      try {
        const settingsSnapshot = await loadUserPlanSettings();
        if (settingsSnapshot?.plan) {
          planToCarryForward = settingsSnapshot.plan;
          const addonFromSettingsSnapshot = Number(settingsSnapshot.addonCount);
          if (Number.isFinite(addonFromSettingsSnapshot) && addonFromSettingsSnapshot > 0) {
            addonCountBeforeReset = Math.max(addonCountBeforeReset, addonFromSettingsSnapshot);
          }
        }
      } catch (settingsErr) {
        console.warn('Failed to recover plan from Supabase during deletion', settingsErr);
      }
    }
    let eventDateForRetention = null;
    let archivedByRetention = false;
    let fetchedEventRow = null;

    if (!eventIdToDelete) {
      try {
        const user = await resolveCurrentUserForSync();
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
            if (evFallback) {
              eventIdToDelete = evFallback.id;
              if (evFallback.status === 'archived') eventIdToDelete = null;
            }
          } else if (ev && ev.status !== 'archived') {
            eventIdToDelete = ev.id;
          }
        }
      } catch (e) {
        console.warn('Could not fetch event to delete', e);
      }
    }

    if (!eventIdToDelete) {
      deletionCompleted = true;
    } else {
      try {
        const { data: eventData, error: fetchError } = await supabase
          .from('events')
          .select('id, status, event_details, selected_plan, additional_packages, allowed_guests')
          .eq('id', eventIdToDelete)
          .maybeSingle();
        if (!fetchError && eventData) {
          fetchedEventRow = eventData;
          try {
            const details = typeof eventData.event_details === 'string'
              ? JSON.parse(eventData.event_details)
              : eventData.event_details || {};
            const retentionDateRaw =
              details?.date ||
              details?.event_date ||
              details?.start_datetime ||
              details?.end_datetime ||
              null;
            if (retentionDateRaw) {
              eventDateForRetention = retentionDateRaw;
            }
          } catch (parseErr) {
            console.warn('Failed to parse event_details for retention window', parseErr);
          }

          // Always remove invited guests belonging to the event that is being cleared.
          try {
            await supabase.from('invited_guests').delete().eq('event_id', eventIdToDelete);
          } catch (guestDeleteErr) {
            console.warn('Failed to delete invited guests for event:', guestDeleteErr);
          }

          const retentionDate = computePlanRetentionDate(eventDateForRetention);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const shouldArchive =
            Boolean(retentionDate && today >= retentionDate) &&
            eventData.status !== 'archived';

          if (shouldArchive) {
            // סיום אירוע אחרי תקופת השמירה: רק כאן מאפסים את המסלול והתוספות ברשומת האירוע.
            let archiveErr = null;
            ({ error: archiveErr } = await supabase
              .from('events')
              .update({ status: 'archived', selected_plan: null, additional_packages: 0 })
              .eq('id', eventIdToDelete));
            if (
              archiveErr &&
              (archiveErr.message || '').toLowerCase().includes('column')
            ) {
              ({ error: archiveErr } = await supabase
                .from('events')
                .update({ status: 'archived' })
                .eq('id', eventIdToDelete));
            }
            if (archiveErr) {
              console.error('Failed to archive event:', archiveErr);
              alert('שגיאה בארכוב האירוע הקיים.');
              deletionErrorAlertShown = true;
              deletionCompleted = false;
            } else {
              archivedByRetention = true;
              eventWasDeleted = true;
              deletionCompleted = true;
              clearCarryPlanAfterManualDelete();
            }
          } else {
            const { error: deleteErr } = await supabase
              .from('events')
              .delete()
              .eq('id', eventIdToDelete);
            if (deleteErr) {
              console.error('Failed to delete event:', deleteErr);
              alert('שגיאה במחיקת האירוע הקיים.');
              deletionErrorAlertShown = true;
              deletionCompleted = false;
            } else {
              eventWasDeleted = true;
              deletionCompleted = true;
              markCarryPlanAfterManualDelete();
            }
          }
        } else {
          deletionCompleted = true;
        }
      } catch (err) {
        console.error('Failed to archive current event:', err);
        if (!deletionErrorAlertShown) {
          alert('שגיאה בארכוב האירוע הקיים.');
        }
        deletionCompleted = false;
      }
    }

    // מחיקה ידנית: לשחזר מסלול מרשומת האירוע ב-DB אם חסר ב-state. ארכוב אחרי סיום: לא לשמור מסלול.
    if (archivedByRetention) {
      planToCarryForward = null;
      addonCountBeforeReset = 0;
    } else if (fetchedEventRow) {
      if (!planToCarryForward) {
        const fromDb = derivePlanFromRecord(fetchedEventRow);
        const rawSelected =
          typeof fetchedEventRow.selected_plan === 'string'
            ? fetchedEventRow.selected_plan.trim()
            : fetchedEventRow.selected_plan
              ? String(fetchedEventRow.selected_plan).trim()
              : '';
        // derivePlanFromRecord מחזיר null במצב draft/pending גם כש-selected_plan מלא (לפני "פרסום") — במחיקה נשמרים מה ששולם
        planToCarryForward = fromDb || (rawSelected ? rawSelected : null);
      }
    }

    // Now reset the state for new event
    eventDetailsOpenedRef.current = false; // Allow reset when opening event details for this new event
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
    lastRestoredEventIdRef.current = null;
    noEventLoggedRef.current = false;
    setEventDataLoaded(false);
    setEventAllowedGuests(null);

    if (!eventDateForRetention) {
      const rawDateFromForm =
        formData?.date ||
        formData?.event_date ||
        formData?.start_datetime ||
        formData?.end_datetime ||
        null;
      if (rawDateFromForm) {
        eventDateForRetention = rawDateFromForm;
      }
    }
    if (eventDateForRetention) {
      const retentionDate = computePlanRetentionDate(eventDateForRetention);
      if (retentionDate) {
        planRetentionUntilRef.current = retentionDate;
      }
    }
    
    // If event was actually deleted (not just archived), reset everything פרט לחבילה:
    // המשתמש כבר רכש/בחר מסלול, אין סיבה לבקש ממנו לבחור שוב.
    setNewEventStarted(false);
    setEventMessagesSentCount(0);
    try { localStorage.removeItem('newEventStarted'); } catch(e){}
    
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
    setSelectedPlan(planToCarryForward);
    if (!planToCarryForward) {
      setAdditionalPackages([]);
      setDbAddonCount(0);
      selectionSourceRef.current = 'manual';
      try { localStorage.removeItem('selectedPlan'); } catch (_) {}
      try { localStorage.removeItem('additionalPackages_global'); } catch (_) {}
      if (archivedByRetention) {
        try {
          await persistUserPlanSettings(null, 0);
        } catch (_) {}
        setUserPlanSettings((prev) => {
          if (prev && prev.plan === null && (prev.addonCount ?? 0) === 0) {
            return prev;
          }
          return { plan: null, addonCount: 0 };
        });
      }
      await resetWizardStateForNoEvent();
      setNewEventStarted(false);
      setShowEventTypes(false);
      setShowPricingPlan(false);
      setShowPlanLimitWarning(false);
      setPlanAddOnMode(false);
      return;
    }

    selectionSourceRef.current = 'persistent';
    try { localStorage.setItem('selectedPlan', planToCarryForward); } catch (_) {}
    const addonsArray =
      addonCountBeforeReset > 0 ? Array(addonCountBeforeReset).fill('addon') : [];
    setAdditionalPackages(addonsArray);
    setDbAddonCount(addonCountBeforeReset);
    try { localStorage.setItem('additionalPackages_global', String(addonCountBeforeReset)); } catch (_) {}
    
    try{ localStorage.removeItem('selectedDesign'); }catch{}
    try{ localStorage.removeItem('finishedSteps'); }catch{}
    try{ localStorage.removeItem('selectedEventType'); }catch{}
    try{ localStorage.removeItem('savedEventDetails'); }catch{}
    try{ localStorage.removeItem('additionalPackages'); }catch{}
    try{ localStorage.removeItem('additionalPackagesEventId'); }catch{}
    try{ if (currentEventId) localStorage.removeItem(`additionalPackages:${currentEventId}`); }catch{}

    // Check if user has a plan - if not, show pricing modal
    if (!planToCarryForward) {
      setShowPricingPlan(true);
      setPlanAddOnMode(false); // Ensure we're in plan selection mode, not addon mode
    }
    await persistUserPlanSettings(planToCarryForward, addonCountBeforeReset);
    setEventRefreshKey((key) => key + 1);

    if (showDeletionMessage && (eventWasDeleted || deletionCompleted)) {
      // סימון ש"ניקינו" את האירוע הקודם – כדי לא לבקש מחיקה שוב בכל לחיצה על "צור אירוע חדש"
      setHasClearedExistingEvent(true);
      setShowDeletionSuccess(true);
      setSelectedFlowStep(null);
      setShowEventTypes(false);
    }
  };

  // Get price for each plan
  const getPlanPrice = (plan) => {
    switch(plan) {
      case 'free':
      case 'basic':
        return 1;
      case 'standard':
        return 149;
      case 'premium':
        return 199;
      case 'luxury':
        return 259;
      default:
        return 1;
    }
  };

  // Get plan display name
  const getPlanDisplayName = (plan) => {
    switch(plan) {
      case 'free':
      case 'basic':
        return 'מסלול א - ₪1';
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
  const handleSelectPlan = async (plan) => {
    setPricingActionAttempted(true);
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

    try {
      const user = await resolveCurrentUserForSync();
      if (user) {
        const { data: ev } = await supabase
          .from('events')
          .select('selected_plan')
          .eq('user_id', user.id)
          .or('status.neq.archived,status.is.null')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (ev?.selected_plan === plan) {
          setInvitationResult({ type: 'success', message: 'המסלול כבר מופעל באירוע שלך' });
          setShowInvitationResultModal(true);
          setShowPricingPlan(false);
          setSelectedPlan(plan);
          try { localStorage.setItem('selectedPlan', plan); } catch(e){}
          return;
        }
      }
    } catch (e) { console.warn('Pre-payment sync check failed:', e); }

    const price = getPlanPrice(plan);

    // All plans now require payment
    setPendingPlan(plan);
    setPaymentAmount(price);
    setPaymentPlanName(getPlanDisplayName(plan));
    setShowPricingPlan(false);
    try {
      localStorage.setItem('payment_pending_plan', plan);
      localStorage.setItem('payment_pending_amount', String(price));
      localStorage.setItem('payment_pending_planName', getPlanDisplayName(plan));
      localStorage.setItem('payment_pending_addonCount', '1');
      if (currentEventId) localStorage.setItem('payment_pending_eventId', currentEventId);
    } catch (e) { console.warn('Failed to save payment pending to localStorage', e); }
    setShowPaymentModal(true);
  };

  // Handle adding package plan (for addon mode)
  const handleAddPackagePlan = (plan) => {
    setPricingActionAttempted(true);
    // Add the selected plan to additional packages
    setAdditionalPackages((prev) => [...prev, plan]);
    setShowPricingPlan(false);
  };

  const closePricingPlanModal = () => {
    setShowPricingPlan(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
    try {
      localStorage.setItem('payment_pending_plan', 'addon');
      localStorage.setItem('payment_pending_amount', String(totalCost));
      localStorage.setItem('payment_pending_planName', numPackages === 1 ? getAddonDisplayName() : `${numPackages} חבילות הרחבה - ${numPackages * 100} הודעות (₪${totalCost})`);
      localStorage.setItem('payment_pending_addonCount', String(numPackages));
      if (currentEventId) localStorage.setItem('payment_pending_eventId', currentEventId);
    } catch (e) { console.warn('Failed to save payment pending to localStorage', e); }
    setShowPaymentModal(true);
    setShowPlanLimitWarning(false);
    resetCapacityWarningGuests();
  };

  // Handle successful payment (override: { plan, addonCount, eventId } when from redirect)
  const handlePaymentSuccess = async (transactionData, override) => {
    try {
      const plan = override?.plan ?? pendingPlan;
      const addonCount = override?.addonCount ?? pendingAddonCount;
      const eventIdForPlan = override?.eventId ?? currentEventId;
      console.log('Payment successful:', transactionData);

      const parseAmount = (value) => {
        if (value === undefined || value === null) return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ''));
        return Number.isFinite(parsed) ? parsed : null;
      };

      const rawAmount =
        transactionData?.sum ??
        transactionData?.Sum ??
        transactionData?.amount ??
        transactionData?.Amount ??
        transactionData?.total ??
        transactionData?.Total ??
        transactionData?.price ??
        transactionData?.Price ??
        null;
      const paidAmount = parseAmount(rawAmount);
      const addonUnitPrice = getAddonPrice ? getAddonPrice() : 100;
      const expectedAddonAmount =
        addonCount && addonUnitPrice ? addonCount * addonUnitPrice : null;
      const planPrice = plan ? getPlanPrice(plan) : null;
      const looksLikeAddonPayment =
        plan === 'addon' ||
        (!!addonCount &&
          addonCount > 0 &&
          paidAmount !== null &&
          expectedAddonAmount !== null &&
          Math.abs(paidAmount - expectedAddonAmount) < 0.51 &&
          (!planPrice || Math.abs(paidAmount - planPrice) > 0.51));
      const effectivePlan = looksLikeAddonPayment ? 'addon' : plan;
      if (looksLikeAddonPayment && plan !== 'addon') {
        console.warn('Normalizing payment as addon despite pending plan', {
          pendingPlan: plan,
          addonCount,
          paidAmount,
          expectedAddonAmount,
        });
      }

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
      if (effectivePlan && effectivePlan !== 'addon') {
        try {
          planRetentionUntilRef.current = null;
          setSelectedPlan(effectivePlan);
          try { localStorage.setItem('selectedPlan', effectivePlan); } catch(e){
            console.warn('Failed to save plan to localStorage:', e);
          }
          const currentAddonBalance = Math.max(
            dbAddonCount ?? 0,
            userPlanSettings?.addonCount ?? 0,
            Array.isArray(additionalPackages) ? additionalPackages.filter((p) => p === 'addon').length : 0
          );
          await persistUserPlanSettings(effectivePlan, currentAddonBalance);
          if (eventIdForPlan) {
            supabase.from('events').update({ selected_plan: effectivePlan }).eq('id', eventIdForPlan).then(({ error }) => {
              if (error) console.error('Failed to persist selected_plan to DB', error);
            });
          }
          if (!eventIdForPlan) {
            // Mark that a new event flow should begin so the dashboard shows the plan section
            setNewEventStarted(true);
            try { localStorage.setItem('newEventStarted', '1'); } catch (e) {}
            setShowGuestListModal(false);
            setShowReportsOptions(false);
            setShowReportModal(false);
          }

          const planDisplayName = getPlanDisplayName(effectivePlan);
          // Show success modal instead of toast
          setPaymentResultType('success');
          setPaymentResultMessage(`התשלום בוצע בהצלחה! ${planDisplayName} הופעל`);
          setPaymentWasPlanPurchase(true);
          setShowPaymentModal(false);
          setShowPaymentResultModal(true);
          // Prepare wizard for brand new event creation
          setFinishedSteps([]);
          setShowEventTypes(true);
          setStepErrorMsg('');
          try { localStorage.removeItem('finishedSteps'); } catch (e) {}
          try { localStorage.removeItem('savedEventDetails'); } catch (e) {}
          try { localStorage.removeItem('selectedDesign'); } catch (e) {}
          try { localStorage.removeItem('draftEvent'); } catch (e) {}
          setFormData(initialFormState);
          setSelectedEventType('');
          setSelectedDesign(null);
          setEventDetailsCompleted(false);
          try { localStorage.removeItem('selectedEventType'); } catch (e) {}
          setGuestSummary({ approved: 0, adults: 0, children: 0 });
          resetCapacityWarningGuests();
          setGuestStatusSummary({ approved: 0, rejected: 0, pending: 0 });
          setSpecialMealsSummary({
            veg: { adults: 0, children: 0, total: 0 },
            vegan: { adults: 0, children: 0, total: 0 },
            glatt: { adults: 0, children: 0, total: 0 },
            allergy: { adults: 0, children: 0, total: 0 },
          });
          setDbGuests([]);
          setSentGuests([]);
          setReportGuests([]);
          setApprovedGuests([]);
          setRejectedGuests([]);
          setPendingGuests([]);
          setShowGuestListModal(false);
          setShowReportsOptions(false);
          setShowReportModal(false);
          setSelectedEventForReport(null);
          setInvitedGuestsCount(0);
          setEventMessagesSentCount(0);
          setGuestSummaryRefreshKey((prev) => prev + 1);
        } catch (error) {
          console.error('Error handling plan purchase:', error);
          setPaymentResultType('error');
          setPaymentResultMessage('שגיאה בעדכון המסלול. אנא פנה לתמיכה.');
          setShowPaymentModal(false);
          setShowPaymentResultModal(true);
        }
      }
      // Handle addon packages (100 guests for 100 shekel each)
      else if (effectivePlan === 'addon') {
        try {
          let existingAddonCount = Math.max(
            parseNonNegativeInt(dbAddonCount),
            parseNonNegativeInt(userPlanSettings?.addonCount),
            additionalPackages.filter((p) => p === 'addon').length,
          );
          if (override && eventIdForPlan) {
            const { data: ev } = await supabase
              .from('events')
              .select('additional_packages')
              .eq('id', eventIdForPlan)
              .single();
            existingAddonCount = Math.max(
              existingAddonCount,
              parseNonNegativeInt(ev?.additional_packages),
            );
          }
          const newAddonTotal = existingAddonCount + addonCount;
          const newAddons = Array(addonCount).fill('addon');
          const updatedPackages = [...additionalPackages, ...newAddons];
          setAdditionalPackages(updatedPackages);
          setDbAddonCount(newAddonTotal);
          let eventIdForSave = eventIdForPlan;
          if (!eventIdForSave) {
            try {
              const user = await resolveCurrentUserForSync();
              if (user) {
                const { data: latestEv } = await supabase.from('events')
                  .select('id, allowed_guests').eq('user_id', user.id)
                  .order('created_at', { ascending: false }).limit(1).single();
                if (latestEv) {
                  eventIdForSave = latestEv.id;
                  setCurrentEventId(latestEv.id);
                  const capPay = parseNonNegativeInt(latestEv.allowed_guests);
                  setEventAllowedGuests(capPay > 0 ? capPay : null);
                }
              }
            } catch (_) {}
          }
          if (eventIdForSave) {
            const basePlanForAddonEvent = selectedPlan || planForDisplay || userPlanSettings?.plan || 'basic';
            const newAllowedGuests =
              (getPlanBaseLimit(basePlanForAddonEvent) || 0) +
              newAddonTotal * (getPlanBaseLimit('addon') || 100);
            const { error: updErr } = await supabase
              .from('events')
              .update({
                additional_packages: newAddonTotal,
                allowed_guests: newAllowedGuests,
                selected_plan: basePlanForAddonEvent,
              })
              .eq('id', eventIdForSave);
            if (updErr) {
              console.error('Failed to persist additional_packages in DB', updErr);
            }
            setEventAllowedGuests(newAllowedGuests > 0 ? newAllowedGuests : null);
            const { data: verify } = await supabase
              .from('events')
              .select('additional_packages,allowed_guests')
              .eq('id', eventIdForSave)
              .single();
            if (
              verify &&
              (parseNonNegativeInt(verify.additional_packages) !== newAddonTotal ||
                parseNonNegativeInt(verify.allowed_guests) < newAllowedGuests)
            ) {
              console.warn('addon capacity mismatch after update, retrying');
              await supabase
                .from('events')
                .update({
                  additional_packages: newAddonTotal,
                  allowed_guests: newAllowedGuests,
                  selected_plan: basePlanForAddonEvent,
                })
                .eq('id', eventIdForSave);
            }
          }
          try { localStorage.setItem('additionalPackages_' + (eventIdForSave || 'global'), JSON.stringify(newAddonTotal)); } catch (_) {}
          setPlanSelectionError('');

          const totalMessagesAdded = addonCount * 100;
          const totalPaid = addonCount * 100;
          const msg = addonCount === 1
            ? 'נרכשה חבילה של 100 והמכסה עודכנה.'
            : `נרכשו ${addonCount} חבילות (${totalMessagesAdded} הודעות) בסכום ₪${totalPaid} והמכסה עודכנה.`;
          setPaymentResultType('success');
          setPaymentResultMessage(msg);
          setPaymentWasPlanPurchase(false);
          const basePlanForAddonPersist = selectedPlan || userPlanSettings?.plan || null;
          await persistUserPlanSettings(basePlanForAddonPersist, newAddonTotal);

          // סגירת הודעת שגיאת מכסה אם הייתה פתוחה – כדי שלא תוצג אחרי התשלום
          setShowInvitationResultModal(false);
          setInvitationResult({ type: null, message: '' });

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
          '004': 'התשלום נדחה על ידי חברת האשראי. נסה כרטיס אחר או פנה לבנק',
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
      setPaymentFailureWasAddon(pendingPlan === 'addon');
      if (pendingPlan === 'addon') setLastAddonCountForRetry(pendingAddonCount);

      // Clear pending state
      setPendingPlan(null);
      setPendingAddonCount(1);
    } catch (error) {
      console.error('Error in handlePaymentFailure:', error);
      setPaymentFailureWasAddon(pendingPlan === 'addon');
      if (pendingPlan === 'addon') setLastAddonCountForRetry(pendingAddonCount);
      setPaymentResultType('error');
      setPaymentResultMessage('אירעה שגיאה בעיבוד התשלום. אנא נסה שוב או פנה לתמיכה.');
      setShowPaymentModal(false);
      setShowPaymentResultModal(true);
    }
  };

  // Check if there's an existing event in progress
  const hasExistingEvent = () => {
    return Boolean(
      currentEventId ||
      newEventStarted ||
      finishedSteps.length > 0 ||
      selectedEventType ||
      formDataHasMeaningfulValues
    );
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
React.useEffect(() => {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem('newEventStarted');
    if (stored === '1') {
      setNewEventStarted(true);
    }
  } catch (err) {
    console.warn('Failed to restore newEventStarted from localStorage', err);
  }
}, []);

  React.useEffect(() => {
    if (!sessionRef.current) return;
    const hasEvent =
      Boolean(currentEventId) ||
      Boolean(newEventStarted) ||
      finishedSteps.length > 0 ||
      Boolean(selectedEventType) ||
      formDataHasMeaningfulValues;
    if (hasEvent) return;
    const hasPlanData =
      Boolean(selectedPlan) ||
      Boolean(userPlanSettings?.plan) ||
      (Array.isArray(additionalPackages) && additionalPackages.length > 0) ||
      (dbAddonCount ?? 0) > 0;
    if (!hasPlanData) return;

    if (!shouldRespectCarryPlanAfterManualDelete()) {
      void clearPlanState();
    }
  }, [
    currentEventId,
    newEventStarted,
    selectedPlan,
    userPlanSettings?.plan,
    additionalPackages,
    dbAddonCount,
    clearPlanState,
    finishedSteps,
    selectedEventType,
    formDataHasMeaningfulValues,
  ]);

  // State for Tranzila terminal info
  const [tranzilaTerminalInfo, setTranzilaTerminalInfo] = useState(null);

  // ---------------- helper to sync event data on refresh -----------------
  React.useEffect(()=>{
    (async ()=>{
      try{
        const user = await resolveCurrentUserForSync();
        if(!user) return;
        let ev = null;
        let messagesSent = 0;
        const { data: evData, error: evError } = await supabase
          .from('events')
          .select('id,event_type,event_details,allowed_guests,messages_sent_count,additional_packages,selected_plan,status')
          .eq('user_id',user.id)
          .order('created_at',{ascending:false})
          .limit(1)
          .maybeSingle();
        if (evError && (evError.message || '').toLowerCase().includes('column')) {
          const { data: evF } = await supabase
            .from('events')
            .select('id,event_type,event_details,allowed_guests')
            .eq('user_id',user.id)
            .order('created_at',{ascending:false})
            .limit(1)
            .maybeSingle();
          ev = evF;
        } else {
          ev = evData;
          messagesSent = ev?.messages_sent_count ?? 0;
        }
        if (!ev || (ev.status === 'archived')) {
          setEventAllowedGuests(null);
          const settings = await loadUserPlanSettings();
          const fallbackAddon = settings?.addonCount ?? 0;
          if ((settings?.plan || null) !== null) {
            setSelectedPlan(settings?.plan || null);
            try { localStorage.setItem('selectedPlan', settings?.plan || ''); } catch(e){}
          }
          setDbAddonCount(fallbackAddon);
          setAdditionalPackages((prev) => {
            const prevCount = Array.isArray(prev) ? prev.length : 0;
            if (prevCount === fallbackAddon) {
              return prev;
            }
            return Array(fallbackAddon).fill('addon');
          });
          return;
        }
        if (hasEventEnded(ev)) {
          await clearEndedEvent(ev.id);
          return;
        }
        setEventMessagesSentCount(messagesSent);
        const settingsAddonCount = parseNonNegativeInt(userPlanSettingsRef.current?.addonCount);
        const addonCount = settingsAddonCount;
        setDbAddonCount(addonCount);
        setAdditionalPackages((prev) => {
          const prevCount = prev ? prev.length : 0;
          if (prevCount !== addonCount) return Array(addonCount).fill('addon');
          return prev;
        });
        try { localStorage.setItem('additionalPackages_' + ev.id, String(addonCount)); } catch (_) {}
        setEventDataLoaded(true);
        const fallbackPlan = userPlanSettingsRef.current?.plan || selectedPlanRef.current || null;
        const planToUse = derivePlanFromRecord(ev) || fallbackPlan;
        const repairedAllowedGuests = planToUse
          ? (getPlanBaseLimit(planToUse) || 0) + addonCount * (getPlanBaseLimit('addon') || 100)
          : parseNonNegativeInt(ev.allowed_guests);
        setEventAllowedGuests(repairedAllowedGuests > 0 ? repairedAllowedGuests : null);
        if (planToUse) {
          setSelectedPlan(planToUse);
          selectionSourceRef.current = 'event';
          try { localStorage.setItem('selectedPlan', planToUse); } catch(e){}
          await persistUserPlanSettings(planToUse, addonCount);
          if (
            parseNonNegativeInt(ev.additional_packages) !== addonCount ||
            parseNonNegativeInt(ev.allowed_guests) !== repairedAllowedGuests
          ) {
            await supabase
              .from('events')
              .update({
                additional_packages: addonCount,
                allowed_guests: repairedAllowedGuests,
                selected_plan: planToUse,
              })
              .eq('id', ev.id);
            setEventAllowedGuests(repairedAllowedGuests > 0 ? repairedAllowedGuests : null);
          }
        }
        const details=typeof ev.event_details==='string'?JSON.parse(ev.event_details):ev.event_details||{};
        if (ev.event_type) setSelectedEventType(ev.event_type);
        syncFinishedStepsFromEvent(ev.event_type || selectedEventType, details);
        const dateStr=details.date||details.start_datetime;
        const retentionDate = computePlanRetentionDate(dateStr);
        if (retentionDate) {
          planRetentionUntilRef.current = retentionDate;
        }
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
  },[eventRefreshKey, loadUserPlanSettings, derivePlanFromRecord, persistUserPlanSettings, getPlanBaseLimit, selectedEventType, syncFinishedStepsFromEvent]);

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
          const rowStatus = typeof ev.status === 'string' ? ev.status.toLowerCase() : '';
          if (payload.eventType === 'DELETE' || rowStatus === 'archived') {
            setCurrentEventId(null);
            setEventAllowedGuests(null);
            setEventDataLoaded(false);
            setEventMessagesSentCount(0);
            setEventRefreshKey((k) => k + 1);
            return;
          }
          if (typeof ev.messages_sent_count === 'number') {
            setEventMessagesSentCount(ev.messages_sent_count);
          }
          if (ev.additional_packages != null && ev.additional_packages !== '') {
            const ap = parseNonNegativeInt(userPlanSettingsRef.current?.addonCount);
            setDbAddonCount(ap);
            setAdditionalPackages((prev) => {
              const prevCount = prev ? prev.length : 0;
              if (prevCount !== ap) return Array(ap).fill('addon');
              return prev;
            });
          }
          if (ev.allowed_guests != null && ev.allowed_guests !== '') {
            const capRt = parseNonNegativeInt(ev.allowed_guests);
            setEventAllowedGuests(capRt > 0 ? capRt : null);
          }
          const planFromEvent = derivePlanFromRecord(ev);
          if (planFromEvent) {
            setSelectedPlan(planFromEvent);
            try { localStorage.setItem('selectedPlan', planFromEvent); } catch (_) {}
            persistUserPlanSettings(planFromEvent, userPlanSettingsRef.current?.addonCount ?? 0);
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
  }, [currentEventId, derivePlanFromRecord, persistUserPlanSettings]);

  const checkActiveEventExists = async () => {
    try{
      if (currentEventId || newEventStarted) return true;
      const user = await resolveCurrentUserForSync();
      if(!user) return false;
      let ev = null;
      const { data: evData, error: evError } = await supabase
        .from('events')
        .select('id,event_details,status,allowed_guests,messages_sent_count')
        .eq('user_id',user.id)
        .or('status.neq.archived,status.is.null')
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

  // Handle payment failure from redirect (Apple Pay / Google Pay may redirect whole page to failure URL)
  const processedPaymentFailureRedirectRef = React.useRef(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !session || !router?.isReady) return;
    if (processedPaymentFailureRedirectRef.current) return;
    const q = router?.query?.payment_failure || new URLSearchParams(window.location.search).get('payment_failure');
    const fdJson = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('payment_failure_data');
    if (q !== '1' || !fdJson) return;
    processedPaymentFailureRedirectRef.current = true;
    try {
      const failureData = JSON.parse(fdJson);
      sessionStorage.removeItem('payment_failure_data');
      router.replace('/', undefined, { shallow: true });
      handlePaymentFailure(failureData);
    } catch (e) {
      console.error('Payment failure from redirect failed:', e);
      processedPaymentFailureRedirectRef.current = false;
    }
  }, [session, router?.query?.payment_failure, router?.isReady]);

  // Handle payment success from redirect (Google Pay may redirect whole page to success URL)
  const processedPaymentRedirectRef = React.useRef(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !session || !router?.isReady) return;
    if (processedPaymentRedirectRef.current) return;
    const q = router?.query?.payment_success || new URLSearchParams(window.location.search).get('payment_success');
    const rawTx =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem('payment_success_transaction')
        : null;
    const txJson = rawTx && rawTx.trim().toLowerCase() !== 'undefined' ? rawTx : null;
    if (q !== '1' || !txJson) return;
    processedPaymentRedirectRef.current = true;
    try {
      const transactionData = JSON.parse(txJson);
      const plan = localStorage.getItem('payment_pending_plan');
      const addonCount = parseInt(localStorage.getItem('payment_pending_addonCount') || '1', 10);
      const eventId = localStorage.getItem('payment_pending_eventId') || undefined;
      sessionStorage.removeItem('payment_success_transaction');
      ['payment_pending_plan', 'payment_pending_amount', 'payment_pending_planName', 'payment_pending_addonCount', 'payment_pending_eventId'].forEach(k => localStorage.removeItem(k));
      router.replace('/', undefined, { shallow: true });
      handlePaymentSuccess(transactionData, { plan: plan || null, addonCount, eventId });
    } catch (e) {
      console.error('Payment success from redirect failed:', e);
      try { sessionStorage.removeItem('payment_success_transaction'); } catch (_) {}
      ['payment_pending_plan', 'payment_pending_amount', 'payment_pending_planName', 'payment_pending_addonCount', 'payment_pending_eventId'].forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
      router.replace('/', undefined, { shallow: true });
      processedPaymentRedirectRef.current = false;
    }
  }, [session, router?.query?.payment_success, router?.isReady]);

  // When returning to the tab, refresh event state from Supabase (keeps web/mobile in sync).
  // Skip refresh when payment modal is open - prevents interrupting Google Pay on mobile.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !showPaymentModal) {
        setEventRefreshKey((k) => k + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [showPaymentModal]);

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

  // Hide "event ended" notice once user starts/has an event again.
  React.useEffect(() => {
    if ((currentEventId || newEventStarted) && showEventEndedNotice) {
      setShowEventEndedNotice(false);
    }
  }, [currentEventId, newEventStarted, showEventEndedNotice]);

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
        const user = await resolveCurrentUserForSync();
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
  }, [showApprovedReport, currentEventId, selectedEventForReport, guestSummaryRefreshKey]);

  // fetch rejected guests
  React.useEffect(() => {
    if (!showRejectedReport) return;
    (async () => {
      try {
        const user = await resolveCurrentUserForSync();
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
  }, [showRejectedReport, currentEventId, selectedEventForReport, guestSummaryRefreshKey]);

  // fetch pending guests
  React.useEffect(() => {
    if (!showPendingReport) return;
    (async () => {
      try {
        const user = await resolveCurrentUserForSync();
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
          .eq('event_id', eventIdToUse);
        setPendingGuests(getPendingGuestsFromRows(data || []));
      } catch (e) {
        console.error('fetch pending guests failed', e);
      }
    })();
  }, [showPendingReport, currentEventId, selectedEventForReport, guestSummaryRefreshKey]);

  // Refresh report modal data when RSVP changes (guestSummaryRefreshKey) and modal is open
  React.useEffect(() => {
    if (!showReportModal) return;
    const eventIdToUse = selectedEventForReport?.id || currentEventId;
    if (!eventIdToUse || reportTitle.includes('אין אירוע נבחר')) return;
    (async () => {
      try {
        if (reportTitle === 'אורחים מגיעים' || reportTitle === 'אורחים מגיעים ממוינים לפי שולחן') {
          const { data } = await supabase.from('invited_guests').select('*').eq('event_id', eventIdToUse).eq('status', 'approved');
          if (reportTitle === 'אורחים מגיעים ממוינים לפי שולחן' && data?.length) {
            const byTable = {};
            data.forEach(g => {
              const t = g.table_number || 'ללא שולחן';
              if (!byTable[t]) byTable[t] = [];
              byTable[t].push(g);
            });
            const tables = Object.keys(byTable).sort((a, b) => (a === 'ללא שולחן' ? 1 : b === 'ללא שולחן' ? -1 : String(a).localeCompare(String(b))));
            const dataWithSummaries = [];
            tables.forEach(table => {
              byTable[table].forEach(g => dataWithSummaries.push(g));
              const rows = byTable[table];
              const tableTotalAdults = rows.reduce((s, g) => s + (g.adults || 0), 0);
              const tableTotalChildren = rows.reduce((s, g) => s + (g.children || 0), 0);
              const tableTotalVeg = rows.reduce((s, g) => s + (g.veg_adults || 0) + (g.veg_children || 0), 0);
              const tableTotalVegan = rows.reduce((s, g) => s + (g.vegan_adults || 0) + (g.vegan_children || 0), 0);
              const tableTotalGlatt = rows.reduce((s, g) => s + (g.glatt_adults || 0) + (g.glatt_children || 0), 0);
              const tableTotalCeliac = rows.reduce((s, g) => s + (g.celiac_adults || 0) + (g.celiac_children || 0), 0);
              const tableTotalAllergy = rows.reduce((s, g) => s + (g.allergy_adults || 0) + (g.allergy_children || 0), 0);
              dataWithSummaries.push({ isSummary: true, table_number: table, summary_label: `סה"כ שולחן ${table}`, adults: tableTotalAdults, children: tableTotalChildren, total: tableTotalAdults + tableTotalChildren, veg: tableTotalVeg, vegan: tableTotalVegan, glatt: tableTotalGlatt, celiac: tableTotalCeliac, allergy: tableTotalAllergy });
            });
            setReportGuests(dataWithSummaries);
          } else {
            setReportGuests(data || []);
          }
        } else if (reportTitle === 'אורחים לא מגיעים') {
          const { data } = await supabase.from('invited_guests').select('*').eq('event_id', eventIdToUse).eq('status', 'rejected');
          setReportGuests(data || []);
        } else if (reportTitle === 'אורחים שטרם הגיבו') {
          const { data } = await supabase.from('invited_guests').select('*').eq('event_id', eventIdToUse);
          setReportGuests(getPendingGuestsFromRows(data || []));
        }
      } catch (e) {
        console.error('Failed to refresh report data', e);
      }
    })();
  }, [showReportModal, guestSummaryRefreshKey, reportTitle, currentEventId, selectedEventForReport]);

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
  }, [showGuestListModal, currentEventId, guestSummaryRefreshKey]);

  // ---- Auto-archive when event ends (after date has passed) ----
  // אחרי שהאירוע הסתיים בפועל, המסלול שנרכש לא ממשיך לאירוע הבא.

  React.useEffect(() => {
    if (!currentEventId) return;

    const archiveIfPast = async () => {
      try {
        let dbEvent = null;
        let error = null;
        const res1 = await supabase
          .from('events')
          .select('event_details, selected_plan, additional_packages, status')
          .eq('id', currentEventId)
          .maybeSingle();
        if (res1.error && (res1.error.message || '').toLowerCase().includes('column')) {
          const res2 = await supabase
            .from('events')
            .select('event_details, selected_plan, additional_packages')
            .eq('id', currentEventId)
            .maybeSingle();
          dbEvent = res2.data;
          error = res2.error;
        } else {
          dbEvent = res1.data;
          error = res1.error;
        }

        if (error || !dbEvent) return;

        const rowStatus = typeof dbEvent.status === 'string' ? dbEvent.status.toLowerCase() : '';
        if (rowStatus === 'archived') {
          setCurrentEventId(null);
          setEventAllowedGuests(null);
          return;
        }

        const details = typeof dbEvent.event_details === 'string'
          ? JSON.parse(dbEvent.event_details)
          : dbEvent.event_details || {};
        const dbDate = details.date || details.start_datetime;
        if (!dbDate) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventDate = new Date(dbDate);
        if (!Number.isFinite(eventDate.getTime())) return;
        eventDate.setHours(0, 0, 0, 0);

        if (eventDate >= today) return;

        (async () => {
          await clearEndedEvent(currentEventId);
        })();
      } catch (err) {
        console.error('auto-archive fetch failed', err);
      }
    };

    archiveIfPast();
  }, [currentEventId]);

  // Fetch Tranzila terminal info
  React.useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/tranzila/terminal-info');
        if (response.ok) {
          try {
            const text = await response.text();
            const data = (text && text.trim().startsWith('{')) ? JSON.parse(text) : {};
            setTranzilaTerminalInfo(data);
          } catch (parseErr) {
            console.error('Terminal info parse error:', parseErr);
          }
        }
      } catch (e) {
        console.error('Failed to fetch terminal info:', e);
      }
    })();
  }, []);

  // ---- Check if there's an active event in database but currentEventId is null ----
  React.useEffect(() => {
    if (currentEventId) return;
    (async () => {
      try {
        const user = await resolveCurrentUserForSync();
        if (!user) return;

        const { data: ev } = await supabase
          .from('events')
          .select('id, event_type, event_details, allowed_guests, messages_sent_count, additional_packages, selected_plan, status')
          .eq('user_id', user.id)
          .or('status.neq.archived,status.is.null')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ev) {
          noEventLoggedRef.current = false;
          const details = typeof ev.event_details === 'string'
            ? JSON.parse(ev.event_details)
            : ev.event_details;

          if (details && details.date) {
            const eventDate = new Date(details.date);
            eventDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (eventDate >= today) {
              if (lastRestoredEventIdRef.current !== ev.id) {
                console.log('Found future event in database, restoring...', ev.id);
                lastRestoredEventIdRef.current = ev.id;
              }
              setCurrentEventId(ev.id);
              if (ev.event_type) {
                setSelectedEventType(ev.event_type);
              }
              syncFinishedStepsFromEvent(ev.event_type || '', details || {});
              if (newEventStarted) {
                setNewEventStarted(false);
                try { localStorage.removeItem('newEventStarted'); } catch(e){}
              }
              setEventMessagesSentCount(ev.messages_sent_count ?? 0);
              const restoreAddonCount = parseNonNegativeInt(userPlanSettingsRef.current?.addonCount);
              setDbAddonCount(restoreAddonCount);
              setAdditionalPackages((prev) => {
                const prevCount = prev ? prev.length : 0;
                if (prevCount !== restoreAddonCount) return Array(restoreAddonCount).fill('addon');
                return prev;
              });
              try { localStorage.setItem('additionalPackages_' + ev.id, String(restoreAddonCount)); } catch (_) {}
              setEventDataLoaded(true);
              const fallbackPlan = userPlanSettingsRef.current?.plan || selectedPlanRef.current || null;
              const planToUse = derivePlanFromRecord(ev) || fallbackPlan;
              const repairedAllowedGuests = planToUse
                ? (getPlanBaseLimit(planToUse) || 0) + restoreAddonCount * (getPlanBaseLimit('addon') || 100)
                : parseNonNegativeInt(ev.allowed_guests);
              setEventAllowedGuests(repairedAllowedGuests > 0 ? repairedAllowedGuests : null);
              if (planToUse) {
                setSelectedPlan(planToUse);
                try { localStorage.setItem('selectedPlan', planToUse); } catch(e){}
                await persistUserPlanSettings(planToUse, restoreAddonCount);
                if (
                  parseNonNegativeInt(ev.additional_packages) !== restoreAddonCount ||
                  parseNonNegativeInt(ev.allowed_guests) !== repairedAllowedGuests
                ) {
                  await supabase
                    .from('events')
                    .update({
                      additional_packages: restoreAddonCount,
                      allowed_guests: repairedAllowedGuests,
                      selected_plan: planToUse,
                    })
                    .eq('id', ev.id);
                }
              }
              setFormData(prev => ({ ...prev, ...details }));

              const tpl = details?.template_src || null;
              if (tpl) {
                setSelectedDesign(tpl);
                markStepDone(2);
              }
            } else {
              if (lastRestoredEventIdRef.current !== 'ended') {
                console.log('Event found but has ended, clearing active event');
                lastRestoredEventIdRef.current = 'ended';
              }
              await clearEndedEvent(ev.id);
              return;
            }
          }
        } else {
          if (!noEventLoggedRef.current) {
            console.log('No event found in database');
            noEventLoggedRef.current = true;
          }
          lastRestoredEventIdRef.current = null;
          if (!newEventStarted) {
            setShowGuestListModal(false);
            setShowReportsOptions(false);
          }

          const currentSelectedPlan = selectedPlanRef.current;
          const currentUserSettings = userPlanSettingsRef.current;
          const currentAdditionalPackages = additionalPackagesRef.current;

          const carriedPlan = newEventStarted
            ? (currentSelectedPlan || currentUserSettings?.plan || null)
            : null;
          const carriedAddon = newEventStarted
              ? (() => {
                const addonFromSettings = Number(currentUserSettings?.addonCount ?? 0);
                return Number.isFinite(addonFromSettings) ? Math.max(0, addonFromSettings) : 0;
              })()
            : 0;

          try {
            const { data: lastEvent } = await supabase
              .from('events')
              .select('event_details, status, created_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (lastEvent) {
              const details = typeof lastEvent.event_details === 'string'
                ? JSON.parse(lastEvent.event_details)
                : lastEvent.event_details || {};
              const rawDate = details.date || details.start_datetime || lastEvent.created_at;
              const retentionDate = computePlanRetentionDate(rawDate);
              if (retentionDate) {
                planRetentionUntilRef.current = retentionDate;
              }
              if (rawDate) {
                // Keep retention metadata for UX; do not auto-clear paid plans on event end.
              }
            }
          } catch (inspectErr) {
            console.error('Failed to inspect last event for plan reset', inspectErr);
          }

          if (newEventStarted) {
            if (carriedPlan) {
              setSelectedPlan(carriedPlan);
              setDbAddonCount(carriedAddon);
              setAdditionalPackages((prev) => {
                const prevCount = Array.isArray(prev) ? prev.length : 0;
                if (prevCount === carriedAddon) {
                  return prev;
                }
                return Array(carriedAddon).fill('addon');
              });
            } else {
              setSelectedPlan(null);
              setDbAddonCount(0);
              setAdditionalPackages((prev) => {
                if (Array.isArray(prev) && prev.length === 0) {
                  return prev;
                }
                return [];
              });
            }
            return;
          }

          const settings = await loadUserPlanSettings();
          if (settings) {
            const canCarryPlan = shouldRespectCarryPlanAfterManualDelete();
            if (settings.plan && canCarryPlan) {
              setSelectedPlan(settings.plan);
              // Keep the purchased/retained plan ready, but do NOT start the wizard automatically.
              // The user should explicitly click "צור אירוע חדש" before seeing step modals.
              try { localStorage.setItem('selectedPlan', settings.plan); } catch(e){}
            } else if (settings.plan) {
              await clearPlanState();
            } else {
              setSelectedPlan(null);
              try { localStorage.removeItem('user_plan_code'); } catch(e){}
              try { localStorage.removeItem('selectedPlan'); } catch(e){}
            }
            const addonToApply = settings.plan && canCarryPlan ? (settings.addonCount ?? 0) : 0;
            setDbAddonCount(addonToApply);
            setAdditionalPackages((prev) => {
              const prevCount = Array.isArray(prev) ? prev.length : 0;
              if (prevCount === addonToApply) {
                return prev;
              }
              return Array(addonToApply).fill('addon');
            });
          }

          setGuestSummary((prev) => {
            if ((prev.approved || prev.adults || prev.children)) {
              return { approved: 0, adults: 0, children: 0 };
            }
            return prev;
          });
          resetCapacityWarningGuests();
          setGuestStatusSummary((prev) => {
            if (prev.approved || prev.rejected || prev.pending) {
              return { approved: 0, rejected: 0, pending: 0 };
            }
            return prev;
          });
          setSpecialMealsSummary((prev) => {
            const emptyMeals = {
              veg: { adults: 0, children: 0, total: 0 },
              vegan: { adults: 0, children: 0, total: 0 },
              glatt: { adults: 0, children: 0, total: 0 },
              allergy: { adults: 0, children: 0, total: 0 },
            };
            const hasMeals =
              prev.veg.total || prev.vegan.total || prev.glatt.total || prev.allergy.total;
            return hasMeals ? emptyMeals : prev;
          });
          setDbGuests((prev) => (prev.length ? [] : prev));
          setSentGuests((prev) => (prev.length ? [] : prev));
          setReportGuests((prev) => (prev.length ? [] : prev));
          setApprovedGuests((prev) => (prev.length ? [] : prev));
          setRejectedGuests((prev) => (prev.length ? [] : prev));
          setPendingGuests((prev) => (prev.length ? [] : prev));
          setShowGuestListModal(false);
          setShowReportsOptions(false);
          setShowReportModal(false);
          setSelectedEventForReport(null);
          setInvitedGuestsCount((prev) => (prev ? 0 : prev));
          setEventMessagesSentCount((prev) => (prev ? 0 : prev));
          setGuestSummaryRefreshKey((prev) => prev + 1);
        }
        isInitialLoadRef.current = false;
      } catch (e) {
        console.error('Failed to check for active event:', e);
        isInitialLoadRef.current = false;
      }
    })();
  }, [currentEventId, newEventStarted, eventRefreshKey, derivePlanFromRecord, persistUserPlanSettings, loadUserPlanSettings, syncFinishedStepsFromEvent]);

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
  const eventDetailsOpenedRef = useRef(false); // Prevent reset when reopening event details

  // Reset form when opening event details for NEW event (first open only, not on reopen)
  React.useEffect(() => {
    if (!showEventDetails) return;
    if (!currentEventId && selectedEventType && !eventDetailsOpenedRef.current) {
      setFormData(initialFormState);
      setFormErrors({});
      try { localStorage.removeItem('savedEventDetails'); } catch(e){}
      eventDetailsOpenedRef.current = true;
    }
  }, [showEventDetails, currentEventId, selectedEventType]);

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
        const user = await resolveCurrentUserForSync();
        if(!user) return;
        let ev = null;
        let messagesSent = 0;
        const { data: evData, error: evError } = await supabase
          .from('events')
          .select('id,event_type,status,event_details,allowed_guests,messages_sent_count,additional_packages,selected_plan')
          .eq('user_id', user.id)
          .order('created_at',{ascending:false})
          .limit(1)
          .maybeSingle();
        if (evError && (evError.message || '').toLowerCase().includes('column')) {
          const { data: evFallback } = await supabase
            .from('events')
            .select('id,event_type,event_details,allowed_guests')
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
        const evIsArchived =
          ev &&
          typeof ev.status === 'string' &&
          ev.status.toLowerCase() === 'archived';
        if (evIsArchived) {
          setEventAllowedGuests(null);
          const settings = await loadUserPlanSettings();
          if (settings?.plan) {
            setSelectedPlan(settings.plan);
            try { localStorage.setItem('selectedPlan', settings.plan); } catch (e) {}
            try { localStorage.setItem('user_plan_code', settings.plan); } catch (e) {}
          }
          const ac = settings?.addonCount ?? 0;
          setDbAddonCount(ac);
          setAdditionalPackages((prev) => {
            const prevCount = Array.isArray(prev) ? prev.length : 0;
            if (prevCount === ac) return prev;
            return Array(ac).fill('addon');
          });
          try { localStorage.setItem('additionalPackages_global', String(ac)); } catch (e) {}
          isInitialLoadRef.current = false;
          return;
        }
        if (ev && hasEventEnded(ev)) {
          await clearEndedEvent(ev.id);
          isInitialLoadRef.current = false;
          return;
        }
        if(ev){
          setCurrentEventId(ev.id);
          if (ev.event_type) {
            setSelectedEventType(ev.event_type);
          }
          setEventMessagesSentCount(messagesSent);
          const addonCount = parseNonNegativeInt(userPlanSettingsRef.current?.addonCount);
          setDbAddonCount(addonCount);
          setAdditionalPackages((prev) => {
            const prevCount = prev ? prev.length : 0;
            if (prevCount !== addonCount) return Array(addonCount).fill('addon');
            return prev;
          });
          try { localStorage.setItem('additionalPackages_' + ev.id, String(addonCount)); } catch (_) {}
          setEventDataLoaded(true);
          const fallbackPlan = userPlanSettingsRef.current?.plan || selectedPlanRef.current || null;
          const planToUse = derivePlanFromRecord(ev) || fallbackPlan;
          const repairedAllowedGuests = planToUse
            ? (getPlanBaseLimit(planToUse) || 0) + addonCount * (getPlanBaseLimit('addon') || 100)
            : parseNonNegativeInt(ev.allowed_guests);
          setEventAllowedGuests(repairedAllowedGuests > 0 ? repairedAllowedGuests : null);
          if (planToUse) {
            setSelectedPlan(planToUse);
            try { localStorage.setItem('selectedPlan', planToUse); } catch(e){}
            await persistUserPlanSettings(planToUse, addonCount);
            if (
              parseNonNegativeInt(ev.additional_packages) !== addonCount ||
              parseNonNegativeInt(ev.allowed_guests) !== repairedAllowedGuests
            ) {
              await supabase
                .from('events')
                .update({
                  additional_packages: addonCount,
                  allowed_guests: repairedAllowedGuests,
                  selected_plan: planToUse,
                })
                .eq('id', ev.id);
            }
          }
          const details = typeof ev.event_details === 'string' 
            ? JSON.parse(ev.event_details) 
            : ev.event_details;
          syncFinishedStepsFromEvent(ev.event_type || '', details || {});
          const tpl = details?.template_src || null;
          if(tpl){
            setSelectedDesign(tpl);
            markStepDone(2);
          }
          if(formDataIsMeaningfullyEmpty && details){
          if(currentEventId) {
            setFormData(prev=>({ ...prev, ...details }));
              setEventDetailsCompleted(true);
              markStepDone(1);
          }
          }
        }
        isInitialLoadRef.current = false;
      }catch(e){ console.error('restore event failed', e);}  
    })();
  },[loadUserPlanSettings, syncFinishedStepsFromEvent]);

  // Load selectedDesign from localStorage if not already set from database
React.useEffect(()=>{
  if(typeof window==='undefined') return;
  if(selectedDesign) return; // Don't override if already set from database
  if(!currentEventId){
    try { localStorage.removeItem('selectedDesign'); } catch {}
    return;
  }
  try{
    const saved = localStorage.getItem('selectedDesign');
    if(saved) setSelectedDesign(saved);
    // Mark initial load as complete after localStorage check
    isInitialLoadRef.current = false;
  }catch{}
},[currentEventId, selectedDesign]);

  // Load guest summary stats - only if there's an active event
  React.useEffect(()=>{
    (async ()=>{
      try{
        const user = await resolveCurrentUserForSync();
        if(!user || !currentEventId) {
          setMobileSummaryGuests([]);
          return;
        }
        
        const { data: guests, error: guestsError } = await supabase
          .from('invited_guests')
          .select('first_name, last_name, phone, table_number, status, adults, children, veg_adults, veg_children, vegan_adults, vegan_children, glatt_adults, glatt_children, allergy_adults, allergy_children, invitation_channel')
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
          const dedupedGuests = dedupeGuestsByIdentity(guests);
          setMobileSummaryGuests(dedupedGuests);
          dedupedGuests.forEach(g => {
            
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
          // "הודעות שנשלחו" comes from eventMessagesSentCount (DB), not from guest count
          // Calculate totals
          specialMeals.veg.total = specialMeals.veg.adults + specialMeals.veg.children;
          specialMeals.vegan.total = specialMeals.vegan.adults + specialMeals.vegan.children;
          specialMeals.glatt.total = specialMeals.glatt.adults + specialMeals.glatt.children;
          specialMeals.allergy.total = specialMeals.allergy.adults + specialMeals.allergy.children;
        } else {
          setMobileSummaryGuests([]);
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
      // Skip when payment modal open - prevents interrupting Google Pay on mobile
      if (document.visibilityState === 'visible' && currentEventId && !showPaymentModal) setGuestSummaryRefreshKey((k) => k + 1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [currentEventId, showPaymentModal]);

  // Auto-refresh reports every 5s when reports/guest list are open (fallback when Realtime is unavailable)
  React.useEffect(() => {
    if (!currentEventId) return;
    const reportsOpen = showReportsOptions || showReportModal || showGuestListModal;
    if (!reportsOpen) return;
    const id = setInterval(() => setGuestSummaryRefreshKey((k) => k + 1), 5000);
    return () => clearInterval(id);
  }, [currentEventId, showReportsOptions, showReportModal, showGuestListModal]);

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
        const user = await resolveCurrentUserForSync();
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
    
    const baseLimit = getPlanBaseLimit(selectedPlan || planForDisplay || userPlanSettings?.plan || null);
    const extraCapacity = addonCountForDisplay * (getPlanBaseLimit('addon') || 100);
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
  // Reset form and steps when no active event exists AND no new event started
  React.useEffect(()=>{
    if(currentEventId || newEventStarted) return; // Don't reset if new event is in progress
    // No active event – reset wizard
    setFormData(initialFormState);
    setFinishedSteps([]);
    setSelectedEventType(null);
    setNewEventStarted(false);
    try{ localStorage.removeItem('draftEvent'); localStorage.removeItem('newEventStarted'); localStorage.removeItem('savedEventDetails'); }catch{}
  },[currentEventId, newEventStarted]);

  const mobileResumeEventDateText = React.useMemo(() => {
    const rawDate = formData?.date || formData?.start_datetime || '';
    if (!rawDate) return '';
    const parsed = new Date(rawDate);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('he-IL') : String(rawDate);
  }, [formData?.date, formData?.start_datetime]);

  const mobileResumeModel = React.useMemo(() => {
    const step1Done = Boolean(selectedEventType) || finishedSteps.includes(0);
    const step2Done = Boolean(eventDetailsCompleted || formDataHasMeaningfulValues || finishedSteps.includes(1));
    const step3Done = Boolean(selectedDesign || finishedSteps.includes(2));
    const step4Done = Boolean(effectiveMessagesSentCount > 0 || invitedCount > 0 || finishedSteps.includes(4));
    const completedCount = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;
    const nextStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : step4Done ? 5 : 4;
    const continueLabels = {
      1: 'המשך לבחירת סוג אירוע',
      2: 'המשך לפרטי האירוע',
      3: 'המשך לעיצוב',
      4: 'עבור לשליחה',
      5: 'פתח דוחות',
    };

    return {
      completedCount,
      nextStep,
      continueLabel: continueLabels[nextStep] || 'המשך',
      shouldShow: Boolean(
        currentEventId ||
        newEventStarted ||
        selectedEventType ||
        formDataHasMeaningfulValues ||
        selectedDesign ||
        finishedSteps.length > 0
      ),
    };
  }, [
    currentEventId,
    effectiveMessagesSentCount,
    eventDetailsCompleted,
    finishedSteps,
    formDataHasMeaningfulValues,
    invitedCount,
    newEventStarted,
    selectedDesign,
    selectedEventType,
  ]);

  const mobileEventTodayModel = React.useMemo(() => {
    const rawDate = formData?.date || formData?.start_datetime || '';
    if (!rawDate || !currentEventId) return { shouldShow: false };

    const parsedDate = new Date(rawDate);
    if (!Number.isFinite(parsedDate.getTime())) return { shouldShow: false };

    const today = new Date();
    const eventDay = new Date(parsedDate);
    today.setHours(0, 0, 0, 0);
    eventDay.setHours(0, 0, 0, 0);
    const shouldShow = today.getTime() === eventDay.getTime();
    if (!shouldShow) return { shouldShow: false };

    const dateText = parsedDate.toLocaleDateString('he-IL');
    const timeText = formData?.time ? String(formData.time) : '';
    let statusText = timeText ? `מתחיל בשעה ${timeText}` : 'האירוע מתקיים היום';

    if (timeText && /^\d{1,2}:\d{2}$/.test(timeText)) {
      const [hours, minutes] = timeText.split(':').map((value) => parseInt(value, 10));
      const eventDateTime = new Date(parsedDate);
      eventDateTime.setHours(hours, minutes, 0, 0);
      const diffMs = eventDateTime.getTime() - Date.now();
      if (diffMs > 0) {
        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        statusText = diffHours <= 1 ? 'מתחיל בקרוב' : `מתחיל בעוד ${diffHours} שעות`;
      } else {
        statusText = 'האירוע כבר התחיל';
      }
    }

    return {
      shouldShow: true,
      dateText,
      statusText,
      venueText: formData?.hallName || formData?.hallAddress || '',
    };
  }, [currentEventId, formData?.date, formData?.hallAddress, formData?.hallName, formData?.start_datetime, formData?.time]);

  const mobileReminderStatusModel = React.useMemo(() => {
    const rawDate = formData?.date || formData?.start_datetime || '';
    if (!rawDate || !currentEventId) return { shouldShow: false };

    const parsedDate = new Date(rawDate);
    if (!Number.isFinite(parsedDate.getTime())) return { shouldShow: false };

    const today = new Date();
    const eventDay = new Date(parsedDate);
    today.setHours(0, 0, 0, 0);
    eventDay.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilEvent = Math.round((eventDay.getTime() - today.getTime()) / msPerDay);
    if (daysUntilEvent < 0) return { shouldShow: false };

    const reminderDaysBefore = 5;
    const daysUntilReminder = daysUntilEvent - reminderDaysBefore;
    const whatsappCount = mobileSummaryGuests.filter((guest) => guest.invitation_channel === 'whatsapp').length;
    const smsCount = mobileSummaryGuests.filter((guest) => guest.invitation_channel === 'sms').length;
    const unknownCount = mobileSummaryGuests.filter((guest) => !guest.invitation_channel).length;
    const knownChannelCount = whatsappCount + smsCount;
    let statusText = 'התזכורת תופעל אחרי שליחת הזמנות';
    if (knownChannelCount > 0) {
      if (daysUntilReminder > 0) {
        statusText = `נותרו ${daysUntilReminder} ימים לשליחת התזכורת`;
      } else if (daysUntilReminder === 0) {
        statusText = 'התזכורת האוטומטית תישלח היום';
      } else {
        statusText = daysUntilEvent === 0
          ? 'התזכורת האוטומטית כבר טופלה אם הייתה פעילה'
          : 'מועד התזכורת האוטומטית כבר עבר';
      }
    }

    return {
      shouldShow: true,
      reminderDaysBefore,
      statusText,
      whatsappCount,
      smsCount,
      unknownCount,
      knownChannelCount,
    };
  }, [currentEventId, formData?.date, formData?.start_datetime, mobileSummaryGuests]);

  const mobileSmartActionModel = React.useMemo(() => {
    const shouldShow = Boolean(
      currentEventId ||
      newEventStarted ||
      selectedEventType ||
      formDataHasMeaningfulValues ||
      selectedDesign ||
      invitedCount > 0 ||
      guestStatusSummary.pending > 0
    );
    if (!shouldShow) return { shouldShow: false };

    if (mobileEventTodayModel.shouldShow) {
      return {
        shouldShow: true,
        title: 'פתח דוחות עכשיו',
        description: 'האירוע היום, כדאי לעקוב אחרי אישורי ההגעה בזמן אמת.',
        badge: 'האירוע היום',
        actionText: 'פתח דוחות',
        action: 'reports',
        icon: '▥',
        tone: 'emerald',
      };
    }

    if (guestStatusSummary.pending > 0) {
      return {
        shouldShow: true,
        title: 'בדוק מי עדיין לא הגיב',
        description: 'יש אורחים שממתינים לתגובה, וכדאי לטפל בהם לפני האירוע.',
        badge: `${guestStatusSummary.pending} ממתינים`,
        actionText: 'פתח דוח ממתינים',
        action: 'pending',
        icon: '◷',
        tone: 'emerald',
      };
    }

    if (!selectedDesign) {
      return {
        shouldShow: true,
        title: 'בחר עיצוב להזמנה',
        description: 'השלב הבא הוא לבחור תבנית ולעצב את ההזמנה לפני שליחה.',
        badge: 'שלב מומלץ',
        actionText: 'בחר עיצוב',
        action: 'design',
        icon: '🎨',
        tone: 'violet',
      };
    }

    if (invitedCount === 0) {
      return {
        shouldShow: true,
        title: 'שלח הזמנה ראשונה',
        description: 'ההזמנה מוכנה, עכשיו אפשר לשלוח אותה לאורח הראשון.',
        badge: 'אין מוזמנים עדיין',
        actionText: 'עבור לשליחה',
        action: 'send',
        icon: '✈',
        tone: 'emerald',
      };
    }

    return {
      shouldShow: true,
      title: 'פתח דוחות',
      description: 'עקוב אחרי מצב האורחים ואישורי ההגעה של האירוע.',
      badge: `${invitedCount} מוזמנים`,
      actionText: 'פתח דוחות',
      action: 'reports',
      icon: '▥',
      tone: 'violet',
    };
  }, [
    currentEventId,
    formDataHasMeaningfulValues,
    guestStatusSummary.pending,
    invitedCount,
    mobileEventTodayModel.shouldShow,
    newEventStarted,
    selectedDesign,
    selectedEventType,
  ]);

  const openMobileResumeStep = React.useCallback((stepNumber) => {
    const mustStartFirst = !currentEventId && !newEventStarted && !planForDisplay;
    if (stepNumber >= 1 && stepNumber <= 4 && mustStartFirst) {
      setStepErrorMsg('\u05D9\u05E9 \u05EA\u05D7\u05D9\u05DC\u05D4 \u05DC\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D5\u05DC\u05D1\u05D7\u05D5\u05E8 \u05DE\u05E1\u05DC\u05D5\u05DC \u05EA\u05E9\u05DC\u05D5\u05DD.');
      setShowStepError(true);
      return;
    }
    setStepErrorMsg('');
    if (stepNumber === 1) setShowEventTypes(true);
    else if (stepNumber === 2) setShowEventDetails(true);
    else if (stepNumber === 3) setShowDesignChooser(true);
    else if (stepNumber === 4) setShowGuestForm(true);
    else if (stepNumber === 5) {
      setShowReportsOptions(true);
      setShowGuestListModal(false);
    }
  }, [currentEventId, newEventStarted, planForDisplay]);

  const openMobilePendingReport = React.useCallback(() => {
    setShowReportsOptions(false);
    setShowGuestListModal(false);
    setShowPendingReport(true);
    setStepErrorMsg('');
  }, []);

  const openMobileReminderFlow = React.useCallback(() => {
    setShowReportsOptions(false);
    setShowGuestForm(true);
    setStepErrorMsg('');
  }, []);

  const handleMobileSmartAction = React.useCallback((action) => {
    if (action === 'pending') {
      openMobilePendingReport();
      return;
    }
    if (action === 'design') {
      openMobileResumeStep(3);
      return;
    }
    if (action === 'send') {
      openMobileResumeStep(4);
      return;
    }
    openMobileResumeStep(5);
  }, [openMobilePendingReport, openMobileResumeStep]);

  const renderMobileNextActionCard = ({
    stepLabel,
    title,
    description,
    actionText,
    onAction,
    helpText,
    icon = '⚡',
  }) => (
    <div className="mb-4 rounded-3xl border border-violet-300/25 bg-white/[0.06] p-4 text-center shadow-[0_10px_32px_rgba(0,0,0,0.28)] ring-1 ring-violet-400/20 backdrop-blur-2xl sm:hidden" dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-right">
          <div className="inline-flex rounded-full border border-violet-300/30 bg-violet-500/20 px-3 py-1 text-xs font-black text-violet-100">
            {stepLabel}
          </div>
          <h3 className="mt-2 text-2xl font-black leading-tight text-white">הפעולה הבאה שלך</h3>
          <p className="mt-1 text-base font-black text-emerald-200">{title}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-500/15 text-2xl text-emerald-200">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{description}</p>
      {actionText && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-3 text-base font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.28)] transition-opacity active:opacity-85"
        >
          {actionText}
        </button>
      )}
      {helpText && (
        <details className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
          <summary className="cursor-pointer text-sm font-black text-violet-200">מה עושים כאן?</summary>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{helpText}</p>
        </details>
      )}
    </div>
  );

  if (!session) {
    return (
      <>
        {showFlowDiagram && (
          <Modal open={showFlowDiagram} onClose={() => setShowFlowDiagram(false)} size="xl">
            <ModalHeader onClose={() => setShowFlowDiagram(false)}>{'\u05EA\u05D9\u05D0\u05D5\u05E8 \u05EA\u05D4\u05DC\u05D9\u05DA \u05D9\u05E6\u05D9\u05E8\u05EA \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D1-Meet-M'}</ModalHeader>
            <ModalBody>
              <p className="text-center text-slate-400 text-base mb-3">{'\u05DB\u05DA \u05E0\u05E8\u05D0\u05D4 \u05D4\u05EA\u05D4\u05DC\u05D9\u05DA \u05DC\u05D9\u05E6\u05D9\u05E8\u05EA \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DA'}</p>
              <div className="border-b-2 border-primary mb-3"></div>
              <div className="w-full mx-auto px-2">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">{'\u05D4\u05EA\u05D7\u05DC\u05D4:'}</h3>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\u2705'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E4\u05EA\u05D9\u05D7\u05EA \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D7\u05D3\u05E9'}</h3>
                        <p className="text-base text-slate-400">{'\u05D0\u05D9\u05E9\u05D5\u05E8 \u05D5\u05D0\u05D9\u05E4\u05D5\u05E1 \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 \u05D7\u05D3\u05E9'}</p>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83D\uDCB0'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05D1\u05D7\u05D9\u05E8\u05EA \u05DE\u05E1\u05DC\u05D5\u05DC'}</h3>
                        <p className="text-base text-slate-400">{'\u05D1\u05D7\u05E8 \u05D0\u05EA \u05D4\u05D7\u05D1\u05D9\u05DC\u05D4 \u05D4\u05DE\u05EA\u05D0\u05D9\u05DE\u05D4 \u05DC\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E9\u05DC\u05DA'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">{'\u05D4\u05D2\u05D3\u05E8\u05EA \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2:'}</h3>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83C\uDF89'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E9\u05DC\u05D1 1: \u05E1\u05D5\u05D2 \u05D0\u05D9\u05E8\u05D5\u05E2'}</h3>
                        <p className="text-base text-slate-400">{'\u05D7\u05EA\u05D5\u05E0\u05D4, \u05D1\u05E8 \u05DE\u05E6\u05D5\u05D5\u05D4, \u05D9\u05D5\u05DD \u05D4\u05D5\u05DC\u05D3\u05EA \u05D5\u05E2\u05D5\u05D3'}</p>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83D\uDCDD'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E9\u05DC\u05D1 2: \u05E4\u05E8\u05D8\u05D9 \u05D4\u05D0\u05D9\u05E8\u05D5\u05E2'}</h3>
                        <p className="text-base text-slate-400">{'\u05EA\u05D0\u05E8\u05D9\u05DA, \u05E9\u05E2\u05D4, \u05DE\u05E7\u05D5\u05DD \u05D5\u05E4\u05E8\u05D8\u05D9\u05DD \u05E0\u05D5\u05E1\u05E4\u05D9\u05DD'}</p>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83C\uDFA8'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E9\u05DC\u05D1 3: \u05E2\u05D9\u05E6\u05D5\u05D1 \u05D4\u05D6\u05DE\u05E0\u05D4'}</h3>
                        <p className="text-base text-slate-400">{'\u05D1\u05D7\u05E8 \u05DE\u05EA\u05D5\u05DA 45 \u05EA\u05D1\u05E0\u05D9\u05D5\u05EA \u05DE\u05E2\u05D5\u05E6\u05D1\u05D5\u05EA'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">{'\u05E0\u05D9\u05D4\u05D5\u05DC \u05D5\u05DE\u05E2\u05E7\u05D1:'}</h3>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83D\uDCF1'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E9\u05DC\u05D1 4: \u05E9\u05DC\u05D9\u05D7\u05EA \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA'}</h3>
                        <p className="text-base text-slate-400">{'\u05E9\u05DC\u05D9\u05D7\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05DC SMS \u05D5-WhatsApp'}</p>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                      <div className="text-4xl flex-shrink-0">{'\uD83D\uDCCA'}</div>
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-bold text-primary">{'\u05E9\u05DC\u05D1 5: \u05D3\u05D5\u05D7\u05D5\u05EA \u05D1\u05E7\u05E8\u05D4'}</h3>
                        <p className="text-base text-slate-400">{'\u05DE\u05E2\u05E7\u05D1 \u05D0\u05D9\u05E9\u05D5\u05E8\u05D9 \u05D4\u05D2\u05E2\u05D4 \u05D5\u05D9\u05D9\u05E6\u05D5\u05D0 \u05DC\u05D0\u05E7\u05E1\u05DC'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <button
                onClick={() => setShowFlowDiagram(false)}
                className="border border-white/15 bg-transparent text-white hover:border-indigo-300 hover:text-indigo-200 rounded-full px-8 py-3 font-medium transition-all"
              >{'\u05E1\u05D2\u05D5\u05E8'}</button>
            </ModalFooter>
          </Modal>
        )}
      </>
    );
  }

  return (
    <>
      {/* Capacity Limit Warning Modal */}
      <Modal open={showPlanLimitWarning} onClose={() => { setShowPlanLimitWarning(false); resetCapacityWarningGuests(); }} size="md">
        <ModalHeader onClose={() => { setShowPlanLimitWarning(false); resetCapacityWarningGuests(); }}>חרגת ממכסת ההודעות!</ModalHeader>
        <ModalBody>
          {showPlanLimitWarning && (() => {
            const baseLimit = getPlanBaseLimit(selectedPlan || planForDisplay || userPlanSettings?.plan || null) || 0;
            const extraCapacity = addonCountForDisplay * (getPlanBaseLimit('addon') || 100);
            const totalLimit = baseLimit + extraCapacity;
            const messagesOverQuota = Math.max(0, effectiveMessagesSentCount - totalLimit);
            const addonUnit = getPlanBaseLimit('addon') || 100;
            const numPackages = Math.max(1, pendingAddonCount);
            const totalMessages = numPackages * addonUnit;
            const totalCost = numPackages * 100;

            return (
              <div className="text-center">
                  <h2 className="text-xl font-bold text-amber-200 mb-2">חרגת ממכסת ההודעות!</h2>
                  <p className="text-sm text-slate-300 mb-3">
                    נשלחו <strong className="text-amber-200">{effectiveMessagesSentCount}</strong> הודעות
                  </p>

                  <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-center gap-3 mb-1">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-100">{totalLimit}</div>
                        <div className="text-xs text-slate-400">מכסת הודעות נוכחית</div>
                      </div>
                      <div className="text-xl text-slate-400">→</div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-300">{effectiveMessagesSentCount}</div>
                        <div className="text-xs text-slate-400">הודעות שנשלחו</div>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-300">
                      נדרשים עוד <strong className="text-red-400">{messagesOverQuota}</strong> הודעות במכסה
                    </p>
                  </div>

                  <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-3 mb-3">
                    <h3 className="text-base font-bold text-emerald-300 mb-1">💰 חבילות הרחבה – 100 הודעות / ₪100</h3>
                    <p className="text-xs text-slate-300 font-semibold mb-2">בחר כמה חבילות לרכוש:</p>
                    <div className="flex flex-wrap justify-center gap-1.5 mb-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPendingAddonCount(n)}
                          className={`w-9 h-9 rounded-full font-bold border-2 text-sm transition-all ${
                            numPackages === n
                              ? 'bg-emerald-600 text-white border-emerald-400/50'
                              : 'bg-white/10 border border-white/20 text-white hover:border-emerald-400'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-slate-300">
                      <strong>{numPackages}</strong> {numPackages === 1 ? 'חבילה' : 'חבילות'} = <strong>{totalMessages}</strong> הודעות נוספות
                      {' · '}
                      <strong>סה"כ:</strong> <span className="text-lg font-bold text-emerald-300">₪{totalCost}</span>
                    </p>
                  </div>

                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handlePurchaseAddon}
                      className="bg-gradient-to-r from-emerald-600 to-emerald-600 text-white border-2 border-emerald-400/50 rounded-full px-6 py-3 font-bold text-base hover:from-emerald-700 hover:to-emerald-700 transition-all shadow-lg"
                    >
                      🛒 רכוש {numPackages} {numPackages === 1 ? 'חבילה' : 'חבילות'} (₪{totalCost})
                    </button>
                    <button
                      onClick={() => {
                        setShowPlanLimitWarning(false);
                        resetCapacityWarningGuests();
                      }}
                      className="border border-white/15 bg-transparent text-white hover:border-indigo-300 hover:text-indigo-200 rounded-full px-5 py-3 font-medium text-sm transition-all"
                    >
                      ביטול
                    </button>
                  </div>

                <p className="text-xs text-slate-400 mt-2">
                  * תשלום חד פעמי לאירוע • ללא מנויים
                </p>
              </div>
            );
          })()}
        </ModalBody>
      </Modal>

      {/* הודעה כשהאירוע הסתיים (עבר התאריך) – מאפשר למשתמש להבין שאפשר לפתוח אירוע חדש */}
      {showEventEndedNotice && !currentEventId && !newEventStarted && (
        <div className="fixed left-4 right-4 bottom-32 z-40 max-w-2xl mx-auto bg-emerald-500/20 border border-emerald-400/30 rounded-xl shadow-lg p-4 flex flex-col gap-3">
          <p className="text-emerald-300 font-semibold text-center text-lg">
            האירוע הסתיים. כעת ניתן לפתוח אירוע חדש.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShowEventEndedNotice(false);
              }}
              className="bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold py-2 px-6 rounded-xl"
            >
              הבנתי
            </button>
          </div>
        </div>
      )}

      {/* הודעה כשהמשתמש לוחץ על שלב 1–4 בלי ליצור אירוע ולבחור מסלול */}
      {showStepError && (
        <div className="fixed left-4 right-4 bottom-24 z-30 max-w-2xl mx-auto bg-amber-500/10 border border-amber-400/30 backdrop-blur-xl rounded-xl shadow-2xl shadow-amber-950/30 p-4 flex flex-col gap-3">
          <p className="text-amber-100 font-semibold text-center text-lg">{stepErrorMsg}</p>
          <button
            type="button"
            onClick={() => { setShowStepError(false); setStepErrorMsg(''); }}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-300/30 font-bold py-2 px-6 rounded-full mx-auto transition-colors"
          >
            הבנתי
          </button>
        </div>
      )}

      {hasSession && mobileSmartActionModel.shouldShow && (
        <section className="mx-auto mb-4 w-full max-w-md rounded-[1.75rem] border border-violet-300/25 bg-white/[0.06] p-4 text-right shadow-[0_14px_44px_rgba(0,0,0,0.36)] ring-1 ring-violet-400/20 backdrop-blur-2xl sm:hidden" dir="rtl">
          <div className="text-center">
            <div className="text-sm font-black text-violet-200">המערכת ממליצה מה לעשות עכשיו</div>
            <h2 className="mt-1 text-3xl font-black leading-tight text-white">מרכז פעולות חכם</h2>
            {(selectedEventType || mobileResumeEventDateText) && (
              <div className="mx-auto mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-300/25 bg-violet-500/15 px-4 py-2 text-sm font-black text-violet-100">
                <span className="truncate">{selectedEventType || 'אירוע'}</span>
                {mobileResumeEventDateText && <span className="text-slate-400">·</span>}
                {mobileResumeEventDateText && <span>{mobileResumeEventDateText}</span>}
              </div>
            )}
          </div>

          <div className={`mt-4 rounded-3xl border p-4 text-center ${
            mobileSmartActionModel.tone === 'emerald'
              ? 'border-emerald-400/35 bg-emerald-500/[0.12]'
              : 'border-violet-400/35 bg-violet-500/15'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl text-white">
                {mobileSmartActionModel.icon}
              </div>
              <div className="min-w-0 flex-1 text-right">
                <div className="text-sm font-black text-emerald-200">הפעולה המומלצת</div>
                <h3 className="mt-1 text-2xl font-black leading-tight text-white">{mobileSmartActionModel.title}</h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-300">{mobileSmartActionModel.description}</p>
              </div>
              <div className="shrink-0 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-center">
                <div className="text-sm font-black text-emerald-200">{mobileSmartActionModel.badge}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleMobileSmartAction(mobileSmartActionModel.action)}
              className="mt-4 w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-3.5 text-lg font-black text-white shadow-[0_10px_26px_rgba(16,185,129,0.30)] transition-opacity active:opacity-85"
            >
              {mobileSmartActionModel.actionText}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={openMobileReminderFlow}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.055] px-4 py-3 text-right transition-colors active:bg-white/[0.10]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-xl text-violet-100">✈</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black text-white">שלח תזכורת</span>
                <span className="block text-xs font-semibold text-slate-400">פתח את מסך השליחה לאורחים</span>
              </span>
              <span className="text-2xl text-violet-200">‹</span>
            </button>
            <button
              type="button"
              onClick={() => openMobileResumeStep(4)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.055] px-4 py-3 text-right transition-colors active:bg-white/[0.10]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 text-xl text-blue-100">+</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black text-white">שלח הזמנה ראשונה</span>
                <span className="block text-xs font-semibold text-slate-400">הוסף אורח ושלח הזמנה</span>
              </span>
              <span className="text-2xl text-violet-200">‹</span>
            </button>
            <button
              type="button"
              onClick={() => openMobileResumeStep(5)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.055] px-4 py-3 text-right transition-colors active:bg-white/[0.10]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/20 text-xl text-indigo-100">▥</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black text-white">פתח דוחות</span>
                <span className="block text-xs font-semibold text-slate-400">צפה בדוחות ועקוב אחרי ההזמנות</span>
              </span>
              <span className="text-2xl text-violet-200">‹</span>
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-center">
            <div className="text-sm font-black text-violet-200">תובנה חכמה</div>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
              כדאי לשלוח תזכורת 5 ימים לפני האירוע לפי ערוץ ההזמנה המקורי.
            </p>
          </div>
        </section>
      )}

      {hasSession && mobileEventTodayModel.shouldShow && (
        <section className="mx-auto mb-4 w-full max-w-md overflow-hidden rounded-[1.75rem] border border-violet-300/25 bg-white/[0.06] text-right shadow-[0_14px_44px_rgba(0,0,0,0.36)] ring-1 ring-violet-400/20 backdrop-blur-2xl sm:hidden" dir="rtl">
          <div className="relative p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.30),transparent_42%),linear-gradient(135deg,rgba(16,185,129,0.12),rgba(99,102,241,0.12))]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-black text-violet-200">ניהול בזמן אמת</div>
                  <h2 className="mt-1 text-3xl font-black leading-tight text-white">האירוע היום</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-300">
                    הכל מוכן לניהול מהיר מהנייד
                  </p>
                </div>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/20 text-2xl shadow-[0_8px_26px_rgba(139,92,246,0.32)]">
                  {eventTypeIcons[selectedEventType] || '✦'}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/12 bg-[#11163d]/65 px-4 py-3">
                <div className="text-lg font-black text-white">
                  {selectedEventType || 'אירוע'}
                  <span className="text-violet-200"> · {mobileEventTodayModel.dateText}</span>
                </div>
                {mobileEventTodayModel.venueText && (
                  <div className="mt-1 truncate text-sm font-semibold text-slate-300">
                    {mobileEventTodayModel.venueText}
                  </div>
                )}
                <div className="mt-3 inline-flex rounded-full border border-violet-300/30 bg-violet-500/25 px-4 py-2 text-sm font-black text-violet-100">
                  {mobileEventTodayModel.statusText}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 px-4 pb-4">
            <button
              type="button"
              onClick={() => openMobileResumeStep(5)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-right transition-colors active:bg-emerald-500/25"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-2xl text-emerald-200">▥</span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-black text-white">פתח דוחות עכשיו</span>
                <span className="block text-xs font-semibold text-emerald-100/80">צפה בנתונים ודוחות בזמן אמת</span>
              </span>
              <span className="text-2xl text-emerald-100">‹</span>
            </button>

            <button
              type="button"
              onClick={openMobilePendingReport}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/[0.12] px-4 py-3 text-right transition-colors active:bg-amber-500/[0.22]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-2xl text-amber-200">◷</span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-black text-white">מי עדיין לא הגיב?</span>
                <span className="block text-xs font-semibold text-amber-100/80">רשימת אורחים שממתינים לתגובה</span>
              </span>
              <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-[#1f1233]">{guestStatusSummary.pending || 0}</span>
            </button>

            <button
              type="button"
              onClick={openMobileReminderFlow}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-violet-400/35 bg-violet-500/15 px-4 py-3 text-right transition-colors active:bg-violet-500/25"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-2xl text-violet-100">✈</span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-black text-white">שלח תזכורת</span>
                <span className="block text-xs font-semibold text-violet-100/80">פתח את מסך השליחה להודעת תזכורת</span>
              </span>
              <span className="text-2xl text-violet-100">‹</span>
            </button>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-2 py-2">
                <div className="text-xl font-black text-emerald-300">{invitedCount}</div>
                <div className="text-[11px] font-bold text-slate-400">מוזמנים</div>
              </div>
              <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-2 py-2">
                <div className="text-xl font-black text-blue-300">{guestStatusSummary.approved || 0}</div>
                <div className="text-[11px] font-bold text-slate-400">אישרו</div>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-2 py-2">
                <div className="text-xl font-black text-amber-300">{guestStatusSummary.pending || 0}</div>
                <div className="text-[11px] font-bold text-slate-400">ממתינים</div>
              </div>
            </div>

            {guestStatusSummary.pending > 0 && (
              <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-center">
                <div className="text-sm font-black text-violet-200">כדאי לשלוח תזכורת אחרונה לממתינים</div>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {guestStatusSummary.pending} אורחים עדיין לא אישרו הגעה
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {hasSession && mobileReminderStatusModel.shouldShow && (
        <section className="mx-auto mb-4 w-full max-w-md rounded-[1.75rem] border border-amber-300/30 bg-white/[0.06] p-4 text-right shadow-[0_14px_44px_rgba(0,0,0,0.34)] ring-1 ring-amber-400/20 backdrop-blur-2xl sm:hidden" dir="rtl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-black text-amber-200">תזכורת אוטומטית פעילה</div>
              <h2 className="mt-1 text-2xl font-black leading-tight text-white">המערכת תזכיר לאורחים בזמן</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-300">
                תישלח {mobileReminderStatusModel.reminderDaysBefore} ימים לפני האירוע לפי ערוץ ההזמנה המקורי.
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/35 bg-amber-500/15 text-2xl text-amber-200">
              🔔
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-3 text-center">
              <div className="text-lg font-black text-emerald-300">WhatsApp</div>
              <div className="mt-1 text-xs font-bold text-slate-300">
                {mobileReminderStatusModel.whatsappCount} אורחים שקיבלו WhatsApp
              </div>
            </div>
            <div className="rounded-2xl border border-blue-400/25 bg-blue-500/10 px-3 py-3 text-center">
              <div className="text-lg font-black text-blue-300">SMS</div>
              <div className="mt-1 text-xs font-bold text-slate-300">
                {mobileReminderStatusModel.smsCount} אורחים שקיבלו SMS
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-[#11163d]/70 px-4 py-3 text-center">
            <div className="text-sm font-black text-amber-200">{mobileReminderStatusModel.statusText}</div>
            {mobileReminderStatusModel.unknownCount > 0 && (
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {mobileReminderStatusModel.unknownCount} אורחים ישנים ללא ערוץ שמור לא יקבלו תזכורת אוטומטית עד שיוגדר להם ערוץ.
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openMobileResumeStep(5)}
              className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 px-4 py-3 text-base font-black text-white shadow-[0_10px_24px_rgba(99,102,241,0.28)] transition-opacity active:opacity-85"
            >
              פתח דוחות
            </button>
            <button
              type="button"
              onClick={openMobileReminderFlow}
              className="rounded-2xl border border-white/14 bg-white/[0.055] px-4 py-3 text-base font-black text-slate-100 transition-colors active:bg-white/[0.10]"
            >
              שלח ידנית
            </button>
          </div>
        </section>
      )}

      {hasSession && mobileResumeModel.shouldShow && (
        <section className="mx-auto mb-4 w-full max-w-md rounded-[1.75rem] border border-violet-300/25 bg-white/[0.06] p-4 text-right shadow-[0_14px_44px_rgba(0,0,0,0.36)] ring-1 ring-violet-400/20 backdrop-blur-2xl sm:hidden" dir="rtl">
          <div className="text-center">
            <div className="text-sm font-black text-violet-200">Meet-M זוכר את האירוע שלך</div>
            <h2 className="mt-1 text-2xl font-black leading-tight text-white">המשך מאיפה שעצרת</h2>
            <p className="mt-1 text-sm font-semibold text-slate-300">האירוע שלך מוכן להמשך עבודה</p>
          </div>

          <div className="mt-4 rounded-3xl border border-white/12 bg-[#11163d]/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-black text-white">
                  {selectedEventType || 'אירוע בתהליך'}
                  {mobileResumeEventDateText ? <span className="text-violet-200"> · {mobileResumeEventDateText}</span> : null}
                </div>
                <div className="mt-1 text-sm font-bold text-emerald-200">
                  {mobileResumeModel.completedCount > 0
                    ? `שלב ${mobileResumeModel.completedCount} מתוך 5 הושלם`
                    : 'האירוע מוכן להתחלה'}
                </div>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/20 text-2xl shadow-[0_8px_26px_rgba(139,92,246,0.32)]">
                {eventTypeIcons[selectedEventType] || '✦'}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-1.5" aria-label="התקדמות האירוע">
              {[1, 2, 3, 4, 5].map((stepNumber) => {
                const isDone = stepNumber <= mobileResumeModel.completedCount;
                return (
                  <div
                    key={stepNumber}
                    className={`h-3 rounded-full ${isDone ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_12px_rgba(52,211,153,0.42)]' : 'bg-white/12'}`}
                  />
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => openMobileResumeStep(mobileResumeModel.nextStep)}
                className="w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-3.5 text-lg font-black text-white shadow-[0_10px_28px_rgba(16,185,129,0.32)] transition-opacity active:opacity-85"
              >
                {mobileResumeModel.continueLabel}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openMobileResumeStep(4)}
                  className="rounded-2xl border border-violet-300/30 bg-violet-500/[0.18] px-3 py-3 text-base font-black text-violet-100 transition-colors active:bg-violet-500/[0.28]"
                >
                  עבור לשליחה
                </button>
                <button
                  type="button"
                  onClick={() => openMobileResumeStep(5)}
                  className="rounded-2xl border border-white/12 bg-white/[0.06] px-3 py-3 text-base font-black text-slate-100 transition-colors active:bg-white/[0.10]"
                >
                  פתח דוחות
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-2 py-2">
              <div className="text-xl font-black text-emerald-300">{invitedCount}</div>
              <div className="text-[11px] font-bold text-slate-400">מוזמנים</div>
            </div>
            <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-2 py-2">
              <div className="text-xl font-black text-blue-300">{guestStatusSummary.approved || 0}</div>
              <div className="text-[11px] font-bold text-slate-400">אישרו</div>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-2 py-2">
              <div className="text-xl font-black text-amber-300">{guestStatusSummary.pending || 0}</div>
              <div className="text-[11px] font-bold text-slate-400">ממתינים</div>
            </div>
          </div>
        </section>
      )}

      {/* סרגל שלבים: למשתמש מחובר תמיד (לא רק כשיש אירוע פעיל) — אחרת נעלם אחרי מחיקת אירוע / רענון */}
      {hasSession && (
      <div
        ref={stepBarAnchorRef}
        className="relative mx-[calc(50%-50vw)] w-screen min-h-[31rem] sm:min-h-[5.25rem]"
        style={stepBarHeight ? { minHeight: `${stepBarHeight}px` } : undefined}
      >
      <div
        ref={stepBarRef}
        className={`${stepBarPhase === 'settled' ? 'absolute inset-x-0 bottom-0' : 'fixed inset-x-0 bottom-0'} z-20 w-screen bg-gradient-to-b from-[#1a1d4a]/95 to-[#12143a]/95 backdrop-blur-2xl border-y border-white/[0.12] shadow-[0_-8px_32px_-4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] py-2.5 px-3 sm:pt-3 sm:px-4`}
        style={{
          paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom, 0.6rem))',
          transform: stepBarPhase === 'settled' ? undefined : stepBarTransform,
          transition: stepBarPhase === 'settling'
            ? `transform ${STEP_BAR_SETTLE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
            : 'none',
          willChange: stepBarPhase === 'settled' ? undefined : 'transform',
        }}
        onTransitionEnd={(event) => {
          if (event.currentTarget !== event.target || event.propertyName !== 'transform') return;
          setStepBarPhase('settled');
          setStepBarTransform('translate3d(0, 0, 0)');
        }}
      >
        <div className="flex flex-col gap-2 sm:hidden px-2">
          <div className="flex flex-col gap-2">
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
                    const mustStartFirst = !currentEventId && !newEventStarted && !planForDisplay;
                    if (mustStartFirst) {
                      setStepErrorMsg('\u05D9\u05E9 \u05EA\u05D7\u05D9\u05DC\u05D4 \u05DC\u05D9\u05E6\u05D5\u05E8 \u05D0\u05D9\u05E8\u05D5\u05E2 \u05D5\u05DC\u05D1\u05D7\u05D5\u05E8 \u05DE\u05E1\u05DC\u05D5\u05DC \u05EA\u05E9\u05DC\u05D5\u05DD.');
                      setShowStepError(true);
                      return;
                    }
                    if (realIdx === 1) { setShowEventTypes(true); setStepErrorMsg(''); }
                    else if (realIdx === 2) { setShowEventDetails(true); setStepErrorMsg(''); }
                    else if (realIdx === 3) { setShowDesignChooser(true); setStepErrorMsg(''); }
                  }}
                  className={`relative flex min-h-[4.75rem] w-full flex-col items-center justify-center gap-1.5 rounded-2xl py-4 px-5 text-center transition-all ${
                    isFinished
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,70,230,0.45)]'
                      : isDesign
                        ? 'bg-violet-500/15 text-violet-100 border border-violet-400/40 shadow-[0_2px_10px_rgba(139,92,246,0.25)]'
                        : 'bg-white/[0.06] text-slate-100 border border-white/15 hover:bg-white/[0.10] hover:border-indigo-400/40'
                  }`}
                >
                  {isFinished && (
                    <span className="absolute left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-lg font-black text-white">
                      ✓
                    </span>
                  )}
                  <span className="text-sm font-bold leading-none text-slate-400">
                    שלב {realIdx}
                  </span>
                  <span className="text-center text-2xl font-black leading-tight text-slate-100">
                    {stepsMobile[realIdx]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
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
                      const mustStartFirst = !currentEventId && !newEventStarted && !planForDisplay;
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
                  className={`relative flex min-h-[4.75rem] w-full flex-col items-center justify-center gap-1.5 rounded-2xl py-4 px-5 text-center transition-all ${
                    isFinished
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,70,230,0.45)]'
                      : 'bg-white/[0.06] text-slate-100 border border-white/15 hover:bg-white/[0.10] hover:border-indigo-400/40'
                  }`}
                >
                  {isFinished && (
                    <span className="absolute left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-lg font-black text-white">
                      ✓
                    </span>
                  )}
                  <span className="text-sm font-bold leading-none text-slate-400">
                    שלב {realIdx}
                  </span>
                  <span className="text-center text-2xl font-black leading-tight text-slate-100">
                    {stepsMobile[realIdx]}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              style={{ cursor: 'pointer', position: 'relative', zIndex: 21, pointerEvents: 'auto' }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openWhatsAppGroupModal();
              }}
              className="relative flex min-h-[4.75rem] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 py-4 px-5 text-center text-emerald-200 shadow-[0_2px_10px_rgba(16,185,129,0.25)] transition-all"
            >
              <span className="text-center text-2xl font-black leading-tight">קבוצת וואטסאפ</span>
            </button>
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
                  const mustStartFirst = !currentEventId && !newEventStarted && !planForDisplay;
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
                    ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white border border-indigo-400/50 rounded-full px-7 py-3 font-bold shadow-[0_6px_20px_rgba(99,70,230,0.45)] hover:opacity-90 transition-all text-base shrink-0'
                    : realIdx === 3
                      ? 'bg-violet-500/15 text-violet-100 border border-violet-400/40 rounded-full px-7 py-3 font-bold shadow-[0_4px_14px_rgba(139,92,246,0.3)] hover:bg-violet-500/25 transition-all text-base shrink-0'
                      : 'bg-white/[0.06] text-slate-100 border border-white/15 rounded-full px-7 py-3 font-bold hover:bg-white/[0.10] hover:border-indigo-400/50 transition-all text-base shrink-0'
                }`}
              >
                {step}
              </button>
            );
          })}
          {shouldShowWhatsAppGroupUpdateButton && (
            <button
              type="button"
              style={{ cursor: 'pointer', position: 'relative', zIndex: 21, pointerEvents: 'auto' }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openWhatsAppGroupModal();
              }}
              className="bg-emerald-500/15 text-emerald-200 border border-emerald-400/40 rounded-full px-7 py-3 font-bold shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:bg-emerald-500/25 transition-all text-base shrink-0"
            >
              צור/עדכן קבוצת וואטסאפ
            </button>
          )}
        </div>
      </div>
      </div>
      )}

      {/* Error message is now displayed in HeroSection instead */}
      {/* Status and Summary Tables */}
      <div ref={reportsSectionRef} className="w-full px-4 mb-0 mt-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          
          {/* First Column - Event Status */}
          <div className="w-full flex flex-col gap-6">
            {/* Tranzila terminal name - always visible */}
            {tranzilaTerminalInfo && (
              <div className="bg-white/[0.06] border border-white/15 p-2 text-center rounded-lg w-full text-sm text-slate-200">
                מסוף טרנזילה: <strong>{tranzilaTerminalInfo.terminal}</strong>
                {tranzilaTerminalInfo.isTestTerminal && (
                  <span className="text-orange-300 mr-1">(מסוף בדיקות)</span>
                )}
              </div>
            )}
            {currentEventId ? (
              <div className="bg-white/[0.055] border border-white/15 backdrop-blur-xl rounded-2xl p-4 sm:p-6 text-center shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-2 ring-indigo-400/30 w-full">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">✅</span>
                  <h3 className="text-xl font-bold text-emerald-300">יש אירוע פעיל במערכת</h3>
                </div>
                <p className="text-slate-300">
                  <strong>סוג האירוע:</strong> {selectedEventType || 'לא מוגדר'}
                </p>
                {formData.date && (
                  <p className="text-slate-300">
                    <strong>תאריך האירוע:</strong> {new Date(formData.date).toLocaleDateString('he-IL')}
                  </p>
                )}
                {formData.hallName && (
                  <p className="text-slate-300">
                    <strong>אולם:</strong> {formData.hallName}
                  </p>
                )}
                {formData.date && (
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-lg p-3 mt-3 mb-2">
                    <p className="text-emerald-200 font-bold text-2xl text-center">
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
                <p className="text-emerald-300 text-base mt-2 font-bold">
                  האירוע מוכן לשליחת הזמנות ואישורי הגעה
                </p>
              </div>
            ) : newEventStarted ? (
              <div className="bg-white/[0.055] border border-white/15 backdrop-blur-xl rounded-2xl p-4 text-center shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-2 ring-indigo-400/30 flex-1">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">🚀</span>
                  <h3 className="text-lg font-bold text-indigo-300">מסלול פעיל – הזמן להתחיל אירוע חדש</h3>
                </div>
                <p className="text-slate-300 mb-2">
                  רכשת {getPlanDisplayName(selectedPlan) || 'מסלול'} בהצלחה. האירוע הקודם נסגר והמערכת מוכנה לאירוע חדש.
                </p>
                <p className="text-slate-300">
                  התחל בשלב 1 כדי לבחור סוג אירוע ולהזין את הפרטים.
                </p>
                <div className="flex justify-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEventTypes(true);
                      setStepErrorMsg('');
                    }}
                    className="bg-primary text-white font-bold py-2 px-4 rounded-full hover:bg-primary/90 transition-all shadow"
                  >
                    עבור לשלב 1 – סוג אירוע
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPricingPlan(true)}
                    className="border border-white/15 bg-transparent text-white font-semibold hover:border-indigo-300 hover:text-indigo-200 py-2 px-4 rounded-full transition-all"
                  >
                    בחר מסלול אחר
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.055] border border-white/15 backdrop-blur-xl rounded-2xl p-4 text-center shadow-lg flex-1">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">📅</span>
                  <h3 className="text-lg font-bold text-slate-100">אין אירוע פעיל</h3>
                </div>
                <p className="text-slate-300">
                  אין אירוע פעיל במערכת. לחץ על "צור אירוע חדש" כדי להתחיל.
                </p>
              </div>
            )}
            {(planForDisplay || currentEventId) && (
              <div className="bg-white/[0.055] border border-white/15 backdrop-blur-xl rounded-2xl p-4 sm:p-6 text-center shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-2 ring-amber-400/30 w-full" style={{ minHeight: 'min(280px, 50vh)' }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">💰</span>
                  <h3 className="text-xl font-bold text-amber-300">מסלול פעיל</h3>
                </div>
                {/* Display Tranzila Terminal Info */}
                {tranzilaTerminalInfo && (
                  <div className="text-xs text-slate-400 mb-2 px-2">
                    מסוף טרנזילה: <strong>{tranzilaTerminalInfo.terminal}</strong>
                    {tranzilaTerminalInfo.isTestTerminal && (
                      <span className="text-orange-300 ml-1">(מסוף בדיקות)</span>
                    )}
                  </div>
                )}
                <div className="mt-3">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3 space-y-3">
                    <div>
                      <div className="text-lg font-bold text-amber-300 mb-1">
                        {displayPlanCode === 'basic' || displayPlanCode === 'free' ? 'מסלול א' : 
                         displayPlanCode === 'standard' ? 'מסלול ב' : 
                         displayPlanCode === 'premium' ? 'מסלול ג' : 
                         displayPlanCode === 'luxury' ? 'מסלול ד' : 
                         displayPlanCode === 'elite' ? 'מסלול ה' : 
                         displayPlanCode === 'supreme' ? 'מסלול ו' : 'מסלול א'}
                      </div>
                      <div className="text-base text-slate-300 font-semibold">
                        {displayPlanCode === 'basic' || displayPlanCode === 'free' ? '₪1 - עד 50 הודעות' :
                         displayPlanCode === 'standard' ? '149₪ - מ 51 עד 200 הודעות' :
                         displayPlanCode === 'premium' ? '199₪ - מ 201 עד 350 הודעות' :
                         displayPlanCode === 'luxury' ? '259₪ - מ 351 עד 500 הודעות' :
                         displayPlanCode === 'elite' ? '349₪ - מ 501 עד 650 הודעות' :
                         displayPlanCode === 'supreme' ? '499₪ - מ 651 עד 1000 הודעות' : '₪1 - עד 50 הודעות'}
                      </div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg p-3">
                      <div className="text-sm font-semibold text-amber-200 flex items-center justify-center gap-2 mb-2">
                        <span className="text-lg">📦</span>
                        <span>חבילות נוספות שנרכשו:</span>
                      </div>
                      {displayPackageEntries.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-2 mb-3">
                          {displayPackageEntries.map(({ id, label, count, extra }) => (
                            <div key={id} className="flex items-center gap-2 bg-white/5 border border-amber-400/20 rounded-full px-3 py-1 shadow-sm">
                              <span className="text-sm font-semibold text-amber-200">
                                {label} × {count}
                              </span>
                              {extra > 0 && (
                                <span className="text-xs text-amber-300">
                                  +{extra} הודעות נוספות
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : displayAdditionalCapacityValue > 0 ? (
                        <p className="text-sm text-slate-300 text-center">
                          הקיבולת הוגדלה ב-{displayAdditionalCapacityValue} באמצעות חבילות הרחבה.
                        </p>
                      ) : (
                        <p className="text-sm text-slate-300 text-center">לא נרכשו חבילות נוספות</p>
                      )}
                      <div className="text-base font-bold text-amber-200">
                        סה״כ כיסוי: {totalPlanCapacity} הודעות
                        {additionalCapacity > 0 && (
                          <> (מתוכם {additionalCapacity} באמצעות חבילות הרחבה)</>
                        )}
                      </div>
                    </div>
                    {activePlanDescription && (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-2">
                        <div className="text-base text-slate-300 text-right leading-relaxed">
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
              <div className="bg-white/[0.055] border border-white/15 backdrop-blur-xl rounded-2xl p-4 sm:p-6 text-center shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-2 ring-indigo-400/30 w-full">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xl">👥</span>
                  <h3 className="text-lg font-bold text-indigo-300">סיכום כל האורחים המוזמנים</h3>
                </div>
                <div className="mt-1">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                    {!shouldShowCharts ? (
                      <div className="py-10 text-sm text-slate-400 text-center">טוען נתונים...</div>
                    ) : hasGuestSummaryData ? (
                      <div>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart
                            data={guestSummaryChartData}
                            margin={{ top: 16, right: 20, left: -10, bottom: 8 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                              dataKey="name"
                              stroke="#cbd5e1"
                              tick={{
                                fontSize: isMobileView ? 11 : 13,
                                fontWeight: 600,
                                fill: isMobileView ? '#FDE68A' : '#cbd5e1',
                              }}
                              interval={0}
                              tickFormatter={(value) => {
                                if (value === 'adults') return 'מבוגרים';
                                if (value === 'children') return 'ילדים';
                                if (value === 'total') return "סה\"כ";
                                return value;
                              }}
                              tickLine={false}
                              axisLine={false}
                              tickMargin={isMobileView ? 8 : 10}
                            />
                            <YAxis hide />
                            <Tooltip content={() => null} active={false} cursor={false} />
                            <Bar
                              dataKey="value"
                              radius={[8, 8, 0, 0]}
                              maxBarSize={60}
                              isAnimationActive={false}
                            >
                              {guestSummaryChartData.map((item) => (
                                <Cell key={item.key} fill={item.color} />
                              ))}
                              <LabelList dataKey="value" content={renderGuestSummaryLabel} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="py-10 text-sm text-slate-400 text-center">אין נתונים להצגה עדיין</div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-base">
                    <div className="min-w-0 bg-white/5 border border-white/10 rounded-xl p-3 text-right">
                      <div className="text-base font-semibold text-emerald-300">מבוגרים</div>
                      <div className={`${previewMetricValueClass} text-3xl font-bold text-emerald-200`}>{guestSummary.adults}</div>
                    </div>
                    <div className="min-w-0 bg-white/5 border border-white/10 rounded-xl p-3 text-right">
                      <div className="text-base font-semibold text-orange-400">ילדים</div>
                      <div className={`${previewMetricValueClass} text-3xl font-bold text-orange-300`}>{guestSummary.children}</div>
                    </div>
                    <div className="min-w-0 bg-white/5 border border-white/10 rounded-xl p-3 text-right">
                      <div className="text-base font-semibold text-indigo-300">סה"כ</div>
                      <div className={`${previewMetricValueClass} text-3xl font-bold text-indigo-200`}>{guestSummary.adults + guestSummary.children}</div>
                    </div>
                  </div>
                </div>
              </div>

              {tableSummary.length > 0 && (
                <div className="bg-white/[0.055] border border-white/15 backdrop-blur-xl rounded-2xl p-4 sm:p-6 text-center shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-2 ring-orange-400/30 w-full flex flex-col">
                  <div className="flex items-center justify-center gap-3 mb-3 flex-shrink-0">
                    <span className="text-2xl">📊</span>
                    <h3 className="text-xl font-extrabold text-orange-300 tracking-wide">דוח סיכום שולחנות</h3>
                  </div>
                  <div className="mt-3 overflow-x-auto flex-grow">
                    <table className="w-full text-right border text-base min-w-full">
                      <thead>
                        <tr className="bg-white/5">
                          <th className="p-2 sm:p-3 border border-white/10 font-bold text-center text-orange-300">מס. שולחן</th>
                          <th className="p-2 sm:p-3 border border-white/10 font-bold text-center text-emerald-300">בוגרים</th>
                          <th className="p-2 sm:p-3 border border-white/10 font-bold text-center text-violet-300">ילדים</th>
                          <th className="p-2 sm:p-3 border border-white/10 font-bold text-center text-indigo-300">סה"כ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableSummary.map((row, idx) => {
                          const digits = (v) => String(v).length;
                          const cellSize = (v) => digits(v) >= 4 ? 'text-sm' : digits(v) === 3 ? 'text-base sm:text-xl' : 'text-lg sm:text-2xl';
                          const totalSize = (v) => digits(v) >= 4 ? 'text-sm' : digits(v) === 3 ? 'text-base sm:text-2xl' : 'text-xl sm:text-3xl';
                          return (
                          <tr key={`table-${row.table_number}-${idx}`} className={idx % 2 === 0 ? 'bg-white/5' : 'bg-amber-500/10'}>
                            <td className={`p-1.5 sm:p-3 border border-white/10 text-center font-semibold text-orange-200 ${cellSize(row.table_number)}`}><span className={previewTableNumberClass}>{row.table_number}</span></td>
                            <td className={`p-1.5 sm:p-3 border border-white/10 text-center font-semibold text-emerald-200 ${cellSize(row.adults)}`}><span className={previewTableNumberClass}>{row.adults}</span></td>
                            <td className={`p-1.5 sm:p-3 border border-white/10 text-center font-semibold text-violet-200 ${cellSize(row.children)}`}><span className={previewTableNumberClass}>{row.children}</span></td>
                            <td className={`p-1.5 sm:p-3 border border-white/10 text-center font-bold text-indigo-200 ${totalSize(row.total)}`}><span className={previewTableNumberClass}>{row.total}</span></td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Third Column - Guest Status Summary */}
          {currentEventId && (
            <div className="w-full flex flex-col gap-6">
              <div className="sm:hidden rounded-3xl border border-white/15 bg-white/[0.055] p-4 text-center shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl ring-2 ring-violet-400/25">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-right">
                    <h3 className="text-3xl font-black text-white">דוחות בקרה</h3>
                    <p className="mt-1 text-sm font-semibold text-violet-200">מעקב אישורי הגעה בזמן אמת</p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/20 text-2xl">
                    📊
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['approved', guestStatusSummary.approved, 'מגיעים', '✓', 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'],
                    ['pending', guestStatusSummary.pending, 'טרם הגיבו', '◷', 'border-amber-400/30 bg-amber-500/10 text-amber-300'],
                    ['rejected', guestStatusSummary.rejected, 'לא מגיעים', '×', 'border-rose-400/30 bg-rose-500/10 text-rose-300'],
                  ].map(([key, value, label, icon, tone]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMobileSummaryFilter(key)}
                      className={`rounded-2xl border px-2 py-3 text-center transition-all ${tone} ${mobileSummaryFilter === key ? 'ring-2 ring-white/30' : ''}`}
                    >
                      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg font-black">{icon}</div>
                      <div className="text-3xl font-black leading-none tabular-nums">{value}</div>
                      <div className="mt-1 text-[11px] font-black text-slate-100">{label}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <label className="sr-only" htmlFor="mobile-summary-search">חיפוש אורח</label>
                  <input
                    id="mobile-summary-search"
                    type="search"
                    value={mobileSummarySearch}
                    onChange={(event) => setMobileSummarySearch(event.target.value)}
                    placeholder="חיפוש אורח"
                    className="w-full rounded-full border border-white/10 bg-white/[0.055] px-4 py-2.5 text-right text-sm font-semibold text-slate-100 placeholder:text-slate-500 focus:border-violet-300 focus:outline-none"
                  />
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[
                      ['all', 'כולם'],
                      ['approved', 'מגיעים'],
                      ['pending', 'טרם הגיבו'],
                      ['rejected', 'לא מגיעים'],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMobileSummaryFilter(key)}
                        className={`rounded-full border px-2 py-2 text-xs font-black transition-all ${
                          mobileSummaryFilter === key
                            ? 'border-violet-300/60 bg-violet-500/35 text-white'
                            : 'border-white/10 bg-white/[0.04] text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-right">
                  {mobileFilteredSummaryGuests.length > 0 ? mobileFilteredSummaryGuests.map((guest, idx) => {
                    const status = guest.status === 'approved' || guest.status === 'rejected' ? guest.status : 'pending';
                    const statusMeta = status === 'approved'
                      ? { label: 'מגיע', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30', icon: '✓' }
                      : status === 'rejected'
                        ? { label: 'לא מגיע', className: 'bg-rose-500/15 text-rose-300 border-rose-400/30', icon: '×' }
                        : { label: 'טרם הגיב', className: 'bg-amber-500/15 text-amber-300 border-amber-400/30', icon: '◷' };
                    const mealTags = [
                      ((guest.veg_adults || 0) + (guest.veg_children || 0)) > 0 ? 'צמחוני' : null,
                      ((guest.vegan_adults || 0) + (guest.vegan_children || 0)) > 0 ? 'טבעוני' : null,
                      ((guest.glatt_adults || 0) + (guest.glatt_children || 0)) > 0 ? 'גלאט' : null,
                      ((guest.allergy_adults || 0) + (guest.allergy_children || 0)) > 0 ? 'אלרגיה' : null,
                    ].filter(Boolean);
                    return (
                      <div key={`${guest.phone || guest.first_name || 'guest'}-${idx}`} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-lg font-black text-white">
                              {[guest.first_name, guest.last_name].filter(Boolean).join(' ') || `אורח ${idx + 1}`}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-400">
                              {guest.phone && <span>☎ {guest.phone}</span>}
                              <span>שולחן {guest.table_number || '-'}</span>
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-3 py-1 text-sm font-black ${statusMeta.className}`}>
                            {statusMeta.icon} {statusMeta.label}
                          </span>
                        </div>
                        {mealTags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {mealTags.map((tag) => (
                              <span key={tag} className="rounded-full border border-white/10 bg-white/[0.055] px-2 py-1 text-[11px] font-bold text-slate-300">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center text-sm font-semibold text-slate-400">
                      אין אורחים להצגה בתקציר
                    </div>
                  )}
                </div>

                {!hasStatusData && (
                  <p className="mt-3 text-xs text-slate-400">נתוני אישור הגעה יופיעו לאחר שליחת הזמנות ותגובות אורחים</p>
                )}
              </div>

              <div className="hidden bg-white/[0.055] border border-white/15 backdrop-blur-xl rounded-2xl p-4 sm:block sm:p-6 text-center shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-2 ring-violet-400/30 w-full">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xl">📊</span>
                  <h3 className="text-lg font-bold text-violet-300">סטטוס אישורי הגעה</h3>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 mt-3">
                    {!shouldShowCharts ? (
                    <div className="py-10 text-sm text-slate-400 text-center">טוען נתונים...</div>
                  ) : hasStatusData ? (
                    <div>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
                          <Pie
                            data={statusChartDataNonZero}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={isMobileView ? 40 : 50}
                            outerRadius={isMobileView ? 66 : 76}
                            paddingAngle={statusChartDataNonZero.length > 1 ? 2 : 0}
                            isAnimationActive={false}
                            label={renderStatusSliceLabel}
                            labelLine={false}
                          >
                            {statusChartDataNonZero.map((item) => (
                              <Cell key={item.key} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip content={() => null} active={false} cursor={false} />
                          <Legend
                            verticalAlign="bottom"
                            align="center"
                            layout="horizontal"
                            iconType="circle"
                            wrapperStyle={{
                              width: '100%',
                              direction: 'rtl',
                              textAlign: 'center',
                              color: '#cbd5e1',
                              marginTop: 8,
                              fontSize: 13,
                            }}
                            formatter={(value) => (
                              <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-10 text-sm text-slate-400">אין נתונים להצגה עדיין</div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-base">
                  <div className="min-w-0 bg-white/5 border border-white/10 rounded-xl p-3 text-right">
                    <div className="text-base font-semibold text-emerald-300">אישרו הגעה</div>
                    <div className={`${previewMetricValueClass} text-3xl font-bold text-emerald-300`}>{guestStatusSummary.approved}</div>
                  </div>
                  <div className="min-w-0 bg-white/5 border border-white/10 rounded-xl p-3 text-right">
                    <div className="text-base font-semibold text-amber-300">טרם הגיבו</div>
                    <div className={`${previewMetricValueClass} text-3xl font-bold text-amber-300`}>{guestStatusSummary.pending}</div>
                  </div>
                  <div className="min-w-0 bg-white/5 border border-white/10 rounded-xl p-3 text-right">
                    <div className="text-base font-semibold text-rose-400">לא אישרו</div>
                    <div className={`${previewMetricValueClass} text-3xl font-bold text-rose-400`}>{guestStatusSummary.rejected}</div>
                  </div>
                </div>
                {!hasStatusData && (
                  <p className="text-xs text-slate-400 mt-2 text-center">נתוני אישור הגעה יופיעו לאחר שליחת הזמנות ותגובות אורחים</p>
                )}
              </div>
              {(planForDisplay || currentEventId) && messageCapacityChartModel && (
                  <div className="bg-white/[0.055] border border-white/15 backdrop-blur-xl rounded-2xl p-4 sm:p-6 text-center shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-2 ring-amber-400/30 w-full">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-xl">📈</span>
                      <h3 className="text-lg font-bold text-amber-300">יתרת הודעות</h3>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                      {!shouldShowCharts ? (
                        <div className="py-10 text-sm text-slate-400 text-center">טוען נתונים...</div>
                      ) : messageCapacityChartModel.hasCapacityChartData ? (
                        <div>
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart
                              data={messageCapacityChartModel.capacityChartData}
                              margin={{ top: 16, right: 20, left: -10, bottom: 8 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis
                                dataKey="name"
                                stroke="#cbd5e1"
                                tick={{ fontSize: isMobileView ? 11 : 13, fontWeight: 600, fill: isMobileView ? '#FDE68A' : '#cbd5e1' }}
                                interval={0}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={isMobileView ? 8 : 10}
                              />
                              <YAxis hide />
                              <Tooltip content={() => null} active={false} cursor={false} />
                              <Bar
                                dataKey="value"
                                radius={[8, 8, 0, 0]}
                                maxBarSize={60}
                                isAnimationActive={false}
                              >
                                {messageCapacityChartModel.capacityChartData.map((item) => (
                                  <Cell key={item.key} fill={item.color} />
                                ))}
                                <LabelList dataKey="value" content={renderCapacityLabel} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="py-10 text-sm text-slate-400 text-center">אין נתונים להצגה עדיין</div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-base">
                      <div className="min-w-0 bg-white/5 border border-white/10 rounded-xl p-3 text-right">
                        <div className="text-base font-semibold text-amber-300">מגבלת הודעות</div>
                        <div className={`${previewMetricValueClass} text-3xl font-bold text-amber-200`}>{messageCapacityChartModel.messageLimit}</div>
                      </div>
                      <div className="min-w-0 bg-white/5 border border-white/10 rounded-xl p-3 text-right">
                        <div className="text-base font-semibold text-indigo-300">הודעות שנשלחו</div>
                        <div className={`${previewMetricValueClass} text-3xl font-bold text-indigo-200`}>{messageCapacityChartModel.messagesSent}</div>
                      </div>
                      <div className={`min-w-0 bg-white/5 rounded-xl border ${messageCapacityChartModel.overMessages > 0 ? 'border-red-400/30' : 'border-emerald-400/30'} p-3 text-right`}>
                        <div className={`text-base font-semibold ${messageCapacityChartModel.overMessages > 0 ? 'text-red-400' : 'text-emerald-300'}`}>
                          {messageCapacityChartModel.overMessages > 0 ? 'חריגה' : 'יתרה'}
                        </div>
                        <div className={`${previewMetricValueClass} text-3xl font-bold ${messageCapacityChartModel.overMessages > 0 ? 'text-red-300' : 'text-emerald-200'}`}>
                          {messageCapacityChartModel.overMessages > 0 ? `-${messageCapacityChartModel.overMessages}` : messageCapacityChartModel.remainingMessages}
                        </div>
                      </div>
                    </div>
                  </div>
              )}
            </div>
          )}


        </div>
      </div>

      <Modal open={showEventTypes} onClose={() => setShowEventTypes(false)} size="md">
        <ModalHeader onClose={() => setShowEventTypes(false)}>בחר סוג אירוע</ModalHeader>
        <ModalBody>
          {renderMobileNextActionCard({
            stepLabel: 'שלב 1 מתוך 5',
            title: 'בחרו סוג אירוע',
            description: 'בחרו את סוג האירוע כדי שהמערכת תתאים את השדות וההזמנה למסיבה שלכם.',
            actionText: selectedEventType ? 'המשך לפרטי האירוע' : '',
            onAction: selectedEventType ? () => {
              setShowEventTypes(false);
              if (!currentEventId) {
                setFormData(initialFormState);
                setFormErrors({});
                try { localStorage.removeItem('savedEventDetails'); } catch(e){}
                eventDetailsOpenedRef.current = true;
              }
              setShowEventDetails(true);
              markStepDone(0);
            } : undefined,
            helpText: 'הבחירה כאן קובעת אילו פרטים נבקש בשלב הבא, למשל חתן וכלה בחתונה או שם חוגג ביום הולדת.',
            icon: eventTypeIcons[selectedEventType] || '🎉',
          })}
          <div className="mb-4 text-center sm:hidden">
            <h3 className="text-2xl font-black text-white">איזה אירוע תרצו ליצור?</h3>
            <p className="mt-1 text-sm font-semibold text-slate-400">בחרו סוג אירוע כדי שנתאים את השדות וההזמנה.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:hidden">
            {eventTypes.map((type) => {
              const isSelected = selectedEventType === normalizeType(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSelectEvent(type)}
                  className={`relative min-h-[6rem] rounded-2xl border px-3 py-4 text-center transition-all ${
                    isSelected
                      ? 'border-emerald-300 bg-violet-500/20 text-white shadow-[0_8px_28px_rgba(139,92,246,0.35)] ring-2 ring-emerald-300/40'
                      : 'border-white/12 bg-white/[0.045] text-slate-200 hover:border-violet-300/40'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-sm font-black text-[#0d0f2b]">
                      ✓
                    </span>
                  )}
                  <span className="block text-3xl leading-none">{eventTypeIcons[type] || '🎉'}</span>
                  <span className="mt-2 block text-lg font-black leading-tight">{type}</span>
                </button>
              );
            })}
          </div>
          <ul className="hidden space-y-2 sm:block">
            {eventTypes.map((type) => (
              <li key={type}>
                <button
                  onClick={() => handleSelectEvent(type)}
                   className={`w-full ${selectedEventType === type ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white border-transparent' : 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30'} rounded-full px-4 py-2 text-base sm:text-lg font-medium hover:opacity-90 transition-all`}
                >
                  {type}
                </button>
              </li>
            ))}
          </ul>
          {selectedEventType && (
            <p className="text-center text-indigo-300 font-medium text-lg sm:text-xl mt-4">האירוע הנבחר: {selectedEventType}</p>
          )}
        </ModalBody>
        <ModalFooter>
          <button
            onClick={() => {
              console.log('Save and close button clicked');
              setShowEventTypes(false);
              if (!currentEventId) {
                setFormData(initialFormState);
                setFormErrors({});
                try { localStorage.removeItem('savedEventDetails'); } catch(e){}
                eventDetailsOpenedRef.current = true; // Mark as opened so we don't reset on reopen
              }
              setShowEventDetails(true);
              markStepDone(0); // Mark step 1 as completed when saving
              console.log('markStepDone(0) called');
            }}
            className="w-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-bold rounded-xl px-4 py-3 hover:opacity-90 transition-all"
          >
            <span className="sm:hidden">המשך לפרטי האירוע</span>
            <span className="hidden sm:inline">שמור וסגור</span>
          </button>
        </ModalFooter>
      </Modal>

      <Modal open={showEventDetails} onClose={() => setShowEventDetails(false)} size="xl">
        <ModalHeader onClose={() => setShowEventDetails(false)}>{`פרטי האירוע - ${selectedEventType}`}</ModalHeader>
        <ModalBody>
          <div dir="rtl">
          {renderMobileNextActionCard({
            stepLabel: 'שלב 2 מתוך 5',
            title: 'מלאו את פרטי האירוע',
            description: 'הזינו את התאריך, השעה, המקום והפרטים שיופיעו בהזמנה.',
            actionText: 'שמור פרטים והמשך',
            onAction: handleSaveDetails,
            helpText: 'הפרטים שתמלאו כאן ישמשו ליצירת נוסח ההזמנה ולעדכון האירוע בכל המכשירים.',
            icon: '📝',
          })}
          {eventDetailsSubmitAttempted && errorMsg && <p className="text-red-400 text-sm text-center mb-3 bg-red-500/10 border border-red-400/30 rounded-xl p-2.5">{errorMsg}</p>}
          {selectedEventType && (
            <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-center sm:hidden">
              <div className="text-xs font-bold text-emerald-300/85">סוג האירוע שנבחר בשלב 1</div>
              <div className="mt-1 text-2xl font-black text-emerald-100">{selectedEventType}</div>
            </div>
          )}
          <form dir="rtl" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Existing event details form (unchanged) */}
              {['חתונה', 'חינה', 'מסיבת אירוסין'].includes(selectedEventType) && (
                <div>
                  <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם הכלה</label>
                  <input type="text" placeholder="שם הכלה" value={formData.brideName} onChange={(e) => setFormData({ ...formData, brideName: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2.5 text-base transition-all ${visibleFormErrors.brideName ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                </div>
              )}
              {['חתונה', 'חינה', 'מסיבת אירוסין'].includes(selectedEventType) && (
                <div>
                  <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם החתן</label>
                  <input type="text" placeholder="שם החתן" value={formData.groomName} onChange={(e) => setFormData({ ...formData, groomName: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2.5 text-base transition-all ${visibleFormErrors.groomName ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                </div>
              )}
              {selectedEventType === 'הפרשת חלה' && (
                <div>
                  <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם המארחת</label>
                  <input
                    type="text"
                    placeholder="שם המארחת"
                    value={formData.hostName}
                    onChange={(e) => setFormData({ ...formData, hostName: e.target.value })}
                    className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2.5 text-base transition-all ${visibleFormErrors.hostName ? 'border-red-400 ring-2 ring-red-400/20' : ''}`}
                  />
                </div>
              )}
              {['חתונה', 'חינה'].includes(selectedEventType) && (
                <div>
                  <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם הורי הכלה</label>
                  <input type="text" placeholder="שם הורי הכלה" value={formData.brideParents} onChange={(e) => setFormData({ ...formData, brideParents: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2.5 text-base transition-all ${visibleFormErrors.brideParents ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                </div>
              )}
              {['חתונה', 'חינה'].includes(selectedEventType) && (
                <div>
                  <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם הורי החתן</label>
                  <input type="text" placeholder="שם הורי החתן" value={formData.groomParents} onChange={(e) => setFormData({ ...formData, groomParents: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2.5 text-base transition-all ${visibleFormErrors.groomParents ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                </div>
              )}
              {selectedEventType === 'בר מצווה' && (
                <>
                  <div>
                    <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם חתן בר מצווה</label>
                    <input type="text" placeholder="שם חתן בר מצווה" value={formData.boyName} onChange={(e) => setFormData({ ...formData, boyName: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3 text-base transition-all ${visibleFormErrors.boyName ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם ההורים</label>
                    <input type="text" placeholder="שם ההורים" value={formData.boyParents} onChange={(e) => setFormData({ ...formData, boyParents: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3 text-base transition-all ${visibleFormErrors.boyParents ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                  </div>
                </>
              )}
              {selectedEventType === 'בת מצווה' && (
                <>
                  <div>
                    <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם כלת בת מצווה</label>
                    <input type="text" placeholder="שם כלת בת מצווה" value={formData.girlName} onChange={(e) => setFormData({ ...formData, girlName: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3 text-base transition-all ${visibleFormErrors.girlName ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם ההורים</label>
                    <input type="text" placeholder="שם ההורים" value={formData.girlParents} onChange={(e) => setFormData({ ...formData, girlParents: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3 text-base transition-all ${visibleFormErrors.girlParents ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                  </div>
                </>
              )}
              {['ברית','בריתה'].includes(selectedEventType) && (
                <>
                  <div>
                    <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם ההורים</label>
                    <input type="text" placeholder="שם ההורים" value={formData.babyParents} onChange={(e) => setFormData({ ...formData, babyParents: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3 text-base transition-all ${visibleFormErrors.babyParents ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                  </div>
                </>
              )}
              {selectedEventType === 'יום הולדת' && (
                <>
                  <div>
                    <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם החוגג/ת</label>
                    <input type="text" placeholder="שם החוגג/ת" value={formData.birthdayName} onChange={(e) => setFormData({ ...formData, birthdayName: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3 text-base transition-all ${visibleFormErrors.birthdayName ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-semibold text-sm text-slate-300">גיל</label>
                    <input type="number" placeholder="גיל" value={formData.birthdayAge} onChange={(e) => setFormData({ ...formData, birthdayAge: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3 text-base transition-all ${visibleFormErrors.birthdayAge ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                  </div>
                </>
              )}
              {selectedEventType === 'אירוע עסקי' && (
                <>
                  <div>
                    <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם החברה</label>
                    <input type="text" placeholder="שם החברה" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3 text-base transition-all ${visibleFormErrors.businessName ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-semibold text-sm text-slate-300">איש קשר</label>
                    <input type="text" placeholder="איש קשר" value={formData.businessContact} onChange={(e) => setFormData({ ...formData, businessContact: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3 text-base transition-all ${visibleFormErrors.businessContact ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
                  </div>
                </>
              )}
              <div className="md:col-span-2">
                <label className="block mb-1.5 font-semibold text-sm text-slate-300">תאריך האירוע</label>
                <DatePicker
                  selected={formData.date ? new Date(formData.date) : null}
                  onChange={(date)=> setFormData({ ...formData, date: date ? formatISODateLocal(date) : '' })}
                  dateFormat="dd/MM/yyyy"
                  locale="he"
                  placeholderText="בחר תאריך"
                  className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2.5 text-base transition-all ${visibleFormErrors.date ? 'border-red-400 ring-2 ring-red-400/20' : ''}`}
                  calendarStartDay={0}
                />
              </div>
              <div>
                <label className="block mb-1.5 font-semibold text-sm text-slate-300">שעת האירוע</label>
                <select value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2.5 text-base transition-all ${visibleFormErrors.time ? 'border-red-400 ring-2 ring-red-400/20' : ''}`}>
                  <option value="">בחר שעה</option>
                  {times.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {selectedEventType === 'חתונה' && (
                <div>
                  <label className="block mb-1.5 font-semibold text-sm text-slate-300">שעת החופה</label>
                  <select value={formData.chuppahTime} onChange={(e) => setFormData({ ...formData, chuppahTime: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2.5 text-base transition-all ${visibleFormErrors.chuppahTime ? 'border-red-400 ring-2 ring-red-400/20' : ''}`}>
                    <option value="">בחר שעה</option>
                    {times.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block mb-1.5 font-semibold text-sm text-slate-300">שם האולם</label>
                <input type="text" placeholder="שם האולם" value={formData.hallName} onChange={(e) => setFormData({ ...formData, hallName: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2.5 text-base transition-all ${visibleFormErrors.hallName ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
              </div>
              <div>
                <label className="block mb-1.5 font-semibold text-sm text-slate-300">כתובת האולם</label>
                <input type="text" placeholder="כתובת האולם" value={formData.hallAddress} onChange={(e) => setFormData({ ...formData, hallAddress: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2.5 text-base transition-all ${visibleFormErrors.hallAddress ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
              </div>
          </form>
          </div>
        </ModalBody>
        <ModalFooter className="justify-center">
          <button type="button" onClick={handleSaveDetails} className="w-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold rounded-xl py-3 text-base hover:opacity-90 transition-opacity">
            שמור וסגור
          </button>
        </ModalFooter>
      </Modal>

      {/* Hidden file input for Excel upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleExcelImport}
        style={{ display: 'none' }}
      />

      <Modal open={showGuestForm} onClose={() => setShowGuestForm(false)} size="lg">
        <ModalHeader onClose={() => setShowGuestForm(false)}>שליחת הזמנות</ModalHeader>
        <ModalBody>
          {renderMobileNextActionCard({
            stepLabel: 'שלב 4 מתוך 5',
            title: 'שלחו הזמנה לאורח',
            description: 'מלאו פרטי אורח, ואז שלחו בוואטסאפ או ב-SMS מתוך הכפתורים שבתחתית הטופס.',
            helpText: 'מומלץ להתחיל באורח אחד לבדיקה, לוודא שההזמנה נראית טוב, ואז להמשיך לשליחה לשאר האורחים.',
            icon: '✈',
          })}
          {/* Invite card preview */}
          {(selectedDesign || invitationText) && (
            <div className="mb-4 rounded-3xl border border-white/15 bg-white/[0.055] p-3 shadow-[0_10px_32px_rgba(0,0,0,0.32)] sm:hidden" dir="rtl">
              <div className="flex items-center gap-3">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white/5">
                  {selectedDesign ? (
                    <img src={selectedDesign} alt="הזמנה" className="absolute inset-0 h-full w-full object-cover object-top" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#f0e8ff] to-[#fdf6ee]" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <div className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-1 text-xs font-black text-violet-200">
                    ✓ ההזמנה מוכנה לשליחה
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                    ההזמנה נשמרה וניתן לשלוח אותה לאורחים.
                  </p>
                </div>
              </div>
            </div>
          )}
          {(selectedDesign || invitationText) && (
            <div className="mb-5 hidden justify-center sm:flex">
              <div className="relative w-full max-w-[220px]" dir="rtl">
                <div className="relative w-full pt-[125%] rounded-xl shadow-xl overflow-hidden border border-white/15">
                  {selectedDesign ? (
                    <img src={selectedDesign} alt="הזמנה" className="absolute inset-0 w-full h-full object-cover object-top" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#f0e8ff] to-[#fdf6ee]" />
                  )}
                  {invitationText && (
                    <div className="absolute inset-0 flex flex-col justify-center items-center p-3 pointer-events-none z-10" dir="rtl">
                      {invitationText.split('\n').map((line, idx) => {
                        if (!line.trim()) return <div key={idx} style={{ height: '0.3em' }} />;
                        const style = lineStyles[idx] || {};
                        const baseFontSize = idx === 0 ? 28 : 16;
                        const fontSize = Math.round((parseInt(style.fontSize) || baseFontSize) * 0.45);
                        const fontFamily = selectedFontCss || 'Assistant, sans-serif';
                        return (
                          <div
                            key={idx}
                            style={{
                              fontSize,
                              fontWeight: style.fontWeight || (idx === 0 ? 'bold' : 'normal'),
                              textAlign: style.textAlign || 'center',
                              color: style.color || '#000000',
                              fontFamily,
                              lineHeight: 1.3,
                              width: '100%',
                            }}
                          >
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-center text-xs text-slate-500 mt-1.5">תצוגה מקדימה של ההזמנה</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 mb-4 sm:mb-6">
            <button
              type="button"
              onClick={openExcelImport}
              className="w-full rounded-2xl border border-dashed border-white/20 bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-primary hover:text-primary sm:rounded-lg sm:border-2 sm:border-primary sm:bg-transparent sm:text-primary sm:hover:bg-primary sm:hover:text-white"
            >
              <span className="sm:hidden">ייבוא מאקסל זמין במחשב</span>
              <span className="hidden sm:inline">ייבוא קובץ אורחים - אקסל</span>
            </button>
          </div>

          <h3 className="text-xl font-black text-slate-100 mb-3 sm:text-lg sm:font-semibold">פרטי אורח</h3>
          {guestSubmitAttempted && guestErrorMsg && <p className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-red-300 text-base font-semibold text-center">{guestErrorMsg}</p>}
          <form className="space-y-4 rounded-3xl border border-white/15 bg-white/[0.045] p-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-300 sm:mb-1 sm:font-medium sm:text-white">שם פרטי</label>
              <input type="text" placeholder="שם פרטי" value={guestData.guestFirstName} onChange={(e) => setGuestData({ ...guestData, guestFirstName: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3.5 pr-4 sm:p-2 sm:pr-2 outline-none ${visibleGuestErrors.guestFirstName ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-300 sm:mb-1 sm:font-medium sm:text-white">שם משפחה</label>
              <input type="text" placeholder="שם משפחה" value={guestData.guestLastName} onChange={(e) => setGuestData({ ...guestData, guestLastName: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3.5 pr-4 sm:p-2 sm:pr-2 outline-none ${visibleGuestErrors.guestLastName ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-300 sm:mb-1 sm:font-medium sm:text-white">מספר שולחן</label>
              <input type="text" placeholder="מספר שולחן" value={guestData.guestTable} onChange={(e) => setGuestData({ ...guestData, guestTable: e.target.value })} required className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3.5 pr-4 sm:p-2 sm:pr-2 outline-none ${visibleGuestErrors.guestTable ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-300 sm:mb-1 sm:font-medium sm:text-white">טלפון</label>
              <input type="tel" placeholder="טלפון" value={guestData.guestPhone} onChange={(e) => setGuestData({ ...guestData, guestPhone: e.target.value })} className={`w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-3.5 pr-4 sm:p-2 sm:pr-2 outline-none ${visibleGuestErrors.guestPhone ? 'border-red-400 ring-2 ring-red-400/20' : ''}`} />
              <p className="mt-1 text-xs font-semibold text-slate-500 sm:hidden">לדוגמה: 050-1234567</p>
            </div>
          </form>
          <div className="mt-6 flex flex-col gap-3 sm:hidden" dir="rtl">
            <button type="button" onClick={handleSendInvitation} className="w-full rounded-2xl border border-emerald-400/50 bg-emerald-600 px-8 py-4 text-lg font-black text-white shadow-[0_10px_28px_rgba(16,185,129,0.28)] transition-all hover:bg-emerald-700">
              שלח בוואטסאפ
            </button>
            <button type="button" onClick={handleSendInvitationSms} className="w-full rounded-2xl border border-rose-400/50 bg-gradient-to-br from-red-600 to-rose-600 px-8 py-4 text-lg font-black text-white shadow-[0_10px_28px_rgba(244,63,94,0.24)] transition-all hover:opacity-90">
              שלח ב-SMS
            </button>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
              <div>
                <div className="text-xs font-bold text-slate-500">נשלחו</div>
                <div className="text-xl font-black text-violet-200">{effectiveMessagesSentCount}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500">נותרו במכסה</div>
                <div className="text-xl font-black text-emerald-300">{Math.max(0, totalPlanCapacity - effectiveMessagesSentCount)}</div>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="hidden sm:flex">
          <div className="flex flex-col sm:flex-row justify-center gap-3 w-full" dir="rtl">
            <button type="button" onClick={handleSendInvitation} className="order-1 bg-emerald-600 text-white border border-emerald-400/50 rounded-full px-8 py-3 font-medium hover:bg-emerald-700 transition-all">
              שלח הזמנה בוואטסאפ
            </button>
            <button type="button" onClick={handleSendInvitationSms} className="order-2 bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all">
              שלח הזמנה ב-SMS
            </button>
          </div>
        </ModalFooter>
      </Modal>

      <Modal open={showWhatsAppGroupModal} onClose={() => !isWhatsAppGroupSubmitting && setShowWhatsAppGroupModal(false)} size="md">
        <ModalHeader onClose={() => !isWhatsAppGroupSubmitting && setShowWhatsAppGroupModal(false)}>קבוצת וואטסאפ לאירוע</ModalHeader>
        <ModalBody>
          <div className="text-right">
            <p className="text-slate-300 mb-4">
              המערכת תיצור קבוצה אחת לאירוע או תשתמש בקבוצה שכבר נשמרה, ותוסיף אליה את מספרי הטלפון התקינים של האורחים.
            </p>
            <label className="block mb-2 font-medium text-slate-300">שם הקבוצה</label>
            <input
              type="text"
              value={whatsAppGroupName}
              onChange={(e) => setWhatsAppGroupName(e.target.value)}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2 mb-4"
              maxLength={100}
              placeholder={buildDefaultWhatsAppGroupName()}
              disabled={isWhatsAppGroupSubmitting}
            />
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 text-slate-300">
              <div>אורחים להוספה: <strong>{whatsAppGroupGuestCount}</strong></div>
              <div className="text-sm mt-1">
                {whatsAppGroupGuestIds
                  ? 'יתווספו האורחים שנשמרו עכשיו מהקובץ.'
                  : 'יתווספו כל האורחים השמורים באירוע.'}
              </div>
            </div>
            <p className="text-sm text-slate-400">
              ייתכן שחלק מהמספרים לא יתווספו בגלל הגדרות פרטיות של וואטסאפ או מגבלות Green API.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={handleCreateWhatsAppGroup}
            disabled={isWhatsAppGroupSubmitting || whatsAppGroupGuestCount === 0}
            className="bg-primary text-white border border-primary rounded-full px-6 py-3 font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isWhatsAppGroupSubmitting ? 'יוצר קבוצה...' : 'אישור - צור/עדכן קבוצה'}
          </button>
          <button
            type="button"
            onClick={() => setShowWhatsAppGroupModal(false)}
            disabled={isWhatsAppGroupSubmitting}
            className="border border-white/15 bg-transparent text-white hover:border-indigo-300 hover:text-indigo-200 rounded-full px-6 py-3 font-medium transition-all disabled:opacity-50"
          >
            ביטול
          </button>
        </ModalFooter>
      </Modal>

      {/* RSVP Confirmation Modal */}
      <Modal open={showGuestListModal} onClose={() => setShowGuestListModal(false)} size="xl">
        <ModalHeader onClose={() => setShowGuestListModal(false)}>דו"חות אישורי הגעה</ModalHeader>
        <ModalBody>
          {/* filter buttons */}
          <div className="flex justify-center gap-2 mb-4">
            {['approved','rejected','pending'].map(key=> (
              <button key={key} onClick={()=>setSelectedReport(key)} className={`${selectedReport===key?'bg-gradient-to-br from-indigo-600 to-violet-600 text-white border-indigo-400/50':'bg-white/[0.06] text-slate-100 border-white/15 hover:bg-indigo-500/15 hover:border-indigo-400/50'} border rounded-full px-4 py-1 text-sm font-medium transition-all`}>
                {key==='approved'?'אישרו הגעה': key==='rejected'?'לא מגיעים':'טרם הגיבו'}
              </button>
            ))}
          </div>
          <div>
            {/* הטבלה הוסרה לפי דרישה */}
          </div>
        </ModalBody>
        <ModalFooter>
          <button onClick={() => setShowGuestListModal(false)} className="bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all">סגור</button>
        </ModalFooter>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={deleteIdx !== null} onClose={cancelDelete} size="sm">
        <ModalHeader onClose={cancelDelete}>אישור מחיקה</ModalHeader>
        <ModalBody>
          <p className="text-lg text-center text-slate-100">האם אתה בטוח שברצונך למחוק אורח זה?</p>
        </ModalBody>
        <ModalFooter>
          <button onClick={confirmDelete} className="bg-gradient-to-br from-red-600 to-rose-600 text-white px-6 py-2 rounded-xl hover:opacity-90">מחיקה</button>
          <button onClick={cancelDelete} className="border border-white/15 bg-transparent text-white hover:border-indigo-300 hover:text-indigo-200 px-6 py-2 rounded-xl">ביטול</button>
        </ModalFooter>
      </Modal>

      <Modal open={showMobileExcelNotice} onClose={() => setShowMobileExcelNotice(false)} size="sm">
        <ModalHeader onClose={() => setShowMobileExcelNotice(false)}>ייבוא קובץ אורחים</ModalHeader>
        <ModalBody>
          <p className="text-center text-slate-200 text-lg font-semibold leading-relaxed">
            רק במחשב ניתן לקרוא לקובץ אורחים שהוכן מראש באקסל
          </p>
        </ModalBody>
        <ModalFooter>
          <button
            onClick={() => setShowMobileExcelNotice(false)}
            className="w-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition-all"
          >
            הבנתי
          </button>
        </ModalFooter>
      </Modal>

      {/* Excel Instructions Modal */}
      <Modal open={showExcelInstructions} onClose={() => setShowExcelInstructions(false)} size="md">
        <ModalHeader onClose={() => setShowExcelInstructions(false)}>הנחיות לייבוא קובץ אקסל</ModalHeader>
        <ModalBody>
          <div className="space-y-4 text-right">
              <p className="text-slate-300">
                הקובץ צריך להכיל <strong>4 עמודות</strong> בסדר הבא:
              </p>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-emerald-500/20">
                      <th className="border border-white/10 px-3 py-2 text-center font-bold text-primary">A</th>
                      <th className="border border-white/10 px-3 py-2 text-center font-bold text-primary">B</th>
                      <th className="border border-white/10 px-3 py-2 text-center font-bold text-primary">C</th>
                      <th className="border border-white/10 px-3 py-2 text-center font-bold text-primary">D</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white/5">
                      <td className="border border-white/10 px-3 py-2 text-center font-medium text-slate-300">שם פרטי</td>
                      <td className="border border-white/10 px-3 py-2 text-center font-medium text-slate-300">שם משפחה</td>
                      <td className="border border-white/10 px-3 py-2 text-center font-medium text-slate-300">מס׳ שולחן</td>
                      <td className="border border-white/10 px-3 py-2 text-center font-medium text-slate-300">טלפון</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 px-3 py-2 text-center text-slate-400">ישראל</td>
                      <td className="border border-white/10 px-3 py-2 text-center text-slate-400">ישראלי</td>
                      <td className="border border-white/10 px-3 py-2 text-center text-slate-400">1</td>
                      <td className="border border-white/10 px-3 py-2 text-center text-slate-400">0501234567</td>
                    </tr>
                    <tr>
                      <td className="border border-white/10 px-3 py-2 text-center text-slate-400">שרה</td>
                      <td className="border border-white/10 px-3 py-2 text-center text-slate-400">כהן</td>
                      <td className="border border-white/10 px-3 py-2 text-center text-slate-400">2</td>
                      <td className="border border-white/10 px-3 py-2 text-center text-slate-400">0529876543</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-indigo-500/10 border border-indigo-400/30 rounded-lg p-3 text-sm">
                <p className="text-indigo-200">
                  <strong>שם העמודות לא משנה</strong> - רק הסדר חשוב. השורה הראשונה היא שורת כותרות.
                </p>
              </div>

              <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg p-3 text-sm">
                <p className="text-amber-200">
                  <strong>שימו לב:</strong> מספר הטלפון צריך להכיל 10 ספרות (לדוגמה: 0501234567)
                </p>
              </div>

          </div>
        </ModalBody>
        <ModalFooter>
          <button
            onClick={chooseExcelFile}
            className="bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-primary/90 transition-all"
          >
            בחר קובץ אקסל
          </button>
          <button
            onClick={() => setShowExcelInstructions(false)}
            className="border border-white/15 bg-transparent text-white hover:border-indigo-300 hover:text-indigo-200 px-6 py-3 rounded-full font-medium transition-all"
          >
            ביטול
          </button>
        </ModalFooter>
      </Modal>

      {/* Excel Preview Modal */}
      <Modal open={showExcelPreview} onClose={() => { setShowExcelPreview(false); setExcelPreviewData([]); setExcelErrors([]); }} size="xl">
        <ModalHeader onClose={() => { setShowExcelPreview(false); setExcelPreviewData([]); setExcelErrors([]); }}>תצוגה מקדימה - ייבוא אורחים מאקסל</ModalHeader>
        <ModalBody>

            {/* Error Summary */}
            {excelErrors.length > 0 && (
              <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-red-300 mb-2">נמצאו {excelErrors.length} שורות עם שגיאות:</h3>
                <ul className="text-sm text-red-300 list-disc list-inside">
                  {excelErrors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>שורה {err.row}: {err.errors.join(', ')}</li>
                  ))}
                  {excelErrors.length > 5 && <li>...ועוד {excelErrors.length - 5} שגיאות</li>}
                </ul>
                <p className="text-sm text-red-300 mt-2">רק שורות תקינות יישמרו למסד הנתונים.</p>
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-4 mb-4 justify-center">
              <div className="bg-indigo-500/10 border border-indigo-400/30 rounded-lg px-4 py-2 text-slate-300">
                <span className="font-bold text-indigo-200">סה"כ שורות:</span> {excelPreviewData.length}
              </div>
              <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-lg px-4 py-2 text-slate-300">
                <span className="font-bold text-emerald-200">תקינות:</span> {excelPreviewData.filter(g => !g.errors || g.errors.length === 0).length}
              </div>
              {excelErrors.length > 0 && (
                <div className="bg-red-500/10 border border-red-400/30 rounded-lg px-4 py-2 text-slate-300">
                  <span className="font-bold text-red-300">שגיאות:</span> {excelErrors.length}
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1 border border-white/10 rounded-xl">
              <table className="w-full text-right" dir="rtl">
                <thead className="bg-primary text-white sticky top-0">
                  <tr>
                    <th className="p-2 border-b border-white/10">#</th>
                    <th className="p-2 border-b border-white/10">שם פרטי</th>
                    <th className="p-2 border-b border-white/10">שם משפחה</th>
                    <th className="p-2 border-b border-white/10">מספר שולחן</th>
                    <th className="p-2 border-b border-white/10">טלפון</th>
                    <th className="p-2 border-b border-white/10">סטטוס</th>
                    <th className="p-2 border-b border-white/10">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {excelPreviewData.map((guest, idx) => (
                    <tr
                      key={idx}
                      className={`${guest.errors && guest.errors.length > 0 ? 'bg-red-500/10' : 'bg-white/5'} hover:bg-white/10 border-b border-white/5`}
                    >
                      <td className="p-2 text-center">{idx + 1}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={guest.guestFirstName}
                          onChange={(e) => handleEditExcelRow(idx, 'guestFirstName', e.target.value)}
                          className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-2 py-1 outline-none focus:border-indigo-400"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={guest.guestLastName}
                          onChange={(e) => handleEditExcelRow(idx, 'guestLastName', e.target.value)}
                          className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-2 py-1 outline-none focus:border-indigo-400"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={guest.guestTable}
                          onChange={(e) => handleEditExcelRow(idx, 'guestTable', e.target.value)}
                          className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-2 py-1 outline-none focus:border-indigo-400"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={guest.guestPhone}
                          onChange={(e) => handleEditExcelRow(idx, 'guestPhone', e.target.value)}
                          className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-2 py-1 outline-none focus:border-indigo-400"
                        />
                      </td>
                      <td className="p-2 text-center">
                        {guest.errors && guest.errors.length > 0 ? (
                          <span className="text-red-300 text-xs">{guest.errors.join(', ')}</span>
                        ) : (
                          <span className="text-emerald-300 font-bold">✓</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleRemoveExcelRow(idx)}
                          className="text-red-300 hover:text-red-200 font-bold"
                          title="מחק שורה"
                          aria-label="מחק שורה"
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
            <div className="flex flex-col items-center gap-4 mt-6">
              <div className="flex justify-center gap-4 flex-wrap">
                <button
                  onClick={() => handleSaveExcelGuests(false, true)}
                  disabled={isSavingExcelGuests || excelPreviewData.filter(g => !g.errors || g.errors.length === 0).length === 0}
                  className="bg-emerald-600 text-white px-8 py-3 rounded-full font-medium hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingExcelGuests ? 'שומר...' : 'שלח בוואטסאפ'}
                </button>
                <button
                  onClick={() => handleSaveExcelGuests(true)}
                  disabled={isSavingExcelGuests || excelPreviewData.filter(g => !g.errors || g.errors.length === 0).length === 0}
                  className="bg-primary text-white px-8 py-3 rounded-full font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingExcelGuests ? 'שומר ושולח...' : 'שלח ב SMS'}
                </button>
              </div>
              <button
                onClick={() => handleSaveExcelGuests(false, false, true)}
                disabled={isSavingExcelGuests || excelPreviewData.filter(g => !g.errors || g.errors.length === 0).length === 0}
                className="mt-2 bg-gradient-to-r from-sky-600 to-indigo-600 text-white px-8 py-3 rounded-full font-medium hover:from-sky-700 hover:to-indigo-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingExcelGuests ? 'שומר...' : 'צור/עדכן קבוצת וואטסאפ'}
              </button>
              <button
                onClick={() => {
                  setShowExcelPreview(false);
                  setExcelPreviewData([]);
                  setExcelErrors([]);
                }}
                className="border border-white/15 bg-transparent text-white hover:border-indigo-300 hover:text-indigo-200 px-8 py-3 rounded-full font-medium transition-all"
              >
                ביטול
              </button>
            </div>
        </ModalBody>
      </Modal>

      {/* RSVP Yes/No Question Modal */}
      <Modal open={showRsvpQuestion} onClose={() => setShowRsvpQuestion(false)} size="sm">
        <ModalHeader onClose={() => setShowRsvpQuestion(false)}>האם אתם מגיעים לאירוע?</ModalHeader>
        <ModalBody>
          <div className="flex justify-center gap-6 py-2">
            <button
              className="bg-emerald-600 text-white px-6 py-2 rounded-full hover:bg-emerald-700 text-lg font-bold"
              onClick={() => {
                setShowRsvpQuestion(false);
                setShowCountModal(true);
              }}
            ><span className="mr-2 text-white">✓</span> מגיעים</button>
            <button
              className="bg-red-600 text-white px-6 py-2 rounded-full hover:bg-red-600 text-lg font-bold"
              onClick={() => {
                setRsvpConfirmed(false);
                setShowRsvpQuestion(false);
              }}
            ><span className="mr-2 text-white">✗</span> לא מגיעים</button>
          </div>
        </ModalBody>
      </Modal>
      {/* Count modal */}
      <Drawer open={showCountModal} onClose={() => setShowCountModal(false)} size="md">
        <DrawerHeader onClose={() => setShowCountModal(false)}>כמה אורחים מגיעים?</DrawerHeader>
        <DrawerBody>
          {countSubmitAttempted && countError && (
              <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4 text-right">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-red-300 text-2xl mr-2">✗</span>
                  <p className="text-red-300 text-lg font-medium">{countError}</p>
                </div>
              </div>
            )}
            <div className="space-y-4 text-right">
              <div>
                <label className="block mb-1 font-medium">סה"כ בוגרים</label>
                <input type="number" min="0" value={adultsCount} onChange={(e)=>{
                  setAdultsCount(parseInt(e.target.value)||0);
                  if (countError) setCountError('');
                }} className="w-full bg-white/10 border border-white/20 text-white rounded-xl p-2 outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block mb-1 font-medium">סה"כ ילדים</label>
                <input type="number" min="0" value={childrenCount} onChange={(e)=>{
                  setChildrenCount(parseInt(e.target.value)||0);
                  if (countError) setCountError('');
                }} className="w-full bg-white/10 border border-white/20 text-white rounded-xl p-2 outline-none focus:border-indigo-400" />
              </div>
            </div>

            <h3 className="text-lg font-medium mt-4">מנות מיוחדות</h3>
            <table className="w-full text-right border">
              <thead>
                <tr className="bg-white/5 text-sm font-bold whitespace-nowrap text-slate-300">
                  <th className="p-1 border border-white/10">קטגוריה</th>
                  <th className="p-1 border">סה"כ בוגרים</th>
                  <th className="p-1 border">סה"כ ילדים</th>
                </tr>
              </thead>
              <tbody>
                {mealCategories.map((c) => (
                  <tr key={c.key} className="odd:bg-white/5 even:bg-white/[0.02] border-white/5">
                    <td className="p-1 border">{c.label}</td>
                    {
                      /* standard categories */
                    }
                    {c.key !== 'allergy' ? (
                      <>
                        <td className="p-1 border">
                          <input type="number" min="0" value={specialMeals[c.key].adults} onChange={(e)=>updateMeal(c.key,'adults',parseInt(e.target.value)||0)} className="w-16 bg-white/10 border border-white/20 text-white rounded-lg p-1 outline-none focus:border-indigo-400" />
                        </td>
                        <td className="p-1 border">
                          <input type="number" min="0" value={specialMeals[c.key].children} onChange={(e)=>updateMeal(c.key,'children',parseInt(e.target.value)||0)} className="w-16 bg-white/10 border border-white/20 text-white rounded-lg p-1 outline-none focus:border-indigo-400" />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-1 border">
                          <input type="number" min="0" value={specialMeals.allergy.adults} onChange={(e)=>updateMeal('allergy','adults',parseInt(e.target.value)||0)} className="w-16 bg-white/10 border border-white/20 text-white rounded-lg p-1 outline-none focus:border-indigo-400" />
                        </td>
                        <td className="p-1 border">
                          <input type="number" min="0" value={specialMeals.allergy.children} onChange={(e)=>updateMeal('allergy','children',parseInt(e.target.value)||0)} className="w-16 bg-white/10 border border-white/20 text-white rounded-lg p-1 outline-none focus:border-indigo-400" />
                        </td>
                        <td className="p-1 border" colSpan={1}>
                          <input type="text" placeholder="סוג אלרגיה" value={specialMeals.allergy.description} onChange={(e)=>updateMeal('allergy','description',e.target.value)} className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg p-1 outline-none focus:border-indigo-400" />
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
              <span className="text-lg font-medium text-slate-300">להוספת אלרגיות לחץ</span>
              <button onClick={addAllergy} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full w-8 h-8 text-lg flex items-center justify-center" aria-label="הוסף אלרגיה">+</button>
            </div>
            <table className="w-full text-right border">
              <thead>
                <tr className="bg-white/5 text-slate-300">
                  <th className="p-1 border border-white/10">תיאור האלרגיה</th>
                  <th className="p-1 border">סה"כ בוגרים</th>
                  <th className="p-1 border">סה"כ ילדים</th>
                  <th className="p-1 border"></th>
                </tr>
              </thead>
              <tbody>
                {allergies.map((a, idx)=>(
                  <tr key={idx} className="odd:bg-white/5 even:bg-white/[0.02]">
                    <td className="p-1 border border-white/10"><input type="text" value={a.description} onChange={(e)=>updateAllergy(idx,'description',e.target.value)} className="w-full bg-white/10 border border-white/20 text-white rounded-lg p-1 outline-none focus:border-indigo-400"/></td>
                    <td className="p-1 border"><input type="number" min="0" value={a.adults} onChange={(e)=>updateAllergy(idx,'adults',parseInt(e.target.value)||0)} className="w-16 bg-white/10 border border-white/20 text-white rounded-lg p-1 outline-none focus:border-indigo-400"/></td>
                    <td className="p-1 border"><input type="number" min="0" value={a.children} onChange={(e)=>updateAllergy(idx,'children',parseInt(e.target.value)||0)} className="w-16 bg-white/10 border border-white/20 text-white rounded-lg p-1 outline-none focus:border-indigo-400"/></td>
                    <td className="p-1 border text-center"><button onClick={()=>removeAllergy(idx)} className="text-red-300 hover:text-red-200" aria-label="הסר אלרגיה">❌</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={async () => {
                // totals for validation
                const totalSpecialAdults = Object.values(specialMeals).reduce((sum, m)=>sum+m.adults,0)+allergies.reduce((s,a)=>s+a.adults,0);
                const totalSpecialChildren = Object.values(specialMeals).reduce((sum, m)=>sum+m.children,0)+allergies.reduce((s,a)=>s+a.children,0);
                setCountSubmitAttempted(true);

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
        </DrawerBody>
      </Drawer>

      {/* Step 5 - choose action modal */}
      {showStep5Options && (
        <Modal open={showStep5Options} onClose={() => setShowStep5Options(false)} size="sm">
          <ModalHeader onClose={() => setShowStep5Options(false)}>בחר דוח</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
            {renderMobileNextActionCard({
              stepLabel: 'שלב 5 מתוך 5',
              title: 'בחרו דוח להצגה',
              description: 'פתחו דוח כדי לראות מי מגיע, מי לא מגיע ומי עדיין לא הגיב.',
              helpText: 'הדוחות המפורטים זמינים גם בנייד, אבל לעבודה עם Excel מומלץ להשתמש במחשב.',
              icon: '📊',
            })}
            <div className="sm:hidden">
              <div className="mb-4 text-center">
                <h3 className="text-3xl font-black text-white">דוחות</h3>
                <p className="mt-1 text-sm font-semibold text-slate-400">בחרו איזה דוח תרצו לפתוח</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['מגיעים', guestStatusSummary.approved, 'text-emerald-300', 'border-emerald-400/25 bg-emerald-500/10'],
                  ['טרם הגיבו', guestStatusSummary.pending, 'text-amber-300', 'border-amber-400/25 bg-amber-500/10'],
                  ['לא מגיעים', guestStatusSummary.rejected, 'text-rose-300', 'border-rose-400/25 bg-rose-500/10'],
                ].map(([label, value, textClass, cardClass]) => (
                  <div key={label} className={`rounded-2xl border px-2 py-3 text-center ${cardClass}`}>
                    <div className={`text-2xl font-black leading-none tabular-nums ${textClass}`}>{value}</div>
                    <div className="mt-1 text-[11px] font-bold text-slate-200">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reports buttons */}
            <button
              onClick={async () => {
                try {
                  const user = await resolveCurrentUserForSync();
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
              className="group w-full rounded-2xl border border-emerald-400/40 bg-white/[0.055] px-4 py-4 text-slate-100 shadow-[0_6px_22px_rgba(0,0,0,0.25)] transition-all hover:bg-indigo-500/15 hover:border-indigo-400/50 sm:rounded-full sm:border-white/15 sm:bg-white/[0.06] sm:px-4 sm:py-2 sm:font-medium sm:shadow-none"
            >
              <span className="hidden sm:inline">דו"ח אורחים מגיעים</span>
              <span className="flex items-center justify-between gap-3 text-right sm:hidden">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/35 bg-emerald-500/15 text-2xl">👥</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-black text-white">דוח אורחים מגיעים</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-400">רשימת אורחים שאישרו הגעה</span>
                </span>
                <span className="text-2xl text-violet-200">‹</span>
              </span>
            </button>
            <button
              onClick={async () => {
                try {
                  const user = await resolveCurrentUserForSync();
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
              className="group w-full rounded-2xl border border-white/15 bg-white/[0.055] px-4 py-4 text-slate-100 shadow-[0_6px_22px_rgba(0,0,0,0.25)] transition-all hover:bg-indigo-500/15 hover:border-indigo-400/50 sm:rounded-full sm:bg-white/[0.06] sm:px-4 sm:py-2 sm:font-medium sm:shadow-none"
            >
              <span className="hidden sm:inline">דו"ח אורחים לא מגיעים</span>
              <span className="flex items-center justify-between gap-3 text-right sm:hidden">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-400/35 bg-rose-500/15 text-2xl">🚫</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-black text-white">דוח אורחים לא מגיעים</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-400">רשימת דחיות</span>
                </span>
                <span className="text-2xl text-violet-200">‹</span>
              </span>
            </button>
            <button
              onClick={async () => {
                try {
                  const user = await resolveCurrentUserForSync();
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
                    .eq('event_id', eventIdToUse);
                  if (error) throw error;

                  setReportGuests(getPendingGuestsFromRows(data || []));
                  setReportTitle('אורחים שטרם הגיבו');
                  setShowReportModal(true);
                } catch (e) {
                  console.error('Load pending guests failed', e);
                  alert('שגיאה בטעינת הדוח');
                }
              }}
              className="group w-full rounded-2xl border border-white/15 bg-white/[0.055] px-4 py-4 text-slate-100 shadow-[0_6px_22px_rgba(0,0,0,0.25)] transition-all hover:bg-indigo-500/15 hover:border-indigo-400/50 sm:rounded-full sm:bg-white/[0.06] sm:px-4 sm:py-2 sm:font-medium sm:shadow-none"
            >
              <span className="hidden sm:inline">דו"ח אורחים שטרם הגיבו</span>
              <span className="flex items-center justify-between gap-3 text-right sm:hidden">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-500/15 text-2xl">⏱</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-black text-white">דוח טרם הגיבו</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-400">אורחים שעדיין לא ענו</span>
                </span>
                <span className="text-2xl text-violet-200">‹</span>
              </span>
            </button>
            <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-center sm:hidden">
              <div className="text-sm font-black text-blue-200">דוחות מפורטים</div>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                מומלץ לפתוח במחשב כדי לעבוד עם Excel בנוחות.
              </p>
            </div>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* Step 3 - Design chooser */}
      {/* ─── Design Chooser — full-screen centered modal ─── */}
      <Modal open={showDesignChooser} onClose={() => setShowDesignChooser(false)} size="full">
        <ModalHeader onClose={() => setShowDesignChooser(false)} subtitle="עצב את הטקסט, צפה בתצוגה מקדימה ובחר תבנית">
          🎨 עיצוב הזמנה
        </ModalHeader>

        <ModalBody className="p-0 overflow-hidden flex flex-col">
          <div className="shrink-0 p-3 pb-0 sm:hidden">
            {renderMobileNextActionCard({
              stepLabel: 'שלב 3 מתוך 5',
              title: designMobileTab === 'templates' ? 'בחרו עיצוב להזמנה' : 'ערכו את טקסט ההזמנה',
              description: designMobileTab === 'templates'
                ? 'בחרו תבנית, ראו תצוגה מקדימה ואז המשיכו לשליחה.'
                : 'עדכנו פונטים, צבעים וטקסט, ואז עברו לבחירת תבנית.',
              actionText: designMobileTab === 'text' ? 'עבור לבחירת תבנית' : '',
              onAction: designMobileTab === 'text' ? () => setDesignMobileTab('templates') : undefined,
              helpText: 'בשלב זה ניתן לבחור תבנית מוכנה וגם לשנות את הטקסט, הפונטים והצבעים של ההזמנה.',
              icon: '🎨',
            })}
          </div>
          {/* Mobile tabs */}
          <div className="flex sm:hidden border-b border-white/10 shrink-0">
            <button
              onClick={() => setDesignMobileTab('text')}
              className={`flex-1 py-3 text-center font-bold text-sm transition-all ${designMobileTab === 'text' ? 'text-indigo-300 border-b-2 border-indigo-400 bg-indigo-500/10' : 'text-slate-400'}`}
            >
              א. עיצוב טקסט
            </button>
            <button
              onClick={() => setDesignMobileTab('templates')}
              className={`flex-1 py-3 text-center font-bold text-sm transition-all ${designMobileTab === 'templates' ? 'text-indigo-300 border-b-2 border-indigo-400 bg-indigo-500/10' : 'text-slate-400'}`}
            >
              ב. בחירת תבנית
            </button>
          </div>

          {/* Desktop: 3-column layout | Mobile: tab-driven single column */}
          <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">

            {/* ── Col 1: Text editor ── */}
            <div className={`${designMobileTab === 'text' ? 'flex' : 'hidden'} sm:flex flex-col w-full sm:w-[25%] border-b sm:border-b-0 sm:border-l border-white/10 overflow-y-auto p-4 gap-4`}>
              <h3 className="text-base font-bold text-slate-200 text-center sm:text-right">א. עצב טקסט הזמנה</h3>

              {/* Font chooser */}
              <div className="text-right">
                <label className="block mb-1 text-sm font-semibold text-slate-300">גופן</label>
                <select
                  value={selectedFontKey}
                  onChange={(e) => setSelectedFontKey(e.target.value)}
                  className="w-full bg-[#1a1d4a] border border-white/30 text-slate-100 rounded-xl focus:border-indigo-400 p-2 text-sm"
                >
                  {fontsOptions.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Line editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">{customInvitationText.split('\n').length} שורות</span>
                  <button
                    onClick={addNewLineAtTop}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-sm font-medium"
                  >+ שורה למעלה</button>
                </div>

                <div className="space-y-1.5">
                  {customInvitationText.split('\n').map((line, index) => (
                    <div key={index} className="p-1.5 bg-white/5 border border-white/10 rounded-xl">
                      <textarea
                        value={line}
                        onChange={(e) => updateLineText(index, e.target.value)}
                        className="w-full bg-white/10 border border-white/15 text-white placeholder-slate-400 rounded-lg focus:border-indigo-400 p-1.5 text-right text-sm resize-none"
                        style={{
                          fontSize: `${Math.min(getEffectiveLineStyle(index).fontSize, 16)}px`,
                          color: getDarkThemePreviewColor(getEffectiveLineStyle(index).color),
                          fontWeight: getEffectiveLineStyle(index).fontWeight || 'normal',
                        }}
                        rows={1}
                      />
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowAdvancedEdit(index); }}
                          className="px-3 py-1.5 sm:px-2 sm:py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg sm:rounded text-base sm:text-sm font-bold sm:font-medium"
                        >
                          ✨ עיצוב
                          <span className="block text-[11px] font-semibold text-white/85 sm:hidden">פונטים, צבעים ועוד</span>
                        </button>
                        <button
                          onClick={() => deleteLine(index)}
                          className="px-2 py-0.5 bg-red-500/70 hover:bg-red-500 rounded text-sm text-white font-medium"
                          aria-label="מחק שורה"
                        >🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomInvitationText('');
                      if (normalizeType(selectedEventType) === 'חתונה') {
                        setLineStyles(defaultLineStylesForWedding);
                      } else {
                        setLineStyles({ 0: { ...defaultFirstLineStyle } });
                      }
                    }}
                    className="text-sm underline text-slate-400 hover:text-slate-200"
                  >ברירת מחדל</button>
                  <button
                    onClick={addNewLine}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-sm font-medium"
                  >+ שורה למטה</button>
                </div>
              </div>
            </div>

            {/* ── Col 2: Live centered invitation preview ── */}
            <div className="hidden sm:flex flex-col items-center justify-center w-full sm:w-[45%] p-4 gap-3 bg-white/[0.02] border-l border-white/10">
              <h3 className="text-sm font-bold text-slate-300 shrink-0">תצוגה מקדימה</h3>
              <div
                className="relative rounded-2xl overflow-hidden shadow-[0_12px_48px_rgba(0,0,0,0.6)] ring-2 ring-indigo-400/20"
                style={{ width: '100%', maxWidth: 480, aspectRatio: '3/4' }}
              >
                {selectedDesign ? (
                  <img src={selectedDesign} alt="תבנית נבחרת" className="absolute inset-0 w-full h-full object-cover object-top" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#f0e8ff] to-[#fdf6ee]" />
                )}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.2)' }} />
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center px-4 py-6 overflow-hidden"
                  dir="rtl"
                  style={{ gap: 0 }}
                >
                  {(customInvitationText || invitationText || '').split('\n').map((line, lineIndex) => {
                    if (!line || !line.trim()) return <div key={lineIndex} style={{ height: '0.4em', flexShrink: 0 }} />;
                    const style = getEffectiveLineStyle(lineIndex);
                    const rawSize = style.fontSize ? parseInt(style.fontSize) : (lineIndex === 0 ? 28 : 18);
                    const scaledSize = Math.round(rawSize * 0.9);
                    let textColor = style.color || '#000000';
                    if (!textColor.startsWith('#')) {
                      const colorMap = { black:'#000000',red:'#FF0000',blue:'#0000FF',green:'#008000',purple:'#800080',orange:'#FFA500',brown:'#A52A2A',gold:'#FFD700',pink:'#FFC0CB',cyan:'#00FFFF',indigo:'#4B0082',teal:'#008080' };
                      textColor = colorMap[textColor.toLowerCase()] || '#000000';
                    }
                    return (
                      <div
                        key={lineIndex}
                        style={{
                          width: '100%',
                          maxWidth: '92%',
                          minWidth: 0,
                          boxSizing: 'border-box',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                          flexShrink: 0,
                          fontSize: `${scaledSize}px`,
                          fontFamily: selectedFontCss || 'Assistant, sans-serif',
                          fontWeight: style.fontWeight || 'normal',
                          color: textColor,
                          lineHeight: style.lineHeight ? `${style.lineHeight}` : '1.35',
                          letterSpacing: style.letterSpacing ? `${style.letterSpacing * 0.7}px` : '0',
                          textAlign: style.textAlign || 'center',
                          textDecoration: style.textDecoration || 'none',
                          transform: style.fontStyle === 'italic' ? 'skewX(20deg)' : style.fontStyle === 'back-slant' ? 'skewX(-20deg)' : 'none',
                          whiteSpace: 'pre-wrap',
                          marginBottom: '0.2em',
                        }}
                      >
                        {line.trim()}
                      </div>
                    );
                  })}
                </div>
                {!selectedDesign && (
                  <div className="absolute bottom-3 inset-x-4 text-center text-[10px] text-slate-500 pointer-events-none">
                    בחר תבנית מהרשימה ←
                  </div>
                )}
              </div>
              {selectedDesign && (
                <p className="text-xs text-emerald-400 font-semibold shrink-0">✓ תבנית נבחרת</p>
              )}
            </div>

            {/* ── Col 3: Template grid ── */}
            <div className={`${designMobileTab === 'templates' ? 'flex' : 'hidden'} sm:flex flex-col w-full sm:w-[30%] overflow-y-auto p-4 gap-3`}>
              <div className="rounded-2xl border border-violet-300/25 bg-violet-500/10 px-4 py-3 text-center sm:hidden">
                <div className="text-lg font-black text-white">תצוגה מקדימה של ההזמנה</div>
                <div className="mt-1 text-sm font-semibold text-violet-200">בחרו תבנית ולחצו עליה כדי לראות איך ההזמנה תיראה</div>
              </div>
              <h3 className="text-sm font-bold text-slate-300 text-center sm:text-right shrink-0">ב. לחץ פעמיים לבחירת תבנית</h3>
              {designImages.length === 0 ? (
                <p className="text-center text-slate-400 mt-10 text-sm">לא נמצאו תמונות</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {designImages.map((src) => {
                    const normalizePath = (path) => {
                      if (!path) return '';
                      try {
                        let n = decodeURIComponent(path);
                        return n.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/').toLowerCase();
                      } catch { return path.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/').toLowerCase(); }
                    };
                    const getFilename = (path) => normalizePath(path).split('/').pop() || normalizePath(path);
                    const isSelected = (() => {
                      if (!selectedDesign) return false;
                      if (normalizePath(selectedDesign) === normalizePath(src)) return true;
                      return getFilename(selectedDesign) === getFilename(src) && getFilename(src) !== '';
                    })();

                    return (
                      <div
                        key={src}
                        className={`relative cursor-pointer rounded-xl overflow-hidden transition-all duration-150 ${
                          isSelected
                            ? 'ring-4 ring-emerald-400/80 ring-offset-2 ring-offset-[#12143a] scale-[1.02]'
                            : 'ring-1 ring-white/15 hover:ring-indigo-400/50 hover:scale-[1.01]'
                        }`}
                        onClick={() => { setLightboxSrc(src); setShowLightbox(true); }}
                        onDoubleClick={async () => {
                          setSelectedDesign(src);
                          try { localStorage.setItem('selectedDesign', src); } catch {}
                          if (currentEventId) {
                            try {
                              const { data: eventData, error: fetchError } = await supabase
                                .from('events').select('event_details').eq('id', currentEventId).single();
                              if (!fetchError && eventData?.event_details) {
                                let details = {};
                                try { details = typeof eventData.event_details === 'string' ? JSON.parse(eventData.event_details) : (eventData.event_details || {}); } catch {}
                                await supabase.from('events').update({ event_details: { ...details, template_src: src } }).eq('id', currentEventId);
                              }
                            } catch (err) { console.error('Failed to save design selection:', err); }
                          }
                        }}
                      >
                        <div className="relative aspect-[3/4] w-full bg-white/5">
                          <img src={src} alt="Invitation design" className="absolute inset-0 w-full h-full object-cover object-top" />
                          <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.15)' }} />
                          <div className="absolute inset-0 flex flex-col items-center justify-center px-2 overflow-hidden" dir="rtl">
                            {(customInvitationText || invitationText || '').split('\n').map((line, lineIndex) => {
                              if (!line || !line.trim()) return <div key={lineIndex} style={{ height: '0.3em', flexShrink: 0 }} />;
                              const style = getEffectiveLineStyle(lineIndex);
                              const rawSize = style.fontSize ? parseInt(style.fontSize) : (lineIndex === 0 ? 28 : 18);
                              const scaledSize = Math.round(rawSize * 0.38);
                              let textColor = style.color || '#000000';
                              if (!textColor.startsWith('#')) {
                                const colorMap = { black:'#000000',red:'#FF0000',blue:'#0000FF',green:'#008000',purple:'#800080',orange:'#FFA500',brown:'#A52A2A',gold:'#FFD700',pink:'#FFC0CB',cyan:'#00FFFF',indigo:'#4B0082',teal:'#008080' };
                                textColor = colorMap[textColor.toLowerCase()] || '#000000';
                              }
                              return (
                                <div
                                  key={lineIndex}
                                  style={{
                                    width: '100%', maxWidth: '92%', minWidth: 0,
                                    boxSizing: 'border-box', overflowWrap: 'anywhere', wordBreak: 'break-word',
                                    flexShrink: 0,
                                    fontSize: `${scaledSize}px`,
                                    fontFamily: selectedFontCss || 'Assistant, sans-serif',
                                    fontWeight: style.fontWeight || 'normal',
                                    color: textColor,
                                    lineHeight: '1.3',
                                    textAlign: style.textAlign || 'center',
                                    whiteSpace: 'pre-wrap',
                                    marginBottom: '0.15em',
                                  }}
                                >
                                  {line.trim()}
                                </div>
                              );
                            })}
                          </div>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 bg-emerald-500 rounded-full w-6 h-6 flex items-center justify-center shadow-lg z-10">
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ModalBody>
      </Modal>
      {/* Lightbox for design preview */}
      <Modal open={showLightbox} onClose={() => setShowLightbox(false)} size="lg">
        <ModalHeader onClose={() => setShowLightbox(false)}>תצוגה מקדימה</ModalHeader>
        <ModalBody className="flex flex-col items-center">
          <div className="relative w-full flex items-center justify-center overflow-hidden min-h-0">
            <div className="relative aspect-[4/5] overflow-hidden rounded-md shadow-2xl" style={{ width: 'min(100%, 520px, calc((92vh - 170px) * 0.8))' }}>
              <img src={lightboxSrc} alt="preview" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 rounded-md pointer-events-none" style={{ background: 'rgba(255,255,255,0.22)' }} aria-hidden />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-4" dir="rtl">
                {(customInvitationText || invitationText || 'דוגמת טקסט להזמנה').split('\n').map((line, lineIndex) => {
                  if (!line || !line.trim()) return <div key={lineIndex} style={{ height: '0.5em' }} />;
                  const style = getEffectiveLineStyle(lineIndex);
                  const fontSize = style.fontSize ? parseInt(style.fontSize) : (lineIndex === 0 ? 28 : 24);
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
                        ...invitationPreviewLineContainmentStyle,
                        fontSize: `${fontSize}px`,
                        fontFamily: selectedFontCss || 'Assistant, sans-serif',
                        fontWeight: style.fontWeight || 'normal',
                        color: textColor,
                        lineHeight: style.lineHeight ? `${style.lineHeight}` : '1.5',
                        letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : '0',
                        textAlign: style.textAlign || 'center',
                        textDecoration: style.textDecoration || 'none',
                        fontStyle: style.fontStyle || 'normal',
                        textShadow: 'none',
                        transform: style.fontStyle === 'italic' ? 'skewX(20deg)' : style.fontStyle === 'back-slant' ? 'skewX(-20deg)' : 'none',
                        whiteSpace: 'pre-wrap',
                        marginBottom: lineIndex < (customInvitationText || invitationText || '').split('\n').length - 1 ? '0.5em' : '0',
                      }}
                    >
                      {line.trim()}
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
        </ModalBody>
        <ModalFooter>
          {uploadingInvite ? (
            <button disabled className="bg-white/20 text-slate-300 px-4 sm:px-6 py-2 rounded-full cursor-not-allowed text-sm sm:text-base">מעלה...</button>
          ) : (
            <button onClick={() => handleChooseDesign(lightboxSrc)} className="bg-emerald-600 text-white px-4 sm:px-6 py-2 rounded-full hover:bg-emerald-700 text-sm sm:text-base font-medium">בחר עיצוב זה</button>
          )}
          <button onClick={() => setShowLightbox(false)} className="bg-red-500 text-white px-4 sm:px-6 py-2 rounded-full hover:bg-red-600 text-sm sm:text-base font-medium">אל תבחר</button>
        </ModalFooter>
      </Modal>

      {/* Advanced Edit Modal */}
      {showAdvancedEdit !== null && (
        <>
          {/* Color picker modal */}
          <Modal open={showColorPalette} onClose={() => setShowColorPalette(false)} size="md">
            <ModalHeader onClose={() => setShowColorPalette(false)}>בחירת צבע פונט</ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {colorKeys.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      updateLineStyle(showAdvancedEdit, 'color', color);
                      setShowColorPalette(false);
                    }}
                    className={`aspect-square rounded-xl border-4 transition-all hover:scale-105 ${
                      lineStyles[showAdvancedEdit]?.color === color ? 'border-white ring-4 ring-indigo-400/50' : 'border-white/20'
                    } ${colorClasses[color] || 'bg-white/10'}`}
                    title={color}
                  ></button>
                ))}
              </div>
            </ModalBody>
            <ModalFooter>
              <button
                onClick={() => setShowColorPalette(false)}
                className="flex-1 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-full px-6 py-2.5 font-bold hover:opacity-90 transition-all"
              >
                חזרה לעיצוב
              </button>
            </ModalFooter>
          </Modal>
          {!showColorPalette && (
        <Modal open={showAdvancedEdit !== null && !showColorPalette} onClose={() => setShowAdvancedEdit(null)} size="xl">
          <ModalHeader onClose={() => setShowAdvancedEdit(null)}>עיצוב מתקדם - שורה {showAdvancedEdit !== null ? showAdvancedEdit + 1 : ''}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              {/* Left Column */}
              <div className="space-y-3">
                {/* Font Color */}
                <div>
                  <label className="block mb-2 font-bold text-right">צבע פונט</label>
                  <button
                    type="button"
                    onClick={() => setShowColorPalette(true)}
                    className="w-full py-2 px-4 bg-white/10 border border-white/20 text-white rounded-xl hover:border-indigo-400 hover:bg-indigo-500/10 transition-colors text-center font-medium"
                  >
                    לחץ לבחירת צבע
                  </button>
                </div>

                {/* Font Size */}
                <div>
                  <label className="block mb-2 font-bold text-right">גודל פונט</label>
                  <select
                    value={lineStyles[showAdvancedEdit]?.fontSize ?? (showAdvancedEdit === 0 ? '28' : '16')}
                    onChange={(e) => updateLineStyle(showAdvancedEdit, 'fontSize', e.target.value)}
                    className="w-full bg-[#1a1d4a] border border-white/30 text-slate-100 rounded-xl focus:border-indigo-400 p-2"
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
                    value={lineStyles[showAdvancedEdit]?.fontWeight ?? (showAdvancedEdit === 0 ? 'bold' : 'normal')}
                    onChange={(e) => updateLineStyle(showAdvancedEdit, 'fontWeight', e.target.value)}
                    className="w-full bg-[#1a1d4a] border border-white/30 text-slate-100 rounded-xl focus:border-indigo-400 p-2"
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
                      className={`flex-1 p-3 border-2 rounded-lg ${lineStyles[showAdvancedEdit]?.textShadow && lineStyles[showAdvancedEdit]?.textShadow !== 'none' ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-white/20 bg-white/5 text-slate-300'} hover:border-indigo-400 transition-colors`}
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
                        className={`flex-1 p-3 border-2 rounded-lg ${lineStyles[showAdvancedEdit]?.textAlign === align.value ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-white/20 bg-white/5 text-slate-300'} hover:border-indigo-400 transition-colors`}
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
                  <div className="text-sm text-slate-400 text-center mt-1">
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
                  <div className="text-sm text-slate-400 text-center mt-1">
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
                        className={`px-4 py-2 border-2 rounded-lg ${lineStyles[showAdvancedEdit]?.textDecoration === dec.value ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-white/20 bg-white/5 text-slate-300'} hover:border-indigo-400 transition-colors`}
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
                      className={`flex-1 p-3 border-2 rounded-lg ${(lineStyles[showAdvancedEdit]?.fontStyle || 'normal') === 'normal' ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-white/20 bg-white/5 text-slate-300'} hover:border-indigo-400 transition-colors`}
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
                      className={`flex-1 p-3 border-2 rounded-lg ${lineStyles[showAdvancedEdit]?.fontStyle === 'italic' ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-white/20 bg-white/5 text-slate-300'} hover:border-indigo-400 transition-colors`}
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
                      className={`flex-1 p-3 border-2 rounded-lg ${lineStyles[showAdvancedEdit]?.fontStyle === 'back-slant' ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-white/20 bg-white/5 text-slate-300'} hover:border-indigo-400 transition-colors`}
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

            {/* Preview - centered at bottom, above buttons */}
            <div className="flex flex-col items-center px-6 py-3 flex-shrink-0 border-t border-white/10 bg-white/[0.03]">
              <label className="block mb-1 font-bold text-center text-sm text-slate-300">תצוגה מקדימה</label>
              <div className="w-full max-w-xl bg-white/5 border border-white/10 rounded-xl p-3 min-h-[70px]" style={{ textAlign: getEffectiveLineStyle(showAdvancedEdit).textAlign || 'center' }}>
                <div
                  style={{
                    fontSize: `${getEffectiveLineStyle(showAdvancedEdit).fontSize}px`,
                    color: getDarkThemePreviewColor(getEffectiveLineStyle(showAdvancedEdit).color),
                    fontWeight: getEffectiveLineStyle(showAdvancedEdit).fontWeight || 'normal',
                    lineHeight: getEffectiveLineStyle(showAdvancedEdit).lineHeight || 1.5,
                    letterSpacing: `${getEffectiveLineStyle(showAdvancedEdit).letterSpacing || 0}px`,
                    textAlign: getEffectiveLineStyle(showAdvancedEdit).textAlign || 'center',
                    textDecoration: getEffectiveLineStyle(showAdvancedEdit).textDecoration || 'none',
                    fontStyle: 'normal',
                    textShadow: 'none',
                    transform: getEffectiveLineStyle(showAdvancedEdit).fontStyle === 'italic' ? 'skewX(20deg)' : getEffectiveLineStyle(showAdvancedEdit).fontStyle === 'back-slant' ? 'skewX(-20deg)' : 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {customInvitationText.split('\n')[showAdvancedEdit] || 'דוגמת טקסט להזמנה'}
                </div>
              </div>
            </div>

          </ModalBody>
          <ModalFooter>
            <button
              onClick={() => {
                const updatedStyles = { ...lineStyles };
                updatedStyles[showAdvancedEdit] = getDefaultStyleForRow(showAdvancedEdit);
                setLineStyles(updatedStyles);
              }}
              className="flex-1 bg-red-500 text-white border border-red-400/50 rounded-full px-6 py-3 font-bold hover:bg-red-600 transition-all"
            >
              תחזיר עיצוב שורה לעיצוב ברירת מחדל
            </button>
            <button
              onClick={() => setShowAdvancedEdit(null)}
              className="flex-1 bg-emerald-600 text-white border border-emerald-400/50 rounded-full px-6 py-3 font-bold hover:bg-emerald-700 transition-all"
            >
              שמור וסגור
            </button>
          </ModalFooter>
        </Modal>
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
          <div className="ml-4 flex items-center gap-2 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-slate-300">
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
      <Modal open={showReportModal} onClose={() => setShowReportModal(false)} size="full" landscape>
        <ModalHeader onClose={() => setShowReportModal(false)}>{reportTitle}</ModalHeader>
        <ModalBody>
          {showReportModal && (<>
            {reportGuests.length === 0 ? (
              <p className="text-center text-slate-400">אין נתונים להצגה</p>
            ) : (
              <>
                <div className="max-h-[75vh] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-right border border-collapse" style={{fontSize: '11px'}}>
                  <thead>
                    <tr className="bg-white/5 text-slate-300">
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">#</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">שם</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">משפחה</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">שולחן</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">טלפון</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">בוגרים</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">ילדים</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">סה"כ</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">צמחוני</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">טבעוני</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">גלאט</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">צליאקים</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">אלרגיה</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">הערה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportGuests.map((g, idx) => {
                      if (g.isSummary) {
                        return (
                          <tr key={`summary-${g.table_number}-${idx}`} className="bg-amber-500/15 text-amber-100 font-bold">
                            <td className="px-0.5 py-0.5 border text-center"></td>
                            <td className="px-0.5 py-0.5 border text-right" colSpan={3}>{g.summary_label}</td>
                            <td className="px-0.5 py-0.5 border"></td>
                            <td className="px-0.5 py-0.5 border text-center">{g.adults}</td>
                            <td className="px-0.5 py-0.5 border text-center">{g.children}</td>
                            <td className="px-0.5 py-0.5 border text-center">{g.total}</td>
                            <td className="px-0.5 py-0.5 border text-center">{g.veg || '-'}</td>
                            <td className="px-0.5 py-0.5 border text-center">{g.vegan || '-'}</td>
                            <td className="px-0.5 py-0.5 border text-center">{g.glatt || '-'}</td>
                            <td className="px-0.5 py-0.5 border text-center">{g.celiac || '-'}</td>
                            <td className="px-0.5 py-0.5 border text-center">{g.allergy || '-'}</td>
                            <td className="px-0.5 py-0.5 border"></td>
                          </tr>
                        );
                      }
                      let rowNum = 0;
                      for (let i = 0; i < idx; i++) {
                        if (!reportGuests[i].isSummary) rowNum++;
                      }
                      rowNum++;
                      return (
                        <tr key={g.id || `guest-${idx}`} className="odd:bg-white/5 even:bg-white/[0.02] border-white/5 text-slate-300">
                          <td className="px-0.5 py-0.5 border text-center">{rowNum}</td>
                          <td className="px-0.5 py-0.5 border whitespace-nowrap">{g.first_name}</td>
                          <td className="px-0.5 py-0.5 border whitespace-nowrap">{g.last_name}</td>
                          <td className="px-0.5 py-0.5 border text-center">{g.table_number || '-'}</td>
                          <td className="px-0.5 py-0.5 border whitespace-nowrap">{g.phone}</td>
                          <td className="px-0.5 py-0.5 border text-center">{g.adults ?? '-'}</td>
                          <td className="px-0.5 py-0.5 border text-center">{g.children ?? '-'}</td>
                          <td className="px-0.5 py-0.5 border text-center">{(g.adults||0)+(g.children||0)}</td>
                          <td className="px-0.5 py-0.5 border text-center">{(g.veg_adults+g.veg_children)|| '-'}</td>
                          <td className="px-0.5 py-0.5 border text-center">{(g.vegan_adults+g.vegan_children)|| '-'}</td>
                          <td className="px-0.5 py-0.5 border text-center">{(g.glatt_adults+g.glatt_children)|| '-'}</td>
                          <td className="px-0.5 py-0.5 border text-center">{((g.celiac_adults||0)+(g.celiac_children||0))|| '-'}</td>
                          <td className="px-0.5 py-0.5 border text-center">{(g.allergy_adults+g.allergy_children)|| '-'}</td>
                          <td className="px-0.5 py-0.5 border text-center">{g.allergy_note || g.allergy_description || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white/5 text-slate-300 font-bold text-xs sm:text-lg">
                      <td className="px-0.5 py-1 border text-center" colSpan={5}>סה״כ</td>
                      <td className="px-0.5 py-1 border text-center">{totalReportAdults}</td>
                      <td className="px-0.5 py-1 border text-center">{totalReportChildren}</td>
                      <td className="px-0.5 py-1 border text-center">{totalReportAdults + totalReportChildren}</td>
                      <td className="px-0.5 py-1 border text-center">{totalVeg}</td>
                      <td className="px-0.5 py-1 border text-center">{totalVegan}</td>
                      <td className="px-0.5 py-1 border text-center">{totalGlatt}</td>
                      <td className="px-0.5 py-1 border text-center">{totalCeliac}</td>
                      <td className="px-0.5 py-1 border text-center">{totalAllergy}</td>
                      <td className="px-0.5 py-1 border text-center"></td>
                    </tr>
                  </tfoot>
                </table>
                </div>
              </>
            )}
            {renderReportActions(exportReportXlsx, () => setShowReportModal(false))}
          </>)}
        </ModalBody>
      </Modal>
      {/* Reports menu modal */}
      <Modal open={typeof showReportsOptions !== 'undefined' && showReportsOptions} onClose={() => setShowReportsOptions(false)} size="lg">
        <ModalHeader onClose={() => setShowReportsOptions(false)}>בחר דו"ח להצגה</ModalHeader>
        <ModalBody className="text-center space-y-4">
            {renderMobileNextActionCard({
              stepLabel: 'שלב 5 מתוך 5',
              title: 'בחרו דוח להצגה',
              description: 'פתחו דוח כדי לעקוב אחרי אישורי ההגעה, שולחנות ואורחים שעדיין לא הגיבו.',
              helpText: 'במובייל מומלץ להשתמש בדוחות לצפייה מהירה. לעבודה מפורטת עם Excel עדיף לפתוח במחשב.',
              icon: '📊',
            })}
            {selectedEventForReport && (
              <p className="text-base md:text-lg font-bold text-slate-100 mb-4 rtl text-right">
                אירוע מהעבר: {selectedEventForReport.event_type || 'אירוע'} – {selectedEventForReport._eventDate?format(selectedEventForReport._eventDate,'dd/MM/yyyy',{locale:he}):''}
              </p>
            )}
            <button onClick={()=>{setShowReportsOptions(false);setShowApprovedReport(true);}} className="w-full bg-white/[0.06] text-slate-100 border border-white/15 rounded-full px-4 py-2 text-lg font-medium hover:bg-indigo-500/15 hover:border-indigo-400/50 transition-all">אישרו הגעה</button>
            <button onClick={async () => {
              setShowReportsOptions(false);
              try {
                const user = await resolveCurrentUserForSync();
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
            }} className="w-full bg-white/[0.06] text-slate-100 border border-white/15 rounded-full px-4 py-2 text-lg font-medium hover:bg-indigo-500/15 hover:border-indigo-400/50 transition-all">אישרו הגעה ממוינים לפי שולחן</button>
            <button onClick={()=>{setShowReportsOptions(false);setShowRejectedReport(true);}} className="w-full bg-white/[0.06] text-slate-100 border border-white/15 rounded-full px-4 py-2 text-lg font-medium hover:bg-indigo-500/15 hover:border-indigo-400/50 transition-all">לא מגיעים</button>
            <button onClick={()=>{setShowReportsOptions(false);setShowPendingReport(true);}} className="w-full bg-white/[0.06] text-slate-100 border border-white/15 rounded-full px-4 py-2 text-lg font-medium hover:bg-indigo-500/15 hover:border-indigo-400/50 transition-all">טרם הגיבו</button>
            {/* Guest status query button */}
            <button onClick={()=>{setShowReportsOptions(false);setShowSearchGuest(true);}} className="w-full bg-white/[0.06] text-slate-100 border border-white/15 rounded-full px-4 py-2 text-lg font-medium hover:bg-indigo-500/15 hover:border-indigo-400/50 transition-all">שאילתת סטטוס אורח</button>
            <button onClick={async ()=>{
              setShowReportsOptions(false);
              try{
                const user = await resolveCurrentUserForSync();
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
            }} className="w-full bg-white/[0.06] text-slate-100 border border-white/15 rounded-full px-4 py-2 text-lg font-medium hover:bg-indigo-500/15 hover:border-indigo-400/50 transition-all">אירועים מהעבר</button>

            {/* Exit archive event button */}
            {selectedEventForReport && (
              <button onClick={()=>{
                setSelectedEventForReport(null);
                // Don't reset currentEventId - it should remain as the active event
                setShowReportsOptions(false);
              }} className="w-full bg-white/[0.06] text-slate-100 border border-white/15 rounded-full px-4 py-2 text-lg font-medium hover:bg-indigo-500/15 hover:border-indigo-400/50 transition-all mt-2">יציאה מאירוע עבר</button>
            )}
        </ModalBody>
      </Modal>

      {/* Approved report modal */}
      <Modal open={showApprovedReport} onClose={()=>{setShowApprovedReport(false);setShowReportsOptions(true);}} size="full" landscape>
        <ModalHeader onClose={()=>{setShowApprovedReport(false);setShowReportsOptions(true);}}>דוח אורחים שאישרו הגעה</ModalHeader>
        <ModalBody className="overflow-x-auto">
              <table className="w-full text-right border border-collapse" style={{fontSize: '11px'}}>
                <thead>
                  <tr className="bg-white/5 text-slate-300">
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">#</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">שם</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">משפחה</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">שולחן</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">טלפון</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">בוגרים</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">ילדים</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">סה"כ</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">צמחוני</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">טבעוני</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">גלאט</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">צליאקים</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">אלרגיה</th>
                    <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">הערה</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedGuests.map((g,idx)=>(
                    <tr key={idx} className="odd:bg-white/5 even:bg-white/[0.02] text-slate-300">
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{idx+1}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.first_name}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.last_name}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{g.table_number || '-'}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.phone}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{g.adults}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{g.children}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{(g.adults||0)+(g.children||0)}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{g.veg_adults+g.veg_children}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{g.vegan_adults+g.vegan_children}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{g.glatt_adults+g.glatt_children}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{(g.celiac_adults||0)+(g.celiac_children||0)}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{g.allergy_adults+g.allergy_children}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{g.allergy_note || ((g.allergy_adults+g.allergy_children)>0? 'אלרגיה' : '-')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white/5 text-slate-300 font-bold" style={{fontSize: '11px'}}>
                    <td className="px-0.5 py-1 border border-white/10 text-center" colSpan={5}>סה״כ</td>
                    <td className="px-0.5 py-1 border border-white/10 text-center">{approvedGuests.reduce((s,g)=>s+g.adults,0)}</td>
                    <td className="px-0.5 py-1 border border-white/10 text-center">{approvedGuests.reduce((s,g)=>s+g.children,0)}</td>
                    <td className="px-0.5 py-1 border border-white/10 text-center">{approvedGuests.reduce((s,g)=>s+g.adults+g.children,0)}</td>
                    <td className="px-0.5 py-1 border border-white/10 text-center">{approvedGuests.reduce((s,g)=>s+g.veg_adults+g.veg_children,0)}</td>
                    <td className="px-0.5 py-1 border border-white/10 text-center">{approvedGuests.reduce((s,g)=>s+g.vegan_adults+g.vegan_children,0)}</td>
                    <td className="px-0.5 py-1 border border-white/10 text-center">{approvedGuests.reduce((s,g)=>s+g.glatt_adults+g.glatt_children,0)}</td>
                    <td className="px-0.5 py-1 border border-white/10 text-center">{approvedGuests.reduce((s,g)=>s+(g.celiac_adults||0)+(g.celiac_children||0),0)}</td>
                    <td className="px-0.5 py-1 border border-white/10 text-center">{approvedGuests.reduce((s,g)=>s+g.allergy_adults+g.allergy_children,0)}</td>
                    <td className="px-0.5 py-1 border border-white/10 text-center"></td>
                  </tr>
                </tfoot>
              </table>
              {renderReportActions(exportApprovedXlsx, () => { setShowApprovedReport(false); setShowReportsOptions(true); })}
        </ModalBody>
      </Modal>

      {/* Rejected report modal */}
      <Modal open={showRejectedReport} onClose={()=>{setShowRejectedReport(false);setShowReportsOptions(true);}} size="full" landscape>
        <ModalHeader onClose={()=>{setShowRejectedReport(false);setShowReportsOptions(true);}}>דוח אורחים שלא מגיעים</ModalHeader>
        <ModalBody className="overflow-x-auto">
              <table className="w-full text-right border border-white/10 border-collapse" style={{fontSize: '11px'}}>
                <thead>
                  <tr className="bg-white/5 text-slate-300 font-bold whitespace-nowrap">
                    <th className="px-0.5 py-1 border border-white/10">#</th>
                    <th className="px-0.5 py-1 border border-white/10">שם</th>
                    <th className="px-0.5 py-1 border border-white/10">משפחה</th>
                    <th className="px-0.5 py-1 border border-white/10">טלפון</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedGuests.map((g,idx)=>(
                    <tr key={idx} className="odd:bg-white/5 even:bg-white/[0.02] text-slate-300">
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{idx+1}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.first_name}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.last_name}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.phone}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white/5 text-slate-300 font-bold">
                    <td className="px-0.5 py-1 border border-white/10 text-center" colSpan={4}>סה״כ לא מגיעים: {rejectedGuests.length}</td>
                  </tr>
                </tfoot>
              </table>
              {renderReportActions(exportRejectedXlsx, () => { setShowRejectedReport(false); setShowReportsOptions(true); })}
        </ModalBody>
      </Modal>

      {/* Pending report modal */}
      <Modal open={showPendingReport} onClose={()=>{setShowPendingReport(false);setShowReportsOptions(true);}} size="full" landscape>
        <ModalHeader onClose={()=>{setShowPendingReport(false);setShowReportsOptions(true);}}>דוח אורחים שטרם הגיבו</ModalHeader>
        <ModalBody className="overflow-x-auto">
              <table className="w-full text-right border border-white/10 border-collapse" style={{fontSize: '11px'}}>
                <thead>
                  <tr className="bg-white/5 text-slate-300 font-bold whitespace-nowrap">
                    <th className="px-0.5 py-1 border border-white/10">#</th>
                    <th className="px-0.5 py-1 border border-white/10">שם</th>
                    <th className="px-0.5 py-1 border border-white/10">משפחה</th>
                    <th className="px-0.5 py-1 border border-white/10">טלפון</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingGuests.map((g,idx)=>(
                    <tr key={idx} className="odd:bg-white/5 even:bg-white/[0.02] text-slate-300">
                      <td className="px-0.5 py-0.5 border border-white/10 text-center">{idx+1}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.first_name}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.last_name}</td>
                      <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.phone}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white/5 text-slate-300 font-bold">
                    <td className="px-0.5 py-1 border border-white/10 text-center" colSpan={4}>סה״כ טרם הגיבו: {pendingGuests.length}</td>
                  </tr>
                </tfoot>
              </table>
              {renderReportActions(exportPendingXlsx, () => { setShowPendingReport(false); setShowReportsOptions(true); })}
        </ModalBody>
      </Modal>

      {/* Guest status query modal */}
      <Modal open={showSearchGuest} onClose={()=>{setShowSearchGuest(false); setShowReportsOptions(true);}} size="lg" landscape>
        <ModalHeader onClose={()=>{setShowSearchGuest(false); setShowReportsOptions(true);}}>חיפוש אורח</ModalHeader>
        <ModalBody>
            <div className="flex justify-center gap-2 mb-4 px-1">
              <input
                type="text"
                placeholder="שם / משפחה / טלפון"
                value={searchTerm}
                onChange={(e)=>setSearchTerm(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl focus:border-indigo-400 p-2 text-sm"
              />
              <button onClick={handleGuestSearch} className="bg-primary text-white px-3 sm:px-4 py-2 rounded-md hover:bg-primary/90 whitespace-nowrap text-sm">חפש</button>
            </div>
            {guestSearchAttempted && searchError && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-center text-sm font-semibold text-red-300">{searchError}</p>}
            {searchResults.length>0 && (
              <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
                <table className="w-full text-right border border-white/10 border-collapse" style={{fontSize: '11px'}}>
                  <thead>
                    <tr className="bg-white/5 text-slate-300">
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">#</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">שם</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">משפחה</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">טלפון</th>
                      <th className="px-0.5 py-1 border border-white/10 whitespace-nowrap">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((g,idx)=>(
                      <tr key={g.id} className="odd:bg-white/5 even:bg-white/[0.02] text-slate-300">
                        <td className="px-0.5 py-0.5 border border-white/10 text-center">{idx+1}</td>
                        <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.first_name}</td>
                        <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.last_name}</td>
                        <td className="px-0.5 py-0.5 border border-white/10 whitespace-nowrap">{g.phone}</td>
                        <td className="px-0.5 py-0.5 border border-white/10 text-center whitespace-nowrap">{g.status==='approved'? 'מגיע' : g.status==='rejected'? 'לא מגיע' : 'טרם הגיב'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </ModalBody>
        <ModalFooter>
          <button onClick={()=>{setShowSearchGuest(false); setShowReportsOptions(true);}} className="bg-primary text-white border border-primary rounded-full px-6 sm:px-8 py-2 sm:py-3 font-medium hover:bg-primary/90 transition-all text-sm sm:text-base">סגור</button>
        </ModalFooter>
      </Modal>

      {/* Existing Event Warning Modal */}
      <Modal open={showExistingEventWarning} onClose={() => setShowExistingEventWarning(false)} size="sm">
        <ModalHeader onClose={() => setShowExistingEventWarning(false)}>יש אירוע קיים במערכת!</ModalHeader>
        <ModalBody className="text-center">
            <div className="mb-4">
              <span className="text-4xl mb-2 block">⚠️</span>
              <p className="text-lg text-red-400 mb-4">
                כבר יש אירוע פעיל או בתהליך יצירה. האם אתה בטוח שברצונך ליצור אירוע חדש?
              </p>
              <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4 mb-4 text-right">
                <h3 className="text-lg font-bold text-slate-100 mb-3 text-center">הבהרות חשובות</h3>
                <div className="space-y-2">
                  <p className="text-base font-bold text-slate-200">
                    • במערכת זו לא ניתן לנהל שני אירועים במקביל. בכל פעם ניתן לנהל אירוע אחד בלבד.
                  </p>
                  <p className="text-base font-bold text-slate-200">
                    • האירוע הקיים יימחק, ותוכל לפתוח אירוע חדש.
                  </p>
                </div>
              </div>
            </div>
        </ModalBody>
        <ModalFooter className="flex-col">
              <button
                onClick={() => setShowExistingEventWarning(false)}
                className="w-full bg-emerald-600 text-white border border-emerald-400/50 rounded-full px-6 py-3 font-bold hover:bg-emerald-700 transition-all"
              >
                חזור לאירוע הקיים
              </button>
              <button
                onClick={() => {
      setShowExistingEventWarning(false);
      setShowArchiveConfirm(true);
                }}
                className="w-full bg-red-600 text-white border border-red-400/50 rounded-full px-6 py-3 font-bold hover:bg-red-600 transition-all"
              >
                מחק אירוע קיים
              </button>
        </ModalFooter>
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal open={showArchiveConfirm} onClose={() => setShowArchiveConfirm(false)} size="sm">
        <ModalHeader onClose={() => setShowArchiveConfirm(false)}>אישור סופי נדרש</ModalHeader>
        <ModalBody className="text-center">
            <div className="mb-6">
              <div className="text-5xl mb-4">⚠️</div>
              <div className="bg-orange-500/10 border border-orange-400/30 rounded-xl p-4 mb-4 text-right">
                <p className="text-base font-bold text-slate-100 mb-3">
                  האם אתה בטוח שברצונך למחוק אירוע קיים?
                </p>
                <div className="space-y-3 text-base text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="text-orange-300 font-bold text-lg">📁</span>
                    <p className="text-right flex-1 text-base font-semibold">
                      האירוע הקיים יימחק.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-orange-300 font-bold text-lg">✨</span>
                    <p className="text-right flex-1 text-base font-semibold">
                      כעת תוכל ליצור אירוע חדש.
                    </p>
                  </div>
                </div>
              </div>
            </div>
        </ModalBody>
        <ModalFooter>
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="flex-1 bg-emerald-600 text-white border border-emerald-400/50 rounded-full px-6 py-3 font-bold text-lg hover:bg-emerald-700 transition-all"
              >
                חזור לאירוע הקיים
              </button>
              <button
                onClick={() => {
                  setShowArchiveConfirm(false);
                  handleNewEvent(true);
                }}
                className="flex-1 bg-red-600 text-white border border-red-400/50 rounded-full px-6 py-3 font-bold hover:bg-red-600 transition-all"
              >
                מחק אירוע קיים
              </button>
        </ModalFooter>
      </Modal>

      {/* Archive Success Modal – מוצג מעל כל המודלים אחרי ארכוב מוצלח */}
      <Modal open={showDeletionSuccess} onClose={() => { setShowDeletionSuccess(false); setSelectedFlowStep(null); setShowEventTypes(false); }} size="sm">
        <ModalHeader onClose={() => { setShowDeletionSuccess(false); setSelectedFlowStep(null); setShowEventTypes(false); }}>מחיקת האירוע בוצעה בהצלחה</ModalHeader>
        <ModalBody className="text-center">
            <div className="mb-6">
              <div className="text-5xl mb-4 text-emerald-400">✅</div>
              <p className="text-base text-slate-300 leading-relaxed">
                האירוע הקודם נמחק בהצלחה, כעת ניתן ליצור אירוע חדש.
              </p>
            </div>
        </ModalBody>
        <ModalFooter>
            <button
              onClick={() => {
                setShowDeletionSuccess(false);
                setSelectedFlowStep(null);
                setShowEventTypes(true);
              }}
              className="bg-emerald-600 text-white border border-emerald-400/50 rounded-full px-8 py-3 font-bold text-lg hover:bg-emerald-700 transition-all"
            >
              בחר סוג אירוע חדש
            </button>
        </ModalFooter>
      </Modal>

      {/* New Event confirmation modal */}
      <Modal open={showNewEventConfirm} onClose={() => setShowNewEventConfirm(false)} size="sm">
        <ModalHeader onClose={() => setShowNewEventConfirm(false)}>האם אתה רוצה ליצור אירוע חדש?</ModalHeader>
        <ModalFooter>
            <button
              onClick={() => { setShowNewEventConfirm(false); handleNewEvent(); }}
              className="bg-primary text-white border border-primary rounded-full px-8 py-3 font-medium hover:bg-primary/90 transition-all"
            >
              אשר ושמור
            </button>
        </ModalFooter>
      </Modal>
      {/* Flow Diagram Modal */}
      <Modal open={showFlowDiagram} onClose={() => setShowFlowDiagram(false)} size="xl">
        <ModalHeader onClose={() => setShowFlowDiagram(false)}>תיאור תהליך יצירת אירוע ב-Meet-M</ModalHeader>
        <ModalBody>
            
            {/* Flow Steps - Horizontal Layout */}
            <div className="w-full mx-auto flex-1 overflow-y-auto px-2">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Column 1: Getting Started */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">התחלה:</h3>
                
                {/* Step 0.5: New Event Confirmation */}
                <div 
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">✅</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">פתיחת אירוע חדש</h3>
                    <p className="text-base text-slate-400">אישור ואיפוס המערכת לאירוע חדש</p>
                  </div>
                </div>
                
                {/* Step 0: Pricing */}
                <div 
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">💰</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">בחירת מסלול</h3>
                    <p className="text-base text-slate-400">בחר את החבילה המתאימה לאירוע שלך</p>
                  </div>
                </div>
              </div>

              {/* Column 2: Event Setup */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">הגדרת האירוע:</h3>

                {/* Step 1: Event Type */}
                <div 
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">🎉</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">שלב 1: סוג אירוע</h3>
                    <p className="text-base text-slate-400">חתונה, בר מצווה, יום הולדת ועוד</p>
                  </div>
                </div>

                {/* Step 2: Event Details */}
                <div 
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">📝</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">שלב 2: פרטי האירוע</h3>
                    <p className="text-base text-slate-400">תאריך, שעה, מקום ופרטים נוספים</p>
                  </div>
                </div>

                {/* Step 3: Design */}
                <div 
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">🎨</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">שלב 3: עיצוב הזמנה</h3>
                    <p className="text-base text-slate-400">בחר מתוך 45 תבניות מעוצבות</p>
                  </div>
                </div>
              </div>

              {/* Column 3: Management and Tracking */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-primary text-right mb-3 pr-2">ניהול ומעקב:</h3>

                {/* Step 4: Send Invitations */}
                <div 
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">📱</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">שלב 4: שליחת הזמנות</h3>
                    <p className="text-base text-slate-400">שליחה אוטומטית מקובץ ל SMS ו-WhatsApp</p>
                  </div>
                </div>

                {/* Step 5: Reports */}
                <div 
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="text-4xl flex-shrink-0">📊</div>
                  <div className="flex-1 text-right">
                    <h3 className="text-lg font-bold text-primary">שלב 5: דוחות בקרה</h3>
                    <p className="text-base text-slate-400">מעקב אישורי הגעה ויצוא לאקסל</p>
                  </div>
                </div>
              </div>
              </div>
            </div>
            
            {/* Step Details Box */}
            {selectedFlowStep !== null && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 mt-3 text-right relative max-h-[35vh] overflow-y-auto">
                <button 
                  onClick={() => setSelectedFlowStep(null)} 
                  className="absolute top-2 left-2 text-xl text-slate-400 hover:text-white font-bold transition-colors"
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
                  {selectedFlowStep === 5 && '📊 שלב 5: דוחות בקרה'}
                </h3>
                
                {selectedFlowStep === 0 && (
                  <div className="space-y-2">
                    <p className="text-slate-300 text-base leading-relaxed">בשלב זה תבחר את המסלול המתאים לאירוע שלך:</p>
                    <ul className="list-disc list-inside space-y-1.5 mr-3 text-base">
                      <li><strong>מסלול א (1₪)</strong> - עד 50 הודעות</li>
                      <li><strong>מסלול ב (149₪)</strong> - מ 51 עד 200 הודעות</li>
                      <li><strong>מסלול ג (199₪)</strong> - מ 201 עד 350 הודעות</li>
                      <li><strong>מסלול ד (259₪)</strong> - מ 351 עד 500 הודעות</li>
                    </ul>
                    <p className="text-slate-400 text-sm mt-2">המחירים הם חד פעמיים לכל אירוע</p>
                  </div>
                )}
                
                {selectedFlowStep === 0.5 && (
                  <div className="space-y-2">
                    <p className="text-slate-300 text-base leading-relaxed">בשלב זה המערכת מתכוננת לאירוע חדש:</p>
                    <ul className="list-disc list-inside space-y-1.5 mr-3 text-base">
                      <li><strong>אישור יצירת אירוע</strong> - מודל אישור</li>
                      <li><strong>איפוס מלא</strong> - ניקוי כל הנתונים</li>
                      <li><strong>איפוס טפסים</strong> - חזרה למצב התחלתי</li>
                      <li><strong>מחיקת עיצוב קודם</strong> - איפוס העיצוב</li>
                      <li><strong>הכנה לאירוע חדש</strong> - המערכת מוכנה</li>
                    </ul>
                    <p className="text-slate-400 text-sm mt-2">ניתן ליצור אירוע חדש רק לאחר ארכיון האירוע הקודם</p>
                  </div>
                )}
                
                {selectedFlowStep === 1 && (
                  <div className="space-y-2">
                    <p className="text-slate-300 text-base leading-relaxed">בשלב זה תבחר את סוג האירוע שלך מתוך 10 אפשרויות:</p>
                    <ul className="list-disc list-inside space-y-1.5 mr-3 text-base">
                      <li>חתונה, חינה, מסיבת אירוסין, הפרשת חלה - טקסים לשמחת המשפחה</li>
                      <li>בר/בת מצווה - חגיגת בגרות</li>
                      <li>ברית/בריתה - טקס ברית מילה או שמות</li>
                      <li>יום הולדת, אירוע עסקי</li>
                    </ul>
                    <p className="text-slate-400 text-sm mt-2">בחירת סוג האירוע תתאים את השדות בשלבים הבאים</p>
                  </div>
                )}
                
                {selectedFlowStep === 2 && (
                  <div className="space-y-2">
                    <p className="text-slate-300 text-base leading-relaxed">בשלב זה תמלא את כל הפרטים החשובים לאירוע:</p>
                    <ul className="list-disc list-inside space-y-1.5 mr-3 text-base">
                      <li><strong>פרטים אישיים</strong> - שמות והורים</li>
                      <li><strong>תאריך ושעה</strong> - תאריך עתידי חובה</li>
                      <li><strong>שעת חופה</strong> - רק לחתונה</li>
                      <li><strong>מיקום</strong> - שם האולם וכתובת</li>
                    </ul>
                    <p className="text-slate-400 text-sm mt-2">הפרטים נשמרים ויופיעו בהזמנה</p>
                  </div>
                )}
                
                {selectedFlowStep === 3 && (
                  <div className="space-y-3">
                    <p className="text-slate-300 leading-relaxed">בשלב זה תבחר את העיצוב המושלם להזמנה שלך:</p>
                    <ul className="list-disc list-inside space-y-2 mr-4">
                      <li><strong>45 תבניות מעוצבות</strong> - מגוון רחב של עיצובים לכל סוג אירוע</li>
                      <li><strong>התאמה אישית</strong> - הטקסט שלך יתווסף אוטומטית על התבנית</li>
                      <li><strong>צפייה מקדימה</strong> - ראה איך ההזמנה תיראה לפני השמירה</li>
                      <li><strong>שמירה בענן</strong> - ההזמנה נשמרת ב-Supabase Storage</li>
                    </ul>
                    <p className="text-slate-400 text-base mt-3">תוכל לשנות את העיצוב בכל שלב של התהליך</p>
                  </div>
                )}
                
                {selectedFlowStep === 4 && (
                  <div className="space-y-3">
                    <p className="text-slate-300 leading-relaxed">בשלב זה תשלח את ההזמנות לאורחים:</p>
                    <ul className="list-disc list-inside space-y-2 mr-4">
                      <li><strong>מילוי פרטי אורח</strong> - שם פרטי, שם משפחה וטלפון</li>
                      <li><strong>שליחה בוואטסאפ</strong> - הזמנה מעוצבת + קישור RSVP ייחודי</li>
                      <li><strong>שליחה ב-SMS</strong> - הודעת טקסט + קישור RSVP</li>
                      <li><strong>קישור RSVP ייחודי</strong> - כל אורח מקבל קישור אישי לאישור הגעה</li>
                      <li><strong>ניהול רשימת אורחים</strong> - צפייה, חיפוש ועריכת אורחים</li>
                    </ul>
                    <p className="text-slate-400 text-base mt-3">ניתן לשלוח הזמנות לכמה שיותר אורחים</p>
                  </div>
                )}
                
                {selectedFlowStep === 5 && (
                  <div className="space-y-3">
                    <p className="text-slate-300 leading-relaxed">בשלב זה תעקוב אחר אישורי ההגעה:</p>
                    <ul className="list-disc list-inside space-y-2 mr-4">
                      <li><strong>דוח מאושרים</strong> - רשימת כל האורחים שאישרו הגעה + פרטים מלאים (מספר בוגרים, ילדים, ארוחות מיוחדות, אלרגיות)</li>
                      <li><strong>דוח דחיות</strong> - אורחים שהודיעו שלא מגיעים</li>
                      <li><strong>דוח ממתינים</strong> - אורחים שעדיין לא הגיבו</li>
                      <li><strong>יצוא לאקסל</strong> - הורדת כל הנתונים לקובץ Excel מסודר</li>
                      <li><strong>ארכיון אירועים</strong> - גישה לדוחות בקרה של אירועים קודמים</li>
                    </ul>
                    <p className="text-slate-400 text-base mt-3">עדכון בזמן אמת - דוחות הבקרה מתעדכנים אוטומטית</p>
                  </div>
                )}
              </div>
            )}

        </ModalBody>
        <ModalFooter>
              <button
                onClick={() => setShowFlowDiagram(false)}
                className="border border-white/15 bg-transparent text-white hover:border-indigo-300 hover:text-indigo-200 rounded-full px-8 py-3 font-medium transition-all"
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
                      const user = await resolveCurrentUserForSync();
                      hasSession = !!user;
                    }
                    if (!hasSession) {
                      setShowPricingPlan(true);
                      setPlanAddOnMode(false);
                      return;
                    }
                    setStepErrorMsg('');
                    const hasActive = await checkActiveEventExists();
                    if (hasActive) {
                      setShowExistingEventWarning(true);
                      return;
                    }
                    const planReady = selectedPlanRef.current || userPlanSettingsRef.current?.plan;
                    if (!planReady) {
                      setShowPricingPlan(true);
                      setPlanAddOnMode(false);
                      return;
                    }
                    await handleNewEvent();
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
        </ModalFooter>
      </Modal>

      {/* Pricing Plan Selection Modal */}
      <Modal open={showPricingPlan} onClose={closePricingPlanModal} size="screen">
        <ModalHeader onClose={closePricingPlanModal}>
          <span className="hidden sm:inline">בחר את המסלול המתאים לאירוע שלך</span>
          <span className="sm:hidden">בחר מסלול מתאים</span>
        </ModalHeader>
        <ModalBody className="flex flex-col">
          {planAddOnMode && (
            <div className="text-center text-sm font-semibold text-primary mb-3 bg-indigo-500/10 border border-indigo-400/20 rounded-xl p-2.5 shrink-0">
              בחר חבילת הרחבה בתשלום כדי להוסיף עוד הודעות למכסה.
            </div>
          )}
          {pricingActionAttempted && planSelectionError && (
            <div className="mb-3 bg-red-500/10 border border-red-400/30 rounded-xl p-2.5 text-red-400 font-semibold text-sm text-center shrink-0">
              {planSelectionError}
            </div>
          )}

          {/* Plan cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6 shrink-0">
            {[
              { key: 'free',     id: 'א', subtitle: 'אירועים קטנים',    range: 'עד 50 הודעות',        price: '1',   recommended: false },
              { key: 'standard', id: 'ב', subtitle: 'מתאים לרוב',       range: 'מ־51 עד 200 הודעות',  price: '149', recommended: true  },
              { key: 'premium',  id: 'ג', subtitle: 'אירועים גדולים',   range: 'מ־201 עד 350 הודעות', price: '199', recommended: false },
              { key: 'luxury',   id: 'ד', subtitle: 'אירועים גדולים מאוד', range: 'מ־351 עד 500 הודעות', price: '259', recommended: false },
            ].map((plan) => (
              <div
                key={plan.key}
                className={`relative flex flex-col items-center text-center rounded-2xl p-8 border transition-all ${
                  plan.recommended
                    ? 'bg-indigo-500/10 border-2 border-primary'
                    : selectedPlan === plan.key
                    ? 'bg-white/[0.07] border-2 border-primary'
                    : 'bg-white/5 border border-white/10 hover:border-indigo-400/50'
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 right-1/2 translate-x-1/2 bg-gradient-to-br from-indigo-600 to-violet-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg whitespace-nowrap">
                    מומלץ
                  </div>
                )}
                <h3 className="text-2xl font-black text-white mb-1">מסלול {plan.id}</h3>
                <p className="text-base text-slate-400 mb-4">{plan.subtitle}</p>
                <div className="text-5xl font-black bg-gradient-to-br from-indigo-300 to-violet-300 bg-clip-text text-transparent mb-4">
                  {plan.price} ₪
                </div>
                <p className="text-xl font-bold text-slate-200 mb-6">{plan.range}</p>
                <button
                  onClick={() => planAddOnMode ? (plan.key !== 'free' ? handleAddPackagePlan(plan.key) : null) : handleSelectPlan(plan.key)}
                  disabled={planAddOnMode && plan.key === 'free'}
                  className={`w-full rounded-xl py-4 text-lg font-bold transition-all ${
                    planAddOnMode && plan.key === 'free'
                      ? 'bg-white/10 text-slate-400 cursor-not-allowed'
                      : planAddOnMode
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : selectedPlan === plan.key
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,70,230,0.4)]'
                      : 'bg-white/10 text-white border border-white/20 hover:bg-indigo-500/20 hover:border-indigo-400/50'
                  }`}
                >
                  {planAddOnMode && plan.key === 'free' ? 'לא זמין' : planAddOnMode ? `הוסף מסלול ${plan.id}` : 'בחר'}
                </button>
              </div>
            ))}
          </div>

          {/* Shared features — flex-1 pushes footer to bottom */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 flex-1" dir="rtl">
            <p className="text-base font-bold text-slate-300 mb-4 text-center tracking-wider uppercase">כל המסלולים כוללים</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-base text-slate-300">
              {[
                'הזמנות מעוצבות מקצועית',
                'שליחה אוטומטית לכל האורחים',
                'SMS ו-WhatsApp',
                'תזכורת לפני האירוע',
                'מעקב אישורי הגעה',
                'דוחות בזמן אמת',
                'ניהול פרטי אורחים',
                'ניהול העדפות מזון ואלרגיות',
                'דוחות מפורטים + ייצוא Excel',
                'שמירת ארכיון אירועים',
                'מפת אזור האירוע + ניווט',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <span className="text-indigo-400 font-bold shrink-0 text-base">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <span className="text-base text-slate-400">* המחירים הם חד פעמיים לאירוע</span>
            <div className="bg-indigo-500/20 border-2 border-indigo-400/60 rounded-xl px-6 py-4 text-xl font-black text-indigo-100 shadow-[0_0_20px_rgba(99,70,230,0.3)]">
              💡 הרחבה: 100 הודעות נוספות ב-100 ₪
            </div>
          </div>
        </ModalBody>
      </Modal>

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
      <Modal open={showPaymentResultModal} onClose={() => setShowPaymentResultModal(false)} size="sm">
        <ModalBody className="text-center py-8">
            {paymentResultType === 'success' ? (
              <>
                <div className="text-6xl md:text-7xl mb-6">✅</div>
                <h2 className="text-2xl md:text-3xl font-bold text-emerald-300 mb-4">
                  התשלום בוצע בהצלחה!
                </h2>
                <p className="text-lg md:text-xl text-slate-300 mb-8">
                  {paymentResultMessage}
                </p>
                <button
                  onClick={() => {
                    setShowPaymentResultModal(false);
                    if (paymentWasPlanPurchase) {
                      // רכישת מסלול – המשך ליצירת אירוע
                      if (typeof window !== 'undefined') {
                        try { localStorage.removeItem('pendingCreateEvent'); } catch(e){}
                      }
                      setShowEventTypes(true);
                    } else {
                      // רכישת חבילת הרחבה – חזרה למסך שליחת הזמנות
                      setShowGuestForm(true);
                    }
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-full transition-all shadow-lg transform hover:scale-105"
                >
                  המשך
                </button>
              </>
            ) : (
              <>
                <div className="text-6xl md:text-7xl mb-6">❌</div>
                <h2 className="text-2xl md:text-3xl font-bold text-red-400 mb-4">
                  התשלום נכשל
                </h2>
                <p className="text-lg md:text-xl text-slate-300 mb-8">
                  {paymentResultMessage}
                </p>
                <button
                  onClick={() => {
                    setShowPaymentResultModal(false);
                    if (paymentFailureWasAddon) {
                      const n = Math.max(1, lastAddonCountForRetry);
                      setPendingPlan('addon');
                      setPendingAddonCount(n);
                      setPaymentAmount(n * 100);
                      setPaymentPlanName(n === 1 ? 'חבילת הרחבה - 100 הודעות נוספות' : `${n} חבילות הרחבה - ${n * 100} הודעות (₪${n * 100})`);
                      setShowPaymentModal(true);
                      setPaymentFailureWasAddon(false);
                    } else {
                      const pendingPlan = typeof localStorage !== 'undefined' && localStorage.getItem('payment_pending_plan');
                      const pendingAmount = parseInt(localStorage.getItem('payment_pending_amount') || '0', 10);
                      const pendingPlanName = localStorage.getItem('payment_pending_planName') || '';
                      if (pendingPlan && pendingPlan !== 'addon' && pendingAmount > 0) {
                        setPendingPlan(pendingPlan);
                        setPaymentAmount(pendingAmount);
                        setPaymentPlanName(pendingPlanName);
                        setShowPaymentModal(true);
                      } else {
                        setShowPricingPlan(true);
                      }
                    }
                  }}
                  className="w-full bg-red-600 hover:bg-red-600 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-full transition-all shadow-lg transform hover:scale-105"
                >
                  {paymentFailureWasAddon ? 'נסה שוב' : 'חזור למסך תשלומים'}
                </button>
              </>
            )}
        </ModalBody>
      </Modal>

      {/* Invitation Send Loading Modal */}
      <Modal open={isSendingInvitation} onClose={() => {}} size="sm">
        <ModalBody className="text-center py-8">
            <div className="text-6xl md:text-7xl mb-6 animate-spin">⏳</div>
            <h2 className="text-2xl md:text-3xl font-bold text-primary mb-4">
              שולח הזמנה...
            </h2>
            <p className="text-lg md:text-xl text-slate-300">
              אנא המתן, ההזמנה נשלחת כעת
            </p>
        </ModalBody>
      </Modal>

      {/* Invitation Send Result Modal */}
      <Modal open={showInvitationResultModal} onClose={() => setShowInvitationResultModal(false)} size="sm">
        <ModalBody className="text-center py-8">
            {invitationResult.type === 'success' ? (
              <>
                <div className="text-6xl md:text-7xl mb-6">✅</div>
                <h2 className="text-2xl md:text-3xl font-bold text-emerald-300 mb-4">
                  {invitationResult.message?.includes('קבוצת הוואטסאפ')
                    ? 'עדכון הקבוצה הצליח!'
                    : 'השליחה הצליחה!'}
                </h2>
                <p className="text-lg md:text-xl text-slate-300 mb-8 whitespace-pre-line">
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
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-full transition-all shadow-lg transform hover:scale-105"
                >
                  המשך
                </button>
              </>
            ) : (
              <>
                <div className="text-6xl md:text-7xl mb-6">
                  {invitationResult.type === 'warning' ? '⚠️' : '❌'}
                </div>
                <h2 className={`text-2xl md:text-3xl font-bold mb-4 ${invitationResult.type === 'warning' ? 'text-amber-300' : 'text-red-400'}`}>
                  {invitationResult.type === 'warning' ? 'העדכון הסתיים עם כשלים' : 'השליחה נכשלה'}
                </h2>
                <p className="text-lg md:text-xl text-slate-300 mb-8 whitespace-pre-line text-right">
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
                  className="w-full bg-red-600 hover:bg-red-600 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-full transition-all shadow-lg transform hover:scale-105"
                >
                  המשך
                </button>
              </>
            )}
        </ModalBody>
      </Modal>

      {/* Archive events list modal */}
      <Modal open={showArchiveList} onClose={()=>{setShowArchiveList(false);setShowReportsOptions(true);}} size="xl" landscape>
        <ModalHeader onClose={()=>{setShowArchiveList(false);setShowReportsOptions(true);}}>אירועים מהעבר (ארכיון)</ModalHeader>
        <ModalBody className="text-center space-y-4">
            {archiveLoading ? (
              <p className="text-slate-400">טוען אירועים...</p>
            ) : archiveEvents.length===0 ? (
              <p className="text-slate-400">אין אירועים בארכיון.</p>
            ):(
              <ul className="space-y-3 px-2">
                {archiveEvents.map(ev=>{
                  const dateObj=ev._eventDate;
                  const date=dateObj?format(dateObj,'dd/MM/yyyy',{locale:he}):'-';
                  return (
                    <li key={ev.id} className="border border-white/15 rounded-lg p-4 bg-white/[0.055] hover:bg-indigo-500/15 hover:border-indigo-400/50 cursor-pointer flex flex-col items-center justify-center text-center shadow-md hover:shadow-lg transition-all transform hover:scale-105" onClick={()=>{
                      // IMPORTANT: Don't set currentEventId for archive events - this would reset the active event!
                      // Only use selectedEventForReport for viewing reports from archive
                      setShowArchiveList(false);
                      setSelectedEventForReport(ev);
                      setShowReportsOptions(true);
                    }}>
                      <span className="font-bold text-lg text-primary mb-1">{ev.event_type||'אירוע'}</span>
                      <span className="text-sm font-medium text-slate-300">{date}</span>
                    </li>
                  );
                })}
              </ul>
            )}
        </ModalBody>
      </Modal>

      <Modal open={showActiveError} onClose={() => setShowActiveError(false)} size="sm">
        <ModalBody className="text-center rtl">
            <p className="text-lg font-medium text-primary mb-6">כבר קיים אירוע פעיל.<br/>ניתן ליצור אירוע חדש רק לאחר שהאירוע יעבור לארכיון.</p>
        </ModalBody>
        <ModalFooter>
            <button onClick={()=>setShowActiveError(false)} className="bg-primary text-white rounded-full px-8 py-2 font-medium hover:bg-primary/90 transition-all">סגור</button>
        </ModalFooter>
      </Modal>

      {showMobileExcelExportNotice && (
        <div
          dir="rtl"
          className="fixed inset-0 flex items-center justify-center bg-[#0a0b1e]/85 backdrop-blur-sm px-4"
          style={{ zIndex: 2147483647 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowMobileExcelExportNotice(false);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-gradient-to-b from-[#1a1d4a]/95 to-[#12143a]/95 p-6 text-center text-slate-100 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.6)]">
            <h2 className="mb-4 text-xl font-bold">שמירת דוח אקסל</h2>
            <p className="mb-6 text-lg font-semibold leading-relaxed text-slate-200">
              שמירת הדוח כקובץ אקסל אפשרי רק במחשב ולא בנייד
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setShowMobileExcelExportNotice(false);
              }}
              className="w-full rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-3 font-bold text-white transition-all hover:opacity-90"
            >
              הבנתי
            </button>
          </div>
        </div>
      )}
    </>
  );
});

export default StepButtons;


