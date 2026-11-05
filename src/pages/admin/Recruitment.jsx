import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, ExternalLink, Pencil, Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import StaffPicker from '../../components/StaffPicker';
import EmailStatusNote from '../../components/EmailStatusNote';
import { Animated, Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, Spinner, Tabs, TagInput } from '../../components/ui';
import { fmtDate, fmtMoney, titleCase, ymd } from '../../lib/format';
import { Term } from '../../components/InfoTip';
import MoneyInput from '../../components/MoneyInput';

export const STAGE_LABEL = { applied: 'Applied', screening: 'Screening', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected', withdrawn: 'Withdrawn' };
const PIPE = ['applied', 'screening', 'interview', 'offer', 'hired'];
const STATUS_COLOR = { draft: 'slate', open: 'green', on_hold: 'amber', closed: 'slate', filled: 'teal' };
const idOf = (v) => (v && typeof v === 'object' ? v._id : v || '');

export function OpeningEditor({ opening, prefillPosition, onClose, onSaved }) {
  const { data: positions } = useFetch('/org/positions', { initial: [] });
  const { data: grades } = useFetch('/org/grades', { initial: [] });
  const { data: people } = useFetch('/users/directory', { initial: [] });
  const blank = { title: '', position: prefillPosition || '', department: '', grade: '', openings: 1, reason: 'vacancy', employmentType: 'full_time', location: 'Solucio Hospital, Lagos',
    summary: '', description: '', responsibilities: [], requirements: [], salaryMin: '', salaryMax: '', showSalary: false, visibility: 'both', closingDate: '', hiringManager: '', panel: [] };
  const [form, setForm] = useState(() => opening ? { ...blank, ...opening, position: idOf(opening.position), grade: idOf(opening.grade), hiringManager: idOf(opening.hiringManager),
    panel: (opening.panel || []).map(idOf), closingDate: opening.closingDate ? ymd(opening.closingDate) : '' } : blank);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Picking a position fills title, department, grade and its required certificates.
  const choosePosition = (id) => {
    const p = positions.find((x) => x._id === id);
    if (!p) return setForm({ ...form, position: '' });
    const g = grades.find((x) => x._id === idOf(p.grade));
    setForm({ ...form, position: id, title: form.title || p.title, department: p.department, grade: idOf(p.grade),
      requirements: form.requirements.length ? form.requirements : p.requiredCertificates.map((c) => `Current ${c}`),
      salaryMin: form.salaryMin || g?.minSalary || '', salaryMax: form.salaryMax || g?.maxSalary || '' });
  };
  useEffect(() => { if (prefillPosition && positions.length && !opening) choosePosition(prefillPosition); }, [positions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form, salaryMin: form.salaryMin || null, salaryMax: form.salaryMax || null };
      const { data } = opening?._id ? await api.put(`/recruitment/openings/${opening._id}`, body) : await api.post('/recruitment/openings', body);
      toast.success('Opening saved');
      onSaved(data);
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={opening?._id ? `Edit ${opening.title}` : 'New job opening'} size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="opening-form" loading={busy}>Save</Button></>}>
      <form id="opening-form" onSubmit={save} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Position (from the establishment)">
          <select className="input" value={form.position} onChange={(e) => choosePosition(e.target.value)}>
            <option value="">Not linked to a position</option>
            {positions.map((p) => <option key={p._id} value={p._id}>{p.title} · {p.department} ({p.filled}/{p.approvedHeadcount})</option>)}
          </select>
        </Field>
        <Field label="Job title"><input className="input" required value={form.title} onChange={set('title')} /></Field>
        <Field label="Department"><input className="input" required value={form.department} onChange={set('department')} /></Field>
        <Field label="Number of posts"><input type="number" min="1" className="input" value={form.openings} onChange={(e) => setForm({ ...form, openings: Number(e.target.value) })} /></Field>
        <Field label="Reason"><select className="input" value={form.reason} onChange={set('reason')}>{['vacancy', 'replacement', 'new_post', 'expansion'].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select></Field>
        <Field label="Employment type"><select className="input" value={form.employmentType} onChange={set('employmentType')}>{['full_time', 'part_time', 'contract', 'locum', 'intern'].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select></Field>
        <Field label="Grade"><select className="input" value={form.grade} onChange={set('grade')}><option value="">—</option>{grades.map((g) => <option key={g._id} value={g._id}>{g.code} · {g.name}</option>)}</select></Field>
        <Field label="Salary from (₦/month)"><MoneyInput className="input" value={form.salaryMin ?? ''} onChange={set('salaryMin')} /></Field>
        <Field label="Salary to (₦/month)"><MoneyInput className="input" value={form.salaryMax ?? ''} onChange={set('salaryMax')} /></Field>
        <Field label="Who can apply"><select className="input" value={form.visibility} onChange={set('visibility')}>
          <option value="both">Public and internal staff</option><option value="public">Public careers page only</option><option value="internal">Internal staff only</option></select></Field>
        <Field label="Closing date"><input type="date" className="input" value={form.closingDate} onChange={set('closingDate')} /></Field>
        <Field label="Hiring manager"><select className="input" value={form.hiringManager} onChange={set('hiringManager')}><option value="">—</option>{people.map((p) => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></Field>
        <label className="flex items-center gap-3 text-sm md:col-span-3"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={form.showSalary} onChange={(e) => setForm({ ...form, showSalary: e.target.checked })} /> Show the salary range on the job advert</label>
        <Field label="Location" className="md:col-span-3"><input className="input" value={form.location} onChange={set('location')} /></Field>
        <Field label="Summary (one line on the job board)" className="md:col-span-3"><input className="input" value={form.summary || ''} onChange={set('summary')} /></Field>
        <Field label="Description" className="md:col-span-3"><textarea rows={4} className="input" value={form.description || ''} onChange={set('description')} /></Field>
        <div className="md:col-span-3"><span className="label">Responsibilities</span><TagInput label="Responsibilities" value={form.responsibilities} onChange={(v) => setForm({ ...form, responsibilities: v })} placeholder="Add a responsibility, press Enter" /></div>
        <div className="md:col-span-3"><span className="label">Requirements</span><TagInput label="Requirements" value={form.requirements} onChange={(v) => setForm({ ...form, requirements: v })} placeholder="Add a requirement, press Enter" /></div>
        <div className="md:col-span-3"><span className="label">Default interview panel</span><StaffPicker value={form.panel} onChange={(v) => setForm({ ...form, panel: v })} height="max-h-56" /></div>
      </form>
    </Modal>
  );
}

function MiniPipeline({ stages }) {
  return (
    <div className="flex gap-1" aria-label="Candidates by stage">
      {PIPE.map((s) => (
        <span key={s} className="flex-1 text-center">
          <span className={`block rounded-lg py-1 text-sm font-semibold ${stages[s] ? 'bg-brand-50 text-brand-800' : 'bg-slate-50 text-slate-400'}`}>{stages[s] || 0}</span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">{STAGE_LABEL[s]}</span>
        </span>
      ))}
    </div>
  );
}

export default function Recruitment() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('open');
  const { data: openings, loading, reload } = useFetch('/recruitment/openings', { initial: [] });
  const { data: stats } = useFetch('/recruitment/stats');
  const [editing, setEditing] = useState(params.get('position') ? { prefill: params.get('position') } : null);
  const shown = status === 'all' ? openings : openings.filter((o) => o.status === status);

  return (
    <div>
      <PageHeader title="Recruitment" subtitle="Requisitions, the careers page and every candidate from application to hire."
        actions={<><a href="/careers" target="_blank" rel="noreferrer"><Button variant="secondary"><ExternalLink className="h-4 w-4" /> Careers page</Button></a>
          <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New opening</Button></>} />
      <EmailStatusNote className="mb-4" />

      {stats && (
        <div className="stagger mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-5 text-white shadow-sm"><p className="text-sm text-brand-100"><Term>Open requisitions</Term></p><p className="mt-2 text-4xl font-semibold"><Animated value={openings.filter((o) => o.status === 'open').length} /></p></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500"><Term>Active candidates</Term></p><p className="mt-2 text-4xl font-semibold"><Animated value={openings.reduce((n, o) => n + o.active, 0)} /></p></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500"><Term>Hires (12 months)</Term></p><p className="mt-2 text-4xl font-semibold"><Animated value={stats.hires} /></p></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500"><Term>Avg. time to hire</Term></p><p className="mt-2 text-4xl font-semibold">{stats.timeToHireDays == null ? '—' : <><Animated value={stats.timeToHireDays} /><span className="ml-1 text-lg text-slate-500">days</span></>}</p></div>
        </div>
      )}

      <Tabs value={status} onChange={setStatus} tabs={['open', 'draft', 'on_hold', 'filled', 'closed', 'all'].map((s) => ({ value: s, label: titleCase(s), count: s === 'all' ? openings.length : openings.filter((o) => o.status === s).length }))} />
      {loading ? <Spinner /> : shown.length === 0 ? <Card><Empty icon={Briefcase} title={`No ${status === 'all' ? '' : titleCase(status).toLowerCase()} openings`} /></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((o) => (
            <div key={o._id} className="lift card cursor-pointer p-5" role="link" tabIndex={0}
              onClick={() => navigate(`/admin/recruitment/${o._id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/recruitment/${o._id}`)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Badge color={STATUS_COLOR[o.status]}>{titleCase(o.status)}</Badge><Badge color="slate">{o.visibility === 'both' ? 'Public + internal' : titleCase(o.visibility)}</Badge></div>
                  <h3 className="mt-2 truncate text-lg font-semibold">{o.title}</h3>
                  <p className="text-sm text-slate-500">{o.department} · {o.openings} post{o.openings > 1 ? 's' : ''}{o.closingDate && ` · closes ${fmtDate(o.closingDate)}`}{o.showSalary && o.salaryMin ? ` · ${fmtMoney(o.salaryMin)}+` : ''}</p>
                </div>
                <IconButton icon={Pencil} label={`Edit ${o.title}`} onClick={(e) => { e.stopPropagation(); setEditing(o); }} />
              </div>
              <div className="mt-4"><MiniPipeline stages={o.stages} /></div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Users className="h-3.5 w-3.5" />{o.applicants} applicant{o.applicants === 1 ? '' : 's'}{o.stages.applied ? <b className="ml-1 text-brand-700">· {o.stages.applied} new</b> : ''}</p>
            </div>
          ))}
        </div>
      )}

      {editing && <OpeningEditor opening={editing._id ? editing : null} prefillPosition={editing.prefill}
        onClose={() => { setEditing(null); if (params.get('position')) setParams({}, { replace: true }); }}
        onSaved={(o) => { setEditing(null); reload(); if (!editing._id) navigate(`/admin/recruitment/${o._id}`); }} />}
    </div>
  );
}
