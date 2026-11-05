import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ClipboardList, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, ProgressBar, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fullName, titleCase, ymd } from '../../lib/format';

const OWNER = { employee: ['New starter', 'blue'], hr: ['HR', 'purple'], manager: ['Manager', 'teal'] };
const AUTO = { avatar: 'Profile photo added', emergency_contact: 'Emergency contact added', bank_details: 'Bank details added', policies: 'All policies acknowledged', certificate: 'A certificate uploaded', skills: 'Skills added' };
const CATEGORIES = ['documents', 'policies', 'training', 'equipment', 'introductions', 'systems', 'other'];
const idOf = (v) => (v && typeof v === 'object' ? v._id : v || '');

// ---------- One new starter's plan ----------
function PlanModal({ id, onClose, onChanged }) {
  const { data: plan, reload } = useFetch(`/onboarding/plans/${id}`);
  const { data: people } = useFetch('/users/directory', { initial: [] });
  const [newTask, setNewTask] = useState(null);
  const [probation, setProbation] = useState(null);
  if (!plan) return <Modal open onClose={onClose} title="Onboarding"><Spinner /></Modal>;
  const refresh = () => { reload(); onChanged(); };
  const tick = async (t) => { try { await api.put(`/onboarding/${plan._id}/tasks/${t._id}`, { done: !t.done }); refresh(); } catch (e) { toastError(e); } };
  const update = async (body, msg) => { try { await api.put(`/onboarding/plans/${plan._id}`, body); if (msg) toast.success(msg); refresh(); return true; } catch (e) { toastError(e); return false; } };
  const now = new Date();

  return (
    <Modal open onClose={onClose} title={`Onboarding · ${fullName(plan.user)}`} size="lg">
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Avatar user={plan.user} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{plan.user.jobTitle} · {plan.user.department}</p>
          <p className="text-sm text-slate-500">Started {fmtDate(plan.startDate)} · {plan.template?.name || 'Custom plan'}</p>
          <div className="mt-2 flex items-center gap-3"><span className="w-40"><ProgressBar value={plan.progress.percent} /></span><span className="text-sm font-semibold">{plan.progress.done}/{plan.progress.total}</span></div>
        </div>
        <Field label="Buddy"><select className="input w-full sm:w-52" value={idOf(plan.buddy)} onChange={(e) => update({ buddy: e.target.value }, 'Buddy updated')}>
          <option value="">None</option>{people.filter((p) => p._id !== plan.user._id).map((p) => <option key={p._id} value={p._id}>{fullName(p)}</option>)}</select></Field>
      </div>

      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
        {plan.tasks.map((t) => {
          const overdue = !t.done && t.dueDate && new Date(t.dueDate) < now;
          return (
            <li key={t._id} className="flex items-center gap-3 px-3 py-2.5">
              <button type="button" onClick={() => tick(t)} aria-pressed={t.done} aria-label={`${t.done ? 'Untick' : 'Tick'} ${t.title}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100">
                {t.done ? <CheckCircle2 className="h-6 w-6 animate-pop-in text-emerald-500" /> : <Circle className="h-6 w-6 text-slate-300" />}
              </button>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${t.done ? 'text-slate-500 line-through' : ''}`}>{t.title}</span>
                <span className="block text-xs text-slate-500">{t.autoCheck ? `Ticks itself when: ${AUTO[t.autoCheck].toLowerCase()}` : titleCase(t.category || 'other')}</span>
              </span>
              <Badge color={OWNER[t.owner][1]}>{OWNER[t.owner][0]}</Badge>
              <span className={`hidden w-24 text-right text-xs sm:block ${overdue ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>{t.dueDate ? fmtDate(t.dueDate) : ''}</span>
              <IconButton icon={Trash2} label={`Remove ${t.title}`} onClick={() => update({ removeTask: t._id })} />
            </li>
          );
        })}
      </ul>
      {newTask ? (
        <form className="mt-3 grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-4" onSubmit={async (e) => { e.preventDefault(); if (await update({ addTask: newTask }, 'Task added')) setNewTask(null); }}>
          <Field label="Task" className="sm:col-span-2"><input className="input" required value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} /></Field>
          <Field label="Who"><select className="input" value={newTask.owner} onChange={(e) => setNewTask({ ...newTask, owner: e.target.value })}>{Object.entries(OWNER).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Due"><input type="date" className="input" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} /></Field>
          <div className="flex gap-2 sm:col-span-4"><Button type="button" variant="secondary" onClick={() => setNewTask(null)}>Cancel</Button><Button>Add task</Button></div>
        </form>
      ) : <Button variant="secondary" size="sm" className="mt-3" onClick={() => setNewTask({ title: '', owner: 'employee', dueDate: '' })}><Plus className="h-4 w-4" /> Add task</Button>}

      <div className="mt-6 rounded-2xl border border-slate-200 p-4">
        <p className="font-semibold">Probation</p>
        <p className="text-sm text-slate-500">{plan.probation?.endDate ? `Ends ${fmtDate(plan.probation.endDate)}` : 'No end date set'} · Outcome: <b>{titleCase(plan.probation?.outcome || 'pending')}</b>{plan.probation?.notes && ` · ${plan.probation.notes}`}</p>
        {probation ? (
          <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault();
            try { await api.post(`/onboarding/plans/${plan._id}/probation`, probation); toast.success('Probation decision saved; employee notified'); setProbation(null); refresh(); } catch (err) { toastError(err); }
          }}>
            <Field label="Decision"><select className="input" value={probation.outcome} onChange={(e) => setProbation({ ...probation, outcome: e.target.value })}>
              <option value="confirmed">Confirm employment</option><option value="extended">Extend probation</option><option value="not_confirmed">Do not confirm</option></select></Field>
            {probation.outcome === 'extended' && <Field label="New end date"><input type="date" className="input" required value={probation.newEndDate} onChange={(e) => setProbation({ ...probation, newEndDate: e.target.value })} /></Field>}
            <Field label="Notes" className="sm:col-span-2"><textarea rows={2} className="input" value={probation.notes} onChange={(e) => setProbation({ ...probation, notes: e.target.value })} /></Field>
            <div className="flex gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setProbation(null)}>Cancel</Button><Button>Save decision</Button></div>
          </form>
        ) : plan.probation?.outcome === 'pending' && <Button size="sm" className="mt-3" onClick={() => setProbation({ outcome: 'confirmed', newEndDate: '', notes: '' })}>Record probation decision</Button>}
      </div>
    </Modal>
  );
}

// ---------- Templates ----------
function TemplateEditor({ template, onClose, onSaved }) {
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] } });
  const [form, setForm] = useState(template?._id ? template : { name: '', description: '', departments: [], isDefault: false, tasks: [] });
  const [saving, setSaving] = useState(false);
  const setTask = (i, patch) => setForm({ ...form, tasks: form.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form._id) await api.put(`/onboarding/templates/${form._id}`, form); else await api.post('/onboarding/templates', form);
      toast.success('Template saved'); onSaved();
    } catch (err) { toastError(err); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={form._id ? `Edit ${form.name}` : 'New onboarding template'} size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="tpl-form" loading={saving}>Save template</Button></>}>
      <form id="tpl-form" onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><input className="input" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
        <div><span className="label">Used automatically for these departments</span>
          <div className="flex flex-wrap gap-1.5">{meta.departments.map((d) => {
            const on = form.departments.includes(d);
            return <button key={d} type="button" aria-pressed={on} onClick={() => setForm({ ...form, departments: on ? form.departments.filter((x) => x !== d) : [...form.departments, d] })}
              className={`min-h-9 rounded-full px-3 text-sm ${on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{d}</button>;
          })}</div></div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default template when no department matches</label>
        <div>
          <span className="label">Tasks</span>
          <div className="space-y-2">{form.tasks.map((t, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-slate-200 p-3 lg:grid-cols-[2fr_1fr_1fr_0.8fr_1.3fr_auto]">
              <Field label="Task" className="col-span-2 lg:col-span-1"><input className="input" value={t.title} onChange={(e) => setTask(i, { title: e.target.value })} /></Field>
              <Field label="Who"><select className="input" value={t.owner} onChange={(e) => setTask(i, { owner: e.target.value })}>{Object.entries(OWNER).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label="Category"><select className="input" value={t.category} onChange={(e) => setTask(i, { category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
              <Field label="Due day" hint="0 = start day"><input type="number" className="input" value={t.dueDay} onChange={(e) => setTask(i, { dueDay: Number(e.target.value) })} /></Field>
              <Field label="Ticks itself when"><select className="input" value={t.autoCheck || ''} onChange={(e) => setTask(i, { autoCheck: e.target.value || null })}><option value="">Ticked manually</option>{Object.entries(AUTO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <IconButton icon={Trash2} tone="danger" label="Remove task" onClick={() => setForm({ ...form, tasks: form.tasks.filter((_, j) => j !== i) })} />
            </div>
          ))}</div>
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => setForm({ ...form, tasks: [...form.tasks, { title: '', owner: 'employee', category: 'other', dueDay: 0, autoCheck: null }] })}><Plus className="h-4 w-4" /> Add task</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Onboarding() {
  const [tab, setTab] = useState('active');
  const { data: plans, loading, reload } = useFetch('/onboarding', { params: { status: tab === 'templates' ? undefined : tab }, initial: [] });
  const { data: templates, reload: reloadTemplates } = useFetch('/onboarding/templates', { initial: [] });
  const { data: people } = useFetch('/users/directory', { initial: [] });
  const ask = useConfirm();
  const [openPlan, setOpenPlan] = useState(null);
  const [editingTpl, setEditingTpl] = useState(null);
  const [starting, setStarting] = useState(null);
  const [startingBusy, setStartingBusy] = useState(false);

  const start = async (e) => {
    e.preventDefault();
    setStartingBusy(true);
    try { await api.post('/onboarding', starting); toast.success('Onboarding started; they have been notified'); setStarting(null); reload(); } catch (err) { toastError(err); } finally { setStartingBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Onboarding" subtitle="Help new starters settle in: checklists, buddies and probation decisions."
        actions={<Button onClick={() => setStarting({ user: '', template: '', startDate: ymd(), buddy: '' })}><UserPlus className="h-4 w-4" /> Start onboarding</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'active', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'templates', label: 'Templates', count: templates.length }]} />

      {tab === 'templates' ? (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t._id}>
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-semibold">{t.name} {t.isDefault && <Badge color="teal">Default</Badge>}</h3><p className="text-sm text-slate-500">{t.description}</p></div>
                <div className="flex"><IconButton icon={Pencil} label={`Edit ${t.name}`} onClick={() => setEditingTpl(t)} />
                  <IconButton icon={Trash2} tone="danger" label={`Delete ${t.name}`} onClick={async () => { if (await ask({ title: `Delete ${t.name}?`, confirmLabel: 'Delete', tone: 'danger' })) { await api.delete(`/onboarding/templates/${t._id}`); reloadTemplates(); } }} /></div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{t.tasks.length} tasks · {t.departments.length ? t.departments.join(', ') : 'Any department'}</p>
            </Card>
          ))}
          <button type="button" onClick={() => setEditingTpl({})} className="flex min-h-32 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-700"><Plus className="h-4 w-4" /> New template</button>
        </div>
      ) : loading ? <Spinner /> : plans.length === 0 ? <Card><Empty icon={ClipboardList} title={tab === 'active' ? 'Nobody is onboarding right now' : 'No completed plans yet'} /></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <button key={p._id} type="button" onClick={() => setOpenPlan(p._id)} className="lift card p-5 text-left">
              <div className="flex items-center gap-3"><Avatar user={p.user} size="md" />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{fullName(p.user)}</span><span className="block truncate text-xs text-slate-500">{p.user?.jobTitle} · started {fmtDate(p.startDate)}</span></span></div>
              <div className="mt-4 flex items-center gap-3"><span className="flex-1"><ProgressBar value={p.progress.percent} /></span><b className="text-sm">{p.progress.percent}%</b></div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.overdue > 0 && <Badge color="red">{`${p.overdue} overdue`}</Badge>}
                {p.buddy && <Badge color="teal">{`Buddy: ${p.buddy.firstName}`}</Badge>}
                {p.probation?.endDate && p.probation.outcome === 'pending' && <Badge color={new Date(p.probation.endDate) < new Date(Date.now() + 30 * 86400000) ? 'amber' : 'slate'}>{`Probation ends ${fmtDate(p.probation.endDate)}`}</Badge>}
                {p.probation?.outcome && p.probation.outcome !== 'pending' && <Badge status={p.probation.outcome === 'confirmed' ? 'approved' : 'pending'}>{titleCase(p.probation.outcome)}</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}

      {openPlan && <PlanModal id={openPlan} onClose={() => setOpenPlan(null)} onChanged={reload} />}
      {editingTpl && <TemplateEditor template={editingTpl} onClose={() => setEditingTpl(null)} onSaved={() => { setEditingTpl(null); reloadTemplates(); }} />}
      {starting && (
        <Modal open onClose={() => setStarting(null)} title="Start onboarding" footer={<><Button variant="secondary" onClick={() => setStarting(null)}>Cancel</Button><Button form="start-form" loading={startingBusy}>Start</Button></>}>
          <form id="start-form" onSubmit={start} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <p className="text-sm text-slate-500 sm:col-span-2">For people added directly rather than hired through <Link to="/admin/recruitment" className="font-semibold text-brand-700">Recruitment</Link> (hiring starts onboarding automatically).</p>
            <Field label="Staff member" className="sm:col-span-2"><select className="input" required value={starting.user} onChange={(e) => setStarting({ ...starting, user: e.target.value })}><option value="">Choose…</option>{people.map((p) => <option key={p._id} value={p._id}>{fullName(p)} · {p.jobTitle || '—'}</option>)}</select></Field>
            <Field label="Template"><select className="input" value={starting.template} onChange={(e) => setStarting({ ...starting, template: e.target.value })}><option value="">Automatic (by department)</option>{templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></Field>
            <Field label="Start date"><input type="date" className="input" value={starting.startDate} onChange={(e) => setStarting({ ...starting, startDate: e.target.value })} /></Field>
            <Field label="Buddy" className="sm:col-span-2"><select className="input" value={starting.buddy} onChange={(e) => setStarting({ ...starting, buddy: e.target.value })}><option value="">None</option>{people.map((p) => <option key={p._id} value={p._id}>{fullName(p)}</option>)}</select></Field>
          </form>
        </Modal>
      )}
    </div>
  );
}
