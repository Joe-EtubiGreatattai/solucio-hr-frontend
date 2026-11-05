import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Circle, DoorOpen, HeartHandshake } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import { Badge, Button, Card, Field, PageHeader, ProgressBar, Spinner, SuccessCheck } from '../../components/ui';
import { fmtDate, ymd } from '../../lib/format';
import { EXIT_RATING_LABEL, EXIT_REASON_LABEL, OWNER_LABEL } from '../../lib/exits';
import { Term } from '../../components/InfoTip';

function Resign({ onDone }) {
  const ask = useConfirm();
  const [f, setF] = useState({ lastDay: ymd(new Date(Date.now() + 30 * 86400000)), reasonCategory: '', reason: '', forwardingAddress: '' });
  const submit = async (e) => {
    e.preventDefault();
    if (!(await ask({ title: 'Submit your resignation?', message: `Your intended last day is ${fmtDate(f.lastDay)}. HR and your manager will be told. You can withdraw it until HR accepts.`, confirmLabel: 'Submit resignation' }))) return;
    try { await api.post('/engagement/resign', f); toast.success('Resignation submitted'); onDone(); } catch (err) { toastError(err); }
  };
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1"><div className="flex gap-3"><HeartHandshake className="h-6 w-6 shrink-0 text-brand-700" /><div className="text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Before you decide</p>
        <p className="mt-1">If something is pushing you to leave (pay, workload, your shifts, a colleague), HR would genuinely like the chance to help. Talk to your manager or HR, or <Link to="/relations" className="font-semibold text-brand-700 underline">raise a concern</Link>.</p></div></div></Card>
      <Card title="Resign" className="lg:col-span-2">
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Intended last working day" hint="Check your contract for your notice period (often one month)"><input type="date" className="input" required min={ymd()} value={f.lastDay} onChange={(e) => setF({ ...f, lastDay: e.target.value })} /></Field>
          <Field label="Main reason (optional)"><select className="input" value={f.reasonCategory} onChange={(e) => setF({ ...f, reasonCategory: e.target.value })}><option value="">Prefer not to say</option>{Object.entries(EXIT_REASON_LABEL).filter(([k]) => !['conduct', 'performance'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Your address after you leave" className="sm:col-span-2" hint="Where HR sends your final payslip, tax and pension documents and any reference. You can change it later.">
            <textarea rows={3} className="input" required placeholder="House number, street, town, state" autoComplete="street-address" value={f.forwardingAddress} onChange={(e) => setF({ ...f, forwardingAddress: e.target.value })} />
          </Field>
          <Field label="Anything you'd like to add (optional)" className="sm:col-span-2"><textarea rows={4} className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Button variant="danger"><DoorOpen className="h-4 w-4" /> Submit resignation</Button></div>
        </form>
      </Card>
    </div>
  );
}

// Editable while the notice runs, in case they move before the last day.
function ForwardingAddress({ exit, onSaved }) {
  const [value, setValue] = useState(exit.forwardingAddress || '');
  const [busy, setBusy] = useState(false);
  const changed = value.trim() !== (exit.forwardingAddress || '');
  const save = async () => {
    setBusy(true);
    try { await api.put('/engagement/leaving/address', { forwardingAddress: value.trim() }); toast.success('Address saved'); onSaved(); } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  return (
    <Card title="Your address after you leave" className="mb-6">
      <p className="mb-3 text-sm text-slate-500">HR sends your final payslip, tax and pension documents and any reference here.</p>
      <textarea rows={3} className="input" placeholder="House number, street, town, state" autoComplete="street-address" value={value} onChange={(e) => setValue(e.target.value)} />
      {!exit.forwardingAddress && !value && <p className="mt-2 text-sm text-amber-700">Please add one so your documents reach you.</p>}
      <div className="mt-3 flex justify-end"><Button size="sm" loading={busy} disabled={!changed || !value.trim()} onClick={save}>Save address</Button></div>
    </Card>
  );
}

function Rate({ value, onChange, label }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span className="text-sm">{label}</span>
      <span className="flex gap-1" role="radiogroup" aria-label={label}>{[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)}
          className={`h-10 w-10 rounded-lg border text-sm font-semibold transition active:scale-95 ${value === n ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 hover:border-brand-300'}`}>{n}</button>
      ))}</span>
    </div>
  );
}

function Interview({ exit, onDone }) {
  const [f, setF] = useState({ ratings: {}, wouldRecommend: null, wouldReturn: null, likedMost: '', improve: '', comments: '', reasonCategory: exit.reasonCategory || '' });
  const submit = async (decline) => { try { await api.post('/engagement/leaving/interview', decline ? { decline: true } : f); toast.success(decline ? 'No problem' : 'Thank you for your feedback'); onDone(); } catch (e) { toastError(e); } };
  return (
    <Card title="Exit interview">
      <p className="mb-4 text-sm text-slate-600">Honest feedback helps us keep good people. HR reads every answer; it won't affect your reference.</p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div><p className="label"><Term>How would you rate… (1 poor, 5 excellent)</Term></p><div className="divide-y divide-slate-100">{Object.entries(EXIT_RATING_LABEL).map(([k, l]) => <Rate key={k} label={l} value={f.ratings[k]} onChange={(v) => setF({ ...f, ratings: { ...f.ratings, [k]: v } })} />)}</div></div>
        <div className="space-y-4">
          <div><p className="label"><Term>Would you recommend Solucio as a place to work? (0–10)</Term></p><div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">{[...Array(11)].map((_, i) => (
            <button key={i} type="button" aria-pressed={f.wouldRecommend === i} onClick={() => setF({ ...f, wouldRecommend: i })} className={`h-10 rounded-lg border text-sm font-semibold ${f.wouldRecommend === i ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200'}`}>{i}</button>))}</div></div>
          <div><p className="label"><Term>Would you come back one day?</Term></p><div className="flex gap-2">{[['Yes', true], ['No', false]].map(([l, v]) => <Button key={l} type="button" size="sm" variant={f.wouldReturn === v ? 'primary' : 'secondary'} onClick={() => setF({ ...f, wouldReturn: v })}>{l}</Button>)}</div></div>
          <Field label="Main reason for leaving"><select className="input" value={f.reasonCategory} onChange={(e) => setF({ ...f, reasonCategory: e.target.value })}><option value="">Prefer not to say</option>{Object.entries(EXIT_REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <Field label="What did you like most about working here?"><textarea rows={3} className="input" value={f.likedMost} onChange={(e) => setF({ ...f, likedMost: e.target.value })} /></Field>
        <Field label="What one thing should we change?"><textarea rows={3} className="input" value={f.improve} onChange={(e) => setF({ ...f, improve: e.target.value })} /></Field>
      </div>
      <div className="mt-6 flex flex-wrap gap-2"><Button onClick={() => submit(false)}>Submit feedback</Button><Button variant="ghost" onClick={() => submit(true)}>I'd rather not</Button></div>
    </Card>
  );
}

export default function Leaving() {
  const { data: exit, loading, reload } = useFetch('/engagement/leaving');
  const ask = useConfirm();
  if (loading && exit === null) return <Spinner />;
  const toggle = async (t) => { try { await api.put(`/engagement/leaving/tasks/${t._id}`, { done: !t.done }); reload(); } catch (e) { toastError(e); } };
  const withdraw = async () => { if (!(await ask({ title: 'Withdraw your resignation?', confirmLabel: 'Withdraw' }))) return; try { await api.post('/engagement/leaving/withdraw', {}); toast.success("Withdrawn. We're glad you're staying"); reload(); } catch (e) { toastError(e); } };

  if (!exit) return <div><PageHeader title="Leaving Solucio" subtitle="Resign, and everything that happens before your last day." /><Resign onDone={reload} /></div>;
  const daysLeft = Math.ceil((new Date(exit.lastDay) - Date.now()) / 86400000);
  const done = exit.checklist.filter((c) => c.done).length;
  return (
    <div>
      <PageHeader title="Leaving Solucio" subtitle="Your last day, handover and exit interview." />
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="animate-fade-up rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-6 text-white shadow-sm">
          <p className="flex items-center gap-2 text-sm text-brand-100"><CalendarDays className="h-4 w-4" /> Last working day</p>
          <p className="mt-2 text-3xl font-semibold">{fmtDate(exit.lastDay)}</p>
          <p className="text-sm text-brand-100">{daysLeft > 0 ? `${daysLeft} days to go` : 'Today or past'}</p>
          {exit.status === 'requested' && <div className="mt-4 rounded-2xl bg-white/10 p-3 text-sm">Waiting for HR to accept your resignation.<Button size="sm" variant="secondary" className="mt-3 w-full" onClick={withdraw}>Withdraw resignation</Button></div>}
        </div>
        {exit.status === 'requested' && (
          <Card title="What happens next" className="lg:col-span-2">
            <ol className="stagger space-y-3 text-sm">{[
              'HR confirms your resignation and agrees your last day with you.',
              'A leaving checklist appears here: handover, returning your badge and equipment.',
              'You will be invited to a short, confidential exit interview.',
              'Your final pay includes any unused leave; loans are settled and pension and tax documents are prepared.',
            ].map((t, i) => <li key={t} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span><span className="pt-0.5 text-slate-700">{t}</span></li>)}</ol>
          </Card>
        )}
        {exit.status === 'in_progress' && (
          <Card title="Leaving checklist" className="lg:col-span-2" action={<span className="text-sm text-slate-500">{done}/{exit.checklist.length}</span>}>
            <ProgressBar value={(done / exit.checklist.length) * 100} tone="bg-brand-600" />
            <ul className="mt-4 divide-y divide-slate-100">{exit.checklist.map((t) => {
              const mine = t.owner === 'employee';
              const Icon = t.done ? CheckCircle2 : Circle;
              return (
                <li key={t._id} className="flex items-center gap-3 py-2.5">
                  {mine ? <button type="button" onClick={() => toggle(t)} aria-label={t.done ? 'Mark not done' : 'Mark done'} className="rounded-full"><Icon className={`h-6 w-6 ${t.done ? 'text-emerald-600' : 'text-slate-300 hover:text-brand-600'}`} /></button> : <Icon className={`h-6 w-6 ${t.done ? 'text-emerald-600' : 'text-slate-200'}`} />}
                  <span className={`flex-1 text-sm ${t.done ? 'text-slate-500 line-through' : ''}`}>{t.task}</span>
                  <Badge color={mine ? 'teal' : 'slate'}>{OWNER_LABEL[t.owner]}</Badge>
                </li>
              );
            })}</ul>
          </Card>
        )}
      </div>
      <ForwardingAddress key={exit.forwardingAddress || ''} exit={exit} onSaved={reload} />
      {exit.interview?.status === 'pending' && <Interview exit={exit} onDone={reload} />}
      {exit.interview?.status === 'completed' && <Card><div className="flex items-center gap-4"><SuccessCheck className="h-12 w-12" /><p className="text-sm text-slate-600">Thank you for your exit interview. We wish you every success.</p></div></Card>}
    </div>
  );
}
