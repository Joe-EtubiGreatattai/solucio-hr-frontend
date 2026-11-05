import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CalendarPlus, ChevronLeft, FileDown, Mail, Pause, Pencil, Phone, Play, Send, Star, UserCheck, UserPlus, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { openFile, toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import StaffPicker from '../../components/StaffPicker';
import EmailStatusNote from '../../components/EmailStatusNote';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PasswordInput, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fmtDateTime, fmtMoney, fullName, timeAgo, titleCase, ymd } from '../../lib/format';
import { OpeningEditor, STAGE_LABEL } from './Recruitment';
import { Term } from '../../components/InfoTip';
import MoneyInput from '../../components/MoneyInput';

const COLUMNS = ['applied', 'screening', 'interview', 'offer', 'hired'];
const REC = { strong_yes: ['Strong yes', 'green'], yes: ['Yes', 'teal'], no: ['No', 'amber'], strong_no: ['Strong no', 'red'] };
const SOURCE = { careers_page: 'Careers page', internal: 'Internal', referral: 'Referral', agency: 'Agency', walk_in: 'Walk-in', other: 'Other' };
const idOf = (v) => (v && typeof v === 'object' ? v._id : v || '');

function Stars({ value, onChange, size = 'h-4 w-4' }) {
  return (
    <span className="inline-flex" role={onChange ? 'radiogroup' : 'img'} aria-label={`Rating ${value || 0} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => onChange ? (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(value === n ? null : n)} className="p-1">
          <Star className={`${size} transition ${n <= (value || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300'}`} />
        </button>
      ) : <Star key={n} className={`${size} ${n <= (value || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />)}
    </span>
  );
}

const EMAIL_KIND = { application_received: 'Application received', screening: 'Being reviewed', interview_scheduled: 'Interview invitation', interview_rescheduled: 'Interview changed',
  interview_cancelled: 'Interview cancelled', offer_sent: 'Job offer', rejected: 'Not successful', hired: 'Welcome', custom: 'Message from HR' };
const EMAIL_STATUS = { sent: ['Delivered to mail server', 'green'], failed: ['Failed', 'red'], not_configured: ['Saved, not sent', 'amber'] };

// Everything the candidate has been emailed, plus a box to write to them.
function EmailsTab({ app, onSent }) {
  const [open, setOpen] = useState(null);
  const [mail, setMail] = useState({ subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post(`/recruitment/applications/${app._id}/email`, mail); toast.success(`Email to ${app.email} saved and sent`); setMail({ subject: '', message: '' }); onSent(); } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <EmailStatusNote />
      <p className="text-sm text-slate-600">The system emails {app.firstName} at <b>{app.email}</b> when they apply, are shortlisted, invited to or moved from an interview, offered the job, not successful, or hired.</p>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
        {(app.emails || []).length === 0 && <li className="p-4 text-sm text-slate-500">No emails yet.</li>}
        {(app.emails || []).map((m) => (
          <li key={m._id}>
            <button type="button" onClick={() => setOpen(open === m._id ? null : m._id)} aria-expanded={open === m._id} className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-slate-50">
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{m.subject}</span><span className="text-xs text-slate-500">{EMAIL_KIND[m.kind] || m.kind} · {fmtDateTime(m.createdAt)}</span></span>
              <Badge color={EMAIL_STATUS[m.status][1]}>{EMAIL_STATUS[m.status][0]}</Badge>
            </button>
            {open === m._id && <div className="animate-fade-up border-t border-slate-100 bg-slate-50 px-4 py-3"><pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">{m.text}</pre>{m.error && <p className="mt-2 text-xs text-rose-600">{m.error}</p>}{m.note && <p className="mt-2 text-xs text-slate-500">{m.note}</p>}</div>}
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="space-y-3 rounded-2xl bg-slate-50 p-4">
        <p className="font-medium">Write to {app.firstName}</p>
        <input className="input" aria-label="Subject" placeholder="Subject, e.g. Documents for your interview" value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
        <textarea rows={5} className="input" aria-label="Message" placeholder={`Your message. It starts with "Dear ${app.firstName}," and is signed by HR.`} value={mail.message} onChange={(e) => setMail({ ...mail, message: e.target.value })} />
        <Button loading={busy} disabled={!mail.subject.trim() || !mail.message.trim()}><Mail className="h-4 w-4" /> Send email</Button>
      </form>
    </div>
  );
}

// ---------------- Hire ----------------
function HireModal({ app, opening, onClose, onHired }) {
  const { data: positions } = useFetch('/org/positions', { initial: [] });
  const { data: grades } = useFetch('/org/grades', { initial: [] });
  const { data: people } = useFetch('/users/directory', { initial: [] });
  const { data: templates } = useFetch('/onboarding/templates', { initial: [] });
  const internal = !!app.internalUser;
  const [form, setForm] = useState({
    email: app.email, password: '', staffId: '', startDate: app.offer?.startDate ? ymd(app.offer.startDate) : ymd(new Date(Date.now() + 14 * 86400000)),
    position: idOf(opening.position), grade: idOf(app.offer?.grade) || idOf(opening.grade), manager: idOf(opening.hiringManager), templateId: internal ? '' : '', buddy: '', emailCandidate: true,
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const internalTemplate = templates.find((t) => /internal|promotion/i.test(t.name));

  const hire = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/recruitment/applications/${app._id}/hire`, { ...form, templateId: form.templateId || (internal ? internalTemplate?._id || 'none' : undefined) });
      setDone(data);
      onHired();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };

  if (done) return (
    <Modal open onClose={onClose} title="Hired" footer={<Button onClick={onClose}>Done</Button>}>
      <div className="animate-fade-up space-y-3 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><UserCheck className="h-7 w-7" /></span>
        <p className="text-lg font-semibold">{app.firstName} {internal ? 'has moved to the new role' : 'has a staff account'}</p>
        {!internal && <p className="rounded-xl bg-slate-50 p-3 text-sm">Sign-in email: <b>{done.user.email}</b> · Staff ID <b>{done.user.staffId}</b><br />Share the initial password with them privately.</p>}
        {done.plan && <p className="text-sm text-slate-600">An onboarding plan has started. <Link to="/admin/onboarding" className="font-semibold text-brand-700">Open onboarding</Link></p>}
        {done.openingFilled && <p className="text-sm text-slate-600">All posts on this opening are now filled, so it's marked <b>Filled</b>.</p>}
      </div>
    </Modal>
  );

  return (
    <Modal open onClose={onClose} title={`Hire ${app.firstName} ${app.lastName}`} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="hire-form" variant="success" loading={busy}><UserPlus className="h-4 w-4" /> {internal ? 'Confirm move' : 'Create staff account'}</Button></>}>
      <form id="hire-form" onSubmit={hire} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {internal ? <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 sm:col-span-2">{app.firstName} already works here. Their record moves to the new position; no new account is created.</p> : <>
          <Field label="Sign-in email"><input type="email" className="input" required value={form.email} onChange={set('email')} /></Field>
          <Field label="Initial password" hint="At least 6 characters; share it privately"><PasswordInput required minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>
          <Field label="Staff ID (optional)" hint="Generated if left blank"><input className="input" value={form.staffId} onChange={set('staffId')} /></Field>
          <label className="flex items-center gap-3 self-end pb-2.5 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={form.emailCandidate} onChange={(e) => setForm({ ...form, emailCandidate: e.target.checked })} /> Email a welcome message (start date and sign-in email, never the password)</label>
        </>}
        <Field label="Start date"><input type="date" className="input" required value={form.startDate} onChange={set('startDate')} /></Field>
        <Field label="Position"><select className="input" value={form.position} onChange={set('position')}><option value="">—</option>{positions.map((p) => <option key={p._id} value={p._id}>{p.title} · {p.department}</option>)}</select></Field>
        <Field label="Grade"><select className="input" value={form.grade} onChange={set('grade')}><option value="">—</option>{grades.map((g) => <option key={g._id} value={g._id}>{g.code} · {g.name}</option>)}</select></Field>
        <Field label="Line manager"><select className="input" value={form.manager} onChange={set('manager')}><option value="">—</option>{people.map((p) => <option key={p._id} value={p._id}>{fullName(p)}</option>)}</select></Field>
        <Field label="Onboarding plan"><select className="input" value={form.templateId} onChange={set('templateId')}>
          <option value="">{internal ? `Automatic (${internalTemplate?.name || 'none'})` : 'Automatic (by department)'}</option>
          {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}<option value="none">No onboarding plan</option></select></Field>
        <Field label="Onboarding buddy"><select className="input" value={form.buddy} onChange={set('buddy')}><option value="">None</option>{people.map((p) => <option key={p._id} value={p._id}>{fullName(p)} · {p.jobTitle || '—'}</option>)}</select></Field>
      </form>
    </Modal>
  );
}

// ---------------- Candidate ----------------
function Candidate({ id, opening, onClose, onChanged }) {
  const { data: app, loading, reload } = useFetch(`/recruitment/applications/${id}`);
  const { data: grades } = useFetch('/org/grades', { initial: [] });
  const ask = useConfirm();
  const [tab, setTab] = useState('overview');
  const [note, setNote] = useState('');
  const [interview, setInterview] = useState(null);
  const [offer, setOffer] = useState(null);
  const [hiring, setHiring] = useState(false);
  const refresh = () => { reload(); onChanged(); };

  if (loading && !app) return <Modal open onClose={onClose} title="Candidate"><Spinner /></Modal>;
  if (!app) return null;
  const closed = ['hired', 'rejected', 'withdrawn'].includes(app.stage);

  // Returns true on success so forms only close/clear when the save worked.
  const call = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); refresh(); return true; } catch (e) { toastError(e); return false; } };
  const move = (stage) => call(() => api.put(`/recruitment/applications/${id}/stage`, { stage }), `Moved to ${STAGE_LABEL[stage]}`);
  const reject = async () => {
    const reason = await ask({ title: `Reject ${app.firstName}?`, message: app.internalUser ? 'They are a member of staff and will be notified.' : 'They will get a polite email saying their application was not successful, and see "Not progressed" on their status page. Your reason stays private.', input: { label: 'Reason (kept on file)', placeholder: 'e.g. Missing ACLS certification' }, confirmLabel: 'Reject', tone: 'danger' });
    if (reason !== false) call(() => api.put(`/recruitment/applications/${id}/stage`, { stage: 'rejected', note: reason }), 'Candidate rejected');
  };
  const grade = grades.find((g) => g._id === idOf(offer?.grade));

  return (
    <>
      <Modal open onClose={onClose} title={`${app.firstName} ${app.lastName}`} size="xl"
        footer={!closed && <>
          <Button variant="ghost" onClick={reject}><XCircle className="h-4 w-4" /> Reject</Button>
          <select className="input w-full sm:w-48" aria-label="Move to stage" value="" onChange={(e) => e.target.value && move(e.target.value)}>
            <option value="">Move to stage…</option>{['applied', 'screening', 'interview', 'offer'].filter((s) => s !== app.stage).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
          <Button variant="success" onClick={() => setHiring(true)}><UserCheck className="h-4 w-4" /> Hire</Button>
        </>}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge status={app.stage === 'hired' ? 'approved' : app.stage === 'rejected' ? 'rejected' : 'pending'}>{STAGE_LABEL[app.stage]}</Badge>
          <Badge color={app.internalUser ? 'purple' : 'slate'}>{SOURCE[app.source]}</Badge>
          {app.scorecardSummary.count > 0 && <Badge color="teal">{`Panel avg ${app.scorecardSummary.average}/5 · ${app.scorecardSummary.yes} yes, ${app.scorecardSummary.no} no`}</Badge>}
          <span className="ml-auto"><Stars value={app.rating} onChange={(r) => call(() => api.put(`/recruitment/applications/${id}/rating`, { rating: r }))} /></span>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'interviews', label: 'Interviews', count: app.interviews.length },
          { value: 'offer', label: 'Offer' }, { value: 'notes', label: 'Notes & history', count: app.notes.length }, { value: 'emails', label: 'Emails', count: app.emails?.length || 0 }]} />

        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            <div className="space-y-2 text-sm md:col-span-2">
              <a href={`mailto:${app.email}`} className="flex min-h-10 items-center gap-2 text-brand-700 hover:underline"><Mail className="h-4 w-4" />{app.email}</a>
              {app.phone && <a href={`tel:${app.phone}`} className="flex min-h-10 items-center gap-2 text-brand-700 hover:underline"><Phone className="h-4 w-4" />{app.phone}</a>}
              <dl className="space-y-1.5 rounded-xl bg-slate-50 p-3">
                {[['Applied', fmtDateTime(app.createdAt)], ['Experience', app.yearsExperience != null ? `${app.yearsExperience} years` : '—'], ['Current employer', app.currentEmployer || '—'],
                  ['Location', app.location || '—'], ...(app.referredBy ? [['Referred by', fullName(app.referredBy)]] : [])].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
                ))}
              </dl>
              {app.cv?.path && <Button variant="secondary" className="w-full" onClick={() => openFile(`/recruitment/applications/${id}/cv`)}><FileDown className="h-4 w-4" /> Open CV</Button>}
              {app.rejectionReason && <p className="rounded-xl bg-rose-50 p-3 text-rose-800"><b>Rejected:</b> {app.rejectionReason}</p>}
            </div>
            <div className="md:col-span-3">
              <p className="label"><Term>Cover letter</Term></p>
              <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{app.coverLetter || 'No cover letter.'}</p>
            </div>
          </div>
        )}

        {tab === 'interviews' && (
          <div className="space-y-4">
            {!closed && <Button variant="secondary" onClick={() => setInterview({ scheduledAt: '', durationMinutes: 45, mode: 'in_person', location: '', panel: (opening.panel || []).map(idOf), emailCandidate: true })}><CalendarPlus className="h-4 w-4" /> Schedule interview</Button>}
            {app.interviews.length === 0 ? <Empty title="No interviews yet" /> : app.interviews.map((i) => (
              <div key={i._id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{fmtDateTime(i.scheduledAt)}</b><span className="text-sm text-slate-500">· {i.durationMinutes} min · {titleCase(i.mode)}{i.location && ` · ${i.location}`}</span>
                  <Badge status={i.status === 'completed' ? 'completed' : i.status === 'cancelled' ? 'cancelled' : 'upcoming'}>{titleCase(i.status)}</Badge>
                  {i.status === 'scheduled' && <button type="button" className="ml-auto min-h-10 text-sm font-semibold text-rose-600 hover:underline" onClick={() => call(() => api.put(`/recruitment/applications/${id}/interviews/${i._id}`, { status: 'cancelled' }), 'Interview cancelled; candidate emailed')}>Cancel</button>}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {i.panel.map((p) => {
                    const card = i.scorecards.find((c) => idOf(c.interviewer) === p._id);
                    const avg = card?.ratings.length ? (card.ratings.reduce((a, r) => a + r.score, 0) / card.ratings.length).toFixed(1) : null;
                    return (
                      <div key={p._id} className="rounded-xl bg-slate-50 p-3 text-sm">
                        <div className="flex items-center gap-2"><Avatar user={p} size="sm" /><b className="flex-1">{fullName(p)}</b>{card ? <Badge color={REC[card.recommendation][1]}>{REC[card.recommendation][0]}</Badge> : <span className="text-xs text-slate-500">Scorecard pending</span>}</div>
                        {card && <>
                          {avg && <p className="mt-2 text-slate-600">Average {avg}/5: {card.ratings.map((r) => `${r.criterion} ${r.score}`).join(' · ')}</p>}
                          {card.strengths && <p className="mt-1"><b>Strengths:</b> {card.strengths}</p>}
                          {card.concerns && <p className="mt-1"><b>Concerns:</b> {card.concerns}</p>}
                        </>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'offer' && (
          offer ? (
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); call(() => api.put(`/recruitment/applications/${id}/offer`, offer), 'Offer saved').then((ok) => ok && setOffer(null)); }}>
              <Field label="Grade"><select className="input" value={idOf(offer.grade)} onChange={(e) => setOffer({ ...offer, grade: e.target.value })}><option value="">—</option>{grades.map((g) => <option key={g._id} value={g._id}>{g.code} · {g.name}</option>)}</select></Field>
              <Field label="Monthly basic salary (₦)" hint={grade ? `${grade.code} band: ${fmtMoney(grade.minSalary)}–${fmtMoney(grade.maxSalary)}` : undefined}>
                <MoneyInput className="input" required value={offer.salary || ''} onChange={(e) => setOffer({ ...offer, salary: Number(e.target.value) })} />
              </Field>
              {grade && offer.salary && (offer.salary < grade.minSalary || offer.salary > grade.maxSalary) && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">This salary is outside the {grade.code} band.</p>}
              <Field label="Start date"><input type="date" className="input" required value={offer.startDate ? ymd(offer.startDate) : ''} onChange={(e) => setOffer({ ...offer, startDate: e.target.value })} /></Field>
              <Field label="Offer expires"><input type="date" className="input" value={offer.expiresAt ? ymd(offer.expiresAt) : ''} onChange={(e) => setOffer({ ...offer, expiresAt: e.target.value })} /></Field>
              <Field label="Terms" className="sm:col-span-2"><textarea rows={3} className="input" value={offer.terms || ''} onChange={(e) => setOffer({ ...offer, terms: e.target.value })} /></Field>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button variant="secondary" type="button" onClick={() => setOffer(null)}>Cancel</Button>
                <Button>{app.offer?.status ? 'Save offer' : 'Save as draft'}</Button>
              </div>
            </form>
          ) : app.offer?.status ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2"><Badge status={app.offer.status === 'accepted' ? 'approved' : app.offer.status === 'declined' ? 'rejected' : app.offer.status === 'sent' ? 'pending' : 'draft'}>{titleCase(app.offer.status)}</Badge>
                  {app.offer.sentAt && <span className="text-sm text-slate-500">Sent {fmtDate(app.offer.sentAt)}</span>}</div>
                <p className="mt-3 text-2xl font-semibold">{fmtMoney(app.offer.salary)} <span className="text-base font-normal text-slate-500">/ month{app.offer.grade && ` · ${app.offer.grade.code}`}</span></p>
                <p className="text-sm text-slate-600">Starts {fmtDate(app.offer.startDate)}{app.offer.expiresAt && ` · respond by ${fmtDate(app.offer.expiresAt)}`}</p>
                {app.offer.terms && <p className="mt-2 text-sm">{app.offer.terms}</p>}
              </div>
              {!closed && <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setOffer(app.offer)}><Pencil className="h-4 w-4" /> Edit</Button>
                {app.offer.status === 'draft' && <>
                  <Button onClick={() => call(() => api.put(`/recruitment/applications/${id}/offer`, { ...app.offer, grade: idOf(app.offer.grade), status: 'sent' }), `Offer emailed to ${app.email}`)}><Send className="h-4 w-4" /> Email the offer</Button>
                  <Button variant="ghost" onClick={() => call(() => api.put(`/recruitment/applications/${id}/offer`, { ...app.offer, grade: idOf(app.offer.grade), status: 'sent', emailCandidate: false }), 'Marked as sent')}>Mark as sent (no email)</Button>
                </>}
                {app.offer.status === 'sent' && <>
                  <Button variant="success" onClick={() => call(() => api.put(`/recruitment/applications/${id}/offer`, { ...app.offer, grade: idOf(app.offer.grade), status: 'accepted' }), 'Offer accepted')}>Accepted</Button>
                  <Button variant="danger" onClick={() => call(() => api.put(`/recruitment/applications/${id}/offer`, { ...app.offer, grade: idOf(app.offer.grade), status: 'declined' }), 'Offer declined')}>Declined</Button>
                </>}
              </div>}
            </div>
          ) : closed ? <Empty title="No offer was made" /> : (
            <Empty title="No offer yet"><Button className="mt-3" onClick={() => setOffer({ grade: idOf(opening.grade), salary: opening.salaryMin || '', startDate: '', expiresAt: '', terms: '' })}>Prepare an offer</Button></Empty>
          )
        )}

        {tab === 'emails' && <EmailsTab app={app} onSent={refresh} />}

        {tab === 'notes' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); call(() => api.post(`/recruitment/applications/${id}/notes`, { text: note })).then((ok) => ok && setNote('')); }}>
                <input className="input" aria-label="Add a note" placeholder="Add a note for the hiring team" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button disabled={!note.trim()}>Add</Button>
              </form>
              <ul className="mt-3 space-y-2">{[...app.notes].reverse().map((n) => (
                <li key={n._id} className="rounded-xl bg-slate-50 p-3 text-sm"><p>{n.text}</p><p className="mt-1 text-xs text-slate-500">{fullName(n.by)} · {timeAgo(n.at)}</p></li>
              ))}</ul>
            </div>
            <div>
              <p className="label"><Term>History</Term></p>
              <ol className="relative space-y-3 border-l-2 border-slate-200 pl-4">{app.stageHistory.map((h, i) => (
                <li key={i} className="relative text-sm"><span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600" />
                  <b>{STAGE_LABEL[h.stage]}</b> · {fmtDateTime(h.at)}{h.by && ` · ${fullName(h.by)}`}{h.note && <span className="block text-slate-500">{h.note}</span>}</li>
              ))}</ol>
            </div>
          </div>
        )}
      </Modal>

      {interview && (
        <Modal open onClose={() => setInterview(null)} title="Schedule interview" size="lg"
          footer={<><Button variant="secondary" onClick={() => setInterview(null)}>Cancel</Button><Button form="iv-form">Schedule & notify panel</Button></>}>
          <form id="iv-form" className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); call(() => api.post(`/recruitment/applications/${id}/interviews`, { ...interview, scheduledAt: new Date(interview.scheduledAt).toISOString() }), 'Interview scheduled; panel notified').then((ok) => ok && setInterview(null)); }}>
            <Field label="Date & time"><input type="datetime-local" className="input" required value={interview.scheduledAt} onChange={(e) => setInterview({ ...interview, scheduledAt: e.target.value })} /></Field>
            <Field label="Length (minutes)"><input type="number" min="15" step="15" className="input" value={interview.durationMinutes} onChange={(e) => setInterview({ ...interview, durationMinutes: Number(e.target.value) })} /></Field>
            <Field label="Format"><select className="input" value={interview.mode} onChange={(e) => setInterview({ ...interview, mode: e.target.value })}><option value="in_person">In person</option><option value="video">Video</option><option value="phone">Phone</option></select></Field>
            <Field label={interview.mode === 'video' ? 'Video link' : 'Room / location'}><input className="input" value={interview.location} onChange={(e) => setInterview({ ...interview, location: e.target.value })} /></Field>
            <div className="sm:col-span-2"><span className="label">Panel</span><StaffPicker value={interview.panel} onChange={(v) => setInterview({ ...interview, panel: v })} height="max-h-56" /></div>
            <label className="flex items-center gap-3 text-sm sm:col-span-2"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={interview.emailCandidate} onChange={(e) => setInterview({ ...interview, emailCandidate: e.target.checked })} /> Email the invitation to {app.firstName} ({app.email})</label>
          </form>
        </Modal>
      )}
      {hiring && <HireModal app={app} opening={opening} onClose={() => setHiring(false)} onHired={refresh} />}
    </>
  );
}

// ---------------- Board ----------------
function CandidateCard({ a, onOpen, onMove }) {
  const i = COLUMNS.indexOf(a.stage);
  return (
    <li className="lift animate-fade-up rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <span className="flex items-center gap-2">
          {a.internalUser ? <Avatar user={{ ...a.internalUser, firstName: a.firstName, lastName: a.lastName }} size="sm" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{a.firstName[0]}{a.lastName[0]}</span>}
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{a.firstName} {a.lastName}</span>
            <span className="block truncate text-xs text-slate-500">{SOURCE[a.source]}{a.yearsExperience != null && ` · ${a.yearsExperience} yrs`}</span></span>
        </span>
        <span className="mt-2 flex items-center justify-between gap-2">
          <Stars value={a.rating} size="h-3.5 w-3.5" />
          {a.scorecards.count > 0 && <span className="text-xs font-semibold text-brand-700">Panel {a.scorecards.average}/5</span>}
          {!a.scorecards.count && <span className="text-xs text-slate-500">{timeAgo(a.createdAt)}</span>}
        </span>
      </button>
      {a.stage !== 'hired' && (
        <span className="mt-2 flex justify-between border-t border-slate-100 pt-2">
          <button type="button" disabled={i <= 0} aria-label={`Move ${a.firstName} back`} onClick={() => onMove(a, COLUMNS[i - 1])} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowLeft className="h-4 w-4" /></button>
          <button type="button" disabled={i >= 3} aria-label={`Move ${a.firstName} forward`} onClick={() => onMove(a, COLUMNS[i + 1])} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button>
        </span>
      )}
    </li>
  );
}

export default function RecruitmentPipeline() {
  const { id } = useParams();
  const { data, loading, reload } = useFetch(`/recruitment/openings/${id}`);
  const ask = useConfirm();
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(null);
  if (loading && !data) return <Spinner />;
  if (!data) return <Empty title="Opening not found" />;
  const { opening, applications } = data;
  const closedOut = applications.filter((a) => ['rejected', 'withdrawn'].includes(a.stage));

  const setStatus = async (status, confirm) => {
    if (confirm && !(await ask(confirm))) return;
    try { await api.post(`/recruitment/openings/${id}/status`, { status }); toast.success(status === 'open' ? 'Opening published' : `Opening ${titleCase(status).toLowerCase()}`); reload(); } catch (e) { toastError(e); }
  };
  const move = async (a, stage) => { try { await api.put(`/recruitment/applications/${a._id}/stage`, { stage }); reload(); } catch (e) { toastError(e); } };
  const addCandidate = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(adding).forEach(([k, v]) => v && fd.append(k, v));
    try { await api.post(`/recruitment/openings/${id}/applications`, fd); toast.success('Candidate added'); setAdding(null); reload(); } catch (err) { toastError(err); }
  };

  return (
    <div>
      <Link to="/admin/recruitment" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ChevronLeft className="h-4 w-4" /> All openings</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2"><Badge status={opening.status === 'open' ? 'active' : 'draft'}>{titleCase(opening.status)}</Badge>
            <span className="text-sm text-slate-500">{opening.department} · {opening.openings} post{opening.openings > 1 ? 's' : ''}{opening.closingDate && ` · closes ${fmtDate(opening.closingDate)}`}</span></div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{opening.title}</h1>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="secondary" onClick={() => setAdding({ firstName: '', lastName: '', email: '', phone: '', source: 'referral', yearsExperience: '' })}><UserPlus className="h-4 w-4" /> Add candidate</Button>
          {['draft', 'on_hold', 'closed'].includes(opening.status) && <Button onClick={() => setStatus('open', opening.status === 'draft' ? { title: 'Publish this opening?', message: opening.visibility !== 'public' ? 'It goes on the careers page (if public) and all staff are told about it.' : 'It goes live on the careers page.', confirmLabel: 'Publish' } : null)}><Play className="h-4 w-4" /> {opening.status === 'draft' ? 'Publish' : 'Reopen'}</Button>}
          {opening.status === 'open' && <>
            <Button variant="secondary" onClick={() => setStatus('on_hold')}><Pause className="h-4 w-4" /> Hold</Button>
            <Button variant="ghost" onClick={() => setStatus('closed', { title: 'Close this opening?', message: 'It comes off the careers page. Candidates already in progress are kept.', confirmLabel: 'Close' })}>Close</Button>
          </>}
        </div>
      </div>

      <p className="mb-2 text-xs text-slate-500 lg:hidden">Swipe sideways to see every stage.</p>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3">
        {COLUMNS.map((stage) => {
          const list = applications.filter((a) => a.stage === stage);
          return (
            <section key={stage} className="w-72 shrink-0 snap-start rounded-3xl bg-white/60 p-3 lg:w-auto lg:flex-1" aria-label={STAGE_LABEL[stage]}>
              <h2 className="mb-3 flex items-center justify-between px-1 font-semibold">{STAGE_LABEL[stage]}<span className="rounded-full bg-slate-200/70 px-2 text-sm">{list.length}</span></h2>
              <ul className="space-y-2">{list.map((a) => <CandidateCard key={a._id} a={a} onOpen={() => setOpen(a._id)} onMove={move} />)}</ul>
              {list.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">Nobody here</p>}
            </section>
          );
        })}
      </div>

      {closedOut.length > 0 && (
        <Card className="mt-4" title={`Not progressed (${closedOut.length})`} bodyClass="p-0">
          <ul className="divide-y divide-slate-100">{closedOut.map((a) => (
            <li key={a._id}><button type="button" onClick={() => setOpen(a._id)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
              <span className="flex-1 font-medium">{a.firstName} {a.lastName}</span><span className="text-sm text-slate-500">{a.rejectionReason || STAGE_LABEL[a.stage]}</span>
            </button></li>
          ))}</ul>
        </Card>
      )}

      {open && <Candidate id={open} opening={opening} onClose={() => setOpen(null)} onChanged={reload} />}
      {editing && <OpeningEditor opening={opening} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      {adding && (
        <Modal open onClose={() => setAdding(null)} title="Add a candidate" footer={<><Button variant="secondary" onClick={() => setAdding(null)}>Cancel</Button><Button form="add-cand">Add</Button></>}>
          <form id="add-cand" onSubmit={addCandidate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name"><input className="input" required value={adding.firstName} onChange={(e) => setAdding({ ...adding, firstName: e.target.value })} /></Field>
            <Field label="Last name"><input className="input" required value={adding.lastName} onChange={(e) => setAdding({ ...adding, lastName: e.target.value })} /></Field>
            <Field label="Email"><input type="email" className="input" required value={adding.email} onChange={(e) => setAdding({ ...adding, email: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={adding.phone} onChange={(e) => setAdding({ ...adding, phone: e.target.value })} /></Field>
            <Field label="Source"><select className="input" value={adding.source} onChange={(e) => setAdding({ ...adding, source: e.target.value })}>{['referral', 'agency', 'walk_in', 'other'].map((s) => <option key={s} value={s}>{SOURCE[s]}</option>)}</select></Field>
            <Field label="Years' experience"><input type="number" className="input" value={adding.yearsExperience} onChange={(e) => setAdding({ ...adding, yearsExperience: e.target.value })} /></Field>
            <Field label="CV" className="sm:col-span-2"><input type="file" accept=".pdf,.doc,.docx" className="input" onChange={(e) => setAdding({ ...adding, cv: e.target.files[0] })} /></Field>
          </form>
        </Modal>
      )}
    </div>
  );
}
