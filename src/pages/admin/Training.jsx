import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, CheckCircle2, GraduationCap, Pencil, Plus, RefreshCw, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import StaffPicker from '../../components/StaffPicker';
import { Animated, Avatar, Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fmtDateTime, fmtMoney, fullName, titleCase, ymd } from '../../lib/format';
import { Term } from '../../components/InfoTip';
import MoneyInput from '../../components/MoneyInput';

export const CELL = {
  compliant: ['bg-emerald-500', 'Compliant'], expiring: ['bg-amber-400', 'Expiring soon'], due: ['bg-sky-400', 'Assigned'],
  overdue: ['bg-rose-500', 'Overdue'], expired: ['bg-rose-500', 'Expired'], missing: ['bg-rose-300', 'Not started'], not_required: ['bg-slate-100', 'Not required'],
};
const CATEGORIES = ['mandatory', 'clinical', 'technical', 'leadership', 'soft_skills', 'induction', 'other'];
const DELIVERY = ['classroom', 'online', 'on_the_job', 'blended', 'external'];

export function Matrix({ data }) {
  if (!data.courses.length) return <Empty icon={GraduationCap} title="No mandatory courses yet">Mark courses as mandatory for a group to build the matrix.</Empty>;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-600">{Object.entries(CELL).map(([k, [c, l]]) => <span key={k} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${c}`} />{l}</span>)}</div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead><tr>
            <th className="sticky left-0 z-10 min-w-40 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500"><Term>Staff</Term></th>
            {data.courses.map((c) => <th key={c._id} className="min-w-24 border-b border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-600" title={c.title}>{c.code || c.title}</th>)}
          </tr></thead>
          <tbody>{data.rows.map((r) => (
            <tr key={r.user._id}>
              <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2"><span className="block font-medium">{fullName(r.user)}</span><span className="text-xs text-slate-500">{r.user.department}</span></td>
              {data.courses.map((c) => {
                const cell = r.cells[c._id];
                const [color, label] = CELL[cell.status];
                const detail = cell.expiresAt ? `expires ${fmtDate(cell.expiresAt)}` : cell.dueDate ? `due ${fmtDate(cell.dueDate)}` : '';
                return <td key={c._id} className="border-b border-slate-100 px-2 py-2 text-center" title={`${c.title}: ${label}${detail ? ` (${detail})` : ''}`}>
                  <span className={`mx-auto block h-7 w-full max-w-16 rounded-lg ${color}`} aria-label={`${label}${detail ? `, ${detail}` : ''}`} />
                </td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function CourseEditor({ course, onClose, onSaved }) {
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] } });
  const { data: positions } = useFetch('/org/positions', { initial: [] });
  const blank = { title: '', code: '', category: 'clinical', description: '', provider: 'In-house', delivery: 'classroom', durationHours: '', costPerPerson: '', validityMonths: '', issuesCertificate: '', mandatory: { scope: 'none', departments: [], positions: [] }, materialsUrl: '', status: 'active' };
  const [f, setF] = useState(course?._id ? { ...blank, ...course, mandatory: { ...blank.mandatory, ...course.mandatory, positions: (course.mandatory?.positions || []).map((p) => p._id || p) } } : blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const m = f.mandatory;
  const save = async (e) => {
    e.preventDefault();
    try {
      const { data } = f._id ? await api.put(`/training/courses/${f._id}`, f) : await api.post('/training/courses', f);
      toast.success(data.assigned ? `Saved; assigned to ${data.assigned} staff` : 'Course saved');
      onSaved();
    } catch (err) { toastError(err); }
  };
  const toggle = (key, v) => setF({ ...f, mandatory: { ...m, [key]: m[key].includes(v) ? m[key].filter((x) => x !== v) : [...m[key], v] } });
  return (
    <Modal open onClose={onClose} title={f._id ? `Edit ${f.title}` : 'New course'} size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="course-form">Save</Button></>}>
      <form id="course-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Title" className="sm:col-span-2"><input className="input" required value={f.title} onChange={set('title')} /></Field>
        <Field label="Code"><input className="input" value={f.code || ''} onChange={set('code')} /></Field>
        <Field label="Category"><select className="input" value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
        <Field label="Delivery"><select className="input" value={f.delivery} onChange={set('delivery')}>{DELIVERY.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
        <Field label="Provider"><input className="input" value={f.provider || ''} onChange={set('provider')} /></Field>
        <Field label="Hours"><input type="number" min="0" step="0.5" className="input" value={f.durationHours ?? ''} onChange={set('durationHours')} /></Field>
        <Field label="Cost per person (₦)"><MoneyInput min="0" className="input" value={f.costPerPerson ?? ''} onChange={set('costPerPerson')} /></Field>
        <Field label="Valid for (months)" hint="Blank = never expires"><input type="number" min="0" className="input" value={f.validityMonths ?? ''} onChange={set('validityMonths')} /></Field>
        <Field label="Issues certificate" className="sm:col-span-3" hint="On completion, a verified certificate with this title is added to the person's record"><input className="input" value={f.issuesCertificate || ''} onChange={set('issuesCertificate')} placeholder="e.g. Basic Life Support (BLS)" /></Field>
        <Field label="Description" className="sm:col-span-3"><textarea rows={3} className="input" value={f.description || ''} onChange={set('description')} /></Field>
        <div className="sm:col-span-3">
          <span className="label">Mandatory for</span>
          <div className="mb-2 flex flex-wrap gap-2">{[['none', 'Optional'], ['all', 'Everyone'], ['departments', 'Departments'], ['positions', 'Positions']].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={m.scope === v} onClick={() => setF({ ...f, mandatory: { ...m, scope: v } })} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${m.scope === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-600'}`}>{l}</button>))}</div>
          {m.scope === 'departments' && <div className="flex flex-wrap gap-1.5">{meta.departments.map((d) => <button key={d} type="button" aria-pressed={m.departments.includes(d)} onClick={() => toggle('departments', d)} className={`min-h-9 rounded-full px-3 text-sm ${m.departments.includes(d) ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{d}</button>)}</div>}
          {m.scope === 'positions' && <div className="flex flex-wrap gap-1.5">{positions.map((p) => <button key={p._id} type="button" aria-pressed={m.positions.includes(p._id)} onClick={() => toggle('positions', p._id)} className={`min-h-9 rounded-full px-3 text-sm ${m.positions.includes(p._id) ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{p.title}</button>)}</div>}
          {m.scope !== 'none' && <p className="mt-2 text-xs text-slate-500">Everyone in this group is assigned the course now, and again before it expires.</p>}
        </div>
      </form>
    </Modal>
  );
}

function SessionRegister({ session, onClose, onDone }) {
  const { data: rows, loading } = useFetch(`/training/sessions/${session._id}/register`, { initial: [] });
  const [results, setResults] = useState({});
  const save = async () => {
    try {
      await api.post(`/training/sessions/${session._id}/attendance`, { results: rows.filter((r) => results[r._id]?.status).map((r) => ({ enrollment: r._id, ...results[r._id] })) });
      toast.success('Register saved; completions recorded'); onDone();
    } catch (e) { toastError(e); }
  };
  return (
    <Modal open onClose={onClose} title={`Register · ${session.course.title} · ${fmtDate(session.startsAt)}`} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save register</Button></>}>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty title="Nobody booked" /> : (
        <ul className="divide-y divide-slate-100">{rows.map((r) => (
          <li key={r._id} className="flex flex-wrap items-center gap-3 py-3">
            <Avatar user={r.user} size="sm" /><span className="min-w-32 flex-1 font-medium">{fullName(r.user)}</span>
            {r.status === 'completed' ? <Badge color="green">Completed</Badge> : <>
              <div className="flex gap-1" role="radiogroup" aria-label={`Attendance for ${fullName(r.user)}`}>
                {[['completed', 'Passed'], ['failed', 'Failed'], ['no_show', 'Absent']].map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={results[r._id]?.status === v} onClick={() => setResults({ ...results, [r._id]: { ...results[r._id], status: v } })}
                    className={`min-h-10 rounded-lg border px-3 text-sm ${results[r._id]?.status === v ? (v === 'completed' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-rose-600 bg-rose-600 text-white') : 'border-slate-300'}`}>{l}</button>))}
              </div>
              <input type="number" min="0" max="100" aria-label="Score" placeholder="Score" className="input w-24" value={results[r._id]?.score || ''} onChange={(e) => setResults({ ...results, [r._id]: { ...results[r._id], score: e.target.value } })} />
            </>}
          </li>
        ))}</ul>
      )}
    </Modal>
  );
}

export default function Training() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'matrix';
  const [dept, setDept] = useState('');
  const { data: overview, reload: reloadOverview } = useFetch('/training/overview');
  const { data: matrix } = useFetch('/training/matrix', { params: { department: dept }, initial: { courses: [], rows: [] } });
  const { data: courses, reload: reloadCourses } = useFetch('/training/courses', { initial: [] });
  const { data: sessions, reload: reloadSessions } = useFetch('/training/sessions', { initial: [] });
  const { data: requests, reload: reloadRequests } = useFetch('/training/enrollments', { params: { status: 'requested' }, initial: [] });
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] } });
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [newSession, setNewSession] = useState(null);
  const [register, setRegister] = useState(null);
  const refresh = () => { reloadOverview(); reloadCourses(); reloadSessions(); reloadRequests(); };

  const decide = async (e, status) => { try { await api.put(`/training/enrollments/${e._id}`, { status }); toast.success(`Request ${status}`); refresh(); } catch (err) { toastError(err); } };

  return (
    <div>
      <PageHeader title="Training & development" subtitle="Mandatory training, the course catalogue, sessions and everyone's compliance."
        actions={<><Button variant="secondary" onClick={async () => { const { data } = await api.post('/training/sync'); toast.success(data.assigned ? `${data.assigned} assignments created` : 'Everyone is assigned what they need'); refresh(); }}><RefreshCw className="h-4 w-4" /> Check assignments</Button>
          <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New course</Button></>} />

      {overview && (
        <div className="stagger mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-5 text-white shadow-sm"><p className="text-sm text-brand-100"><Term>Mandatory compliance</Term></p><p className="mt-2 text-4xl font-semibold"><Animated value={overview.compliance.rate} />%</p><p className="text-xs text-brand-100">{overview.compliance.compliant}/{overview.compliance.required} requirements met</p></div>
          {[['Completions (12m)', overview.completions12m], ['Training hours (12m)', Math.round(overview.hours12m)], ['Spend (12m)', fmtMoney(overview.spend12m)], ['Average rating', overview.averageRating ? `${overview.averageRating}/5` : '—']].map(([l, v]) => (
            <div key={l} className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500"><Term>{l}</Term></p><p className="mt-2 text-3xl font-semibold">{typeof v === 'number' ? <Animated value={v} /> : v}</p></div>
          ))}
        </div>
      )}

      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ value: 'matrix', label: 'Training matrix' }, { value: 'courses', label: 'Courses', count: courses.length },
        { value: 'sessions', label: 'Sessions' }, { value: 'requests', label: 'Requests', count: requests.length }]} />

      {tab === 'matrix' && <>
        <div className="mb-3 flex justify-end"><select className="input w-full sm:w-56" aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{meta.departments.map((d) => <option key={d}>{d}</option>)}</select></div>
        <Matrix data={matrix} />
      </>}

      {tab === 'courses' && (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <Card key={c._id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="flex flex-wrap gap-1.5"><Badge color={c.category === 'mandatory' ? 'red' : 'teal'}>{titleCase(c.category)}</Badge>{c.mandatory?.scope !== 'none' && <Badge color="amber">{`Required for ${c.mandatoryAudience}`}</Badge>}</div>
                  <h3 className="mt-2 font-semibold">{c.title}</h3><p className="text-xs text-slate-500">{c.code} · {titleCase(c.delivery)} · {c.durationHours || '?'}h{c.validityMonths ? ` · renew every ${c.validityMonths} months` : ''}</p></div>
                <IconButton icon={Pencil} label={`Edit ${c.title}`} onClick={() => setEditing(c)} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-600">{c.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-emerald-700">{c.completed} completed</span><span className="text-slate-500">· {c.inProgress} in progress</span>
                {c.issuesCertificate && <Badge color="slate">{`Issues "${c.issuesCertificate}"`}</Badge>}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setAssigning(c)}><UserPlus className="h-4 w-4" /> Assign</Button>
                <Button size="sm" variant="secondary" onClick={() => setNewSession({ course: c._id, startsAt: '', endsAt: '', location: '', facilitator: '', capacity: 15 })}><Calendar className="h-4 w-4" /> Add session</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'sessions' && (
        <Card bodyClass="p-0">{sessions.length === 0 ? <Empty title="No sessions" /> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th><Term>Course</Term></th><th><Term>When</Term></th><th><Term>Where</Term></th><th><Term>Booked</Term></th><th><Term>Status</Term></th><th /></tr></thead>
            <tbody>{sessions.map((s) => (
              <tr key={s._id}>
                <td className="font-semibold">{s.course?.title}</td><td>{fmtDateTime(s.startsAt)}</td><td>{s.location || '—'}{s.facilitator && <span className="block text-xs text-slate-500">{s.facilitator}</span>}</td>
                <td>{s.booked}/{s.capacity}</td><td><Badge status={s.status === 'scheduled' ? 'upcoming' : s.status}>{titleCase(s.status)}</Badge></td>
                <td className="text-right">{s.status !== 'cancelled' && <Button size="sm" variant="secondary" onClick={() => setRegister(s)}><CheckCircle2 className="h-4 w-4" /> Register</Button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}</Card>
      )}

      {tab === 'requests' && (
        <Card bodyClass="p-0">{requests.length === 0 ? <Empty title="No training requests" /> : (
          <ul className="divide-y divide-slate-100">{requests.map((e) => (
            <li key={e._id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <Avatar user={e.user} size="sm" />
              <span className="min-w-48 flex-1"><span className="block font-medium">{fullName(e.user)} · {e.course?.title}</span>{e.notes && <span className="block text-sm text-slate-500">"{e.notes}"</span>}</span>
              <Button size="sm" variant="secondary" onClick={() => decide(e, 'declined')}>Decline</Button>
              <Button size="sm" onClick={() => decide(e, 'approved')}>Approve</Button>
            </li>
          ))}</ul>
        )}</Card>
      )}

      {editing && <CourseEditor course={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {register && <SessionRegister session={register} onClose={() => setRegister(null)} onDone={() => { setRegister(null); refresh(); }} />}
      {assigning && (
        <Modal open onClose={() => setAssigning(null)} title={`Assign ${assigning.title}`} size="lg" footer={<><Button variant="secondary" onClick={() => setAssigning(null)}>Cancel</Button><Button form="assign-course">Assign</Button></>}>
          <form id="assign-course" className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            try { const { data } = await api.post(`/training/courses/${assigning._id}/assign`, assigning.form || {}); toast.success(`Assigned to ${data.created}`); setAssigning(null); refresh(); } catch (err) { toastError(err); }
          }}>
            <Field label="Complete by"><input type="date" className="input" min={ymd()} value={assigning.form?.dueDate || ''} onChange={(e) => setAssigning({ ...assigning, form: { ...assigning.form, dueDate: e.target.value } })} /></Field>
            <StaffPicker value={assigning.form?.users || []} onChange={(v) => setAssigning({ ...assigning, form: { ...assigning.form, users: v } })} />
          </form>
        </Modal>
      )}
      {newSession && (
        <Modal open onClose={() => setNewSession(null)} title="New session" footer={<><Button variant="secondary" onClick={() => setNewSession(null)}>Cancel</Button><Button form="session-form">Create & notify</Button></>}>
          <form id="session-form" className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault();
            try { await api.post('/training/sessions', { ...newSession, startsAt: new Date(newSession.startsAt).toISOString(), endsAt: newSession.endsAt ? new Date(newSession.endsAt).toISOString() : undefined }); toast.success('Session created; people waiting have been told'); setNewSession(null); refresh(); } catch (err) { toastError(err); }
          }}>
            <Field label="Starts"><input type="datetime-local" required className="input" value={newSession.startsAt} onChange={(e) => setNewSession({ ...newSession, startsAt: e.target.value })} /></Field>
            <Field label="Ends"><input type="datetime-local" className="input" value={newSession.endsAt} onChange={(e) => setNewSession({ ...newSession, endsAt: e.target.value })} /></Field>
            <Field label="Location"><input className="input" value={newSession.location} onChange={(e) => setNewSession({ ...newSession, location: e.target.value })} /></Field>
            <Field label="Facilitator"><input className="input" value={newSession.facilitator} onChange={(e) => setNewSession({ ...newSession, facilitator: e.target.value })} /></Field>
            <Field label="Capacity"><input type="number" min="1" className="input" value={newSession.capacity} onChange={(e) => setNewSession({ ...newSession, capacity: Number(e.target.value) })} /></Field>
          </form>
        </Modal>
      )}
    </div>
  );
}
