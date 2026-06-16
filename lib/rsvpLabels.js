/** מילון מונחים אחיד לסטטוסי אישור הגעה בממשק הניהול */

export const RSVP_STATUS_LABELS = {
  approved: 'אישרו הגעה',
  pending: 'טרם הגיבו',
  rejected: 'לא מגיעים',
};

/** תוויות קצרות לתגיות על כרטיס אורח בודד */
export const RSVP_STATUS_LABELS_COMPACT = {
  approved: 'אישרו',
  pending: 'טרם הגיבו',
  rejected: 'לא מגיעים',
};

export const RSVP_FILTER_LABELS = {
  all: 'כולם',
  ...RSVP_STATUS_LABELS,
};

export function getGuestStatusBucket(status) {
  return status === 'approved' || status === 'rejected' ? status : 'pending';
}

export function getRsvpStatusLabel(status, { compact = false } = {}) {
  const bucket = getGuestStatusBucket(status);
  const labels = compact ? RSVP_STATUS_LABELS_COMPACT : RSVP_STATUS_LABELS;
  return labels[bucket];
}

export function getGuestStatusMeta(status) {
  const bucket = getGuestStatusBucket(status);
  if (bucket === 'approved') {
    return {
      label: RSVP_STATUS_LABELS_COMPACT.approved,
      className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
      icon: '✓',
    };
  }
  if (bucket === 'rejected') {
    return {
      label: RSVP_STATUS_LABELS_COMPACT.rejected,
      className: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
      icon: '×',
    };
  }
  return {
    label: RSVP_STATUS_LABELS_COMPACT.pending,
    className: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    icon: '◷',
  };
}
