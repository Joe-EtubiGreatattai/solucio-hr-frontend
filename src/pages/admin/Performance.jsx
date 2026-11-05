import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BellRing, Heart, Play, Plus, Rocket, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, ProgressBar, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fullName, timeAgo, titleCase } from '../../lib/format';
import { OUTCOME_LABEL, STATUS_LABEL } from '../performance/ReviewView';
import { Term } from '../../components/InfoTip';

const STAGES = ['self_review', 'manager_review', 'calibration', 'finalized', 'acknowledged'];
const STAGE_COLOR = { self_review: 'bg-slate-300', manager_review: 'bg-sky-400', calibration: 'bg-amber-400', finalized: 'bg-brand-500', acknowledged: 'bg-emerald-500' };

function CycleProgress({ counts, total }) {
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={STAGES.map((s) => `${STATUS_LABEL[s]} ${counts[s] || 0}`).join(', ')}>
        {STAGES.map((s) => counts[s] ? <span key={s} className={`${STAGE_COLOR[s]} origin-left animate-grow-x`} style={{ width: `${(counts[s] / total) * 100}%` }} /> : null)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">{STAGES.map((s) => <span key={s} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${STAGE_COLOR[s]}`} />{STATUS_LABEL[s]} {counts[s] || 0}</span>)}</div>
    </div>
  );
}

function CycleEditor({ onClose, onSaved }) {
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] } });
  const year = new Date().getFullYear();
  const [f, setF] = useState({ name: `${year} Mid-year Review`, type: 'mid_year', periodStart: `${year}-01-01`, periodEnd: `${year}-06-30`, selfDue: '', managerDue: '', goalWeight: 50, audience: { scope: 'all', departments: [] } });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => { e.preventDefault(); try { await api.post('/performance/cycles', f); toast.success('Cycle created. Launch it when ready'); onSaved(); } catch (err) { toastError(err); } };
  return (
    <Modal open onClose={onClose} title="New review cycle" size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="cycle-form">Create</Button></>}>
      <form id="cycle-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><input className="input" required value={f.name} onChange={set('name')} /></Field>
        <Field label="Type"><select className="input" value={f.type} onChange={set('type')}>{['annual', 'mid_year', 'quarterly'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></Field>
        <Field label="Goals count for" hint="The rest comes from competencies"><div className="flex items-center gap-2"><input type="number" min="0" max="100" className="input" value={f.goalWeight} onChange={(e) => setF({ ...f, goalWeight: Number(e.target.value) })} /><span>%</span></div></Field>
        <Field label="Period from"><input type="date" className="input" value={f.periodStart} onChange={set('periodStart')} /></Field>
        <Field label="Period to"><input type="date" className="input" value={f.periodEnd} onChange={set('periodEnd')} /></Field>
        <Field label="Self-assessments due"><input type="date" className="input" value={f.selfDue} onChange={set('selfDue')} /></Field>
        <Field label="Manager reviews due"><input type="date" className="input" value={f.managerDue} onChange={set('managerDue')} /></Field>
        <div className="sm:col-span-2"><span className="label">Who is reviewed</span>
          <div className="mb-2 flex gap-2">{[['all', 'Everyone'], ['departments', 'Departments']].map(([v, l]) => <button key={v} type="button" aria-pressed={f.audience.scope === v} onClick={() => setF({ ...f, audience: { ...f.audience, scope: v } })} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${f.audience.scope === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300'}`}>{l}</button>)}</div>
          {f.audience.scope === 'departments' && <div className="flex flex-wrap gap-1.5">{meta.departments.map((d) => { const on = f.audience.departments.includes(d); return <button key={d} type="button" aria-pressed={on} onClick={() => setF({ ...f, audience: { ...f.audience, departments: on ? f.audience.departments.filter((x) => x !== d) : [...f.audience.departments, d] } })} className={`min-h-9 rounded-full px-3 text-sm ${on ? 'bg-brand-700 text-white' : 'bg-slate-100'}`}>{d}</button>; })}</div>}
        </div>
      </form>
    </Modal>
  );
}

function Calibration({ cycles }) {
  const options = cycles.filter((c) => c.type !== 'probation' && c.status !== 'draft');
  const [cycle, setCycle] = useState(options[0]?._id || '');
  const { data, loading } = useFetch(cycle ? `/performance/cycles/${cycle}/calibration` : null, { initial: { reviews: [], distribution: [] } });
  const max = Math.max(1, ...data.distribution.map((d) => d.count));
  if (!options.length) return <Card><Empty title="No launched cycles yet" /></Card>;
  return (
    <div className="space-y-6">
      <select className="input w-full sm:w-72" aria-label="Cycle" value={cycle} onChange={(e) => setCycle(e.target.value)}>{options.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
      <Card title="Rating distribution">
        <div className="flex h-48 items-end gap-3">{data.distribution.map((d) => (
          <div key={d.rating} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span className="text-sm font-semibold">{d.count}</span>
            <div className="w-full max-w-20 origin-bottom animate-grow-y rounded-t-xl bg-brand-600" style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }} />
            <span className="text-center text-xs text-slate-500">{d.rating} · {d.label}</span>
          </div>
        ))}</div>
      </Card>
      <Card title="Reviews to calibrate" bodyClass="p-0">
        {loading ? <Spinner /> : data.reviews.length === 0 ? <Empty title="No reviews have reached calibration yet" /> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th><Term>Employee</Term></th><th><Term>Reviewer</Term></th><th><Term>Calculated</Term></th><th><Term>Recommended</Term></th><th><Term>Final</Term></th><th><Term>Outcome</Term></th><th /></tr></thead>
            <tbody>{data.reviews.map((r) => (
              <tr key={r._id}>
                <td><span className="flex items-center gap-2"><Avatar user={r.user} size="sm" /><span><span className="block font-medium">{fullName(r.user)}</span><span className="text-xs text-slate-500">{r.user.department}</span></span></span></td>
                <td>{r.reviewer ? fullName(r.reviewer) : '—'}</td>
                <td>{r.calculatedRating ?? '—'}</td><td>{r.manager?.recommendedRating ?? '—'}</td>
                <td className="font-semibold">{r.finalRating ?? '—'}</td>
                <td>{OUTCOME_LABEL[r.finalOutcome || r.manager?.recommendedOutcome] || '—'}{(r.raisePercent || r.manager?.raisePercent) ? ` ${r.raisePercent || r.manager?.raisePercent}%` : ''}</td>
                <td className="text-right"><Link to={`/admin/performance/reviews/${r._id}`} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-700 hover:underline">{r.status === 'calibration' ? 'Finalise' : 'View'}</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}

export default function Performance() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'cycles';
  const { data: cycles, loading, reload } = useFetch('/performance/cycles', { initial: [] });
  const [cycleFilter, setCycleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data: reviews } = useFetch('/performance/reviews', { params: { cycle: cycleFilter, status: statusFilter }, initial: [] });
  const { data: overview } = useFetch('/performance/overview');
  const { data: wall } = useFetch('/performance/feedback/wall', { initial: [] });
  const { data: people } = useFetch('/users/directory', { initial: [] });
  const ask = useConfirm();
  const [creating, setCreating] = useState(false);
  const [probation, setProbation] = useState(null);

  const act = async (c, action, confirm) => {
    if (confirm && !(await ask(confirm))) return;
    try {
      const { data } = await api.post(`/performance/cycles/${c._id}/${action.path}`, action.body || {});
      toast.success(action.path === 'launch' ? `Launched: ${data.created} reviews created and everyone notified` : action.path === 'remind' ? `${data.reminded} reminders sent` : 'Cycle updated');
      reload();
    } catch (e) { toastError(e); }
  };

  return (
    <div>
      <PageHeader title="Performance" subtitle="Review cycles, goals, calibration and recognition, linked to pay and probation."
        actions={<><Button variant="secondary" onClick={() => setProbation({ user: '' })}>Probation review</Button><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New cycle</Button></>} />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ value: 'cycles', label: 'Cycles' }, { value: 'reviews', label: 'Reviews' }, { value: 'calibration', label: 'Calibration' }, { value: 'goals', label: 'Goals & recognition' }]} />

      {tab === 'cycles' && (loading ? <Spinner /> : cycles.length === 0 ? <Card><Empty title="No review cycles yet" /></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
          {cycles.map((c) => (
            <Card key={c._id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><div className="flex gap-1.5"><Badge color="teal">{titleCase(c.type)}</Badge><Badge status={c.status === 'active' ? 'active' : c.status === 'closed' ? 'completed' : 'draft'}>{titleCase(c.status)}</Badge></div>
                  <h3 className="mt-2 text-lg font-semibold">{c.name}</h3>
                  <p className="text-sm text-slate-500">{c.periodStart ? `${fmtDate(c.periodStart)} – ${fmtDate(c.periodEnd)}` : 'Ongoing'}{c.selfDue && ` · self by ${fmtDate(c.selfDue)}`}{c.managerDue && ` · managers by ${fmtDate(c.managerDue)}`}</p></div>
                <span className="text-2xl font-semibold">{c.total}<span className="ml-1 text-sm font-normal text-slate-500">reviews</span></span>
              </div>
              {c.total > 0 && <div className="mt-4"><CycleProgress counts={c.counts} total={c.total} /></div>}
              <div className="mt-4 flex flex-wrap gap-2">
                {c.status === 'draft' && <Button size="sm" onClick={() => act(c, { path: 'launch' }, { title: `Launch ${c.name}?`, message: 'A review is created for everyone in it, and everyone is notified to start their self-assessment.', confirmLabel: 'Launch' })}><Rocket className="h-4 w-4" /> Launch</Button>}
                {c.status === 'active' && <><Button size="sm" variant="secondary" onClick={() => act(c, { path: 'remind' })}><BellRing className="h-4 w-4" /> Remind</Button>
                  {c.type !== 'probation' && <Button size="sm" variant="secondary" onClick={() => act(c, { path: 'status', body: { status: 'calibration' } })}>Move to calibration</Button>}</>}
                {c.status === 'calibration' && <Button size="sm" variant="secondary" onClick={() => setParams({ tab: 'calibration' })}>Calibrate</Button>}
                {['active', 'calibration'].includes(c.status) && c.type !== 'probation' && <Button size="sm" variant="ghost" onClick={() => act(c, { path: 'status', body: { status: 'closed' } }, { title: `Close ${c.name}?`, message: 'Reviews stay viewable; no more changes.', confirmLabel: 'Close' })}>Close</Button>}
                {c.status === 'closed' && <Button size="sm" variant="ghost" onClick={() => act(c, { path: 'status', body: { status: 'active' } })}><Play className="h-4 w-4" /> Reopen</Button>}
              </div>
            </Card>
          ))}
        </div>
      ))}

      {tab === 'reviews' && (
        <Card bodyClass="p-0" action={<div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <select className="input w-full sm:w-56" aria-label="Cycle" value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)}><option value="">All cycles</option>{cycles.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
          <select className="input w-full sm:w-48" aria-label="Stage" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">Any stage</option>{STAGES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
        </div>} title={`${reviews.length} reviews`}>
          {reviews.length === 0 ? <Empty title="No reviews" /> : (
            <div className="overflow-x-auto"><table className="table">
              <thead><tr><th><Term>Employee</Term></th><th><Term>Cycle</Term></th><th><Term>Reviewer</Term></th><th><Term>Stage</Term></th><th><Term>Rating</Term></th><th /></tr></thead>
              <tbody>{reviews.map((r) => (
                <tr key={r._id}>
                  <td><span className="flex items-center gap-2"><Avatar user={r.user} size="sm" /><span className="font-medium">{fullName(r.user)}</span></span></td>
                  <td>{r.cycle?.name}</td><td>{r.reviewer ? fullName(r.reviewer) : '—'}</td>
                  <td><Badge status={['finalized', 'acknowledged'].includes(r.status) ? 'approved' : r.status === 'calibration' ? 'pending' : 'open'}>{STATUS_LABEL[r.status]}</Badge></td>
                  <td>{r.finalRating ?? r.calculatedRating ?? '—'}</td>
                  <td className="text-right"><Link to={`/admin/performance/reviews/${r._id}`} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-700 hover:underline">Open</Link></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}

      {tab === 'calibration' && <Calibration cycles={cycles} />}

      {tab === 'goals' && overview && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title={<span className="flex items-center gap-2"><Target className="h-4 w-4" /> Goals across the hospital</span>}>
            {(() => {
              const total = Object.values(overview.goals).reduce((a, b) => a + b, 0) || 1;
              return ['completed', 'on_track', 'at_risk', 'not_started'].map((s) => (
                <div key={s} className="mb-3"><div className="mb-1 flex justify-between text-sm"><span>{titleCase(s)}</span><b>{overview.goals[s] || 0}</b></div>
                  <ProgressBar value={((overview.goals[s] || 0) / total) * 100} tone={{ completed: 'bg-emerald-500', on_track: 'bg-brand-500', at_risk: 'bg-amber-500', not_started: 'bg-slate-300' }[s]} /></div>
              ));
            })()}
          </Card>
          <Card title={<span className="flex items-center gap-2"><Heart className="h-4 w-4" /> Most recognised (90 days)</span>} bodyClass="p-0">
            {overview.topRecognised.length === 0 ? <Empty title="No recognition yet" /> : <ul className="divide-y divide-slate-100">{overview.topRecognised.map((t) => (
              <li key={t.user._id} className="flex items-center gap-3 px-5 py-3"><Avatar user={t.user} size="sm" /><span className="flex-1 font-medium">{fullName(t.user)}</span><Badge color="teal">{`${t.count} kudos`}</Badge></li>
            ))}</ul>}
          </Card>
          <Card title="Recognition wall" className="lg:col-span-2" bodyClass="p-0">
            <ul className="stagger divide-y divide-slate-100">{wall.map((f) => (
              <li key={f._id} className="flex gap-3 px-5 py-3"><Avatar user={f.from} size="sm" />
                <p className="text-sm"><b>{fullName(f.from)}</b> → <b>{fullName(f.to)}</b>{f.value && <Badge color="teal">{titleCase(f.value)}</Badge>}<br /><span className="text-slate-600">{f.message}</span> <span className="text-xs text-slate-500">· {timeAgo(f.createdAt)}</span></p></li>
            ))}</ul>
          </Card>
        </div>
      )}

      {creating && <CycleEditor onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
      {probation && (
        <Modal open onClose={() => setProbation(null)} title="Start a probation review" footer={<><Button variant="secondary" onClick={() => setProbation(null)}>Cancel</Button><Button form="prob-form">Start</Button></>}>
          <form id="prob-form" onSubmit={async (e) => { e.preventDefault(); try { await api.post('/performance/reviews', probation); toast.success('Probation review started'); setProbation(null); reload(); } catch (err) { toastError(err); } }}>
            <p className="mb-3 text-sm text-slate-500">The employee does a self-assessment, their manager reviews it, and HR's outcome (confirm, extend or not confirm) updates their record.</p>
            <Field label="Employee"><select className="input" required value={probation.user} onChange={(e) => setProbation({ user: e.target.value })}><option value="">Choose…</option>{people.map((p) => <option key={p._id} value={p._id}>{fullName(p)} · {p.jobTitle || '—'}</option>)}</select></Field>
          </form>
        </Modal>
      )}
    </div>
  );
}
