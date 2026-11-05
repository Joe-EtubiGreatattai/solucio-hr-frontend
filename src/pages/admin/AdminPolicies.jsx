import { useState } from 'react';
import { Archive, BellRing, FileText, Pencil, Plus, Send, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { openFile, toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, ProgressBar, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fmtDateTime, fullName, titleCase, ymd } from '../../lib/format';

export const POLICY_CATEGORIES = {
  hr: 'HR', code_of_conduct: 'Code of conduct', health_safety: 'Health & safety', clinical: 'Clinical', infection_control: 'Infection control',
  data_protection: 'Data protection', it: 'IT', finance: 'Finance', other: 'Other',
};

const blank = { title: '', category: 'hr', summary: '', body: '', requiresAcknowledgement: true, effectiveDate: '', reviewDate: '', changeNote: '', audience: { scope: 'all', departments: [], positions: [] } };

function PolicyEditor({ policy, onClose, onSaved }) {
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] } });
  const { data: positions } = useFetch('/org/positions', { initial: [] });
  const [form, setForm] = useState(() => policy ? { ...blank, ...policy, effectiveDate: policy.effectiveDate ? ymd(policy.effectiveDate) : '', reviewDate: policy.reviewDate ? ymd(policy.reviewDate) : '', changeNote: '' } : blank);
  const [file, setFile] = useState(null);
  const [newVersion, setNewVersion] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const aud = form.audience;
  const toggle = (key, v) => setForm({ ...form, audience: { ...aud, [key]: aud[key].includes(v) ? aud[key].filter((x) => x !== v) : [...aud[key], v] } });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      for (const k of ['title', 'category', 'summary', 'body', 'requiresAcknowledgement', 'effectiveDate', 'reviewDate', 'changeNote']) fd.append(k, form[k] ?? '');
      fd.append('audience', JSON.stringify({ ...aud, positions: aud.positions.map((p) => p._id || p) }));
      if (newVersion) fd.append('newVersion', 'true');
      if (file) fd.append('file', file);
      if (policy?._id) await api.put(`/policies/${policy._id}`, fd); else await api.post('/policies', fd);
      toast.success(newVersion ? 'New version published; staff asked to acknowledge again' : 'Policy saved');
      onSaved();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={policy?._id ? `Edit ${policy.title}` : 'New policy'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="policy-form" loading={busy}>Save{policy?.status === 'published' && newVersion ? ' as new version' : ''}</Button></>}>
      <form id="policy-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2"><input className="input" required value={form.title} onChange={set('title')} /></Field>
        <Field label="Category"><select className="input" value={form.category} onChange={set('category')}>{Object.entries(POLICY_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Effective from"><input type="date" className="input" value={form.effectiveDate} onChange={set('effectiveDate')} /></Field>
        <Field label="Summary" className="sm:col-span-2"><input className="input" value={form.summary || ''} onChange={set('summary')} placeholder="One line staff see in the list" /></Field>
        <Field label="Policy text" className="sm:col-span-2"><textarea rows={8} className="input" value={form.body} onChange={set('body')} /></Field>
        <Field label="Attach document (optional)" className="sm:col-span-2" hint={policy?.file?.originalName ? `Current: ${policy.file.originalName}` : 'PDF or Word'}>
          <input type="file" accept=".pdf,.doc,.docx" className="input" onChange={(e) => setFile(e.target.files[0])} />
        </Field>
        <Field label="Next review date" hint="You'll see an alert when it's due"><input type="date" className="input" value={form.reviewDate} onChange={set('reviewDate')} /></Field>
        <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 p-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={form.requiresAcknowledgement} onChange={(e) => setForm({ ...form, requiresAcknowledgement: e.target.checked })} />
          Staff must confirm they've read it
        </label>
        <div className="sm:col-span-2">
          <span className="label">Who it applies to</span>
          <div className="mb-2 flex flex-wrap gap-2">
            {[['all', 'Everyone'], ['departments', 'Departments'], ['positions', 'Positions']].map(([v, l]) => (
              <button key={v} type="button" aria-pressed={aud.scope === v} onClick={() => setForm({ ...form, audience: { ...aud, scope: v } })}
                className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${aud.scope === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-600'}`}>{l}</button>
            ))}
          </div>
          {aud.scope === 'departments' && <div className="flex flex-wrap gap-1.5">{meta.departments.map((d) => (
            <button key={d} type="button" aria-pressed={aud.departments.includes(d)} onClick={() => toggle('departments', d)}
              className={`min-h-9 rounded-full px-3 text-sm ${aud.departments.includes(d) ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{d}</button>))}</div>}
          {aud.scope === 'positions' && <div className="flex flex-wrap gap-1.5">{positions.map((p) => {
            const on = aud.positions.some((x) => (x._id || x) === p._id);
            return <button key={p._id} type="button" aria-pressed={on} onClick={() => setForm({ ...form, audience: { ...aud, positions: on ? aud.positions.filter((x) => (x._id || x) !== p._id) : [...aud.positions, p._id] } })}
              className={`min-h-9 rounded-full px-3 text-sm ${on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{p.title}</button>;
          })}</div>}
        </div>
        {policy?.status === 'published' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={newVersion} onChange={(e) => setNewVersion(e.target.checked)} />
              <span><b>Publish as version {policy.version + 1}.</b> Everyone must acknowledge again. Leave unticked for small corrections.</span>
            </label>
            {newVersion && <Field label="What changed?" className="mt-3"><input className="input" value={form.changeNote} onChange={set('changeNote')} placeholder="Shown to staff in the notification" /></Field>}
          </div>
        )}
      </form>
    </Modal>
  );
}

function AckList({ policy, onClose }) {
  const { data: rows, loading } = useFetch(`/policies/${policy._id}/acknowledgements`, { initial: [] });
  const [tab, setTab] = useState('pending');
  const pending = rows.filter((r) => !r.acknowledgedAt);
  const done = rows.filter((r) => r.acknowledgedAt);
  const list = tab === 'pending' ? pending : done;
  return (
    <Modal open onClose={onClose} title={`${policy.title} · v${policy.version}`}>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pending', label: 'Not yet', count: pending.length }, { value: 'done', label: 'Acknowledged', count: done.length }]} />
      {loading ? <Spinner /> : list.length === 0 ? <Empty title={tab === 'pending' ? 'Everyone has acknowledged' : 'Nobody yet'} /> : (
        <ul className="divide-y divide-slate-100">{list.map((r) => (
          <li key={r.user._id} className="flex items-center gap-3 py-2.5">
            <Avatar user={r.user} size="sm" /><span className="flex-1"><span className="block font-medium">{fullName(r.user)}</span><span className="text-xs text-slate-500">{r.user.jobTitle} · {r.user.department}</span></span>
            {r.acknowledgedAt && <span className="text-xs text-slate-500">{fmtDateTime(r.acknowledgedAt)}</span>}
          </li>
        ))}</ul>
      )}
    </Modal>
  );
}

export default function AdminPolicies() {
  const [status, setStatus] = useState('published');
  const { data: policies, loading, reload } = useFetch('/policies', { initial: [] });
  const ask = useConfirm();
  const [editing, setEditing] = useState(null);
  const [acks, setAcks] = useState(null);
  const shown = policies.filter((p) => p.status === status);

  const act = async (p, action, confirm) => {
    if (confirm && !(await ask(confirm))) return;
    try {
      const { data } = action === 'delete' ? await api.delete(`/policies/${p._id}`) : await api.post(`/policies/${p._id}/${action}`);
      toast.success(action === 'remind' ? `Reminder sent to ${data.reminded} staff` : action === 'publish' ? 'Published and staff notified' : action === 'archive' ? 'Policy archived' : 'Deleted');
      reload();
    } catch (e) { toastError(e); }
  };

  return (
    <div>
      <PageHeader title="Policies" subtitle="Publish workplace policies and track that staff have read them." actions={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New policy</Button>} />
      <Tabs value={status} onChange={setStatus} tabs={['published', 'draft', 'archived'].map((s) => ({ value: s, label: titleCase(s), count: policies.filter((p) => p.status === s).length }))} />
      {loading ? <Spinner /> : shown.length === 0 ? <Card><Empty icon={FileText} title={`No ${status} policies`} /></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((p) => {
            const rate = p.audienceCount ? Math.round((p.acknowledgedCount / p.audienceCount) * 100) : null;
            const reviewDue = p.reviewDate && new Date(p.reviewDate) < new Date(Date.now() + 30 * 86400000);
            return (
              <Card key={p._id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><Badge color="teal">{POLICY_CATEGORIES[p.category]}</Badge><Badge color="slate">v{p.version}</Badge>
                      {reviewDue && <Badge color="amber">{`Review ${new Date(p.reviewDate) < new Date() ? 'overdue' : 'due'} ${fmtDate(p.reviewDate)}`}</Badge>}</div>
                    <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
                    {p.summary && <p className="text-sm text-slate-500">{p.summary}</p>}
                  </div>
                  <div className="flex">
                    {p.file?.path && <IconButton icon={FileText} label="Open document" onClick={() => openFile(`/policies/${p._id}/file`)} />}
                    {p.status !== 'archived' && <IconButton icon={Pencil} label={`Edit ${p.title}`} onClick={() => setEditing(p)} />}
                  </div>
                </div>
                {rate != null && (
                  <button type="button" onClick={() => setAcks(p)} className="mt-4 block w-full rounded-xl bg-slate-50 p-3 text-left hover:bg-slate-100">
                    <span className="mb-1.5 flex justify-between text-sm"><span className="flex items-center gap-1.5 text-slate-600"><Users className="h-4 w-4" /> Acknowledged</span><b>{p.acknowledgedCount}/{p.audienceCount} · {rate}%</b></span>
                    <ProgressBar value={rate} />
                  </button>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.status === 'draft' && <>
                    <Button size="sm" onClick={() => act(p, 'publish', { title: `Publish ${p.title}?`, message: 'Everyone in its audience is notified and asked to acknowledge it.', confirmLabel: 'Publish' })}><Send className="h-4 w-4" /> Publish</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(p, 'delete', { title: 'Delete this draft?', confirmLabel: 'Delete', tone: 'danger' })}><Trash2 className="h-4 w-4" /> Delete</Button>
                  </>}
                  {p.status === 'published' && <>
                    {rate != null && rate < 100 && <Button size="sm" variant="secondary" onClick={() => act(p, 'remind')}><BellRing className="h-4 w-4" /> Remind {p.audienceCount - p.acknowledgedCount}</Button>}
                    <Button size="sm" variant="ghost" onClick={() => act(p, 'archive', { title: `Archive ${p.title}?`, message: 'Staff will no longer see it. Acknowledgement records are kept.', confirmLabel: 'Archive' })}><Archive className="h-4 w-4" /> Archive</Button>
                  </>}
                  <span className="ml-auto self-center text-xs text-slate-500">{p.publishedAt ? `Published ${fmtDate(p.publishedAt)}` : `Edited ${fmtDate(p.updatedAt)}`}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <PolicyEditor policy={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {acks && <AckList policy={acks} onClose={() => setAcks(null)} />}
    </div>
  );
}
