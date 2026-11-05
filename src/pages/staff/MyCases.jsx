import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Gavel, MessageSquareWarning, Plus, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import CaseTimeline from '../../components/CaseTimeline';
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner } from '../../components/ui';
import { fmtDate, fmtDateTime, fullName, titleCase } from '../../lib/format';
import { CASE_CATEGORIES, CASE_STATUS, CASE_TYPE_LABEL, OUTCOME_LABEL } from '../../lib/relations';

function RaiseGrievance({ onClose, onDone }) {
  const { data: staff } = useFetch('/users/directory', { initial: [] });
  const [f, setF] = useState({ category: 'workload', title: '', description: '', against: '' });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/relations/grievance', { ...f, against: f.against ? [f.against] : [] }); toast.success('Grievance raised. HR will be in touch'); onDone(); } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Raise a formal grievance" size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="grv" loading={busy}>Raise grievance</Button></>}>
      <form id="grv" onSubmit={save} className="space-y-4">
        <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">This is a formal, named complaint. HR will investigate, may meet you (you can bring a colleague), and will tell you the outcome in writing. If you'd rather stay anonymous, use <Link to="/anonymous" className="font-semibold underline">Speak up</Link> instead.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="What is it about?"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CASE_CATEGORIES.filter((c) => !['attendance', 'performance', 'fraud', 'policy_breach'].includes(c)).map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
          <Field label="Is it about a person? (optional)"><select className="input" value={f.against} onChange={(e) => setF({ ...f, against: e.target.value })}><option value="">No / prefer to explain below</option>{staff.map((s) => <option key={s._id} value={s._id}>{fullName(s)}</option>)}</select></Field>
        </div>
        <Field label="Summary"><input className="input" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Unsafe staffing on night shifts" /></Field>
        <Field label="What happened, and what would put it right?" hint="Include dates, who was involved and anything you've already tried"><textarea rows={6} className="input" required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </form>
    </Modal>
  );
}

function CaseView({ id }) {
  const { data: c, loading, reload } = useFetch(`/relations/${id}`);
  const ask = useConfirm();
  const [statement, setStatement] = useState('');
  if (loading && !c) return <Spinner />;
  if (!c) return <Empty title="Case not found" />;
  const post = async (path, body, msg) => { try { await api.post(`/relations/${id}/${path}`, body); toast.success(msg); reload(); return true; } catch (e) { toastError(e); return false; } };
  const appealOpen = c.outcome && c.outcome !== 'withdrawn' && !c.appeal?.requestedAt && c.appeal?.deadline && new Date(c.appeal.deadline) > new Date();
  const appeal = async () => {
    const reason = await ask({ title: 'Appeal this decision', message: 'Explain why you think the decision is wrong or unfair. Someone not involved in the original decision will review it.', input: { label: 'Grounds of appeal', required: true, multiline: true }, confirmLabel: 'Submit appeal' });
    if (reason) post('appeal', { reason }, 'Appeal submitted');
  };
  const withdraw = async () => { if (await ask({ title: 'Withdraw your grievance?', message: 'HR will close the case. You can raise it again later if you need to.', confirmLabel: 'Withdraw', tone: 'danger' })) post('withdraw', {}, 'Grievance withdrawn'); };

  return (
    <div>
      <Link to="/relations" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> My cases</Link>
      <div className="mb-6"><div className="flex flex-wrap gap-2"><Badge color="teal">{CASE_TYPE_LABEL[c.type]}</Badge><Badge color={CASE_STATUS[c.status][1]}>{CASE_STATUS[c.status][0]}</Badge></div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{c.title}</h1><p className="text-sm text-slate-500">{c.reference} · opened {fmtDate(c.createdAt)}</p></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={c.type === 'disciplinary' ? 'The concern raised' : 'Your grievance'}><p className="whitespace-pre-line text-sm">{c.description}</p></Card>
          {c.status !== 'closed' && c.status !== 'appeal' && (
            <Card title={c.type === 'disciplinary' ? 'Your response' : 'Add information'}>
              <textarea rows={4} className="input" aria-label="Your statement" placeholder={c.type === 'disciplinary' ? 'Give your account. It goes on the record and the decision-maker will read it.' : 'Anything else HR should know'} value={statement} onChange={(e) => setStatement(e.target.value)} />
              <Button className="mt-3" disabled={!statement.trim()} onClick={async () => { if (await post('statement', { text: statement }, 'Added to your case')) setStatement(''); }}>Submit</Button>
            </Card>
          )}
          <Card title="What has happened so far"><CaseTimeline events={c.timeline} /></Card>
        </div>
        <div className="order-first space-y-6 lg:order-none">
          {c.hearing?.at && c.status === 'hearing' && (
            <Card><div className="flex gap-3"><CalendarClock className="h-6 w-6 shrink-0 text-brand-700" /><div><p className="font-semibold">Hearing: {fmtDateTime(c.hearing.at)}</p><p className="text-sm text-slate-600">{c.hearing.location}</p>
              <p className="mt-2 text-sm text-slate-600">You may bring a colleague or representative. If you can't attend, tell HR as soon as possible.</p></div></div></Card>
          )}
          {c.outcome && (
            <Card title="Decision">
              <p className="text-lg font-semibold">{OUTCOME_LABEL[c.outcome]}</p><p className="mt-1 whitespace-pre-line text-sm">{c.outcomeSummary}</p>
              {c.warningExpires && <p className="mt-2 text-xs text-slate-500">Stays on your record until {fmtDate(c.warningExpires)}.</p>}
              {appealOpen && <Button className="mt-4" variant="secondary" onClick={appeal}><Gavel className="h-4 w-4" /> Appeal (until {fmtDate(c.appeal.deadline)})</Button>}
              {c.appeal?.requestedAt && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Appeal {c.appeal.decision === 'pending' ? 'submitted and being reviewed' : `decided: ${titleCase(c.appeal.decision)}`}.</p>}
            </Card>
          )}
          <Card><div className="flex gap-3 text-sm text-slate-600"><ShieldCheck className="h-5 w-5 shrink-0 text-brand-700" /><p>Cases are confidential to HR and those directly involved. You won't be treated unfairly for raising a concern in good faith.</p></div></Card>
          {c.type === 'grievance' && c.status !== 'closed' && <Button variant="ghost" onClick={withdraw}>Withdraw grievance</Button>}
        </div>
      </div>
    </div>
  );
}

export default function MyCases() {
  const { id } = useParams();
  const { data: cases, loading, reload } = useFetch('/relations/mine', { initial: [] });
  const [raising, setRaising] = useState(false);
  if (id) return <CaseView id={id} />;
  return (
    <div>
      <PageHeader title="My cases" subtitle="Raise a formal grievance, and follow any case that involves you." actions={<Button onClick={() => setRaising(true)}><Plus className="h-4 w-4" /> Raise a grievance</Button>} />
      {loading ? <Spinner /> : cases.length === 0 ? (
        <Card><Empty icon={MessageSquareWarning} title="No cases">If something at work isn't right and talking to your manager hasn't fixed it, you can raise a formal grievance. To report something anonymously, use <Link to="/anonymous" className="font-semibold text-brand-700 underline">Speak up</Link>.</Empty></Card>
      ) : (
        <div className="stagger space-y-3">{cases.map((c) => (
          <Link key={c._id} to={`/relations/${c._id}`} className="card lift flex flex-wrap items-center gap-3 p-5">
            <span className="min-w-48 flex-1"><span className="block font-semibold">{c.title}</span><span className="text-xs text-slate-500">{c.reference} · {CASE_TYPE_LABEL[c.type]} · {fmtDate(c.createdAt)}</span></span>
            {c.outcome && <span className="text-sm text-slate-600">{OUTCOME_LABEL[c.outcome]}</span>}
            <Badge color={CASE_STATUS[c.status][1]}>{CASE_STATUS[c.status][0]}</Badge>
          </Link>
        ))}</div>
      )}
      {raising && <RaiseGrievance onClose={() => setRaising(false)} onDone={() => { setRaising(false); reload(); }} />}
    </div>
  );
}
