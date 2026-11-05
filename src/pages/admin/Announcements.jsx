import { useEffect, useState } from 'react';
import { Megaphone, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, Field, IconButton, PageHeader, ProgressBar, Spinner } from '../../components/ui';
import { useConfirm } from '../../components/Confirm';
import { useUndoDelete } from '../../lib/undo';
import StaffPicker from '../../components/StaffPicker';
import { fmtDateTime, fullName } from '../../lib/format';
import { Term } from '../../components/InfoTip';

function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button type="button" key={o} aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
            className={`min-h-10 rounded-full px-3.5 py-1.5 text-sm font-semibold desk:min-h-0 desk:px-3 desk:py-1 desk:text-xs ${on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{o}</button>
        );
      })}
      {!options.length && <span className="text-xs text-slate-500">None available</span>}
    </div>
  );
}

const blank = { title: '', body: '', priority: 'normal', audience: { scope: 'all', users: [], departments: [], jobTitles: [], roles: [] } };

function audienceText(a) {
  if (a.scope === 'all') return 'All staff';
  if (a.scope === 'individuals') return a.users?.map(fullName).join(', ') || 'Individuals';
  return [...(a.departments || []), ...(a.jobTitles || []), ...(a.roles || []).map((r) => `${r}s`)].join(', ');
}

export default function Announcements() {
  const { data: allSent, loading, reload } = useFetch('/announcements', { initial: [] });
  const undo = useUndoDelete();
  const sent = undo.visible(allSent);
  const ask = useConfirm();
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [], jobTitles: [] } });
  const [form, setForm] = useState(blank);
  const [count, setCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const aud = form.audience;
  const setAud = (patch) => setForm({ ...form, audience: { ...aud, ...patch } });

  useEffect(() => {
    const t = setTimeout(() => {
      api.post('/announcements/preview', { audience: aud }).then((r) => setCount(r.data.count)).catch(() => setCount(0));
    }, 300);
    return () => clearTimeout(t);
  }, [aud]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/announcements', form);
      toast.success(`Sent to ${count} staff`);
      setForm(blank);
      reload();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };

  const remove = async (a) => {
    const ok = await ask({
      title: `Delete "${a.title}"?`,
      message: `It will disappear from the inbox of all ${a.recipientCount} recipient(s). You'll have a few seconds to undo.`,
      confirmLabel: 'Delete for everyone',
      tone: 'danger',
    });
    if (ok) undo.remove({ id: a._id, url: `/announcements/${a._id}`, message: 'Announcement deleted' });
  };

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Send information to all staff, a category of staff, or specific people." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card title="Compose" className="xl:col-span-3">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <span className="label">Send to</span>
              <div className="grid grid-cols-3 gap-2">
                {[['all', 'Everyone'], ['category', 'By category'], ['individuals', 'Individuals']].map(([v, l]) => (
                  <button type="button" key={v} aria-pressed={aud.scope === v} onClick={() => setAud({ scope: v })}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold desk:min-h-0 ${aud.scope === v ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-500' : 'border-slate-200 text-slate-600'}`}>{l}</button>
                ))}
              </div>
            </div>
            {aud.scope === 'category' && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div><span className="label">Departments</span><Chips options={meta.departments} value={aud.departments} onChange={(v) => setAud({ departments: v })} /></div>
                <div><span className="label">Job titles</span><Chips options={meta.jobTitles} value={aud.jobTitles} onChange={(v) => setAud({ jobTitles: v })} /></div>
                <div><span className="label">Roles</span><Chips options={['admin', 'staff']} value={aud.roles} onChange={(v) => setAud({ roles: v })} /></div>
                <p className="text-xs text-slate-500"><Term>Staff matching any selected department, job title or role receive the message.</Term></p>
              </div>
            )}
            {aud.scope === 'individuals' && <StaffPicker value={aud.users} onChange={(v) => setAud({ users: v })} />}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Title" className="sm:col-span-2"><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="Priority">
                <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option>
                </select>
              </Field>
            </div>
            <Field label="Message"><textarea rows={7} className="input" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{count == null ? '…' : `${count} recipient(s)`}</span>
              <Button loading={busy} disabled={!count}><Send className="h-4 w-4" /> Send</Button>
            </div>
          </form>
        </Card>

        <Card title="Sent" className="xl:col-span-2" bodyClass="p-0">
          {loading ? <Spinner /> : sent.length === 0 ? <Empty icon={Megaphone} title="Nothing sent yet" /> : (
            <ul className="stagger max-h-[75vh] divide-y divide-slate-100 overflow-y-auto">
              {sent.map((a) => (
                <li key={a._id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><p className="truncate font-semibold">{a.title}</p>{a.priority !== 'normal' && <Badge status={a.priority} />}</div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">To: {audienceText(a.audience)}</p>
                    </div>
                    <IconButton icon={Trash2} label={`Delete ${a.title}`} onClick={() => remove(a)} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{a.body}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={(a.readCount / a.recipientCount) * 100} tone="bg-brand-500" />
                    <span className="whitespace-nowrap text-xs text-slate-500">{a.readCount}/{a.recipientCount} read</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{fmtDateTime(a.createdAt)} · {fullName(a.createdBy)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
