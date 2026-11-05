import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight, Loader2, LogOut, QrCode,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/Confirm';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Button, Field, Spinner } from '../../components/ui';
import { useMounted } from '../../lib/motion';
import { fmtDate, fmtMinutes, fmtTime, titleCase, ymd } from '../../lib/format';
import { Term } from '../../components/InfoTip';

const DAY_MS = 86400000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const weekDates = (monday) => Array.from({ length: 7 }, (_, i) => ymd(new Date(monday.getTime() + i * DAY_MS)));

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

const Panel = ({ className = '', children }) => (
  <section className={`rounded-3xl border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur ${className}`}>{children}</section>
);

const PanelTitle = ({ children, to, label }) => (
  <div className="mb-3 flex items-center justify-between gap-2">
    <h2 className="text-lg font-semibold text-slate-900"><Term>{children}</Term></h2>
    {to && (
      <Link to={to} aria-label={label} title={label} className="group flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 active:scale-90">
        <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:rotate-45" />
      </Link>
    )}
  </div>
);

// ---------- Header: progress pills + headline numbers ----------
function ProgressPill({ label, value, fill, to }) {
  return (
    <Link to={to} className="group min-w-0 transition-transform duration-200 hover:-translate-y-0.5">
      <p className="mb-1.5 truncate text-xs font-medium text-slate-500 group-hover:text-slate-700"><Term>{label}</Term></p>
      <div className="relative h-10 w-full overflow-hidden rounded-full border border-slate-200 bg-white">
        <div className="absolute inset-y-0 left-0 origin-left animate-grow-x rounded-full bg-brand-800 transition-[width] duration-500" style={{ width: `${Math.max(8, Math.min(100, fill))}%` }} />
        {/* Text sits on the dark fill when there's room, otherwise on the light track, so it always has contrast. */}
        <span className={`relative flex h-full items-center whitespace-nowrap px-3 text-sm font-semibold sm:px-4 ${fill >= 55 ? 'text-white' : 'justify-end text-slate-800'}`}>{value}</span>
      </div>
    </Link>
  );
}

// ---------- Cards ----------
// Ring timer: time on duty against the shift length; check in/out from here.
export function ClockCard() {
  const { data: status, reload, loading } = useFetch('/attendance/status');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const ask = useConfirm();
  const now = useNow();
  const ready = useMounted(); // ring starts empty, then sweeps to the real value

  if (loading && !status) return <Panel className="flex items-center justify-center"><Spinner /></Panel>;
  const open = status?.open;
  const pending = status?.pending;
  const shift = open?.shift || status?.currentShift;

  let progress = 0;
  let center = '--:--';
  let caption = 'Off duty';
  if (open) {
    const elapsed = now - new Date(open.clockIn);
    const length = shift ? new Date(shift.endAt) - new Date(shift.startAt) : 8 * 3600000;
    progress = Math.min(1, elapsed / length);
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    center = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    caption = shift ? `of ${shift.startTime}–${shift.endTime}` : 'Unscheduled';
  } else if (status?.upcoming || shift) {
    const next = shift || status.upcoming;
    center = next.startTime;
    const started = shift && now >= new Date(shift.startAt);
    caption = shift ? (started ? 'Started · check in now' : 'Shift starts') : `Next · ${new Date(next.startAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}`;
  }
  const R = 64;
  const C = 2 * Math.PI * R;

  const checkOut = async () => {
    const early = shift && now < new Date(shift.endAt);
    if (!(await ask({
      title: 'Check out now?',
      message: early ? `Your shift runs until ${shift.endTime}. Checking out now will be recorded as leaving early.` : 'This ends your shift for today.',
      confirmLabel: 'Check out',
    }))) return;
    setBusy(true);
    try {
      const { data } = await api.post('/attendance/clock-out', { note });
      toast.success(`Checked out. ${fmtMinutes(data.workedMinutes)} worked`);
      setNote('');
      reload();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };

  return (
    <Panel className="flex flex-col">
      <PanelTitle to="/check-in" label="Open check-in">Shift timer</PanelTitle>
      <div className="relative mx-auto my-1 h-40 w-40" role="img" aria-label={open ? `On duty for ${center} hours` : pending ? 'Waiting at the check-in desk' : `${caption} ${center}`}>
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={R} fill="none" strokeWidth="14" className="stroke-slate-100" strokeDasharray="3 5" />
          <circle cx="80" cy="80" r={R} fill="none" strokeWidth="14" strokeLinecap="round" className="stroke-brand-600 transition-all duration-700"
            strokeDasharray={C} strokeDashoffset={ready ? C * (1 - progress) : C} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {pending ? <Loader2 className="h-8 w-8 animate-spin text-brand-600" /> : <span key={center} className="animate-fade-in text-3xl font-light tabular-nums text-slate-900">{center}</span>}
          <span className="mt-0.5 text-xs text-slate-500">{pending ? 'At the desk' : caption}</span>
        </div>
      </div>
      <div className="mt-auto space-y-2 pt-2">
        {open ? (
          <>
            <Field label="Handover note (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <Button variant="danger" className="w-full" loading={busy} onClick={checkOut}><LogOut className="h-4 w-4" /> Check out</Button>
          </>
        ) : (
          <Link to="/check-in" className="block">
            <Button variant={pending ? 'secondary' : 'primary'} className="w-full">
              {pending ? 'Waiting for the admin…' : <><QrCode className="h-4 w-4" /> Check in at the desk</>}
            </Button>
          </Link>
        )}
        {open && <p className="text-center text-xs text-slate-500">Checked in {fmtTime(open.clockIn)}{open.status === 'late' && ` · ${open.lateMinutes} min late`}</p>}
      </div>
    </Panel>
  );
}

// One card for set-up progress. Only outstanding tasks are listed; it disappears once everything is done.
function Checklist({ tasks, title = 'Getting set up', link }) {
  const done = tasks.filter((t) => t.done).length;
  const left = tasks.filter((t) => !t.done);
  if (!left.length) return null;
  return (
    <section className="rounded-3xl bg-gradient-to-b from-brand-800 to-brand-900 p-5 text-white shadow-lg">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{link ? <Link to={link} className="hover:underline">{title}</Link> : title}</h2>
        <span className="text-2xl font-light">{done}/{tasks.length}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15" role="img" aria-label={`${done} of ${tasks.length} done`}>
        <div className="h-full origin-left animate-grow-x rounded-full bg-brand-400" style={{ width: `${(done / tasks.length) * 100}%` }} />
      </div>
      <ul className="stagger mt-3 space-y-1">
        {left.map((t) => (
          <li key={t.label}>
            <Link to={t.to} className="group flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:translate-x-0.5 hover:bg-white/10">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white/60" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="block truncate text-xs text-white/60">{t.hint}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-white/70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Week calendar: shifts drawn as blocks on a 24-hour scale; night shifts continue into the next day.
const SHIFT_BLOCK = {
  morning: 'bg-sky-100 text-sky-900 border-sky-200', afternoon: 'bg-amber-100 text-amber-900 border-amber-200',
  night: 'bg-brand-800 text-white border-brand-900', day: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  on_call: 'bg-rose-100 text-rose-900 border-rose-200', custom: 'bg-slate-100 text-slate-800 border-slate-200',
};

function WeekCalendar({ className = '' }) {
  const [monday, setMonday] = useState(() => startOfWeek());
  const dates = weekDates(monday);
  const prevDay = ymd(new Date(monday.getTime() - DAY_MS));
  const { data: shifts } = useFetch('/rosters/my-shifts', { params: { from: prevDay, to: dates[6] }, initial: [] });
  const now = useNow(60000);
  const today = ymd(now);
  const H = 20 * 16; // px for 24h; 1h = H/24

  const segments = useMemo(() => {
    const out = [];
    for (const s of shifts) {
      const start = new Date(s.startAt);
      const end = new Date(s.endAt);
      for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d < end; d = new Date(d.getTime() + DAY_MS)) {
        const dayStart = d.getTime();
        const from = Math.max(start.getTime(), dayStart);
        const to = Math.min(end.getTime(), dayStart + DAY_MS);
        if (to > from) out.push({ shift: s, date: ymd(d), top: (from - dayStart) / 3600000, len: (to - from) / 3600000, cont: from > start.getTime() });
      }
    }
    return out.filter((x) => dates.includes(x.date));
  }, [shifts, dates]);

  const month = monday.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const nowHours = now.getHours() + now.getMinutes() / 60;
  const thisWeek = ymd(startOfWeek()) === dates[0];

  return (
    <Panel className={className}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button type="button" aria-label="Previous week" onClick={() => setMonday(new Date(monday.getTime() - 7 * DAY_MS))} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-900">{month}</h2>
          {!thisWeek && <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => setMonday(startOfWeek())}>Back to this week</button>}
        </div>
        <button type="button" aria-label="Next week" onClick={() => setMonday(new Date(monday.getTime() + 7 * DAY_MS))} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
      </div>
      {/* Phones: a simple agenda list instead of the 7-column grid. */}
      <ul key={`agenda-${dates[0]}`} className="stagger space-y-2 sm:hidden">
        {dates.map((d, i) => {
          const dayShifts = shifts.filter((s) => s.date === d);
          return (
            <li key={d} className={`flex items-center gap-3 rounded-2xl p-2.5 ${d === today ? 'bg-brand-50 ring-1 ring-brand-200' : 'bg-slate-50'}`}>
              <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${d === today ? 'bg-brand-800 text-white' : 'bg-white text-slate-700'}`}>
                <span className="text-xs leading-none">{WEEKDAYS[i]}</span>
                <span className="text-base font-semibold leading-tight">{Number(d.slice(8))}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {dayShifts.length === 0 ? <span className="text-sm text-slate-500">Off</span> : dayShifts.map((sh) => (
                  <Link key={sh._id} to="/my-roster" className={`flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium ${SHIFT_BLOCK[sh.shiftType]}`}>
                    {titleCase(sh.shiftType)} · {sh.startTime}–{sh.endTime}
                  </Link>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <div key={dates[0]} className="grid min-w-[34rem] animate-fade-in grid-cols-[2.5rem_repeat(7,1fr)] gap-x-1.5">
          <div />
          {dates.map((d, i) => (
            <div key={d} className={`mb-2 rounded-2xl py-1.5 text-center transition-colors ${d === today ? 'animate-pop-in bg-brand-800 text-white' : ''}`}>
              <p className={`text-xs ${d === today ? 'text-white/80' : 'text-slate-500'}`}>{WEEKDAYS[i]}</p>
              <p className="text-sm font-semibold">{Number(d.slice(8))}</p>
            </div>
          ))}
          <div className="relative" style={{ height: H }}>
            {[0, 6, 12, 18].map((h) => <span key={h} className="absolute right-1 -translate-y-1/2 text-xs text-slate-500" style={{ top: (h / 24) * H }}>{String(h).padStart(2, '0')}:00</span>)}
          </div>
          {dates.map((d) => (
            <div key={d} className={`relative rounded-2xl ${d === today ? 'bg-brand-50' : 'bg-slate-50'}`} style={{ height: H }}>
              {[6, 12, 18].map((h) => <div key={h} className="absolute inset-x-0 border-t border-dashed border-slate-200" style={{ top: (h / 24) * H }} />)}
              {d === today && (
                <div className="absolute inset-x-0 z-10 border-t-2 border-rose-500" style={{ top: (nowHours / 24) * H }} aria-hidden="true">
                  <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-rose-500" />
                  <span className="absolute -left-1 -top-[5px] h-2 w-2 animate-pulse-ring rounded-full bg-rose-500" />
                </div>
              )}
              {segments.filter((x) => x.date === d).map((x, i) => (
                <Link to="/my-roster" key={`${x.shift._id}-${x.date}`} title={`${titleCase(x.shift.shiftType)} ${x.shift.startTime}–${x.shift.endTime}`}
                  className={`absolute inset-x-1 animate-fade-up overflow-hidden rounded-xl border px-1.5 py-1 text-xs leading-tight shadow-sm transition hover:z-20 hover:scale-[1.04] hover:shadow-md ${SHIFT_BLOCK[x.shift.shiftType]}`}
                  style={{ top: (x.top / 24) * H, height: Math.max(22, (x.len / 24) * H - 2), animationDelay: `${dates.indexOf(d) * 50 + i * 30}ms` }}>
                  <span className="block font-semibold">{x.cont ? '↳ ' : ''}{titleCase(x.shift.shiftType)}</span>
                  {x.len >= 3 && <span className="block opacity-80">{x.shift.startTime}–{x.shift.endTime}</span>}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const monday = startOfWeek();
  const week = weekDates(monday);
  const { data: records } = useFetch('/attendance/mine', { params: { from: ymd(new Date(Date.now() - 30 * DAY_MS)) }, initial: [] });
  const { data: upcomingShifts } = useFetch('/rosters/my-shifts', { params: { from: ymd(), to: ymd(new Date(Date.now() + 14 * DAY_MS)) }, initial: [] });
  const { data: certs } = useFetch('/certificates/mine', { initial: [] });
  const { data: certReqs } = useFetch('/certificates/requests/mine', { initial: [] });
  const { data: inbox } = useFetch('/announcements/mine', { initial: [] });
  const { data: onboarding } = useFetch('/onboarding/mine');

  const onTime = records.filter((r) => r.status === 'on_time').length;
  const late = records.filter((r) => r.status === 'late').length;
  const punctuality = onTime + late ? Math.round((onTime / (onTime + late)) * 100) : null;
  const weekHours = records.filter((r) => week.includes(r.date)).reduce((a, r) => a + (r.workedMinutes || 0), 0) / 60;
  const scheduledWeekHours = upcomingShifts.filter((s) => week.includes(s.date)).reduce((a, s) => a + (new Date(s.endAt) - new Date(s.startAt)) / 3600000, 0) + weekHours;

  // Only what HR has approved counts; licences are the only records that expire.
  const validCerts = certs.filter((c) => c.verification === 'verified' && ['valid', 'no_expiry', 'expiring_soon'].includes(c.expiryStatus)).length;
  const certAlerts = certs.filter((c) => c.verification === 'verified' && ['expired', 'expiring_soon'].includes(c.expiryStatus));
  const openReqs = certReqs.filter((r) => r.status === 'open');
  const unread = inbox.filter((a) => !a.read);
  const hour = new Date().getHours();

  const tasks = [
    { label: 'Add a profile photo', hint: 'Used to confirm you at check-in', done: !!user.avatar, to: '/profile' },
    { label: 'Emergency contact', hint: 'Who to call if something happens', done: !!(user.emergencyContact?.name && user.emergencyContact?.phone), to: '/profile' },
    { label: 'Bank details', hint: 'For salary and approved loans', done: !!user.bankDetails?.accountNumber, to: '/profile' },
    { label: 'Upload a certificate', hint: 'Licence, BLS and training', done: certs.length > 0, to: '/certificates' },
    { label: 'HR certificate requests', hint: openReqs.length ? `${openReqs.length} waiting for you` : 'Nothing outstanding', done: openReqs.length === 0, to: '/certificates' },
    { label: 'Read announcements', hint: unread.length ? `${unread.length} unread` : 'All caught up', done: unread.length === 0, to: '/inbox' },
  ];

  // New starters see their real onboarding tasks; everyone else a profile set-up list.
  const checklist = onboarding?.status === 'active'
    ? <Checklist title="Your onboarding" link="/onboarding" tasks={onboarding.tasks.filter((t) => t.owner === 'employee').map((t) => ({ label: t.title, hint: t.dueDate ? `Due ${fmtDate(t.dueDate)}` : 'Part of your onboarding', done: t.done, to: t.link || '/onboarding' }))} />
    : <Checklist tasks={tasks} />;

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-slate-900 sm:text-5xl">
          Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, <span className="font-medium">{user.firstName}</span>
        </h1>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <ProgressPill label="Hours this week" value={`${weekHours.toFixed(0)}/${Math.round(scheduledWeekHours) || '—'}h`} fill={scheduledWeekHours ? (weekHours / scheduledWeekHours) * 100 : 0} to="/attendance" />
          <ProgressPill label="Annual leave left" value={`${user.leaveBalance} days`} fill={(user.leaveBalance / 21) * 100} to="/requests" />
          <ProgressPill label="Punctuality · 30 days" value={punctuality == null ? '—' : `${punctuality}%`} fill={punctuality ?? 0} to="/attendance" />
          <ProgressPill label="Valid certificates" value={`${validCerts}/${certs.length || 0}`} fill={certs.length ? (validCerts / certs.length) * 100 : 0} to="/certificates" />
        </div>
      </div>

      {(certAlerts.length > 0 || openReqs.length > 0) && (
        <div className="mb-6 flex animate-slide-down flex-wrap items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            {certAlerts.map((c) => <p key={c._id}><b>{c.title}</b> {c.expiryStatus === 'expired' ? 'has expired' : `expires in ${c.daysToExpiry} day(s)`}.</p>)}
            {openReqs.map((r) => <p key={r._id}>HR has asked you to obtain <b>{r.title}</b>{r.dueDate && ` by ${fmtDate(r.dueDate)}`}.</p>)}
          </div>
          {/* Drops under the message on phones so the text gets the full width */}
          <Link to="/certificates" className="w-full pl-8 font-semibold underline sm:w-auto sm:pl-0">Manage certificates</Link>
        </div>
      )}

      {/* Check-in first, then anything left to set up, then the week; on large screens the calendar sits on the right. */}
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={`lg:col-span-4 ${checklist ? '' : 'lg:self-start'}`}><ClockCard /></div>
        {checklist && <div className="lg:col-span-4 lg:row-start-2">{checklist}</div>}
        <WeekCalendar className={`lg:col-span-8 lg:col-start-5 lg:row-start-1 ${checklist ? 'lg:row-span-2' : ''}`} />
      </div>
    </div>
  );
}
