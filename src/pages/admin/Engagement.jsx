import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle, DoorOpen, Flame, HeartPulse, Plus, Smile, Star, UserMinus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, ProgressBar, Spinner, StatCard, Tabs } from '../../components/ui';
import { fmtDate, fullName, titleCase, ymd } from '../../lib/format';
import { EXIT_RATING_LABEL, EXIT_REASON_LABEL, EXIT_TYPE_LABEL, OWNER_LABEL } from '../../lib/exits';
import SurveyBuilder from '../../components/SurveyBuilder';
import { SURVEY_STATUS } from '../../lib/engagement';
import { Term } from '../../components/InfoTip';

// ---------------- Surveys ----------------
function Surveys() {
  const navigate = useNavigate();
  const { data: surveys, loading, reload } = useFetch('/engagement/surveys', { initial: [] });
  const { data: meta } = useFetch('/engagement/meta', { initial: null, live: false });
  const [building, setBuilding] = useState(null);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Start from a template, then edit the questions before launching.</p>
        <div className="flex flex-wrap gap-2">{meta?.templates.map((t) => <Button key={t.key} size="sm" variant="secondary" onClick={() => setBuilding({ ...t, title: `${t.title} · ${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`, anonymous: true, audience: { scope: 'all' } })}><Plus className="h-4 w-4" /> {t.title}</Button>)}</div>
      </div>
      {loading ? <Spinner /> : surveys.length === 0 ? <Card><Empty icon={HeartPulse} title="No surveys yet" /></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{surveys.map((s) => (
          <Link key={s._id} to={`/admin/engagement/surveys/${s._id}`} className="card lift block p-5">
            <div className="flex flex-wrap gap-2"><Badge color={SURVEY_STATUS[s.status][1]}>{SURVEY_STATUS[s.status][0]}</Badge>{s.anonymous && <Badge color="teal">Anonymous</Badge>}</div>
            <h3 className="mt-2 font-semibold">{s.title}</h3>
            <p className="text-xs text-slate-500">{s.questions.length} questions{s.opensAt ? ` · opened ${fmtDate(s.opensAt)}` : ''}</p>
            {s.status !== 'draft' && <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-slate-50 p-2"><p className="text-xs text-slate-500"><Term>Response rate</Term></p><p className="font-semibold">{s.participation ?? 0}% <span className="font-normal text-slate-500">({s.responded}/{s.invited})</span></p></div>
              <div className="rounded-xl bg-slate-50 p-2"><p className="text-xs text-slate-500"><Term>eNPS</Term></p><p className="font-semibold">{s.enps == null ? '—' : s.enps > 0 ? `+${s.enps}` : s.enps}</p></div>
            </div>}
          </Link>
        ))}</div>
      )}
      {building && <SurveyBuilder initial={building} onClose={() => setBuilding(null)} onSaved={(s) => { setBuilding(null); reload(); navigate(`/admin/engagement/surveys/${s._id}`); }} />}
    </>
  );
}

// ---------------- Retention ----------------
const ACTION = { pay: 'Review pay against the band', tenure: 'Check in on how they are settling', performance: 'Agree a development plan', attendance: 'Have a supportive return-to-work chat', workload: 'Look at their rota and hours',
  requests: 'Revisit the declined requests', growth: 'Offer a course or new responsibility', relations: 'Resolve the open issue quickly', warning: 'Check they have the support to improve', contract: 'Decide on renewal and tell them early' };

function Retention() {
  const { data, loading } = useFetch('/engagement/retention');
  const [level, setLevel] = useState('risk');
  if (loading && !data) return <Spinner />;
  const rows = data.rows.filter((r) => (level === 'all' ? true : level === 'risk' ? r.level !== 'low' : r.highPerformer));
  return (
    <>
      <div className="stagger mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="High flight risk" value={data.summary.high} icon={Flame} tone={data.summary.high ? 'red' : 'green'} />
        <StatCard label="Medium risk" value={data.summary.medium} icon={AlertTriangle} tone="amber" />
        <StatCard label="Strong performers at risk" value={data.summary.highPerformersAtRisk} icon={Star} tone="purple" hint="Rated 4+ with risk signals" />
      </div>
      <p className="mb-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">Signals come from pay, reviews, attendance, declined requests, training, cases and contract dates. They're a prompt for a <b>stay conversation</b>, not a judgement, and staff never see them.</p>
      <div className="mb-4 flex flex-wrap gap-2">{[['risk', 'At risk'], ['performers', 'Strong performers'], ['all', 'Everyone']].map(([k, l]) => <Button key={k} size="sm" variant={level === k ? 'primary' : 'secondary'} onClick={() => setLevel(k)}>{l}</Button>)}</div>
      <Card bodyClass="p-0">{rows.length === 0 ? <Empty icon={Smile} title="Nobody shows risk signals" /> : (
        <ul className="divide-y divide-slate-100">{rows.map((r) => (
          <li key={r.user._id} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[16rem_10rem_1fr]">
            <Link to={`/admin/staff/${r.user._id}`} className="flex items-center gap-3"><Avatar user={r.user} size="sm" /><span><span className="flex items-center gap-1 font-medium">{fullName(r.user)}{r.highPerformer && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Strong performer" />}</span><span className="text-xs text-slate-500">{r.user.jobTitle} · {r.tenureMonths} months</span></span></Link>
            <div><div className="mb-1 flex items-center justify-between text-xs"><Badge color={{ high: 'red', medium: 'amber', low: 'green' }[r.level]}>{titleCase(r.level)}</Badge><span className="text-slate-500">{r.score}/100</span></div>
              <ProgressBar value={r.score} tone={{ high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-emerald-500' }[r.level]} />{r.leaving && <span className="mt-1 block text-xs text-rose-600">Already leaving</span>}</div>
            <div>{r.factors.length === 0 ? <span className="text-sm text-slate-500">No signals</span> : <ul className="space-y-1">{r.factors.map((f) => <li key={f.label} className="text-sm"><span className="text-slate-800">{f.label}</span> <span className="text-xs text-brand-700">→ {ACTION[f.area]}</span></li>)}</ul>}</div>
          </li>
        ))}</ul>
      )}</Card>
    </>
  );
}

// ---------------- Exits ----------------
function StartExit({ onClose, onDone }) {
  const { data: staff } = useFetch('/users/directory', { initial: [] });
  const [f, setF] = useState({ user: '', type: 'resignation', lastDay: ymd(new Date(Date.now() + 30 * 86400000)), reasonCategory: '', reason: '', regrettable: false, rehireEligible: true });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => { e.preventDefault(); try { await api.post('/engagement/exits', f); toast.success('Exit started; checklist created'); onDone(); } catch (err) { toastError(err); } };
  return (
    <Modal open onClose={onClose} title="Start an exit" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="exit-form">Start exit</Button></>}>
      <form id="exit-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Employee" className="sm:col-span-2"><select className="input" required value={f.user} onChange={set('user')}><option value="">Choose…</option>{staff.map((s) => <option key={s._id} value={s._id}>{fullName(s)} · {s.department}</option>)}</select></Field>
        <Field label="Type"><select className="input" value={f.type} onChange={set('type')}>{Object.entries(EXIT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Last working day"><input type="date" className="input" required value={f.lastDay} onChange={set('lastDay')} /></Field>
        <Field label="Main reason"><select className="input" value={f.reasonCategory} onChange={set('reasonCategory')}><option value="">Unknown</option>{Object.entries(EXIT_REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Notes"><input className="input" value={f.reason} onChange={set('reason')} /></Field>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={f.regrettable} onChange={set('regrettable')} /> Regrettable loss</label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={f.rehireEligible} onChange={set('rehireEligible')} /> Eligible for rehire</label>
      </form>
    </Modal>
  );
}

function ExitDetail({ id, onClose, onChanged }) {
  const { data: e, reload } = useFetch(`/engagement/exits/${id}`);
  const ask = useConfirm();
  const [task, setTask] = useState('');
  if (!e) return <Modal open onClose={onClose} title="Exit"><Spinner /></Modal>;
  const run = async (fn, msg) => { try { await fn(); toast.success(msg); reload(); onChanged(); } catch (err) { toastError(err); } };
  const toggle = (t) => run(() => api.put(`/engagement/exits/${id}/checklist/${t._id}`, { done: !t.done }), t.done ? 'Marked not done' : 'Done');
  const complete = async () => {
    const early = new Date(e.lastDay) > new Date();
    if (!(await ask({ title: `Complete ${e.user.firstName}'s exit?`, message: `Their account is deactivated, benefits end${e.directReports ? `, and ${e.directReports} direct report(s) need a new manager` : ''}.${early ? ' Their last day has not passed yet.' : ''}`, confirmLabel: 'Complete exit', tone: 'danger' }))) return;
    run(() => api.post(`/engagement/exits/${id}/complete`, { force: early }), 'Exit completed');
  };
  const cancel = async () => { if (await ask({ title: 'Cancel this exit?', message: `${e.user.firstName} stays employed and is told.`, confirmLabel: 'Cancel exit' })) run(() => api.post(`/engagement/exits/${id}/cancel`, {}), 'Exit cancelled'); };
  const iv = e.interview;
  const active = ['requested', 'in_progress'].includes(e.status);
  return (
    <Modal open onClose={onClose} title={`${fullName(e.user)} · ${EXIT_TYPE_LABEL[e.type]}`} size="xl"
      footer={active && <>{<Button variant="ghost" onClick={cancel}>Cancel exit</Button>}{e.status === 'requested' ? <Button onClick={() => run(() => api.post(`/engagement/exits/${id}/accept`, {}), 'Resignation accepted')}>Accept resignation</Button> : <Button variant="danger" onClick={complete}><UserMinus className="h-4 w-4" /> Complete exit</Button>}</>}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3"><Avatar user={e.user} /><div><p className="font-semibold">{fullName(e.user)}</p><p className="text-xs text-slate-500">{e.user.jobTitle} · {e.user.department}</p></div></div>
          <Field label="Last working day"><input type="date" className="input" defaultValue={ymd(new Date(e.lastDay))} disabled={!active} onBlur={(ev) => ev.target.value !== ymd(new Date(e.lastDay)) && run(() => api.put(`/engagement/exits/${id}`, { lastDay: ev.target.value }), 'Last day updated')} /></Field>
          <dl className="space-y-1.5">
            <div className="flex justify-between"><dt className="text-slate-500"><Term>Status</Term></dt><dd><Badge color={{ requested: 'amber', in_progress: 'blue', completed: 'slate', withdrawn: 'slate' }[e.status]}>{titleCase(e.status)}</Badge></dd></div>
            <div className="flex justify-between"><dt className="text-slate-500"><Term>Reason</Term></dt><dd>{EXIT_REASON_LABEL[e.reasonCategory] || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500"><Term>Joined</Term></dt><dd>{fmtDate(e.user.dateJoined)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500"><Term>Unused leave</Term></dt><dd>{e.leaveBalance} days</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500"><Term>Loans outstanding</Term></dt><dd className={e.outstandingLoans ? 'font-semibold text-rose-600' : ''}>₦{(e.outstandingLoans || 0).toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500"><Term>Direct reports</Term></dt><dd>{e.directReports}</dd></div>
          </dl>
          {e.reason && <p className="rounded-xl bg-slate-50 p-3">{e.reason}</p>}
          <Field label="Address after leaving" hint="For the final payslip, tax and pension documents and references">
            <textarea rows={3} className="input" defaultValue={e.forwardingAddress || ''} placeholder="Not given yet" disabled={!active}
              onBlur={(ev) => ev.target.value.trim() !== (e.forwardingAddress || '') && run(() => api.put(`/engagement/exits/${id}`, { forwardingAddress: ev.target.value.trim() }), 'Address saved')} />
          </Field>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={!!e.regrettable} onChange={(ev) => run(() => api.put(`/engagement/exits/${id}`, { regrettable: ev.target.checked }), 'Saved')} /> Regrettable</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={!!e.rehireEligible} onChange={(ev) => run(() => api.put(`/engagement/exits/${id}`, { rehireEligible: ev.target.checked }), 'Saved')} /> Rehire</label>
          </div>
          {e.case && <p className="text-xs">From case <Link className="font-semibold text-brand-700" to={`/admin/relations/${e.case._id}`}>{e.case.reference}</Link></p>}
        </div>
        <div className="lg:col-span-2">
          {e.checklist.length > 0 && <>
            <p className="label">Checklist ({e.checklist.filter((c) => c.done).length}/{e.checklist.length})</p>
            <ul className="divide-y divide-slate-100">{e.checklist.map((t) => { const Icon = t.done ? CheckCircle2 : Circle; return (
              <li key={t._id} className="flex items-center gap-3 py-2"><button type="button" disabled={!active} onClick={() => toggle(t)} aria-label={t.done ? 'Mark not done' : 'Mark done'}><Icon className={`h-6 w-6 ${t.done ? 'text-emerald-600' : 'text-slate-300 hover:text-brand-600'}`} /></button>
                <span className={`flex-1 text-sm ${t.done ? 'text-slate-500 line-through' : ''}`}>{t.task}{/certificate of service/i.test(t.task) && <Link to={`/admin/staff/${e.user._id}?letter=service_certificate`} className="ml-2 text-xs font-semibold text-brand-700 hover:underline">Create letter</Link>}</span><Badge color="slate">{t.owner === 'employee' ? 'Employee' : OWNER_LABEL[t.owner]}</Badge></li>); })}</ul>
            {active && <form className="mt-2 flex gap-2" onSubmit={(ev) => { ev.preventDefault(); run(() => api.post(`/engagement/exits/${id}/checklist`, { task }), 'Task added'); setTask(''); }}><input className="input" aria-label="New task" placeholder="Add a task" value={task} onChange={(ev) => setTask(ev.target.value)} /><Button size="sm" disabled={!task.trim()}>Add</Button></form>}
          </>}
          <div className="mt-6"><p className="label"><Term>Exit interview</Term></p>
            {iv?.status === 'completed' ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(EXIT_RATING_LABEL).map(([k, l]) => <div key={k} className="rounded-xl bg-slate-50 p-2"><p className="text-xs text-slate-500"><Term>{l}</Term></p><p className={`font-semibold ${iv.ratings?.[k] <= 2 ? 'text-rose-600' : ''}`}>{iv.ratings?.[k] ?? '—'}/5</p></div>)}</div>
                <p>Would recommend: <b>{iv.wouldRecommend ?? '—'}/10</b> · Would return: <b>{iv.wouldReturn == null ? '—' : iv.wouldReturn ? 'Yes' : 'No'}</b></p>
                {iv.likedMost && <p><span className="text-slate-500">Liked most: </span>{iv.likedMost}</p>}
                {iv.improve && <p><span className="text-slate-500">Should change: </span>{iv.improve}</p>}
              </div>
            ) : <p className="text-sm text-slate-500">{{ not_sent: 'Not sent', pending: 'Sent; waiting for them to complete it in their portal', declined: 'They chose not to do one' }[iv?.status || 'not_sent']}</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Exits() {
  const [params, setParams] = useSearchParams();
  const [show, setShow] = useState('active');
  const { data: exits, loading, reload } = useFetch('/engagement/exits', { params: { status: show === 'active' ? 'active' : undefined }, initial: [] });
  const [starting, setStarting] = useState(false);
  const openId = params.get('exit');
  const open = (id) => { params.set('exit', id); setParams(params); };
  const close = () => { params.delete('exit'); setParams(params); };
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">{[['active', 'In progress'], ['all', 'All']].map(([k, l]) => <Button key={k} size="sm" variant={show === k ? 'primary' : 'secondary'} onClick={() => setShow(k)}>{l}</Button>)}</div>
        <Button onClick={() => setStarting(true)}><DoorOpen className="h-4 w-4" /> Start an exit</Button>
      </div>
      <Card bodyClass="p-0">{loading ? <Spinner /> : exits.length === 0 ? <Empty icon={DoorOpen} title="No exits in progress" /> : (
        <div className="overflow-x-auto"><table className="table">
          <thead><tr><th><Term>Employee</Term></th><th><Term>Type</Term></th><th><Term>Reason</Term></th><th><Term>Last day</Term></th><th><Term>Checklist</Term></th><th><Term>Status</Term></th></tr></thead>
          <tbody>{exits.map((e) => (
            <tr key={e._id} className="cursor-pointer" onClick={() => open(e._id)}>
              <td><span className="flex items-center gap-2"><Avatar user={e.user} size="sm" /><span><span className="block font-medium">{fullName(e.user)}</span><span className="text-xs text-slate-500">{e.user?.department}</span></span></span></td>
              <td>{EXIT_TYPE_LABEL[e.type]}{e.regrettable && <Badge color="red">Regrettable</Badge>}</td><td>{EXIT_REASON_LABEL[e.reasonCategory] || '—'}</td><td>{fmtDate(e.lastDay)}</td>
              <td className="w-32"><ProgressBar value={e.progress} tone="bg-brand-600" /></td>
              <td><Badge color={{ requested: 'amber', in_progress: 'blue', completed: 'slate', withdrawn: 'slate' }[e.status]}>{e.status === 'requested' ? 'Needs accepting' : titleCase(e.status)}</Badge></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}</Card>
      {starting && <StartExit onClose={() => setStarting(false)} onDone={() => { setStarting(false); reload(); }} />}
      {openId && <ExitDetail id={openId} onClose={close} onChanged={reload} />}
    </>
  );
}

// ---------------- Insights ----------------
function Insights() {
  const { data: trend } = useFetch('/engagement/trend', { initial: [] });
  const { data: x } = useFetch('/engagement/exits/insights');
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Engagement over time" className="lg:col-span-2">{trend.length < 1 ? <Empty title="Run a survey to start the trend" /> : (
        <div className="h-64"><ResponsiveContainer><LineChart data={trend.map((t) => ({ ...t, label: t.title }))}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
          <YAxis domain={[-100, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={36} /><Tooltip />
          <Line dataKey="enps" name="eNPS" stroke="#0b3b38" strokeWidth={2} dot connectNulls /><Line dataKey="favourable" name="% favourable" stroke="#129d8f" strokeWidth={2} dot />
        </LineChart></ResponsiveContainer></div>
      )}</Card>
      {x && <>
        <Card title="Leavers in the last 12 months">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[['Leavers', x.total], ['Voluntary', x.voluntary], ['Regrettable', x.regrettable], ['Exit interviews done', x.interviewRate == null ? '—' : `${x.interviewRate}%`], ['Leaver eNPS', x.leaverEnps ?? '—'], ['Would return', x.wouldReturn == null ? '—' : `${x.wouldReturn}%`]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500"><Term>{l}</Term></p><p className="text-xl font-semibold">{v}</p></div>))}
          </div>
        </Card>
        <Card title="Why people leave">{x.byReason.length === 0 ? <Empty title="No leavers yet" /> : (
          <div className="h-60"><ResponsiveContainer><BarChart data={x.byReason.map((r) => ({ ...r, name: EXIT_REASON_LABEL[r.name] || 'Not given' }))} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" allowDecimals={false} hide /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} /><Tooltip />
            <Bar dataKey="count" name="Leavers" fill="#129d8f" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>
        )}</Card>
        <Card title="How leavers rated us (1–5)" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{x.ratings.map((r) => (
            <div key={r.area} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{EXIT_RATING_LABEL[r.area]}</p><p className={`text-xl font-semibold ${r.average != null && r.average < 3 ? 'text-rose-600' : ''}`}>{r.average ?? '—'}</p></div>
          ))}</div>
        </Card>
      </>}
    </div>
  );
}

export default function Engagement() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'surveys';
  return (
    <div>
      <PageHeader title="Engagement & retention" subtitle="Anonymous surveys and eNPS, flight-risk signals, and a proper exit process." />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ value: 'surveys', label: 'Surveys' }, { value: 'retention', label: 'Flight risk' }, { value: 'exits', label: 'Exits' }, { value: 'insights', label: 'Insights' }]} />
      {tab === 'surveys' && <Surveys />}
      {tab === 'retention' && <Retention />}
      {tab === 'exits' && <Exits />}
      {tab === 'insights' && <Insights />}
    </div>
  );
}
