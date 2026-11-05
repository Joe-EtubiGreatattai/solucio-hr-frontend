import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpRight, Award, Bell, Briefcase, FileDown, FileText, GraduationCap, HandCoins, Palmtree, Plus, QrCode, Repeat, TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { downloadPunctualityPdf } from '../../lib/attendancePdf';
import { Animated, Avatar, Button, Spinner } from '../../components/ui';
import { useMounted } from '../../lib/motion';
import { fmtDate, fmtTime, fullName, timeAgo, titleCase, ymd } from '../../lib/format';
import { RequestSummary } from '../staff/Requests';
import { Term } from '../../components/InfoTip';

const Panel = ({ className = '', children }) => <section className={`rounded-3xl bg-white p-5 shadow-sm ${className}`}>{children}</section>;

function CornerLink({ to, label, light }) {
  return (
    <Link to={to} aria-label={label} title={label}
      className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition active:scale-90 ${light ? 'border-white bg-white text-brand-900 hover:bg-white/90' : 'border-slate-300 text-slate-800 hover:bg-slate-50'}`}>
      <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:rotate-45" />
    </Link>
  );
}

function StatCard({ title, value, caption, to, highlight }) {
  return (
    <div className={`lift relative overflow-hidden rounded-3xl p-5 shadow-sm ${highlight ? 'bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 text-white' : 'bg-white text-slate-900'}`}>
      {highlight && <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />}
      <div className="relative flex items-start justify-between gap-2">
        <h2 className="text-[17px] font-medium"><Term>{title}</Term></h2>
        <CornerLink to={to} label={`Open ${title.toLowerCase()}`} light={highlight} />
      </div>
      <p className="relative mt-3 text-5xl font-semibold tabular-nums tracking-tight">
        {typeof value === 'string' && value.includes('/')
          ? <><Animated value={Number(value.split('/')[0])} />/<Animated value={Number(value.split('/')[1])} /></>
          : <Animated value={value} />}
      </p>
      <p className={`relative mt-3 flex items-center gap-1.5 text-xs ${highlight ? 'text-brand-100' : 'text-brand-700'}`}>
        <span className={`inline-flex h-4 items-center rounded border px-1 ${highlight ? 'border-brand-200/60' : 'border-brand-600/40'}`}><TrendingUp className="h-3 w-3" /></span>
        {caption}
      </p>
    </div>
  );
}

// Pill bars for Mon–Sun: solid = checked in, hatched = still to come.
function WeekBars({ week }) {
  const max = Math.max(1, ...week.map((d) => Math.max(d.scheduled, d.checkedIn)));
  const today = ymd();
  const shades = ['bg-brand-700', 'bg-brand-800', 'bg-brand-500', 'bg-brand-900'];
  return (
    <div className="flex h-56 items-end justify-between gap-3 pt-6" role="img"
      aria-label={week.map((d) => `${new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}: ${d.future ? `${d.scheduled} scheduled` : `${d.checkedIn} of ${d.scheduled} checked in`}`).join('; ')}>
      {week.map((d, i) => {
        const value = d.future ? d.scheduled : d.checkedIn;
        const pct = d.scheduled ? Math.round((d.checkedIn / d.scheduled) * 100) : null;
        const isToday = d.date === today;
        return (
          <div key={d.date} className="flex h-full flex-1 flex-col items-center gap-2">
            <div className="relative flex w-full flex-1 items-end justify-center">
              {isToday && pct != null && (
                <span className="absolute z-10 -translate-y-full animate-[pop-in_0.35s_0.7s_both] rounded-md border border-brand-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-brand-800 shadow-sm"
                  style={{ bottom: `${Math.max(18, (value / max) * 100)}%` }}>{pct}%</span>
              )}
              <div className={`w-full max-w-14 origin-bottom animate-grow-y rounded-full transition-[height] duration-500 hover:brightness-110 ${d.future || !value ? 'hatched' : shades[i % shades.length]} ${isToday ? 'ring-2 ring-brand-300 ring-offset-2' : ''}`}
                style={{ height: `${Math.max(18, (value / max) * 100)}%`, animationDelay: `${i * 70}ms` }} title={d.future ? `${d.scheduled} scheduled` : `${d.checkedIn}/${d.scheduled} checked in`} />
            </div>
            <span className={`text-sm ${isToday ? 'font-semibold text-brand-800' : 'text-slate-500'}`}>{'MTWTFSS'[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

// Semicircle gauge split into on time / late / absent (hatched).
function PunctualityGauge({ totals, punctuality }) {
  const parts = [
    { key: 'onTime', label: 'On time', value: totals.onTime, stroke: 'var(--color-brand-600)' },
    { key: 'late', label: 'Late', value: totals.late, stroke: 'var(--color-brand-900)' },
    { key: 'absences', label: 'Absent', value: totals.absences, stroke: 'url(#hatch)' },
  ];
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const ready = useMounted(80); // segments start at zero length, then sweep round
  const R = 80;
  const len = Math.PI * R;
  let offset = 0;
  return (
    <div>
      <div className="relative mx-auto w-full max-w-[17rem]">
        <svg viewBox="0 -4 200 122" className="w-full" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="white" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-slate-400)" strokeWidth="3" />
            </pattern>
          </defs>
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--color-slate-100)" strokeWidth="26" strokeLinecap="round" />
          {parts.map((p) => {
            const seg = (p.value / total) * len;
            const el = (
              <path key={p.key} d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={p.stroke} strokeWidth="26" strokeLinecap="round"
                className="transition-[stroke-dasharray,stroke-dashoffset] duration-1000 ease-out"
                strokeDasharray={`${ready ? Math.max(0, seg - 2) : 0} ${len}`} strokeDashoffset={ready ? -offset : 0} />
            );
            offset += seg;
            return el;
          })}
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="text-4xl font-semibold tabular-nums tracking-tight text-slate-900"><Animated value={punctuality} />{punctuality != null && '%'}</p>
          <p className="text-xs text-slate-500"><Term>On time · last 30 days</Term></p>
        </div>
      </div>
      <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-slate-600">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className={`h-3.5 w-3.5 rounded-full ${p.key === 'absences' ? 'hatched' : ''}`} style={p.key === 'absences' ? undefined : { background: p.stroke }} />
            {p.label} <span className="font-semibold text-slate-900">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const REQUEST_ICON = {
  leave: [Palmtree, 'bg-emerald-50 text-emerald-700'], loan: [HandCoins, 'bg-amber-50 text-amber-700'],
  salary_advance: [HandCoins, 'bg-amber-50 text-amber-700'], training: [GraduationCap, 'bg-sky-50 text-sky-700'],
  transfer: [Repeat, 'bg-violet-50 text-violet-700'], equipment: [Briefcase, 'bg-slate-100 text-slate-700'], other: [FileText, 'bg-slate-100 text-slate-700'],
};

function NextUp({ data, onRemind }) {
  const cert = data.nextExpiring[0];
  let content;
  if (data.waitingAtDesk > 0) {
    content = { title: `${data.waitingAtDesk} waiting at the desk`, text: 'Scanned in and waiting for you to confirm who they are.', action: <Link to="/admin/check-in-desk" className="block"><Button size="lg" className="w-full"><QrCode className="h-5 w-5" /> Open check-in desk</Button></Link> };
  } else if (cert) {
    const days = Math.ceil((new Date(cert.expiryDate) - Date.now()) / 86400000);
    content = { title: `${cert.user.firstName}'s ${cert.title}`, text: `Expires ${fmtDate(cert.expiryDate)} (in ${days} day${days === 1 ? '' : 's'})`, action: <Button size="lg" className="w-full" onClick={() => onRemind(cert)}><Bell className="h-5 w-5" /> Send reminder</Button> };
  } else if (data.requests.pending) {
    content = { title: `${data.requests.pending} request${data.requests.pending > 1 ? 's' : ''} to review`, text: 'Leave, loans and other applications waiting for a decision.', action: <Link to="/admin/requests" className="block"><Button size="lg" className="w-full">Review requests</Button></Link> };
  } else {
    content = { title: 'All clear', text: 'Nothing needs your attention right now.', action: null };
  }
  return (
    <Panel className="flex flex-col">
      <h2 className="text-[17px] font-medium text-slate-900"><Term>Next up</Term></h2>
      <p key={content.title} className="mt-3 line-clamp-3 animate-fade-up text-xl font-semibold leading-snug text-brand-900">{content.title}</p>
      <p className="mt-1 text-sm text-slate-500">{content.text}</p>
      <div className="mt-auto pt-5">{content.action}</div>
    </Panel>
  );
}

// Fairest people to cover an under-rostered shift, one click each. The server leaves out anyone on leave,
// already working, short of rest or over the weekly hours limit, and ranks the rest so extra shifts,
// nights and weekends are shared evenly.
function CoverSuggestions({ row, onAdded }) {
  const params = { department: row.department, shiftType: row.shiftType };
  const { data, reload } = useFetch('/rosters/cover-suggestions', { params });
  const [adding, setAdding] = useState(null);
  if (!data?.gap) return null;
  const top = data.suggestions.slice(0, 3);
  const add = async (s) => {
    setAdding(s.user._id);
    try {
      await api.post('/rosters/cover', { ...params, user: s.user._id });
      toast.success(`${s.user.firstName} is rostered and has been notified`);
      onAdded();
    } catch (e) { toastError(e); reload(); } finally { setAdding(null); }
  };
  const unsocial = row.shiftType === 'night' ? 'nights' : [0, 6].includes(new Date().getDay()) ? 'weekends' : null;
  if (!top.length) {
    return <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">Nobody in {row.department} is free without breaking rest, leave or weekly-hours rules{data.excluded.length ? ` (${data.excluded.length} checked)` : ''}.</p>;
  }
  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suggested cover · fairest first</p>
      <ul className="mt-1 divide-y divide-slate-100">
        {top.map((s) => (
          <li key={s.user._id} className="flex items-center gap-3 py-2">
            <Avatar user={s.user} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{s.user.firstName} {s.user.lastName}</p>
              <p className="truncate text-xs text-slate-500">
                {s.recentHours}h in 4 weeks{unsocial === 'nights' ? ` · ${s.recentNights} nights` : unsocial ? ` · ${s.recentWeekends} weekends` : ''} · {s.weekHours}h this week
              </p>
            </div>
            <Button size="sm" variant="secondary" disabled={!!adding} loading={adding === s.user._id} onClick={() => add(s)}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Today's shifts below minimum staffing. Only shown when something needs action.
function StaffingAlert({ staffing, onChange }) {
  const problems = (staffing?.rows || []).filter((r) => r.status !== 'ok' && !r.ended);
  if (!problems.length) return null;
  return (
    <section className="mb-4 animate-slide-down rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" aria-label="Staffing today">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" /> Staffing today
          <span className="font-normal text-rose-700">· {problems.length} shift{problems.length > 1 ? 's' : ''} below minimum</span>
        </p>
        <Link to="/admin/rosters" className="inline-flex min-h-10 items-center text-xs font-semibold underline">Open rosters</Link>
      </div>
      <ul className={`mt-3 grid gap-3 ${problems.length > 1 ? 'lg:grid-cols-2' : ''} ${problems.length > 2 ? '2xl:grid-cols-3' : ''}`}>{problems.map((r) => (
        <li key={r.department + r.shiftType} className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{r.department} · {titleCase(r.shiftType)}</p>
              <p className="mt-0.5 text-xs text-rose-700">
                {r.status === 'under_rostered' ? `${r.rostered ? `Only ${r.rostered}` : 'Nobody'} rostered` : `${r.checkedIn} of ${r.rostered} rostered have checked in`}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-rose-800">
              {r.status === 'under_rostered' ? r.rostered : r.checkedIn} / {r.min} needed
            </span>
          </div>
          {r.status === 'under_rostered' && <CoverSuggestions row={r} onAdded={onChange} />}
        </li>
      ))}</ul>
    </section>
  );
}

export default function AdminDashboard() {
  const { data, loading, reload } = useFetch('/reports/dashboard');
  const navigate = useNavigate();
  const [pdfBusy, setPdfBusy] = useState(false);
  if (loading || !data) return <Spinner />;

  const remind = async (c) => {
    try { await api.post(`/certificates/${c._id}/remind`); toast.success(`Reminder sent to ${c.user.firstName}`); } catch (e) { toastError(e); }
  };
  const downloadReport = async () => {
    setPdfBusy(true);
    try {
      const f = { from: ymd(new Date(Date.now() - 30 * 86400000)), to: ymd(), department: '' };
      const { data: rep } = await api.get('/reports/punctuality', { params: f });
      await downloadPunctualityPdf(rep.rows.filter((r) => r.scheduled || r.onTime || r.late), f);
    } catch (e) { toastError(e); } finally { setPdfBusy(false); }
  };

  const certIssues = data.certificates.expired + data.certificates.expiring;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-slate-500">Staffing, attendance and compliance at Solucio Hospital.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => navigate('/admin/staff?new=1')}><Plus className="h-5 w-5" /> Add staff</Button>
          <Button size="lg" variant="secondary" loading={pdfBusy} onClick={downloadReport}><FileDown className="h-5 w-5" /> Download report</Button>
        </div>
      </div>

      <StaffingAlert staffing={data.staffing} onChange={reload} />

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard highlight title="Active staff" value={data.staff.active} to="/admin/staff" caption={`${data.staff.onLeave} on leave · ${data.staff.byDepartment.length} departments`} />
        <StatCard title="On duty today" value={`${data.today.clockedIn}/${data.today.scheduled}`} to="/admin/attendance" caption={`${data.today.late} late · ${data.today.notYetIn} not checked in${data.waitingAtDesk ? ` · ${data.waitingAtDesk} waiting at desk` : ''}`} />
        <StatCard title="Pending requests" value={data.requests.pending} to="/admin/requests?status=pending" caption="Awaiting a decision" />
        <StatCard title="Certificates" value={certIssues} to="/admin/certificates?status=expiring_soon" caption={`${data.certificates.expired} licences expired · ${data.certificates.expiring} expiring · ${data.certificates.pending} to approve`} />
      </div>

      <div className="stagger mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-[17px] font-medium text-slate-900"><Term>Check-ins this week</Term></h2>
              <p className="text-xs text-slate-500"><Term>Solid = checked in · striped = still to come</Term></p>
            </div>
            <CornerLink to="/admin/attendance?tab=records" label="Open attendance records" />
          </div>
          <WeekBars week={data.week} />
        </Panel>

        <div className="lg:col-span-3"><NextUp data={data} onRemind={remind} /></div>

        <Panel className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-medium text-slate-900"><Term>Requests</Term></h2>
            <Link to="/admin/requests" className="flex min-h-10 items-center rounded-full border border-slate-300 px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 desk:min-h-8">View all</Link>
          </div>
          {data.requests.recent.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No pending requests</p> : (
            <ul className="stagger space-y-3">
              {data.requests.recent.map((r) => {
                const [Icon, tone] = REQUEST_ICON[r.type] || REQUEST_ICON.other;
                return (
                  <li key={r._id}>
                    <Link to="/admin/requests?status=pending" className="flex min-h-11 items-start gap-3 rounded-xl py-1 transition-colors hover:bg-slate-50">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">{fullName(r.user)} · {titleCase(r.type)}</span>
                        <span className="block truncate text-xs text-slate-500"><RequestSummary r={r} /> · {timeAgo(r.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-4 lg:col-span-7">
        <Panel className="flex-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-medium text-slate-900"><Term>On duty now</Term></h2>
            <Link to="/admin/attendance" className="flex min-h-10 items-center rounded-full border border-slate-300 px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 desk:min-h-8">Duty board</Link>
          </div>
          {data.onDuty.length === 0 ? <p className="text-sm text-slate-500"><Term>Nobody is checked in right now.</Term></p> : (
            <ul className="stagger space-y-3">
              {data.onDuty.map((a) => (
                <li key={a._id}>
                  <Link to={`/admin/staff/${a.user?._id}`} className="flex items-center gap-3 rounded-xl transition-colors hover:bg-slate-50">
                    <Avatar user={a.user} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">{fullName(a.user)}</span>
                      <span className="block truncate text-xs text-slate-500">
                        Since {fmtTime(a.clockIn)} · {a.shift ? `${titleCase(a.shift.shiftType)} ${a.shift.startTime}–${a.shift.endTime}` : 'Unscheduled'}
                      </span>
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${a.status === 'late' ? 'border-amber-200 bg-amber-50 text-amber-800' : a.status === 'on_time' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-violet-200 bg-violet-50 text-violet-800'}`}>
                      {a.status === 'late' ? `Late ${a.lateMinutes}m` : a.status === 'on_time' ? 'On time' : 'Unscheduled'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

          {data.nextExpiring.length > 1 && (
            <Panel>
              <h2 className="mb-3 flex items-center gap-2 text-[17px] font-medium text-slate-900"><Award className="h-4 w-4 text-slate-500" /> Licences also expiring soon</h2>
              <ul className="stagger divide-y divide-slate-100">
                {data.nextExpiring.slice(1).map((c) => (
                  <li key={c._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span><b className="font-medium text-slate-900">{c.user.firstName}</b> · {c.title}</span>
                    <span className="text-slate-500">{fmtDate(c.expiryDate)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <Panel className="lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-medium text-slate-900"><Term>Punctuality</Term></h2>
            <CornerLink to="/admin/attendance?tab=punctuality" label="Open punctuality report" />
          </div>
          <PunctualityGauge totals={data.attendanceTotals} punctuality={data.punctuality30d} />
        </Panel>

      </div>

    </div>
  );
}
