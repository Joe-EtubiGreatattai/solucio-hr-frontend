import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useFetch from '../../lib/useFetch';
import { Button, Card, Empty, PageHeader, Spinner } from '../../components/ui';
import { fmtMoney, titleCase } from '../../lib/format';
import { enpsText } from '../../lib/engagement';
import { PARTS, splitCost } from '../../lib/payCost';
import { Term } from '../../components/InfoTip';

const PALETTE = ['#0b3b38', '#129d8f', '#5fd0c2', '#f59e0b', '#8b5cf6', '#0ea5e9', '#f43f5e', '#94a3b8'];
const short = (p) => `${new Date(p.slice(0, 4), p.slice(5, 7) - 1).toLocaleDateString(undefined, { month: 'short' })} ’${p.slice(2, 4)}`;
const axis = { tick: { fontSize: 12 }, tickLine: false, axisLine: false };

// A headline number with a plain-English benchmark, so it reads without a manual.
function Kpi({ label, value, hint, tone, to }) {
  const body = (
    <>
      <p className="text-sm text-slate-500"><Term>{label}</Term></p>
      <p className={`mt-1 text-2xl font-semibold ${tone === 'bad' ? 'text-rose-600' : tone === 'good' ? 'text-emerald-700' : 'text-slate-900'}`}>{value ?? '—'}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </>
  );
  return to ? <Link to={to} className="card lift block p-4">{body}</Link> : <div className="card p-4">{body}</div>;
}

function Section({ title, children }) {
  return <section className="mb-8 break-inside-avoid"><h2 className="mb-3 text-lg font-semibold"><Term>{title}</Term></h2>{children}</section>;
}

function Donut({ data, dataKey = 'count' }) {
  const rows = data.filter((d) => d[dataKey] > 0);
  if (!rows.length) return <Empty title="No data" />;
  return (
    <div className="h-56"><ResponsiveContainer><PieChart>
      <Pie data={rows} dataKey={dataKey} nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>{rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie>
      <Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
    </PieChart></ResponsiveContainer></div>
  );
}

function Bars({ data, dataKey = 'count', name = 'Staff', vertical, height = 'h-56' }) {
  return (
    <div className={height}><ResponsiveContainer>
      {vertical ? (
        <BarChart data={data} layout="vertical" margin={{ left: 8 }}><XAxis type="number" hide allowDecimals={false} /><YAxis type="category" dataKey="name" width={110} {...axis} /><Tooltip /><Bar dataKey={dataKey} name={name} fill="#129d8f" radius={[0, 6, 6, 0]} /></BarChart>
      ) : (
        <BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" {...axis} /><YAxis allowDecimals={false} width={28} {...axis} /><Tooltip /><Bar dataKey={dataKey} name={name} fill="#129d8f" radius={[6, 6, 0, 0]} /></BarChart>
      )}
    </ResponsiveContainer></div>
  );
}

export default function Analytics() {
  const [dept, setDept] = useState('');
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] }, live: false });
  const { data: a, loading } = useFetch('/analytics/overview', { params: { department: dept || undefined } });
  if (loading && !a) return <Spinner />;
  if (!a) return <Empty title="Analytics unavailable" />;
  const { workforce: w, recruitment: r, attendance: t, learning: l, performance: p, pay, engagement: e, relations: rel } = a;
  const pct = (v) => (v == null ? '—' : `${v}%`);

  return (
    <div>
      <PageHeader title="HR analytics" subtitle={`Workforce, hiring, attendance, learning, performance, pay and engagement in one place${dept ? ` · ${dept}` : ''}.`}
        actions={<div className="flex flex-wrap gap-2 print:hidden">
          <select className="input w-auto" aria-label="Department" value={dept} onChange={(ev) => setDept(ev.target.value)}><option value="">Whole hospital</option>{meta.departments.map((d) => <option key={d}>{d}</option>)}</select>
          <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</Button>
        </div>} />

      <Section title="Workforce">
        <div className="stagger mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Headcount" value={w.headcount} hint={`${w.hires12} hired, ${w.exits12} left in 12 months`} to="/admin/staff" />
          <Kpi label="Turnover (12 mo)" value={pct(w.turnoverRate)} hint="Healthcare benchmark ~15–20%" tone={w.turnoverRate > 20 ? 'bad' : w.turnoverRate != null && w.turnoverRate <= 15 ? 'good' : undefined} />
          <Kpi label="Voluntary turnover" value={pct(w.voluntaryTurnoverRate)} hint="Resignations and retirements" tone={w.voluntaryTurnoverRate > 15 ? 'bad' : undefined} />
          <Kpi label="Retention" value={pct(w.retentionRate)} hint="Of those here a year ago" tone={w.retentionRate >= 85 ? 'good' : w.retentionRate != null && w.retentionRate < 75 ? 'bad' : undefined} />
          <Kpi label="Left in first year" value={pct(w.earlyTurnover)} hint="Share of leavers" tone={w.earlyTurnover > 30 ? 'bad' : undefined} />
          <Kpi label="Average tenure" value={w.avgTenureYears != null ? `${w.avgTenureYears} yrs` : '—'} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Headcount, hires and leavers" className="lg:col-span-2">
            <div className="h-64"><ResponsiveContainer><ComposedChart data={w.trend.map((m) => ({ ...m, label: short(m.period) }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" {...axis} />
              <YAxis yAxisId="h" allowDecimals={false} width={28} {...axis} /><YAxis yAxisId="m" orientation="right" allowDecimals={false} width={28} {...axis} /><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area yAxisId="h" dataKey="headcount" name="Headcount" fill="#ccefe9" stroke="#129d8f" strokeWidth={2} />
              <Bar yAxisId="m" dataKey="hires" name="Hires" fill="#0b3b38" radius={[4, 4, 0, 0]} /><Bar yAxisId="m" dataKey="exits" name="Leavers" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </ComposedChart></ResponsiveContainer></div>
          </Card>
          <Card title="By department"><Bars data={w.byDepartment} vertical /></Card>
          <Card title="Gender"><Donut data={w.byGender} /></Card>
          <Card title="Age"><Bars data={w.byAge} /></Card>
          <Card title="Length of service"><Bars data={w.byTenure} /></Card>
        </div>
      </Section>

      <Section title="Hiring">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-3 lg:col-span-1">
            <Kpi label="Open roles" value={r.openRoles} to="/admin/recruitment" />
            <Kpi label="Applicants (12 mo)" value={r.applicants12} />
            <Kpi label="Time to hire" value={r.avgTimeToHireDays != null ? `${Math.round(r.avgTimeToHireDays)} days` : '—'} hint="Advert to hire" tone={r.avgTimeToHireDays > 45 ? 'bad' : undefined} />
            <Kpi label="Offer acceptance" value={pct(r.offerAcceptance)} tone={r.offerAcceptance != null && r.offerAcceptance < 70 ? 'bad' : undefined} />
          </div>
          <Card title="Where applicants come from" className="lg:col-span-2">{r.bySource.length ? (
            <div className="h-56"><ResponsiveContainer><BarChart data={r.bySource.map((s) => ({ ...s, name: titleCase(s.name) }))}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" {...axis} /><YAxis allowDecimals={false} width={28} {...axis} /><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" name="Applicants" fill="#5fd0c2" radius={[6, 6, 0, 0]} /><Bar dataKey="hires" name="Hired" fill="#0b3b38" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
          ) : <Empty title="No applications yet" />}</Card>
        </div>
      </Section>

      <Section title="Attendance & leave (last 30 days / 12 months)">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-3">
            <Kpi label="Absenteeism" value={pct(t.absenteeismRate)} hint="Rostered shifts missed" tone={t.absenteeismRate > 5 ? 'bad' : 'good'} to="/admin/attendance" />
            <Kpi label="Punctuality" value={pct(t.punctualityRate)} hint={`Late arrivals average ${t.avgLateMinutes} min`} tone={t.punctualityRate != null && t.punctualityRate < 85 ? 'bad' : 'good'} />
            <Kpi label="Hours worked" value={t.hoursWorked.toLocaleString()} hint={`${t.shiftsScheduled} shifts rostered`} />
            <Kpi label="Leave taken (12 mo)" value={`${t.leaveDays12} days`} />
            <Kpi label="Sick days per head" value={t.sickDaysPerHead} hint="12 months" tone={t.sickDaysPerHead > 8 ? 'bad' : undefined} />
          </div>
          <Card title="Leave by type">{t.leaveByType.length ? <Donut data={t.leaveByType.map((x) => ({ ...x, name: titleCase(x.name) }))} dataKey="days" /> : <Empty title="No leave taken" />}</Card>
        </div>
      </Section>

      <Section title="Learning, compliance & performance">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Mandatory training" value={pct(l.trainingCompliance)} hint="Target 95%" tone={l.trainingCompliance >= 95 ? 'good' : 'bad'} to="/admin/training?tab=matrix" />
            <Kpi label="Certificates expired" value={l.certificatesExpired} tone={l.certificatesExpired ? 'bad' : 'good'} to="/admin/certificates" />
            <Kpi label="Expiring in 60 days" value={l.certificatesExpiring60} tone={l.certificatesExpiring60 ? undefined : 'good'} />
            <Kpi label="Goals achieved" value={pct(p.goalCompletion)} hint="Due in the last 12 months" />
          </div>
          <Card title={`Performance ratings (${p.reviewed} reviewed${p.averageRating ? `, average ${p.averageRating}` : ''})`} className="lg:col-span-2">
            <Bars data={p.distribution.map((d) => ({ name: ['', 'Unsatisfactory', 'Needs improvement', 'Meets', 'Exceeds', 'Outstanding'][d.rating], count: d.count }))} />
          </Card>
        </div>
      </Section>

      <Section title="Pay">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Kpi label="Employer cost last payroll" value={fmtMoney(pay.lastMonthCost)} to="/admin/payroll" />
            <Kpi label="Cost per employee" value={fmtMoney(pay.costPerHead)} hint="Monthly, incl. pension & levies" />
          </div>
          <Card title="Payroll cost by month" className="lg:col-span-2">{pay.trend.length ? (
            <>
            <p className="mb-3 text-sm text-slate-600">Each bar is the hospital’s <b>total cost</b> for that month, split into what staff take home, what is deducted from their pay and passed on, and the hospital’s own extras.</p>
            <div className="h-64"><ResponsiveContainer><BarChart data={pay.trend.map((m) => ({ label: short(m.period), ...splitCost(m), total: m.employerCost }))}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" {...axis} /><YAxis width={56} tickFormatter={(v) => `₦${Math.round(v / 1e6)}m`} {...axis} />
              <Tooltip formatter={(v) => fmtMoney(v)} labelFormatter={(l, p) => `${l} · total ${fmtMoney(p?.[0]?.payload.total)}`} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              {PARTS.map((part, i) => <Bar key={part.key} dataKey={part.key} name={part.label} stackId="cost" fill={part.hex} radius={i === PARTS.length - 1 ? [6, 6, 0, 0] : 0} />)}
            </BarChart></ResponsiveContainer></div>
            </>
          ) : <Empty title="No approved payrolls yet" />}{pay.note && <p className="mt-2 text-xs text-slate-500">{pay.note}</p>}</Card>
        </div>
      </Section>

      <Section title="Engagement, retention & relations">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
            <Kpi label="eNPS" value={enpsText(e.enps)} hint={e.enpsFrom || e.latestSurvey?.title || 'No survey yet'} tone={e.enps > 10 ? 'good' : e.enps != null && e.enps < 0 ? 'bad' : undefined} to="/admin/engagement" />
            <Kpi label="Survey response rate" value={pct(e.participation)} hint={e.latestSurvey?.title} tone={e.participation != null && e.participation < 60 ? 'bad' : undefined} />
            <Kpi label="High flight risk" value={e.flightRisk.high} hint={`${e.flightRisk.medium} medium · ${e.flightRisk.highPerformersAtRisk} strong performers`} tone={e.flightRisk.high ? 'bad' : 'good'} to="/admin/engagement?tab=retention" />
            <Kpi label="Open ER cases" value={rel.openCases} hint={`${rel.grievances12} grievances, ${rel.activeWarnings} live warnings`} to="/admin/relations" />
          </div>
          <Card title={`Themes: ${e.latestSurvey?.title || 'latest survey'}`}>{e.themes?.length ? (
            <ul className="space-y-3">{[...e.themes].sort((x, y) => x.favourable - y.favourable).map((th) => (
              <li key={th.theme}><div className="mb-1 flex justify-between text-sm"><span>{titleCase(th.theme)}</span><span className="font-semibold">{th.favourable}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${th.favourable >= 70 ? 'bg-emerald-500' : th.favourable >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${th.favourable}%` }} /></div></li>
            ))}</ul>
          ) : <Empty title={e.hidden ? 'Too few responses to show' : 'No themes yet'} />}</Card>
        </div>
        <p className="mt-6 text-xs text-slate-500">Generated {new Date(a.generatedAt).toLocaleString()}. Small groups are suppressed in survey data to protect anonymity.</p>
      </Section>
    </div>
  );
}
