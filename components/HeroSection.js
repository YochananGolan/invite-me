import { forwardRef, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { RSVP_STATUS_LABELS } from '../lib/rsvpLabels';
import { buildGuestRsvpStats } from '../lib/guestStats';
import { shouldShowEventReports } from '../lib/eventLifecycle';

const useTypewriter = (text, speed = 42, pauseDuration = 2600) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let timeoutId;
    let currentIndex = 0;
    let paused = false;

    const typeNext = () => {
      if (paused) return;

      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex += 1;
        timeoutId = setTimeout(typeNext, speed);
        return;
      }

      paused = true;
      timeoutId = setTimeout(() => {
        setDisplayedText('');
        currentIndex = 0;
        paused = false;
        typeNext();
      }, pauseDuration);
    };

    typeNext();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [text, speed, pauseDuration]);

  return displayedText;
};

const FeatureTick = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path
      d="M1.5 6.5l3 3 7-7"
      stroke="#818cf8"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MessageIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path
      d="M2 3.5h9v6H5.6L3.2 11V9.5H2v-6z"
      stroke="#818cf8"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M3.5 5.5h6M3.5 7.3h4" stroke="#818cf8" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const ReportIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path d="M2 10.5h9" stroke="#818cf8" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M3 8V5.5M6.5 8V2.5M10 8V4" stroke="#818cf8" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const CardHeader = ({ title, children }) => (
  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] font-bold text-slate-100" dir="rtl">
    <span className="truncate">{title}</span>
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-600 to-violet-600">
      {children}
    </div>
  </div>
);

const GlassCard = ({ className = '', children }) => (
  <div
    className={`overflow-hidden rounded-2xl border border-white/15 bg-white/[0.055] text-slate-100 shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl ring-2 ring-indigo-400/30 ${className}`}
  >
    {children}
  </div>
);

const toNonNegativeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const getPercent = (value, total) => {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
};

const parseEventDetails = (details) => {
  if (!details) return {};
  if (typeof details === 'string') {
    try {
      return JSON.parse(details);
    } catch (_) {
      return {};
    }
  }
  return details;
};

const buildActiveReportSummary = (eventRecord, guests = []) => {
  const stats = buildGuestRsvpStats(guests);
  const { statusSummary, summary, totalRsvp } = stats;

  const planBaseLimits = {
    free: 1, basic: 1, standard: 200, premium: 350,
    luxury: 500, elite: 650, supreme: 1000,
  };
  const planBase = planBaseLimits[eventRecord?.selected_plan] ?? 1; // default 1 matches getPlanBaseLimit's default
  const addonCount = toNonNegativeNumber(eventRecord?.additional_packages);
  const invitationLimit = planBase + addonCount * 100;
  const invitationsSent = Math.max(toNonNegativeNumber(eventRecord?.messages_sent_count), totalRsvp);
  const invitationsRemaining = Math.max(0, invitationLimit - invitationsSent);

  return {
    adults: summary.adults,
    children: summary.children,
    approved: statusSummary.approved,
    rejected: statusSummary.rejected,
    pending: statusSummary.pending,
    totalGuests: summary.adults + summary.children,
    totalRsvp,
    invitationLimit,
    invitationsSent,
    invitationsRemaining,
    hasReportData: true,
  };
};

const MiniMetric = ({ label, value, tone = 'text-slate-100' }) => (
  <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-3 text-center">
    <div className={`truncate text-2xl font-black leading-none tabular-nums ${tone}`}>{value}</div>
    <div className="mt-1 truncate text-xs font-semibold text-slate-400">{label}</div>
  </div>
);

const RsvpBar = ({ color, label, value, total }) => {
  const percent = getPercent(value, total);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0 flex-1 truncate font-semibold text-slate-300">{label}</span>
        <span className="shrink-0 font-bold tabular-nums text-slate-100">{value}</span>
        <span className="w-9 shrink-0 text-left text-[11px] font-semibold tabular-nums text-slate-500">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

const InvitationBalanceCard = ({ summary }) => {
  const usedPercent = getPercent(summary.invitationsSent, summary.invitationLimit);

  return (
    <GlassCard>
      <CardHeader title="יתרת הזמנות לשליחה">
        <ReportIcon />
      </CardHeader>
      <div className="space-y-4 p-4" dir="rtl">
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="נותרו" value={summary.invitationsRemaining} tone="text-emerald-300" />
          <MiniMetric label="נשלחו" value={summary.invitationsSent} tone="text-indigo-200" />
          <MiniMetric label="מגבלה" value={summary.invitationLimit} tone="text-slate-100" />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>ניצול מסלול</span>
            <span className="tabular-nums text-slate-200">{usedPercent}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-l from-emerald-300 via-indigo-400 to-violet-500"
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

const ActiveEventReportsDashboard = ({ summary }) => (
  <div className="mx-auto w-full max-w-[540px] space-y-4 lg:mx-0" dir="rtl">
    <GlassCard className="bg-white/[0.07]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs font-bold text-indigo-200">דוחות בקרה מרכזיים</p>
          <h2 className="mt-1 text-xl font-black text-white">תמונת מצב לאירוע</h2>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_10px_28px_rgba(99,70,230,0.35)]">
          <ReportIcon />
        </div>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-400">סה"כ אורחים</div>
            <div className="mt-1 text-5xl font-black leading-none tabular-nums text-white">{summary.totalGuests}</div>
          </div>
          <div className="text-left text-xs font-semibold text-slate-500">מבוסס על דוחות קיימים</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="מבוגרים" value={summary.adults} tone="text-emerald-300" />
          <MiniMetric label="ילדים" value={summary.children} tone="text-orange-300" />
        </div>
      </div>
    </GlassCard>

    <GlassCard>
      <CardHeader title="סטטוס אישורי הגעה">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </CardHeader>
      <div className="space-y-4 p-4" dir="rtl">
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label={RSVP_STATUS_LABELS.approved} value={summary.approved} tone="text-emerald-300" />
          <MiniMetric label={RSVP_STATUS_LABELS.pending} value={summary.pending} tone="text-amber-300" />
          <MiniMetric label={RSVP_STATUS_LABELS.rejected} value={summary.rejected} tone="text-rose-300" />
        </div>
        <div className="space-y-3">
          <RsvpBar color="#34d399" label={RSVP_STATUS_LABELS.approved} value={summary.approved} total={summary.totalRsvp} />
          <RsvpBar color="#fbbf24" label={RSVP_STATUS_LABELS.pending} value={summary.pending} total={summary.totalRsvp} />
          <RsvpBar color="#fb7185" label={RSVP_STATUS_LABELS.rejected} value={summary.rejected} total={summary.totalRsvp} />
        </div>
      </div>
    </GlassCard>

    <InvitationBalanceCard summary={summary} />
  </div>
);

const HeroStatsDonut = () => (
  <div className="relative h-16 w-16 shrink-0">
    <svg className="h-16 w-16 shrink-0 overflow-visible" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#34d399" strokeWidth="7" strokeDasharray="88.9 150.8" strokeDashoffset="37.7" strokeLinecap="round" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#fbbf24" strokeWidth="7" strokeDasharray="45.2 150.8" strokeDashoffset="-51.2" strokeLinecap="round" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#f87171" strokeWidth="7" strokeDasharray="16.6 150.8" strokeDashoffset="-96.4" strokeLinecap="round" />
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
      <span className="text-[12px] font-black leading-none tabular-nums">326</span>
      <span className="mt-0.5 text-center text-[7px] leading-[0.7rem] text-slate-400">סה״כ<br />מוזמנים</span>
    </div>
  </div>
);

const invitePreviewText =
  'דוד & שרה\nמתחתנים\n\nבשמחה רבה אנו מזמינים אתכם לחגוג איתנו\n\nיום חמישי | 24.07.2026\nגן אירועים עדן, רמת השרון\n\nקבלת פנים 19:30 | חופה 21:00';

const InviteCard = () => {
  const displayedText = useTypewriter(invitePreviewText);
  const isComplete = displayedText.length === invitePreviewText.length;
  const lines = displayedText.split('\n');

  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#f0e8ff] to-[#fdf6ee] text-[#1e1432] shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl ring-2 ring-indigo-400/30 h-full p-2">
      <div className="relative h-full min-h-[340px] overflow-hidden rounded-md bg-white text-[#1e1432]">
        <img
          src="/images/wedding-couple-bright-luxury.jpg"
          alt="תצוגת הזמנה לדוגמה"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/62 to-white/42" aria-hidden="true" />
        <div className="absolute right-3 top-3 rounded-full border border-violet-500/30 bg-violet-100/90 px-2.5 py-1 text-[10px] font-bold text-violet-700 shadow-sm backdrop-blur">
          הזמנה דיגיטלית
        </div>
        <div className="absolute inset-x-4 bottom-5 top-14 flex flex-col items-center justify-between text-center" dir="rtl">
          <div
            className="flex min-h-[210px] w-full flex-col items-center justify-center text-balance"
            aria-label="תצוגה מונפשת של טקסט ההזמנה"
          >
            {lines.map((line, index) => {
              if (!line.trim()) return <div key={`gap-${index}`} className="h-3" />;
              const isTitle = index === 0;
              const isSubtitle = index === 1;
              const isDate = index === 5 || index === 6;
              return (
                <div
                  key={`${line}-${index}`}
                  className={[
                    'max-w-full break-words leading-snug text-[#1f1730]',
                    isTitle ? 'text-2xl font-black sm:text-[26px]' : '',
                    isSubtitle ? 'text-sm font-bold tracking-wide text-[#5b4c7e]' : '',
                    isDate ? 'text-xs font-bold text-[#2b2140]' : '',
                    !isTitle && !isSubtitle && !isDate ? 'text-[11px] font-medium text-[#4d4165]' : '',
                  ].join(' ')}
                >
                  {line}
                  {index === lines.length - 1 && !isComplete && <span className="animate-pulse text-violet-700">|</span>}
                </div>
              );
            })}
            {lines.length === 1 && !isComplete && <span className="animate-pulse text-violet-700">|</span>}
          </div>
          <button className="w-full rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 py-2 text-xs font-bold text-white shadow-lg text-center" aria-hidden="true">
            אישור הגעה
          </button>
        </div>
      </div>
    </div>
  );
};

const StatsCard = () => (
  <GlassCard className="h-full">
    <CardHeader title="אישורי הגעה בזמן אמת">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    </CardHeader>
    <div className="flex items-center gap-3 px-3 py-3" dir="rtl">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {[
          ['#34d399', RSVP_STATUS_LABELS.approved, '192 (59%)'],
          ['#fbbf24', RSVP_STATUS_LABELS.pending, '98 (30%)'],
          ['#f87171', RSVP_STATUS_LABELS.rejected, '36 (11%)'],
        ].map(([color, label, value]) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="shrink-0 font-bold tabular-nums text-slate-100">{value}</span>
          </div>
        ))}
      </div>
      <HeroStatsDonut />
    </div>
  </GlassCard>
);

const MessagesCard = () => (
  <GlassCard className="h-full">
    <CardHeader title="שליחה ב-SMS וב-WhatsApp">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </CardHeader>
    {[
      {
        name: 'WhatsApp', count: '312/326', width: '95.7%', color: '#25d366',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM11.892 2C6.424 2 2 6.373 2 11.778c0 1.846.504 3.576 1.384 5.069L2 22l5.312-1.359a9.886 9.886 0 004.58 1.115C17.36 21.756 22 17.183 22 11.778 22 6.373 17.36 2 11.892 2zm0 17.778a8.127 8.127 0 01-4.133-1.125l-.296-.175-3.148.805.836-3.038-.193-.312A8.003 8.003 0 013.889 11.778c0-4.411 3.593-8 8.003-8 4.41 0 8.003 3.589 8.003 8s-3.593 8-8.003 8z"/>
          </svg>
        ),
      },
      {
        name: 'SMS', count: '287/326', width: '88%', color: '#818cf8',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
    ].map(({ name, count, width, color, icon }) => (
      <div key={name} className="px-3 py-2">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ backgroundColor: color }}>
            {icon}
          </span>
          <span className="text-xs font-semibold">{name}</span>
          <span className="ml-auto text-[10px] text-slate-400">{count}</span>
          <span className="text-[10px] font-bold text-emerald-300">נשלח</span>
        </div>
        <div className="h-1 overflow-hidden rounded bg-white/10">
          <div
            className="h-full origin-right animate-[hero-progress-fill_4.8s_ease-in-out_infinite] rounded"
            style={{ width, backgroundColor: color }}
          />
        </div>
      </div>
    ))}
  </GlassCard>
);

const AnalyticsCard = () => (
  <GlassCard className="h-full">
    <CardHeader title="דוחות וייצוא לאקסל">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    </CardHeader>
    <div className="px-3 py-3">
      <div className="flex items-center gap-2">
        <div className="text-2xl font-black leading-none">1,286</div>
        <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">↑ 28%</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
        <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 font-bold text-emerald-300">Excel</span>
        <span>אורחים, סטטוסים והעדפות אוכל</span>
      </div>
      <svg className="mt-3 h-12 w-full overflow-visible" viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="heroChartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="animate-[hero-chart-line_4.8s_ease-in-out_infinite]"
          d="M0 44 L18 40 L36 36 L52 38 L68 27 L88 18 L108 23 L128 13 L148 8 L164 16 L178 6 L200 4"
          stroke="#818cf8"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
        <path
          className="animate-[hero-chart-area_4.8s_ease-in-out_infinite]"
          d="M0 44 L18 40 L36 36 L52 38 L68 27 L88 18 L108 23 L128 13 L148 8 L164 16 L178 6 L200 4 L200 48 L0 48Z"
          fill="url(#heroChartGradient)"
        />
        <circle cx="178" cy="6" r="2.5" fill="#818cf8" stroke="white" strokeWidth="1.2" />
      </svg>
    </div>
  </GlassCard>
);

const GuestsCard = () => (
  <GlassCard className="h-full">
    <CardHeader title="ניהול אורחים והעדפות">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    </CardHeader>
    {[
      ['דכ', 'דנה כהן', '2 מבוגרים', 'צמחוני', 'text-emerald-300', 'linear-gradient(135deg,#6366f1,#8b5cf6)'],
      ['אל', 'אורי לוי', 'טרם הגיב', 'תזכורת', 'text-amber-300', 'linear-gradient(135deg,#f59e0b,#ef4444)'],
      ['מש', 'מיכל שמואלי', 'משפחה', 'ללא גלוטן', 'text-emerald-300', 'linear-gradient(135deg,#10b981,#059669)'],
    ].map(([initials, name, time, status, statusClass, avatar]) => (
      <div key={name} className="flex items-center gap-2 border-b border-white/5 px-3 py-2 last:border-b-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: avatar }}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold">{name}</div>
          <div className="text-[9px] text-slate-400">{time}</div>
        </div>
        <span className={`shrink-0 text-[9px] font-bold ${statusClass}`}>{status}</span>
      </div>
    ))}
  </GlassCard>
);

// 3D card slot — applies perspective + rotateY/rotateX, lifts on hover via translateZ
const Card3D = ({ width, top, left, rotateY, rotateX, zIndex, shadow, hoverShadow, children }) => {
  const base = `perspective(900px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
  return (
    <div
      className="absolute group transition-[transform,box-shadow] duration-300"
      style={{
        width,
        top,
        left,
        zIndex,
        transform: base,
        boxShadow: shadow,
        transformStyle: 'preserve-3d',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `${base} translateZ(12px)`;
        e.currentTarget.style.boxShadow = hoverShadow;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = base;
        e.currentTarget.style.boxShadow = shadow;
      }}
    >
      {children}
    </div>
  );
};

const ProductCards = () => (
  <>
    {/* Mobile / tablet: clean stacked grid — 3 cards */}
    <div className="mx-auto grid w-full max-w-[560px] grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
      <InviteCard />
      <StatsCard />
      <MessagesCard />
    </div>

    {/* Desktop: 3D perspective stage — 3 cards, larger */}
    <div
      className="relative mx-auto hidden lg:block"
      style={{ width: 500, height: 580, perspective: '1200px' }}
    >
      {/* Invite — left hero, full height, strong tilt */}
      <Card3D
        width={260}
        top={30}
        left={0}
        rotateY={5}
        rotateX={1}
        zIndex={10}
        shadow="-6px 20px 52px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)"
        hoverShadow="-8px 28px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.15)"
      >
        <InviteCard />
      </Card3D>

      {/* Stats — top-right, tilted left */}
      <Card3D
        width={240}
        top={20}
        left={255}
        rotateY={-5}
        rotateX={2}
        zIndex={8}
        shadow="8px 18px 50px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.08)"
        hoverShadow="10px 24px 62px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.1)"
      >
        <StatsCard />
      </Card3D>

      {/* Messages — bottom-right, tilted left + down */}
      <Card3D
        width={240}
        top={240}
        left={255}
        rotateY={-4}
        rotateX={-2}
        zIndex={7}
        shadow="8px 20px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)"
        hoverShadow="10px 26px 66px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.09)"
      >
        <MessagesCard />
      </Card3D>
    </div>
  </>
);

const MobileHomepageHero = ({ onCreateEvent, onShowProcess, showPreEventMarketing = true }) => (
  <div className="sm:hidden" dir="rtl">
    <div className="mx-auto flex max-w-md flex-col items-center px-1 pb-6 pt-1 text-center">
      <div className="mb-5 text-2xl font-semibold tracking-wide text-white">
        Meet<span className="text-violet-300">-M</span>
      </div>

      <div className="space-y-3">
        <h1 className="text-[2rem] font-black leading-[1.15] text-white">
          הזמנות דיגיטליות
          <br />
          ואישורי הגעה במקום אחד
        </h1>
        <p className="mx-auto max-w-[21rem] text-sm font-medium leading-7 text-slate-300">
          בונים אירוע, שולחים הזמנות ועוקבים אחרי אורחים מהנייד.
        </p>
      </div>

      <button
        type="button"
        onClick={onCreateEvent}
        className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-l from-emerald-500 to-green-400 px-6 py-4 text-lg font-black text-white shadow-[0_16px_38px_rgba(16,185,129,0.32)] active:scale-[0.99]"
      >
        <span>צור אירוע חדש</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/18 text-2xl leading-none">+</span>
      </button>

      {showPreEventMarketing && (
        <>
          <button
            type="button"
            onClick={onShowProcess}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-violet-200"
          >
            <span>צפה איך זה עובד</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-violet-300/50 text-[10px]">▶</span>
          </button>

          <div className="mt-5 w-full overflow-hidden rounded-3xl border border-white/15 bg-white/[0.055] p-4 text-right shadow-[0_14px_46px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-400">כרטיס הדגמה</p>
                <h2 className="mt-1 text-2xl font-black text-white">חתונת דניאל ומיכל</h2>
              </div>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10 text-3xl">
                💐
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                ['124', RSVP_STATUS_LABELS.approved, 'text-emerald-300', 'border-emerald-300/25 bg-emerald-400/10'],
                ['18', RSVP_STATUS_LABELS.pending, 'text-amber-300', 'border-amber-300/25 bg-amber-400/10'],
                ['7', RSVP_STATUS_LABELS.rejected, 'text-rose-300', 'border-rose-300/25 bg-rose-400/10'],
              ].map(([value, label, valueClass, cardClass]) => (
                <div key={label} className={`rounded-2xl border px-2 py-3 text-center ${cardClass}`}>
                  <div className={`text-3xl font-black leading-none tabular-nums ${valueClass}`}>{value}</div>
                  <div className="mt-1 text-xs font-bold text-slate-300">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 w-full space-y-2">
            {[
              ['🎨', 'הזמנה מעוצבת', 'עיצובים יוקרתיים שמתאימים לאירוע שלכם'],
              ['📱', 'שליחה בוואטסאפ ו-SMS', 'מגיעים לכל אורח, בדרך הנוחה לו'],
              ['📊', 'דוחות בזמן אמת', 'מעקב אחרי אישורי הגעה וסטטיסטיקות'],
            ].map(([icon, title, subtitle]) => (
              <div key={title} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-right">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-xl">{icon}</div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-slate-100">{title}</h3>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">{subtitle}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-3 z-10 mt-4 w-full rounded-3xl border border-white/10 bg-[#101437]/90 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <button
              type="button"
              onClick={onCreateEvent}
              className="w-full rounded-2xl bg-gradient-to-l from-emerald-500 to-green-400 px-6 py-3.5 text-lg font-black text-white shadow-[0_12px_34px_rgba(16,185,129,0.28)]"
            >
              התחל עכשיו
            </button>
          </div>
        </>
      )}
    </div>
  </div>
);

export default forwardRef(function HeroSection({ onStart, onPressCreateEvent, session }, ref) {
  const [activeReportSummary, setActiveReportSummary] = useState(null);
  const [activeEventId, setActiveEventId] = useState(null);
  const [reportRefreshKey, setReportRefreshKey] = useState(0);

  const handleCreateNewEvent = (event) => {
    event?.preventDefault?.();
    if (typeof onPressCreateEvent === 'function') {
      onPressCreateEvent();
      return;
    }
    onStart?.();
  };

  useEffect(() => {
    let cancelled = false;

    const loadActiveReportSummary = async () => {
      const userId = session?.user?.id;

      if (!userId) {
        setActiveReportSummary(null);
        setActiveEventId(null);
        return;
      }

      try {
        const { data: eventRecord, error: eventError } = await supabase
          .from('events')
          .select('id, event_details, status, allowed_guests, messages_sent_count, selected_plan, additional_packages')
          .eq('user_id', userId)
          .or('status.neq.archived,status.is.null')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (eventError) throw eventError;

        let reportEvent = eventRecord;
        if (!reportEvent || !shouldShowEventReports(reportEvent)) {
          const { data: anyEvent } = await supabase
            .from('events')
            .select('id, event_details, status, allowed_guests, messages_sent_count, selected_plan, additional_packages')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          reportEvent = anyEvent;
        }

        if (!reportEvent || !shouldShowEventReports(reportEvent)) {
          if (!cancelled) {
            setActiveReportSummary(null);
            setActiveEventId(null);
          }
          return;
        }

        const { data: guests, error: guestsError } = await supabase
          .from('invited_guests')
          .select('status, adults, children, phone, first_name, last_name')
          .eq('event_id', reportEvent.id);

        if (guestsError) throw guestsError;

        if (!cancelled) {
          setActiveReportSummary(buildActiveReportSummary(reportEvent, guests || []));
          setActiveEventId(reportEvent.id);
        }
      } catch (error) {
        console.error('Failed to load active hero report summary', error);
        if (!cancelled) {
          setActiveReportSummary(null);
          setActiveEventId(null);
        }
      }
    };

    loadActiveReportSummary();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, reportRefreshKey]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return undefined;

    const channel = supabase
      .channel(`hero-user-events-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `user_id=eq.${userId}` },
        () => setReportRefreshKey((key) => key + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!activeEventId) return undefined;

    const channel = supabase.channel(`hero-report-summary-${activeEventId}`);
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `id=eq.${activeEventId}` },
        () => setReportRefreshKey((key) => key + 1)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invited_guests', filter: `event_id=eq.${activeEventId}` },
        () => setReportRefreshKey((key) => key + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEventId]);

  useEffect(() => {
    if (!activeEventId) return undefined;
    const id = window.setInterval(() => setReportRefreshKey((key) => key + 1), 8000);
    return () => window.clearInterval(id);
  }, [activeEventId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const refresh = () => {
      if (activeEventId) setReportRefreshKey((key) => key + 1);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
    return () => {
      window.removeEventListener('focus', refresh);
    };
  }, [activeEventId]);

  const shouldShowActiveReports = Boolean(activeReportSummary && activeReportSummary.hasReportData);

  return (
    <section className="relative z-10 overflow-visible px-4 pb-10 pt-12 text-slate-100 sm:px-6 lg:px-12 lg:pb-14 lg:pt-16">
      <MobileHomepageHero
        onCreateEvent={handleCreateNewEvent}
        onShowProcess={() => onStart?.()}
        showPreEventMarketing={!activeEventId}
      />
      <div className={`mx-auto hidden max-w-6xl items-center gap-10 sm:grid lg:min-h-[calc(100vh-86px)] lg:gap-12 ${shouldShowActiveReports ? 'lg:grid-cols-[0.96fr_1.04fr]' : 'lg:grid-cols-[0.96fr_1.04fr]'}`}>
        <div className={`flex flex-col items-center gap-6 text-center lg:items-start lg:text-right ${shouldShowActiveReports ? 'lg:order-1' : 'lg:order-1'}`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/35 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-200">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="#c4b9ff" aria-hidden="true">
              <path d="M6 0l1.5 4.5H12L8.25 7.5 9.75 12 6 9.25 2.25 12l1.5-4.5L0 4.5h4.5z" />
            </svg>
            הזמנות, אורחים ודוחות במקום אחד
          </div>

          <div className="space-y-5">
            <h1 className="text-4xl font-black leading-[1.08] text-white sm:text-5xl lg:text-6xl">
              יוצרים הזמנה,
              <br />
              שולחים לאורחים,
              <br />
              <span className="bg-gradient-to-br from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                מנהלים הכל בזמן אמת.
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-base leading-8 text-slate-400 lg:mx-0">
              Meet-M מאפשרת ליצור הזמנה מעוצבת, לשלוח אותה ב-SMS וב-WhatsApp, לקבל אישורי הגעה, לנהל העדפות אוכל ואלרגיות, להציג דוחות בקרה ולייצא לאקסל.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={handleCreateNewEvent}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-3 text-base font-bold text-white shadow-[0_12px_34px_rgba(99,70,230,0.34)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f2b]"
            >
              <span aria-hidden="true">←</span>
              צרו אירוע חדש
            </button>
            <button
              type="button"
              onClick={() => onStart?.()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-transparent px-6 py-3 text-base font-semibold text-white transition-colors hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f2b]"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6 5l4.5 2.5L6 10V5z" fill="currentColor" />
              </svg>
              ראו את תהליך היצירה
            </button>
          </div>

          <div className="grid w-full max-w-xl grid-cols-1 gap-4 pt-1 text-right sm:grid-cols-3">
            {[
              [<FeatureTick key="icon" />, 'עיצוב הזמנה', 'תבניות ועריכה מלאה'],
              [<MessageIcon key="icon" />, 'שליחה מהירה', 'SMS ו-WhatsApp'],
              [<ReportIcon key="icon" />, 'דוחות בקרה', 'סטטוסים וייצוא Excel'],
            ].map(([icon, title, subtitle]) => (
              <div key={title} className="min-w-0">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-400 sm:justify-start">
                  {icon}
                  <span>{title}</span>
                </div>
                <div className="mt-1 text-center text-xs text-slate-600 sm:pr-5 sm:text-right">{subtitle}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={shouldShowActiveReports ? 'lg:order-2' : 'lg:order-2'}>
          {shouldShowActiveReports ? <ActiveEventReportsDashboard summary={activeReportSummary} /> : <ProductCards />}
        </div>
      </div>
    </section>
  );
});
