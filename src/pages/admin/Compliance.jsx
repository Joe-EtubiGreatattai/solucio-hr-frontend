import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Clock, FileCheck2, ShieldAlert, UserX } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { useMounted } from '../../lib/motion';
import { Animated, Avatar, Card, Empty, PageHeader, ProgressBar, Spinner } from '../../components/ui';
import { fmtDate, fullName } from '../../lib/format';
import { Term } from '../../components/InfoTip';

function ScoreRing({ score }) {
  const ready = useMounted(80);
  const R = 52, C = 2 * Math.PI * R;
  const tone = score >= 85 ? 'stroke-emerald-500' : score >= 65 ? 'stroke-amber-500' : 'stroke-rose-500';
  return (
    <div className="relative h-36 w-36 shrink-0" role="img" aria-label={`Compliance score ${score}%`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" strokeWidth="12" className="stroke-white/20" />
        <circle cx="60" cy="60" r={R} fill="none" strokeWidth="12" strokeLinecap="round" className={`${tone} transition-all duration-1000 ease-out`}
          strokeDasharray={C} strokeDashoffset={ready ? C * (1 - score / 100) : C} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-semibold"><Animated value={score} />%</span></div>
    </div>
  );
}

function Meter({ icon: Icon, label, rate, detail, to }) {
  return (
    <Link to={to} className="lift block rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-slate-500"><Icon className="h-4 w-4" /><Term>{label}</Term></div>
      <p className={`mt-2 text-4xl font-semibold tabular-nums ${rate >= 85 ? 'text-emerald-600' : rate >= 65 ? 'text-amber-600' : 'text-rose-600'}`}><Animated value={rate} />%</p>
      <div className="mt-3"><ProgressBar value={rate} /></div>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </Link>
  );
}

const PersonLine = ({ user, right, to }) => (
  <li><Link to={to || `/admin/staff/${user._id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
    <Avatar user={user} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{fullName(user)}</span><span className="block truncate text-xs text-slate-500">{user.jobTitle || '—'} · {user.department || '—'}</span></span>
    <span className="shrink-0 text-right text-sm">{right}</span>
  </Link></li>
);

export default function Compliance() {
  const { data, loading } = useFetch('/compliance/overview');
  if (loading && !data) return <Spinner />;
  if (!data) return <Empty title="Couldn't load compliance" />;
  const issues = data.certificates.gaps.length + data.contractsEnding.length + data.probationsEnding.length + data.missingRecords.length + data.workingTime.overWorked.length + data.safety.openIncidents + data.safety.openSafetyReports;

  return (
    <div>
      <PageHeader title="Compliance" subtitle="Policies, mandatory certificates, employment deadlines, records and working time in one place." />
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-4">
        <section className="flex items-center gap-5 rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-5 text-white shadow-sm lg:col-span-2">
          <ScoreRing score={data.score} />
          <div>
            <h2 className="text-lg font-medium"><Term>Compliance score</Term></h2>
            <p className="mt-1 text-sm text-white/80">Average of policy acknowledgement and required certificates{data.training ? ' and mandatory training' : ''}.</p>
            <p className="mt-3 text-sm"><b>{issues}</b> item{issues === 1 ? '' : 's'} need attention below.</p>
          </div>
        </section>
        <Meter icon={FileCheck2} label="Policies acknowledged" rate={data.policies.rate} detail={`${data.policies.rows.length} policies need acknowledgement`} to="/admin/policies" />
        <Meter icon={ShieldAlert} label="Required certificates held" rate={data.certificates.rate} detail={`${data.certificates.met}/${data.certificates.required} · ${data.certificates.expired} expired · ${data.certificates.unverified} to verify`} to="/admin/certificates" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Policy acknowledgement" bodyClass="p-0">
          {data.policies.rows.length === 0 ? <Empty title="No policies need acknowledgement" /> : (
            <ul className="divide-y divide-slate-100">{data.policies.rows.map((p) => (
              <li key={p._id}><Link to="/admin/policies" className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.title} <span className="text-xs text-slate-500">v{p.version}</span></span>
                  {p.reviewOverdue && <span className="text-xs font-semibold text-amber-700">Review overdue</span>}</span>
                <span className="w-28"><ProgressBar value={p.rate} /></span><span className="w-20 text-right text-sm">{p.acknowledged}/{p.audience}</span>
              </Link></li>
            ))}</ul>
          )}
        </Card>

        <Card title={`Missing required certificates (${data.certificates.gaps.length})`} bodyClass="p-0">
          {data.certificates.gaps.length === 0 ? <Empty title="Everyone holds what their position requires" /> : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">{data.certificates.gaps.map((g, i) => (
              <PersonLine key={i} user={g.user} to={`/admin/certificates?title=${encodeURIComponent(g.certificate)}&holders=missing`}
                right={<><span className="block font-medium text-rose-600">{g.certificate}</span><span className="text-xs text-slate-500">{g.position}</span></>} />
            ))}</ul>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Contracts ending in 60 days</span>} bodyClass="p-0">
          {data.contractsEnding.length === 0 ? <Empty title="None" /> : <ul className="divide-y divide-slate-100">{data.contractsEnding.map((c) => (
            <PersonLine key={c.user._id} user={c.user} right={<span className={c.overdue ? 'font-semibold text-rose-600' : 'text-slate-700'}>{c.overdue ? 'Ended ' : ''}{fmtDate(c.date)}</span>} />
          ))}</ul>}
        </Card>

        <Card title={<span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Probation reviews due in 30 days</span>} bodyClass="p-0">
          {data.probationsEnding.length === 0 ? <Empty title="None" /> : <ul className="divide-y divide-slate-100">{data.probationsEnding.map((c) => (
            <PersonLine key={c.user._id} user={c.user} right={<span className={c.overdue ? 'font-semibold text-rose-600' : 'text-slate-700'}>{c.overdue ? 'Overdue · ' : ''}{fmtDate(c.date)}</span>} />
          ))}</ul>}
        </Card>

        <Card title={<span className="flex items-center gap-2"><UserX className="h-4 w-4" /> Incomplete personnel records ({data.missingRecords.length})</span>} bodyClass="p-0">
          {data.missingRecords.length === 0 ? <Empty title="All records complete" /> : <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">{data.missingRecords.map((r) => (
            <PersonLine key={r.user._id} user={r.user} right={<span className="text-xs text-amber-700">Missing {r.missing.join(', ')}</span>} />
          ))}</ul>}
        </Card>

        <Card title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Safety & working time</span>}>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/admin/notes" className="rounded-2xl bg-slate-50 p-4 hover:bg-slate-100"><p className="text-3xl font-semibold">{data.safety.openIncidents}</p><p className="text-sm text-slate-500"><Term>Open incident reports</Term></p></Link>
            <Link to="/admin/anonymous" className="rounded-2xl bg-slate-50 p-4 hover:bg-slate-100"><p className="text-3xl font-semibold">{data.safety.openSafetyReports}</p><p className="text-sm text-slate-500"><Term>Open safety concerns</Term></p></Link>
          </div>
          <p className="mb-2 mt-5 label">Over {data.workingTime.limit} hours a week (last 4 weeks)</p>
          {data.workingTime.overWorked.length === 0 ? <p className="text-sm text-slate-500"><Term>Nobody is over the limit.</Term></p> : (
            <ul className="divide-y divide-slate-100">{data.workingTime.overWorked.map((w) => <PersonLine key={w.user._id} user={w.user} right={<b className="text-rose-600">{w.weeklyHours}h/wk</b>} />)}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
