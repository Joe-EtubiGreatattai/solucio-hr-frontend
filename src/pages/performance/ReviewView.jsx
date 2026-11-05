import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck2, GraduationCap, Heart, Target, TrendingUp, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import { Avatar, Badge, Button, Card, Empty, Field, Spinner, SuccessCheck } from '../../components/ui';
import { fmtDate, fmtDateTime, fullName } from '../../lib/format';
import { Term } from '../../components/InfoTip';
import RatingGap from '../../components/RatingGap';

export const OUTCOME_LABEL = {
  none: 'No change', confirm: 'Confirm employment', raise: 'Pay rise', promotion: 'Promotion', bonus: 'Bonus', development: 'Development plan',
  pip: 'Performance improvement plan', extend_probation: 'Extend probation', not_confirmed: 'Do not confirm',
};
export const STATUS_LABEL = { self_review: 'Self-assessment', manager_review: 'Manager review', calibration: 'Calibration', finalized: 'Ready to acknowledge', acknowledged: 'Complete' };

// 1–5 rating buttons with the label of the chosen level.
export function RatingInput({ value, onChange, labels, disabled }) {
  return (
    <div>
      <div className="flex gap-1.5" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} disabled={disabled} onClick={() => onChange(n)} title={labels?.[n]}
            className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition disabled:cursor-default ${value === n ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-300 hover:border-brand-400 disabled:hover:border-slate-300'}`}>{n}</button>
        ))}
      </div>
      {value ? <p className="mt-1 text-xs text-slate-500">{labels?.[value]}</p> : null}
    </div>
  );
}

// Rows of 1–5 ratings (competencies or goals). Top-level so focus survives re-renders.
function RatingRows({ rows, onChange, readOnly, comps, labels }) {
  return rows.map((row, i) => (
    <div key={row.name || row.title} className="grid grid-cols-1 gap-2 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[1fr_16rem]">
      <div><p className="font-medium">{row.name || row.title}</p>{comps.find((c) => c.name === row.name)?.description && <p className="text-xs text-slate-500">{comps.find((c) => c.name === row.name).description}</p>}</div>
      <RatingInput value={row.rating} labels={labels} disabled={readOnly} onChange={(n) => onChange?.(i, n)} />
    </div>
  ));
}

function Evidence({ e }) {
  if (!e) return null;
  const items = [
    [CalendarCheck2, 'Punctuality', e.punctualityRate != null ? `${e.punctualityRate}%` : '—', `${e.late || 0} late arrivals`],
    [UserX, 'Attendance', e.attendanceRate != null ? `${e.attendanceRate}%` : '—', `${e.absences || 0} missed shifts`],
    [GraduationCap, 'Mandatory training', e.mandatoryTraining?.required ? `${e.mandatoryTraining.compliant}/${e.mandatoryTraining.required}` : '—', `${e.coursesCompleted || 0} courses completed`],
    [Target, 'Goals', e.goalsTotal ? `${e.goalsCompleted}/${e.goalsTotal}` : '—', 'completed'],
    [Heart, 'Recognition', e.praiseReceived ?? 0, 'from colleagues'],
  ];
  return (
    <Card title="Evidence from Solucio HR" action={<span className="text-xs text-slate-500">Gathered automatically for the review period</span>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {items.map(([Icon, label, value, hint]) => (
          <div key={label} className="rounded-2xl bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs text-slate-500"><Icon className="h-3.5 w-3.5" />{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p><p className="text-xs text-slate-500">{hint}</p></div>
        ))}
      </div>
    </Card>
  );
}

export default function ReviewView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: r, loading, reload } = useFetch(`/performance/reviews/${id}`);
  const ask = useConfirm();
  const [selfForm, setSelfForm] = useState(null);
  const [mgrForm, setMgrForm] = useState(null);
  const [final, setFinal] = useState(null);
  const [ackComment, setAckComment] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading && !r) return <Spinner />;
  if (!r) return <Empty title="Review not found" />;

  const comps = r.cycle.competencies || [];
  const labels = r.ratingLabels;
  const viewer = r.viewer; // self | reviewer | hr
  const canSelf = viewer === 'self' && r.status === 'self_review';
  const canManager = (viewer === 'reviewer' || viewer === 'hr') && ['self_review', 'manager_review'].includes(r.status);
  const canFinal = viewer === 'hr' && ['calibration', 'finalized'].includes(r.status);
  const finalDone = ['finalized', 'acknowledged'].includes(r.status);

  const initSelf = () => selfForm || {
    competencies: comps.map((c) => ({ name: c.name, rating: r.self?.competencies?.find((x) => x.name === c.name)?.rating || 0, comment: r.self?.competencies?.find((x) => x.name === c.name)?.comment || '' })),
    goals: r.goals.map((g) => ({ goal: g._id, title: g.title, rating: r.self?.goals?.find((x) => String(x.goal) === g._id)?.rating || 0, comment: '' })),
    achievements: r.self?.achievements || '', challenges: r.self?.challenges || '', developmentNeeds: r.self?.developmentNeeds || '',
  };
  const initMgr = () => mgrForm || {
    competencies: comps.map((c) => ({ name: c.name, rating: r.manager?.competencies?.find((x) => x.name === c.name)?.rating || 0, comment: r.manager?.competencies?.find((x) => x.name === c.name)?.comment || '' })),
    goals: r.goals.map((g) => ({ goal: g._id, title: g.title, rating: r.manager?.goals?.find((x) => String(x.goal) === g._id)?.rating || 0, comment: '' })),
    strengths: r.manager?.strengths || '', improvements: r.manager?.improvements || '', overallComment: r.manager?.overallComment || '',
    recommendedRating: r.manager?.recommendedRating || 0, recommendedOutcome: r.manager?.recommendedOutcome || (r.cycle.type === 'probation' ? 'confirm' : 'none'), raisePercent: r.manager?.raisePercent || '',
  };
  const sf = canSelf ? initSelf() : null;
  const mf = canManager ? initMgr() : null;

  const save = async (url, body, submit, msg) => {
    if (submit && !(await ask({ title: 'Submit now?', message: "You won't be able to change it afterwards.", confirmLabel: 'Submit' }))) return;
    setBusy(true);
    try { await api.put(url, { ...body, submit }); toast.success(submit ? msg : 'Draft saved'); setSelfForm(null); setMgrForm(null); reload(); }
    catch (e) { toastError(e); } finally { setBusy(false); }
  };


  return (
    <div className="mx-auto max-w-5xl">
      <button type="button" onClick={() => navigate(-1)} className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar user={r.user} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{viewer === 'self' ? 'Your review' : fullName(r.user)} · {r.cycle.name}</h1>
          <p className="text-sm text-slate-500">{r.user.jobTitle} · {r.user.department}{r.reviewer && ` · Reviewer: ${fullName(r.reviewer)}`}{r.cycle.selfDue && r.status === 'self_review' && ` · Self-assessment due ${fmtDate(r.cycle.selfDue)}`}</p>
        </div>
        <Badge status={finalDone ? 'approved' : 'pending'}>{STATUS_LABEL[r.status]}</Badge>
      </div>

      <div className="space-y-6">
        {viewer !== 'self' && <Evidence e={r.evidence} />}

        {/* ---- Self-assessment ---- */}
        {canSelf ? (
          <Card title="Your self-assessment">
            <p className="label"><Term>How you rate yourself</Term></p>
            <RatingRows comps={comps} labels={labels} rows={sf.competencies} onChange={(i, n) => setSelfForm({ ...sf, competencies: sf.competencies.map((c, j) => (j === i ? { ...c, rating: n } : c)) })} />
            {sf.goals.length > 0 && <><p className="label mt-5">Your goals</p><RatingRows comps={comps} labels={labels} rows={sf.goals} onChange={(i, n) => setSelfForm({ ...sf, goals: sf.goals.map((g, j) => (j === i ? { ...g, rating: n } : g)) })} /></>}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="What went well"><textarea rows={4} className="input" value={sf.achievements} onChange={(e) => setSelfForm({ ...sf, achievements: e.target.value })} /></Field>
              <Field label="What was hard"><textarea rows={4} className="input" value={sf.challenges} onChange={(e) => setSelfForm({ ...sf, challenges: e.target.value })} /></Field>
              <Field label="Support or training you'd like"><textarea rows={4} className="input" value={sf.developmentNeeds} onChange={(e) => setSelfForm({ ...sf, developmentNeeds: e.target.value })} /></Field>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" loading={busy} onClick={() => save(`/performance/reviews/${id}/self`, sf, false)}>Save draft</Button>
              <Button loading={busy} disabled={sf.competencies.some((c) => !c.rating)} onClick={() => save(`/performance/reviews/${id}/self`, sf, true, 'Self-assessment sent to your manager')}>Submit to manager</Button>
            </div>
          </Card>
        ) : r.self?.submittedAt ? (
          <Card title={viewer === 'self' ? 'Your self-assessment' : 'Self-assessment'} action={<span className="text-xs text-slate-500">Submitted {fmtDateTime(r.self.submittedAt)}</span>}>
            <RatingRows comps={comps} labels={labels} rows={r.self.competencies} readOnly />
            {r.self.goals?.length > 0 && <><p className="label mt-4">Goals</p><RatingRows comps={comps} labels={labels} rows={r.self.goals} readOnly /></>}
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              {[['Went well', r.self.achievements], ['Was hard', r.self.challenges], ['Support wanted', r.self.developmentNeeds]].map(([k, v]) => <div key={k} className="rounded-xl bg-slate-50 p-3"><p className="label">{k}</p><p className="whitespace-pre-wrap">{v || '—'}</p></div>)}
            </div>
          </Card>
        ) : viewer !== 'self' && <Card><p className="text-sm text-slate-500">{fullName(r.user)} hasn't submitted their self-assessment yet.</p></Card>}

        {/* ---- Manager assessment ---- */}
        {canManager ? (
          <Card title="Manager assessment" action={r.status === 'self_review' && <span className="text-xs text-amber-700">You can start before the self-assessment arrives</span>}>
            <RatingRows comps={comps} labels={labels} rows={mf.competencies} onChange={(i, n) => setMgrForm({ ...mf, competencies: mf.competencies.map((c, j) => (j === i ? { ...c, rating: n } : c)) })} />
            {mf.goals.length > 0 && <><p className="label mt-5">Goals</p><RatingRows comps={comps} labels={labels} rows={mf.goals} onChange={(i, n) => setMgrForm({ ...mf, goals: mf.goals.map((g, j) => (j === i ? { ...g, rating: n } : g)) })} /></>}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Strengths"><textarea rows={3} className="input" value={mf.strengths} onChange={(e) => setMgrForm({ ...mf, strengths: e.target.value })} /></Field>
              <Field label="To improve"><textarea rows={3} className="input" value={mf.improvements} onChange={(e) => setMgrForm({ ...mf, improvements: e.target.value })} /></Field>
              <Field label="Overall comment" className="md:col-span-2"><textarea rows={3} className="input" value={mf.overallComment} onChange={(e) => setMgrForm({ ...mf, overallComment: e.target.value })} /></Field>
              <div><span className="label">Overall rating you recommend</span><RatingInput value={mf.recommendedRating} labels={labels} onChange={(n) => setMgrForm({ ...mf, recommendedRating: n })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Recommended outcome"><select className="input" value={mf.recommendedOutcome} onChange={(e) => setMgrForm({ ...mf, recommendedOutcome: e.target.value })}>
                  {Object.entries(OUTCOME_LABEL).filter(([k]) => r.cycle.type === 'probation' ? ['confirm', 'extend_probation', 'not_confirmed'].includes(k) : !['confirm', 'extend_probation', 'not_confirmed'].includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                {['raise', 'promotion'].includes(mf.recommendedOutcome) && <Field label="Raise %"><input type="number" min="0" max="50" className="input" value={mf.raisePercent} onChange={(e) => setMgrForm({ ...mf, raisePercent: Number(e.target.value) })} /></Field>}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" loading={busy} onClick={() => save(`/performance/reviews/${id}/manager`, mf, false)}>Save draft</Button>
              <Button loading={busy} disabled={!mf.recommendedRating} onClick={() => save(`/performance/reviews/${id}/manager`, mf, true, 'Review sent to HR for calibration')}>Submit to HR</Button>
            </div>
          </Card>
        ) : r.manager?.submittedAt && (
          <Card title="Manager assessment" action={<span className="text-xs text-slate-500">{fmtDateTime(r.manager.submittedAt)}</span>}>
            <RatingRows comps={comps} labels={labels} rows={r.manager.competencies} readOnly />
            {r.manager.goals?.length > 0 && <><p className="label mt-4">Goals</p><RatingRows comps={comps} labels={labels} rows={r.manager.goals} readOnly /></>}
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              {[['Strengths', r.manager.strengths], ['To improve', r.manager.improvements], ['Overall', r.manager.overallComment]].map(([k, v]) => <div key={k} className="rounded-xl bg-slate-50 p-3"><p className="label">{k}</p><p className="whitespace-pre-wrap">{v || '—'}</p></div>)}
            </div>
            {viewer !== 'self' && <p className="mt-3 text-sm text-slate-600">Recommended: <b>{r.manager.recommendedRating} · {labels[r.manager.recommendedRating]}</b> · {OUTCOME_LABEL[r.manager.recommendedOutcome]}{r.manager.raisePercent ? ` (${r.manager.raisePercent}%)` : ''} · Calculated from ratings: <b>{r.calculatedRating ?? '—'}</b></p>}
          </Card>
        )}

        {/* ---- Self vs manager ---- */}
        {r.self?.submittedAt && (canManager ? mf.competencies.some((c) => c.rating) : r.manager?.submittedAt) && (
          <RatingGap self={r.self} manager={canManager ? mf : r.manager} viewer={viewer} live={canManager}
            employee={r.user.firstName} reviewer={r.reviewer && r.reviewer._id !== r.user._id ? fullName(r.reviewer) : undefined} />
        )}

        {/* ---- HR finalisation ---- */}
        {canFinal && (
          <Card title="Final rating & outcome (HR)">
            {(() => {
              const f = final || { finalRating: r.finalRating || r.manager?.recommendedRating || Math.round(r.calculatedRating || 0) || 0, finalOutcome: r.finalOutcome || r.manager?.recommendedOutcome || 'none', raisePercent: r.raisePercent ?? r.manager?.raisePercent ?? '', outcomeNotes: r.outcomeNotes || '' };
              return (
                <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try { await api.post(`/performance/reviews/${id}/finalize`, f); toast.success('Review finalised; employee notified'); setFinal(null); reload(); } catch (err) { toastError(err); } finally { setBusy(false); }
                }}>
                  <div><span className="label">Final rating</span><RatingInput value={f.finalRating} labels={labels} onChange={(n) => setFinal({ ...f, finalRating: n })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Outcome"><select className="input" value={f.finalOutcome} onChange={(e) => setFinal({ ...f, finalOutcome: e.target.value })}>{Object.entries(OUTCOME_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                    {['raise', 'promotion'].includes(f.finalOutcome) && <Field label="Raise %"><input type="number" min="0" className="input" value={f.raisePercent} onChange={(e) => setFinal({ ...f, raisePercent: Number(e.target.value) })} /></Field>}
                  </div>
                  <Field label="Notes for the employee" className="md:col-span-2"><textarea rows={2} className="input" value={f.outcomeNotes} onChange={(e) => setFinal({ ...f, outcomeNotes: e.target.value })} /></Field>
                  {['confirm', 'extend_probation', 'not_confirmed'].includes(f.finalOutcome) && <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 md:col-span-2">This updates their probation on their staff record and onboarding plan.</p>}
                  <div className="md:col-span-2"><Button loading={busy} disabled={!f.finalRating}>{r.status === 'finalized' ? 'Update final outcome' : 'Finalise & share with employee'}</Button></div>
                </form>
              );
            })()}
          </Card>
        )}

        {finalDone && (
          <Card title="Outcome">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-700 text-3xl font-semibold text-white">{r.finalRating}</div>
              <div><p className="text-lg font-semibold">{labels[r.finalRating]}</p><p className="text-slate-600">{OUTCOME_LABEL[r.finalOutcome]}{r.raisePercent ? ` · ${r.raisePercent}%` : ''}</p></div>
            </div>
            {r.outcomeNotes && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">{r.outcomeNotes}</p>}
            {r.status === 'acknowledged' ? (
              <div className="mt-4 flex items-center gap-3 text-sm text-slate-600"><SuccessCheck className="h-8 w-8" />Acknowledged {fmtDateTime(r.acknowledgedAt)}{r.employeeComment && <span>· "{r.employeeComment}"</span>}</div>
            ) : viewer === 'self' && (
              <div className="mt-4 space-y-3">
                <Field label="Your response (optional)" hint="If you disagree with anything, say so here. HR will see it."><textarea rows={2} className="input" value={ackComment} onChange={(e) => setAckComment(e.target.value)} /></Field>
                <Button loading={busy} onClick={async () => { setBusy(true); try { await api.post(`/performance/reviews/${id}/acknowledge`, { comment: ackComment }); toast.success('Thanks. Your review is complete'); reload(); } catch (e) { toastError(e); } finally { setBusy(false); } }}>I've read my review</Button>
              </div>
            )}
          </Card>
        )}
        {viewer === 'self' && !finalDone && r.status !== 'self_review' && <Card><p className="text-sm text-slate-600"><TrendingUp className="mr-1 inline h-4 w-4" /> Your self-assessment is with {r.reviewer ? fullName(r.reviewer) : 'your manager'}. You'll be notified when your review is ready.</p></Card>}
      </div>
      <p className="mt-6 text-center text-xs text-slate-500"><Link to={viewer === 'hr' ? '/admin/performance' : '/performance'} className="hover:text-brand-700">All reviews</Link></p>
    </div>
  );
}
