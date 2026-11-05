import { useState } from 'react';
import { Lock, NotebookPen, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, Spinner, Tabs } from '../../components/ui';
import { useUndoDelete } from '../../lib/undo';
import { fmtDateTime, fullName, titleCase } from '../../lib/format';

export const NOTE_KINDS = [
  { value: 'note', label: 'Note', hint: 'Private jottings and reminders' },
  { value: 'observation', label: 'Observation', hint: 'Something you noticed on the ward or unit' },
  { value: 'report', label: 'Report', hint: 'A formal report for management' },
  { value: 'incident', label: 'Incident', hint: 'An incident involving patients, staff or equipment' },
];
const KIND_COLOR = { note: 'slate', observation: 'blue', report: 'purple', incident: 'red' };
export { KIND_COLOR };

const blank = { kind: 'note', title: '', body: '', subject: '', shareWithAdmin: false };

export default function Notes() {
  const [tab, setTab] = useState('');
  const undo = useUndoDelete();
  const { data: allNotes, loading, reload } = useFetch('/notes/mine', { params: tab ? { kind: tab } : {}, initial: [] });
  const notes = undo.visible(allNotes);
  const { data: staff } = useFetch('/users/directory', { initial: [] });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  const openNew = () => { setForm(blank); setModal({ mode: 'new' }); };
  const openEdit = (n) => { setForm({ ...blank, ...n, subject: n.subject?._id || '' }); setModal({ mode: 'edit', id: n._id }); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (modal.mode === 'new') await api.post('/notes', form);
      else await api.put(`/notes/${modal.id}`, form);
      toast.success(form.shareWithAdmin ? 'Saved and shared with management' : 'Saved privately');
      setModal(null);
      reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = (n) => undo.remove({ id: n._id, url: `/notes/${n._id}`, message: `"${n.title}" deleted` });

  return (
    <div>
      <PageHeader title="Notes, observations & reports" subtitle="Keep private notes, or share observations and reports with management."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> New entry</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: '', label: 'All' }, ...NOTE_KINDS.map((k) => ({ value: k.value, label: k.label + 's' }))]} />
      {loading ? <Spinner /> : notes.length === 0 ? <Card><Empty icon={NotebookPen} title="No entries yet" /></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
          {notes.map((n) => (
            <Card key={n._id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={KIND_COLOR[n.kind]}>{titleCase(n.kind)}</Badge>
                  {n.shareWithAdmin ? <Badge status={n.status}>{`Shared · ${titleCase(n.status)}`}</Badge> : <Badge color="slate"><Lock className="mr-1 h-3 w-3" />Private</Badge>}
                </div>
                <div className="flex shrink-0">
                  <IconButton icon={Pencil} label={`Edit ${n.title}`} onClick={() => openEdit(n)} />
                  <IconButton icon={Trash2} tone="danger" label={`Delete ${n.title}`} onClick={() => remove(n)} />
                </div>
              </div>
              <h3 className="font-semibold">{n.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{n.body}</p>
              {n.subject && <p className="mt-2 text-xs text-slate-500">About: {fullName(n.subject)}</p>}
              {n.adminResponse && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900"><b>Management:</b> {n.adminResponse}</p>}
              <p className="mt-3 text-xs text-slate-500">{fmtDateTime(n.createdAt)}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit entry' : 'New entry'}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button form="note-form" loading={busy}>{form.shareWithAdmin ? <><Send className="h-4 w-4" /> Save & share</> : 'Save'}</Button></>}>
        <form id="note-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {NOTE_KINDS.map((k) => (
              <button type="button" key={k.value} aria-pressed={form.kind === k.value} onClick={() => setForm({ ...form, kind: k.value, shareWithAdmin: k.value !== 'note' ? true : form.shareWithAdmin })}
                className={`rounded-lg border p-2.5 text-left text-sm transition ${form.kind === k.value ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300'}`}>
                <p className="font-semibold">{k.label}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">{NOTE_KINDS.find((k) => k.value === form.kind)?.hint}</p>
          <Field label="Title"><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Details"><textarea rows={6} className="input" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
          <Field label="Concerning a staff member (optional)">
            <select className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
              <option value="">None</option>
              {staff.map((s) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} · {s.department}</option>)}
            </select>
          </Field>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={form.shareWithAdmin} onChange={(e) => setForm({ ...form, shareWithAdmin: e.target.checked })} />
            <span className="text-sm">
              <span className="font-semibold">Share with management</span>
              <span className="block text-slate-500">Your name is attached. To report without your name, use Anonymous report.</span>
            </span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
