import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, UserMinus, Users } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { Animated, Avatar, Badge, Card, Empty, PageHeader, ProgressBar, Spinner } from '../../components/ui';
import { fmtDate, fullName } from '../../lib/format';
import { Term } from '../../components/InfoTip';

const EXIT_LABEL = { contract_end: 'Contract ends', retirement: 'Retires', planned_exit: 'Leaving' };

function Kpi({ label, value, hint, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500"><Term>{label}</Term></p>
      <p className={`mt-2 text-4xl font-semibold tabular-nums tracking-tight ${tone}`}><Animated value={value} /></p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function PositionRow({ row }) {
  const [open, setOpen] = useState(false);
  const p = row.position;
  const filledPct = p.approvedHeadcount ? Math.min(100, (row.filled / p.approvedHeadcount) * 100) : 100;
  const hasDetail = row.leaving.length || row.certGaps.length || row.skillGaps.length || row.forecastGap > 0;
  return (
    <li className="rounded-2xl border border-slate-200 bg-white">
      <button type="button" onClick={() => hasDetail && setOpen(!open)} aria-expanded={hasDetail ? open : undefined}
        className={`flex w-full flex-wrap items-center gap-x-6 gap-y-3 p-4 text-left ${hasDetail ? 'hover:bg-slate-50' : 'cursor-default'}`}>
        <span className="min-w-48 flex-1">
          <span className="block font-semibold">{p.title}</span>
          <span className="block text-xs text-slate-500">{p.department}{p.grade && ` · ${p.grade.code}`}</span>
        </span>
        <span className="w-40">
          <span className="mb-1 flex justify-between text-xs text-slate-500"><span>In post</span><span className="font-semibold text-slate-800">{row.filled}/{row.approved}</span></span>
          <ProgressBar value={filledPct} />
        </span>
        <span className="flex flex-wrap gap-1.5">
          {row.vacancies > 0 && <Badge color="amber">{`${row.vacancies} vacant`}</Badge>}
          {row.overstaffed > 0 && <Badge color="purple">{`${row.overstaffed} over establishment`}</Badge>}
          {row.leaving.length > 0 && <Badge color="red">{`${row.leaving.length} leaving`}</Badge>}
          {row.openRequisitions > 0 && <Badge color="blue">{`${row.openRequisitions} being recruited`}</Badge>}
          {row.certGaps.length > 0 && <Badge color="red">{`${row.certGaps.reduce((n, g) => n + g.missing.length, 0)} cert gaps`}</Badge>}
        </span>
        <span className="ml-auto text-right">
          <span className={`block text-2xl font-semibold tabular-nums ${row.forecastGap ? 'text-rose-600' : 'text-emerald-600'}`}>{row.forecastGap}</span>
          <span className="block text-xs text-slate-500">to find</span>
        </span>
        {hasDetail ? <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} /> : <span className="w-4" />}
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden" inert={!open}>
          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 p-4 md:grid-cols-3">
            <div>
              <p className="label"><Term>Leaving within horizon</Term></p>
              {row.leaving.length === 0 ? <p className="text-sm text-slate-500"><Term>None</Term></p> : row.leaving.map((l) => (
                <Link key={l.user._id} to={`/admin/staff/${l.user._id}`} className="mb-1.5 flex items-center gap-2 text-sm hover:text-brand-700">
                  <Avatar user={l.user} size="sm" /><span>{fullName(l.user)} <span className="text-slate-500">· {EXIT_LABEL[l.type]} {fmtDate(l.date)}</span></span>
                </Link>
              ))}
            </div>
            <div>
              <p className="label"><Term>Missing required certificates</Term></p>
              {row.certGaps.length === 0 ? <p className="text-sm text-slate-500"><Term>All held</Term></p> : row.certGaps.map((g) => (
                <p key={g.title} className="mb-1.5 text-sm"><b>{g.title}:</b> {g.missing.map(fullName).join(', ')}{' '}
                  <Link className="font-semibold text-brand-700 hover:underline" to={`/admin/certificates?title=${encodeURIComponent(g.title)}&holders=missing`}>Request</Link></p>
              ))}
            </div>
            {row.forecastGap > 0 && (
              <div className="md:col-span-3">
                <Link to={`/admin/recruitment?position=${row.position._id}`} className="inline-flex min-h-10 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
                  Open a requisition for {row.forecastGap} {row.position.title}{row.forecastGap > 1 ? 's' : ''}
                </Link>
              </div>
            )}
            <div>
              <p className="label"><Term>Skill gaps (below level 3)</Term></p>
              {row.skillGaps.length === 0 ? <p className="text-sm text-slate-500"><Term>None</Term></p> : row.skillGaps.map((g) => <p key={g.skill} className="text-sm">{g.skill}: {g.missing} {g.missing === 1 ? 'person' : 'people'}</p>)}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function WorkforcePlan() {
  const [horizon, setHorizon] = useState(6);
  const { data, loading } = useFetch('/org/workforce', { params: { horizon } });
  const { data: skills } = useFetch('/org/skills', { initial: [] });
  if (loading && !data) return <Spinner />;
  if (!data) return <Empty title="No plan available" />;
  const t = data.totals;

  return (
    <div>
      <PageHeader title="Workforce plan" subtitle="Are the right people, with the right skills, in place now and over the coming months?"
        actions={<label className="flex items-center gap-2 text-sm text-slate-600">Plan for
          <select className="input w-auto" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            {[3, 6, 12, 24].map((m) => <option key={m} value={m}>next {m} months</option>)}
          </select></label>} />

      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Establishment" value={t.approved} hint="Approved posts" />
        <Kpi label="In post" value={t.filled} hint={`${t.vacancyRate}% vacancy rate`} />
        <Kpi label="Vacant posts" value={t.vacancies} tone={t.vacancies ? 'text-amber-600' : 'text-emerald-600'} />
        <Kpi label={`Leaving in ${data.horizonMonths} months`} value={t.leaving} tone={t.leaving ? 'text-rose-600' : 'text-slate-900'} hint="Contracts, retirements, resignations" />
        <Kpi label="Still to recruit" value={t.forecastGap} tone={t.forecastGap ? 'text-rose-600' : 'text-emerald-600'} hint={`After ${t.openRequisitions} open requisition(s)`} />
      </div>

      <Card className="mt-6" title="By department" bodyClass="p-0">
        <div className="overflow-x-auto"><table className="table">
          <thead><tr><th><Term>Department</Term></th><th><Term>In post</Term></th><th><Term>Vacant</Term></th><th><Term>Leaving</Term></th><th><Term>To recruit</Term></th><th><Term>Cert gaps</Term></th><th><Term>Rostered hrs/person/wk</Term></th></tr></thead>
          <tbody>{data.departments.map((d) => (
            <tr key={d.department}>
              <td className="font-semibold">{d.department}</td>
              <td>{d.filled}/{d.approved}</td>
              <td className={d.vacancies ? 'font-semibold text-amber-700' : ''}>{d.vacancies}</td>
              <td className={d.leaving ? 'font-semibold text-rose-600' : ''}>{d.leaving}</td>
              <td className={d.forecastGap ? 'font-semibold text-rose-600' : 'text-emerald-700'}>{d.forecastGap}</td>
              <td>{d.certGapPeople ? `${d.certGapPeople} people` : '—'}</td>
              <td>{d.weeklyHoursPerPerson == null ? '—' : (
                <span className={`inline-flex items-center gap-1 ${d.overWorkingTime ? 'font-semibold text-rose-600' : ''}`}>
                  {d.overWorkingTime && <AlertTriangle className="h-3.5 w-3.5" />}{d.weeklyHoursPerPerson}h{d.overWorkingTime && ` (> ${data.maxWeeklyHours}h)`}
                </span>
              )}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold"><Term>Positions</Term></h2>
        <span className="text-xs text-slate-500">Tap a position for who's leaving and the gaps</span>
      </div>
      {data.positions.length === 0 ? <Card className="mt-3"><Empty title="No positions defined">Add positions under Organisation to start planning.</Empty></Card> : (
        <ul className="stagger mt-3 space-y-2">{data.positions.map((r) => <PositionRow key={r.position._id} row={r} />)}</ul>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Skills inventory" bodyClass="p-0">
          {skills.length === 0 ? <Empty title="No skills recorded">Staff add skills on their profile; HR can add them on staff records.</Empty> : (
            <ul className="divide-y divide-slate-100">
              {skills.slice(0, 12).map((s) => (
                <li key={s.name} className="flex items-center gap-4 px-5 py-3">
                  <span className="flex-1 font-medium">{s.name}</span>
                  <span className="text-sm text-slate-500">{s.people} {s.people === 1 ? 'person' : 'people'} · {s.experts} expert</span>
                  <span className="w-24"><ProgressBar value={(s.avgLevel / 5) * 100} tone="bg-brand-500" /></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Not in a position (${data.unassigned.length})`} bodyClass="p-0">
          {data.unassigned.length === 0 ? <Empty icon={Users} title="Everyone is in a position" /> : (
            <ul className="divide-y divide-slate-100">
              {data.unassigned.map((u) => (
                <li key={u._id}><Link to={`/admin/staff/${u._id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <UserMinus className="h-4 w-4 text-slate-500" /><span className="flex-1">{fullName(u)}</span><span className="text-sm text-slate-500">{u.jobTitle || '—'} · {u.department || '—'}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
