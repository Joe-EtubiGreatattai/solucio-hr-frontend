import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Heart, MessageCircle, Plus, Target, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, ProgressBar, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fullName, timeAgo, titleCase, ymd } from '../../lib/format';
import { STATUS_LABEL } from '../performance/ReviewView';
import { Term } from '../../components/InfoTip';

const GOAL_COLOR = { not_started: 'slate', on_track: 'teal', at_risk: 'amber', completed: 'green' };
const VALUES = ['compassion', 'excellence', 'teamwork', 'integrity', 'innovation'];

function GoalCard({ g, onUpdate, onAgree, canAgree }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2"><Badge color={GOAL_COLOR[g.status]}>{titleCase(g.status)}</Badge>{g.agreed ? <Badge color="slate">Agreed</Badge> : <Badge color="amber">Not yet agreed</Badge>}{g.weight ? <Badge color="slate">{`${g.weight}%`}</Badge> : null}</div>
      <h3 className="mt-2 font-semibold">{g.title}</h3>
      {(g.measure || g.target) && <p className="text-sm text-slate-500">{g.measure}{g.target && ` · target: ${g.target}`}</p>}
      <div className="mt-3 flex items-center gap-3"><span className="flex-1"><ProgressBar value={g.progress} tone="bg-brand-600" /></span><b className="text-sm">{g.progress}%</b></div>
      <p className="mt-1 text-xs text-slate-500">{g.dueDate ? `Due ${fmtDate(g.dueDate)}` : ''}{g.updates?.length ? ` · updated ${timeAgo(g.updates.at(-1).at)}` : ''}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {g.status !== 'completed' && <Button size="sm" variant="secondary" onClick={() => onUpdate(g)}>Update progress</Button>}
        {canAgree && !g.agreed && <Button size="sm" onClick={() => onAgree(g)}>Agree goal</Button>}
      </div>
    </Card>
  );
}

export default function Performance() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'goals';
  const { data, loading, reload } = useFetch('/performance/me', { initial: { goals: [], reviews: [], feedbackReceived: [], feedbackGiven: [], activeCycles: [] } });
  const { data: team, reload: reloadTeam } = useFetch('/performance/team', { initial: { team: [], goals: [], reviews: [] } });
  const { data: wall } = useFetch('/performance/feedback/wall', { initial: [] });
  const { data: people } = useFetch('/users/directory', { initial: [] });
  const [goalForm, setGoalForm] = useState(null);
  const [progress, setProgress] = useState(null);
  const [giving, setGiving] = useState(null);
  const isManager = team.team.length > 0;
  const todoReview = data.reviews.find((r) => r.status === 'self_review' || r.status === 'finalized');

  const saveGoal = async (e) => {
    e.preventDefault();
    try { await api.post('/performance/goals', goalForm); toast.success(goalForm.user ? 'Goal set for your team member' : 'Goal added. Your manager will agree it'); setGoalForm(null); reload(); reloadTeam(); } catch (err) { toastError(err); }
  };
  const saveProgress = async (e) => {
    e.preventDefault();
    try { await api.post(`/performance/goals/${progress.g._id}/progress`, { progress: progress.value, note: progress.note, status: progress.status }); toast.success('Progress updated'); setProgress(null); reload(); reloadTeam(); } catch (err) { toastError(err); }
  };
  const agree = async (g) => { try { await api.post(`/performance/goals/${g._id}/agree`); toast.success('Goal agreed'); reloadTeam(); } catch (e) { toastError(e); } };
  const give = async (e) => {
    e.preventDefault();
    try { await api.post('/performance/feedback', giving); toast.success(giving.type === 'praise' ? 'Recognition sent' : 'Feedback sent privately'); setGiving(null); reload(); } catch (err) { toastError(err); }
  };

  if (loading && !data.goals.length) return <Spinner />;
  return (
    <div>
      <PageHeader title="Performance" subtitle="Your goals, reviews and feedback."
        actions={<Button onClick={() => setGiving({ to: '', type: 'praise', value: 'teamwork', message: '', visibility: 'public' })}><Heart className="h-4 w-4" /> Recognise a colleague</Button>} />
      {todoReview && (
        <Link to={`/performance/reviews/${todoReview._id}`} className="lift mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <Target className="h-5 w-5" /><span className="flex-1"><b>{todoReview.cycle.name}:</b> {todoReview.status === 'self_review' ? `your self-assessment is due${todoReview.cycle.selfDue ? ` by ${fmtDate(todoReview.cycle.selfDue)}` : ''}.` : 'your review is ready to read.'}</span>
          <span className="font-semibold underline">{todoReview.status === 'self_review' ? 'Start' : 'Read it'}</span>
        </Link>
      )}
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ value: 'goals', label: 'My goals', count: data.goals.length }, { value: 'reviews', label: 'My reviews' },
        { value: 'feedback', label: 'Feedback', count: data.feedbackReceived.length }, ...(isManager ? [{ value: 'team', label: 'My team', count: team.reviews.filter((r) => r.status === 'manager_review').length }] : [])]} />

      {tab === 'goals' && <>
        <div className="mb-4 flex justify-end"><Button variant="secondary" onClick={() => setGoalForm({ title: '', measure: '', target: '', dueDate: '', weight: '' })}><Plus className="h-4 w-4" /> Add a goal</Button></div>
        {data.goals.length === 0 ? <Card><Empty icon={Target} title="No goals yet">Agree goals with your manager to focus your year.</Empty></Card> :
          <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{data.goals.map((g) => <GoalCard key={g._id} g={g} onUpdate={(x) => setProgress({ g: x, value: x.progress, note: '', status: x.status })} />)}</div>}
      </>}

      {tab === 'reviews' && (
        <Card bodyClass="p-0">{data.reviews.length === 0 ? <Empty title="No reviews yet" /> : (
          <ul className="divide-y divide-slate-100">{data.reviews.map((r) => (
            <li key={r._id}><Link to={`/performance/reviews/${r._id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-slate-50">
              <span className="min-w-0 flex-1"><span className="block font-semibold">{r.cycle.name}</span><span className="text-sm text-slate-500">Reviewer: {r.reviewer ? fullName(r.reviewer) : '—'}</span></span>
              {r.finalRating && ['finalized', 'acknowledged'].includes(r.status) && <span className="text-2xl font-semibold text-brand-800">{r.finalRating}<span className="text-sm text-slate-500">/5</span></span>}
              <Badge status={r.status === 'acknowledged' ? 'approved' : r.status === 'self_review' || r.status === 'finalized' ? 'pending' : 'open'}>{STATUS_LABEL[r.status]}</Badge>
            </Link></li>
          ))}</ul>
        )}</Card>
      )}

      {tab === 'feedback' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Received" bodyClass="p-0">{data.feedbackReceived.length === 0 ? <Empty icon={MessageCircle} title="Nothing yet" /> : (
            <ul className="stagger divide-y divide-slate-100">{data.feedbackReceived.map((f) => (
              <li key={f._id} className="flex gap-3 px-5 py-3"><Avatar user={f.from} size="sm" /><div className="min-w-0 text-sm">
                <p><b>{fullName(f.from)}</b> {f.type === 'praise' ? <Badge color="teal">{f.value ? titleCase(f.value) : 'Kudos'}</Badge> : <Badge color="slate">Private feedback</Badge>}</p>
                <p className="text-slate-600">{f.message}</p><p className="text-xs text-slate-500">{timeAgo(f.createdAt)}</p></div></li>
            ))}</ul>
          )}</Card>
          <Card title="Recognition wall" bodyClass="p-0"><ul className="stagger divide-y divide-slate-100">{wall.map((f) => (
            <li key={f._id} className="flex gap-3 px-5 py-3"><Avatar user={f.to} size="sm" /><p className="text-sm"><b>{fullName(f.from)}</b> recognised <b>{fullName(f.to)}</b><br /><span className="text-slate-600">{f.message}</span> <span className="text-xs text-slate-500">· {timeAgo(f.createdAt)}</span></p></li>
          ))}</ul></Card>
        </div>
      )}

      {tab === 'team' && isManager && (
        <div className="space-y-6">
          <Card title="Reviews for you to complete" bodyClass="p-0">
            {team.reviews.length === 0 ? <Empty icon={Users} title="No team reviews in progress" /> : (
              <ul className="divide-y divide-slate-100">{team.reviews.map((r) => (
                <li key={r._id}><Link to={`/performance/reviews/${r._id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <Avatar user={r.user} size="sm" /><span className="min-w-0 flex-1"><span className="block font-medium">{fullName(r.user)}</span><span className="text-xs text-slate-500">{r.cycle?.name}{r.cycle?.managerDue && ` · due ${fmtDate(r.cycle.managerDue)}`}</span></span>
                  <Badge status={r.status === 'manager_review' ? 'pending' : 'open'}>{r.status === 'manager_review' ? 'Your turn' : STATUS_LABEL[r.status]}</Badge>
                </Link></li>
              ))}</ul>
            )}
          </Card>
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold"><Term>Team goals</Term></h2><Button size="sm" variant="secondary" onClick={() => setGoalForm({ user: team.team[0]._id, title: '', measure: '', target: '', dueDate: '', weight: '' })}><Plus className="h-4 w-4" /> Set a goal</Button></div>
          {team.team.map((m) => {
            const goals = team.goals.filter((g) => g.user === m._id);
            return (
              <div key={m._id}>
                <div className="mb-2 flex items-center gap-2 font-medium"><Avatar user={m} size="sm" />{fullName(m)} <span className="text-sm font-normal text-slate-500">· {goals.length} goals</span></div>
                {goals.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{goals.map((g) => <GoalCard key={g._id} g={g} canAgree onAgree={agree} onUpdate={(x) => setProgress({ g: x, value: x.progress, note: '', status: x.status })} />)}</div> : <p className="text-sm text-slate-500"><Term>No goals yet.</Term></p>}
              </div>
            );
          })}
        </div>
      )}

      {goalForm && (
        <Modal open onClose={() => setGoalForm(null)} title={goalForm.user ? 'Set a goal for your team' : 'Add a goal'} footer={<><Button variant="secondary" onClick={() => setGoalForm(null)}>Cancel</Button><Button form="goal-form">Save</Button></>}>
          <form id="goal-form" onSubmit={saveGoal} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {goalForm.user && <Field label="For" className="sm:col-span-2"><select className="input" value={goalForm.user} onChange={(e) => setGoalForm({ ...goalForm, user: e.target.value })}>{team.team.map((m) => <option key={m._id} value={m._id}>{fullName(m)}</option>)}</select></Field>}
            <Field label="Goal" className="sm:col-span-2"><input className="input" required value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} placeholder="e.g. Reduce missed medication doses on the ward" /></Field>
            <Field label="How it's measured"><input className="input" value={goalForm.measure} onChange={(e) => setGoalForm({ ...goalForm, measure: e.target.value })} /></Field>
            <Field label="Target"><input className="input" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} /></Field>
            <Field label="Due"><input type="date" className="input" min={ymd()} value={goalForm.dueDate} onChange={(e) => setGoalForm({ ...goalForm, dueDate: e.target.value })} /></Field>
            <Field label="Weight %" hint="Share of the goals score"><input type="number" min="0" max="100" className="input" value={goalForm.weight} onChange={(e) => setGoalForm({ ...goalForm, weight: Number(e.target.value) })} /></Field>
          </form>
        </Modal>
      )}
      {progress && (
        <Modal open onClose={() => setProgress(null)} title={progress.g.title} footer={<><Button variant="secondary" onClick={() => setProgress(null)}>Cancel</Button><Button form="progress-form">Save update</Button></>}>
          <form id="progress-form" onSubmit={saveProgress} className="space-y-4">
            <Field label={`Progress: ${progress.value}%`}><input type="range" min="0" max="100" step="5" className="w-full accent-brand-700" value={progress.value} onChange={(e) => setProgress({ ...progress, value: Number(e.target.value) })} /></Field>
            <Field label="Status"><select className="input" value={progress.value >= 100 ? 'completed' : progress.status} onChange={(e) => setProgress({ ...progress, status: e.target.value })}>{['not_started', 'on_track', 'at_risk', 'completed'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select></Field>
            <Field label="What's changed?"><textarea rows={3} className="input" value={progress.note} onChange={(e) => setProgress({ ...progress, note: e.target.value })} /></Field>
          </form>
        </Modal>
      )}
      {giving && (
        <Modal open onClose={() => setGiving(null)} title="Give feedback" footer={<><Button variant="secondary" onClick={() => setGiving(null)}>Cancel</Button><Button form="give-form" disabled={!giving.to || !giving.message.trim()}>Send</Button></>}>
          <form id="give-form" onSubmit={give} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">{[['praise', 'Recognition'], ['suggestion', 'Private suggestion']].map(([v, l]) => <button key={v} type="button" aria-pressed={giving.type === v} onClick={() => setGiving({ ...giving, type: v })} className={`min-h-11 rounded-xl border text-sm font-semibold ${giving.type === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300'}`}>{l}</button>)}</div>
            <Field label="Colleague"><select className="input" required value={giving.to} onChange={(e) => setGiving({ ...giving, to: e.target.value })}><option value="">Choose…</option>{people.map((p) => <option key={p._id} value={p._id}>{fullName(p)} · {p.jobTitle || '—'}</option>)}</select></Field>
            {giving.type === 'praise' && <div><span className="label">Hospital value</span><div className="flex flex-wrap gap-1.5">{VALUES.map((v) => <button key={v} type="button" aria-pressed={giving.value === v} onClick={() => setGiving({ ...giving, value: v })} className={`min-h-9 rounded-full px-3 text-sm ${giving.value === v ? 'bg-brand-700 text-white' : 'bg-slate-100'}`}>{titleCase(v)}</button>)}</div></div>}
            <Field label="Message"><textarea rows={3} className="input" required value={giving.message} onChange={(e) => setGiving({ ...giving, message: e.target.value })} /></Field>
            {giving.type === 'praise' && <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={giving.visibility === 'public'} onChange={(e) => setGiving({ ...giving, visibility: e.target.checked ? 'public' : 'private' })} /> Show on the recognition wall</label>}
          </form>
        </Modal>
      )}
    </div>
  );
}
