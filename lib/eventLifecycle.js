/** Shared event lifecycle rules — single source of truth for Hero + StepButtons */

export const WIZARD_DRAFT_EVENT_TYPE = 'טיוטה';

export const STALE_WIZARD_LOCAL_STORAGE_KEYS = [
  'savedEventDetails',
  'selectedEventType',
  'selectedDesign',
  'finishedSteps',
  'draftEvent',
  'newEventStarted',
  'selectedPlan',
  'user_plan_code',
  'additionalPackages_global',
  'payment_pending_plan',
  'payment_pending_amount',
  'payment_pending_planName',
  'payment_pending_addonCount',
  'payment_pending_eventId',
];

export const ISRAEL_TZ = 'Asia/Jerusalem';

export const getIsraelTodayDateString = (now = new Date()) =>
  now.toLocaleDateString('en-CA', { timeZone: ISRAEL_TZ });

export const toCalendarDateString = (rawDate) => {
  const eventDate = parseEventDate(rawDate);
  if (!eventDate) return null;
  const year = eventDate.getFullYear();
  const month = String(eventDate.getMonth() + 1).padStart(2, '0');
  const day = String(eventDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseEventDate = (str) => {
  if (!str) return null;
  const dateOnly = String(str).split(/[T ]/)[0];
  const isoMatch = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const match = dateOnly.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const native = new Date(dateOnly);
  if (!Number.isNaN(native.getTime())) return native;
  return null;
};

export const isEventDateOnOrAfterToday = (rawDate) => {
  const eventStr = toCalendarDateString(rawDate);
  if (!eventStr) return false;
  return eventStr >= getIsraelTodayDateString();
};

export const isEventDateBeforeToday = (rawDate) => {
  const eventStr = toCalendarDateString(rawDate);
  if (!eventStr) return false;
  return eventStr < getIsraelTodayDateString();
};

export const getRawEventDateFromDetails = (details) => {
  if (!details || typeof details !== 'object') return null;
  return details.date || details.event_date || details.start_datetime || details.end_datetime || null;
};

export const getEventDetailsFromRecord = (record) => {
  if (!record) return {};
  if (typeof record.event_details === 'string') {
    try {
      return JSON.parse(record.event_details);
    } catch (_) {
      return {};
    }
  }
  return record.event_details || {};
};

export const isEventArchived = (record) => {
  const status = typeof record?.status === 'string' ? record.status.toLowerCase() : '';
  return status === 'archived';
};

export const isWizardPlaceholderEventType = (eventType) => (
  typeof eventType === 'string' && eventType.trim() === WIZARD_DRAFT_EVENT_TYPE
);

export const resolveDisplayEventType = (eventType) => {
  if (eventType == null || eventType === '') return '';
  const normalized = typeof eventType === 'string' ? eventType.trim() : String(eventType).trim();
  if (!normalized || isWizardPlaceholderEventType(normalized)) return '';
  return normalized;
};

export const isEventRecordActive = (record) => {
  if (!record) return false;
  if (isEventArchived(record)) return false;
  const rawDate = getRawEventDateFromDetails(getEventDetailsFromRecord(record));
  if (!rawDate) return false;
  return isEventDateOnOrAfterToday(rawDate);
};

/** אירוע בתהליך יצירה אחרי תשלום — רק טיוטה מפורשת, לא כל אירוע בלי תאריך */
export const isEventWizardDraft = (record) => {
  if (!record) return false;
  if (isEventArchived(record)) return false;
  if (isEventRecordActive(record)) return false;
  const details = getEventDetailsFromRecord(record);
  if (details?.wizard_draft === true) return true;
  if (isWizardPlaceholderEventType(record.event_type)) return true;
  const status = typeof record.status === 'string' ? record.status.toLowerCase() : '';
  return status === 'draft';
};

export const hasEventEnded = (record) => !isEventRecordActive(record) && !isEventWizardDraft(record);

/** Close after the event calendar day ends (next day in Israel). Drafts without a date stay open. */
export const shouldAutoCloseEndedEvent = (record) => {
  if (!record || isEventArchived(record)) return false;
  const rawDate = getRawEventDateFromDetails(getEventDetailsFromRecord(record));
  if (!rawDate) return false;
  return isEventDateBeforeToday(rawDate);
};

export const shouldShowEventReports = (record) => isEventRecordActive(record);

export const shouldKeepEventWizardStarted = (record, settings = null) => {
  if (isEventWizardDraft(record)) return true;
  if (settings?.eventWizardStarted) return true;
  return false;
};

/** מסלול ששולם — לשחזר רק עם אירוע פעיל או טיוטת אשף מאומתת ב-DB */
export const shouldRestorePaidPlanFromSettings = (settings, { eventRecord } = {}) => {
  if (!settings?.plan) return false;
  if (eventRecord && isEventRecordActive(eventRecord)) return true;
  if (
    eventRecord &&
    isEventWizardDraft(eventRecord) &&
    settings.eventWizardStarted &&
    settings.activeEventId &&
    settings.activeEventId === eventRecord.id
  ) {
    return true;
  }
  return false;
};

export const isPaidWizardInProgress = ({
  plan,
  eventWizardStarted,
  currentEventId,
  activeEventId,
  isEndedPastEvent,
  isCurrentEventActive,
}) => Boolean(
  plan &&
  eventWizardStarted &&
  currentEventId &&
  activeEventId &&
  currentEventId === activeEventId &&
  !isEndedPastEvent &&
  !isCurrentEventActive,
);

export const shouldAllowWizardAutoResume = ({
  isCurrentEventActive,
  isPaidWizardInProgress: paidWizard,
}) => Boolean(isCurrentEventActive || paidWizard);

/** האם יש אירוע שמנוהל כרגע — אותה לוגיקה ל-UI ולבדיקה לפני יצירת אירוע חדש */
export const hasOperableEventSession = ({
  eventRecord = null,
  settings = null,
  isCurrentEventActive = false,
  isPaidWizardInProgress = false,
} = {}) => {
  if (isCurrentEventActive || isPaidWizardInProgress) return true;
  if (eventRecord && isEventRecordActive(eventRecord)) return true;
  if (shouldRestorePaidPlanFromSettings(settings, { eventRecord })) return true;
  return false;
};

export const shouldArchiveOrphanedEvent = (eventRecord, settings = null) => {
  if (!eventRecord || isEventArchived(eventRecord)) return false;
  return !hasOperableEventSession({ eventRecord, settings });
};

export const clearStaleWizardLocalStorage = () => {
  if (typeof window === 'undefined') return;
  STALE_WIZARD_LOCAL_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  });
};

export const validateActiveEventPointer = (eventRecord) => {
  if (!eventRecord) return { valid: false, reason: 'missing' };
  if (isEventArchived(eventRecord)) return { valid: false, reason: 'archived' };
  if (isEventRecordActive(eventRecord)) return { valid: true, kind: 'active' };
  if (isEventWizardDraft(eventRecord)) return { valid: true, kind: 'draft' };
  return { valid: false, reason: 'ended' };
};
