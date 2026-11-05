import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Eye, EyeOff, Gavel, RotateCcw, Search, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import StaffPicker from '../../components/StaffPicker';
import CaseTimeline from '../../components/CaseTimeline';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, Spinner } from '../../components/ui';
import { fmtDate, fmtDateTime, fullName, titleCase, ymd } from '../../lib/format';
import { CASE_STATUS, CASE_TYPE_LABEL, DISCIPLINARY_OUTCOMES, GRIEVANCE_OUTCOMES, OUTCOME_LABEL, SEVERITY_COLOR } from '../../lib/relations';
import { Term } from '../../components/InfoTip';

function HearingModal({ c, onClose, onDone }) {
  const [f, setF] = useState({ at: '', location: c.hearing?.location || 'HR meeting room', panel: [] });
  const save = async () => { try { await api.post(`/relations/${c._id}/hearing`, { ...f, at: f.at && new Date(f.at).toISOString() }); toast.success('Hearing scheduled; the employee has been invited'); onDone(); } catch (e) { toastError(e); } };
  return (
    <Modal open onClose={onClose} title="Schedule a hearing" size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Send invitation</Button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date and time"><input type="datetime-local" className="input" value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} /></Field>
        <Field label="Location"><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        <div className="sm:col-span-2"><span className="label">Panel</span><StaffPicker value={f.panel} onChange={(panel) => setF({ ...f, panel })} height="max-h-48" /></div>
        <p className="text-sm text-slate-500 sm:col-span-2">The invitation tells the employee they may bring a colleague or representative. Give reasonable notice (at least 48 hours is good practice).</p>
      </div>
    </Modal>
  );
}

function OutcomeModal({ c, onClose, onDone }) {
  const options = c.type === 'grievance' ? GRIEVANCE_OUTCOMES : DISCIPLINARY_OUTCOMES;
  const [f, setF] = useState({ outcome: options[0], summary: '', suspend: true, lastDay: ymd() });
  const save = async () => { try { await api.post(`/relations/${c._id}/outcome`, f); toast.success('Decision recorded and shared'); onDone(); } catch (e) { toastError(e); } };
  return (
    <Modal open onClose={onClose} title="Record the decision" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={f.outcome === 'dismissal' ? 'danger' : 'primary'} onClick={save}>Record decision</Button></>}>
      <div className="space-y-4">
        <Field label="Outcome"><select className="input" value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}>{options.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}</select></Field>
        {['verbal_warning', 'written_warning', 'final_warning'].includes(f.outcome) && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">The warning stays live on their record for {f.outcome === 'verbal_warning' ? '6' : '12'} months.</p>}
        {f.outcome === 'suspension' && <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={f.suspend} onChange={(e) => setF({ ...f, suspend: e.target.checked })} /> Set their status to suspended now</label>}
        {f.outcome === 'dismissal' && <Field label="Last day of employment" hint="Starts the exit process (no exit interview, not eligible for rehire)"><input type="date" className="input" value={f.lastDay} onChange={(e) => setF({ ...f, lastDay: e.target.value })} /></Field>}
        <Field label="Reasons for the decision" hint="Shared with the employee, with their right to appeal"><textarea rows={5} className="input" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function AppealModal({ c, onClose, onDone }) {
  const [f, setF] = useState({ decision: 'upheld', notes: '', newOutcome: c.outcome });
  const save = async () => { try { await api.post(`/relations/${c._id}/appeal-decision`, f); toast.success('Appeal decided'); onDone(); } catch (e) { toastError(e); } };
  const options = c.type === 'grievance' ? GRIEVANCE_OUTCOMES : DISCIPLINARY_OUTCOMES;
  return (
    <Modal open onClose={onClose} title="Decide the appeal" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Record appeal decision</Button></>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">Grounds of appeal</p><p className="mt-1 whitespace-pre-line">{c.appeal?.reason}</p></div>
        <Field label="Decision"><select className="input" value={f.decision} onChange={(e) => setF({ ...f, decision: e.target.value })}>
          <option value="upheld">Original decision stands</option><option value="varied">Change the outcome</option><option value="overturned">Overturn completely</option></select></Field>
        {f.decision === 'varied' && <Field label="New outcome"><select className="input" value={f.newOutcome} onChange={(e) => setF({ ...f, newOutcome: e.target.value })}>{options.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}</select></Field>}
        <Field label="Reasons" hint="Shared with the employee. This is the final stage."><textarea rows={4} className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <p className="text-xs text-slate-500"><Term>Good practice: someone not involved in the original decision hears the appeal.</Term></p>
      </div>
    </Modal>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const { data: c, loading, reload } = useFetch(`/relations/${id}`);
  const { data: staff } = useFetch('/users/directory', { initial: [] });
  const [note, setNote] = useState({ text: '', kind: 'note', visibleToEmployee: false });
  const [modal, setModal] = useState('');
  if (loading && !c) return <Spinner />;
  if (!c) return <Empty title="Case not found" />;
  const done = () => { setModal(''); reload(); };
  const addNote = async (e) => {
    e.preventDefault();
    try { await api.post(`/relations/${id}/notes`, note); setNote({ text: '', kind: 'note', visibleToEmployee: false }); reload(); toast.success(note.visibleToEmployee ? 'Added and shared with the employee' : 'Note added'); } catch (err) { toastError(err); }
  };
  const status = async (s) => { try { await api.post(`/relations/${id}/status`, { status: s }); reload(); } catch (e) { toastError(e); } };
  const update = async (patch) => { try { await api.put(`/relations/${id}`, patch); reload(); toast.success('Saved'); } catch (e) { toastError(e); } };
  const closed = c.status === 'closed';

  return (
    <div>
      <Link to="/admin/relations" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Employee relations</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2"><Badge color="teal">{CASE_TYPE_LABEL[c.type]}</Badge><Badge color={CASE_STATUS[c.status][1]}>{CASE_STATUS[c.status][0]}</Badge><Badge color={SEVERITY_COLOR[c.severity]}>{titleCase(c.severity)} severity</Badge></div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{c.title}</h1>
          <p className="text-sm text-slate-500">{c.reference} · {titleCase(c.category)} · opened {fmtDate(c.createdAt)}{c.source?.kind === 'anonymous' && ' from an anonymous report'}{c.source?.kind === 'note' && ' from a staff report'}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {c.status === 'open' && <Button variant="secondary" onClick={() => status('investigating')}><Search className="h-4 w-4" /> Start investigation</Button>}
          {!closed && c.status !== 'appeal' && c.employee && <Button variant="secondary" onClick={() => setModal('hearing')}><CalendarClock className="h-4 w-4" /> {c.hearing?.at ? 'Reschedule hearing' : 'Schedule hearing'}</Button>}
          {['investigating', 'hearing'].includes(c.status) && <Button variant="ghost" onClick={() => status('awaiting_outcome')}>Ready for decision</Button>}
          {!closed && c.status !== 'appeal' && <Button onClick={() => setModal('outcome')}><Gavel className="h-4 w-4" /> Record decision</Button>}
          {c.status === 'appeal' && <Button onClick={() => setModal('appeal')}><Gavel className="h-4 w-4" /> Decide appeal</Button>}
          {closed && <Button variant="ghost" onClick={() => status('open')}><RotateCcw className="h-4 w-4" /> Reopen</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={c.type === 'disciplinary' ? 'Allegation' : 'Details'}><p className="whitespace-pre-line text-sm text-slate-700">{c.description}</p>
            {c.against?.length > 0 && <p className="mt-3 text-sm"><span className="text-slate-500">About: </span>{c.against.map(fullName).join(', ')}</p>}</Card>
          {c.outcome && (
            <Card title="Decision">
              <p className="text-lg font-semibold">{OUTCOME_LABEL[c.outcome]}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{c.outcomeSummary}</p>
              <p className="mt-2 text-xs text-slate-500">{fmtDate(c.outcomeAt)}{c.warningExpires && ` · warning live until ${fmtDate(c.warningExpires)}`}{c.appeal?.deadline && !c.appeal?.requestedAt && ` · appeal window ${new Date(c.appeal.deadline) > new Date() ? 'open until' : 'closed'} ${fmtDate(c.appeal.deadline)}`}</p>
              {c.appeal?.requestedAt && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Appeal {c.appeal.decision === 'pending' ? 'pending' : titleCase(c.appeal.decision)}</b>, lodged {fmtDate(c.appeal.requestedAt)}: {c.appeal.reason}{c.appeal.decisionNotes && <p className="mt-1">{c.appeal.decisionNotes}</p>}</div>}
            </Card>
          )}
          <Card title="Case record">
            {!closed && (
              <form onSubmit={addNote} className="mb-6 space-y-3 rounded-2xl bg-slate-50 p-4">
                <textarea rows={3} className="input" aria-label="Add to the record" placeholder="Add a note, interview summary or evidence…" value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} />
                <div className="flex flex-wrap items-center gap-3">
                  <select className="input w-auto" aria-label="Kind" value={note.kind} onChange={(e) => setNote({ ...note, kind: e.target.value })}><option value="note">Note</option><option value="meeting">Meeting</option></select>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={note.visibleToEmployee} onChange={(e) => setNote({ ...note, visibleToEmployee: e.target.checked })} />
                    {note.visibleToEmployee ? <><Eye className="h-4 w-4" /> Share with the employee</> : <><EyeOff className="h-4 w-4" /> HR only</>}</label>
                  <Button size="sm" className="ml-auto" disabled={!note.text.trim()}><Send className="h-4 w-4" /> Add</Button>
                </div>
              </form>
            )}
            <CaseTimeline events={c.timeline} showPrivacy />
          </Card>
        </div>

        <div className="space-y-6">
          {c.employee && (
            <Card title="Employee">
              <Link to={`/admin/staff/${c.employee._id}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-slate-50"><Avatar user={c.employee} /><span><span className="block font-semibold">{fullName(c.employee)}</span><span className="text-xs text-slate-500">{c.employee.jobTitle} · {c.employee.department}</span></span></Link>
              <p className="mt-3 text-sm text-slate-600">{c.priorCases ? `${c.priorCases} other case(s) on record` : 'No other cases on record'}</p>
              {c.warnings?.length > 0 && <ul className="mt-2 space-y-1">{c.warnings.map((w) => <li key={w._id} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><b>{OUTCOME_LABEL[w.outcome]}</b> ({w.reference}) until {fmtDate(w.warningExpires)}</li>)}</ul>}
            </Card>
          )}
          <Card title="Handling">
            <div className="space-y-4">
              <Field label="Case owner"><select className="input" value={c.assignedTo?._id || ''} onChange={(e) => update({ assignedTo: e.target.value })}><option value="">Unassigned</option>{staff.filter((s) => s.role === 'admin' || s._id === c.assignedTo?._id).map((s) => <option key={s._id} value={s._id}>{fullName(s)}</option>)}</select></Field>
              <Field label="Target date"><input type="date" className="input" defaultValue={c.dueDate ? ymd(new Date(c.dueDate)) : ''} onBlur={(e) => e.target.value !== (c.dueDate ? ymd(new Date(c.dueDate)) : '') && update({ dueDate: e.target.value })} /></Field>
              <Field label="Severity"><select className="input" value={c.severity} onChange={(e) => update({ severity: e.target.value })}>{['low', 'medium', 'high', 'critical'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select></Field>
            </div>
          </Card>
          {c.hearing?.at && (
            <Card title="Hearing">
              <p className="font-semibold">{fmtDateTime(c.hearing.at)}</p>
              <p className="text-sm text-slate-600">{c.hearing.location}</p>
              {c.hearing.panel?.length > 0 && <p className="mt-2 text-sm"><span className="text-slate-500">Panel: </span>{c.hearing.panel.map(fullName).join(', ')}</p>}
              <p className="mt-2 text-xs text-slate-500">Employee may be accompanied.</p>
            </Card>
          )}
        </div>
      </div>
      {modal === 'hearing' && <HearingModal c={c} onClose={() => setModal('')} onDone={done} />}
      {modal === 'outcome' && <OutcomeModal c={c} onClose={() => setModal('')} onDone={done} />}
      {modal === 'appeal' && <AppealModal c={c} onClose={() => setModal('')} onDone={done} />}
    </div>
  );
}
