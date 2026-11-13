import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShieldCheck, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/Confirm';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, PasswordInput, Spinner, Tabs } from '../../components/ui';
import { ACCESS_LABEL, ACCESS_OPTIONS, accessOf } from '../../lib/access';
import { fmtDate, fullName } from '../../lib/format';

const ELEVATED = ACCESS_OPTIONS.filter((o) => o.value !== 'staff');
const COLOR = { super_admin: 'purple', hr_manager: 'blue', hr_officer: 'teal', front_desk: 'amber' };

// What each level can do, so the choice is clear before giving it.
function LevelGuide() {
  return (
    <Card title="What each level can do" bodyClass="p-0">
      <ul className="divide-y divide-slate-100">
        {ELEVATED.slice().reverse().map((o) => (
          <li key={o.value} className="flex flex-wrap items-start gap-3 px-5 py-3">
            <span className="w-28 shrink-0"><Badge color={COLOR[o.value]}>{o.label}</Badge></span>
            <span className="min-w-0 flex-1 text-sm text-slate-600">{o.hint}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AddAccess({ open, onClose, onDone }) {
  const { data: people } = useFetch(open ? '/users/directory' : null, { initial: [] });
  const [mode, setMode] = useState('existing');
  const [form, setForm] = useState({ user: '', access: 'hr_officer', firstName: '', lastName: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const candidates = people.filter((p) => p.role !== 'admin');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'existing') {
        await api.put(`/users/${form.user}`, { access: form.access });
        const p = people.find((x) => x._id === form.user);
        toast.success(`${p.firstName} is now ${ACCESS_LABEL[form.access]}`);
      } else {
        const { data } = await api.post('/users', { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, access: form.access });
        toast.success(`${data.firstName} added as ${ACCESS_LABEL[form.access]} (ID ${data.staffId})`);
      }
      setForm({ user: '', access: 'hr_officer', firstName: '', lastName: '', email: '', password: '' });
      onDone();
      onClose();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Give someone access"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="access-form" loading={busy}>Give access</Button></>}>
      <form id="access-form" onSubmit={submit} className="space-y-4">
        <Tabs value={mode} onChange={setMode} tabs={[{ value: 'existing', label: 'Existing staff member' }, { value: 'new', label: 'New account' }]} />
        {mode === 'existing' ? (
          <Field label="Staff member">
            <select className="input" required value={form.user} onChange={set('user')}>
              <option value="">Select…</option>
              {candidates.map((p) => <option key={p._id} value={p._id}>{p.firstName} {p.lastName} · {p.staffId}</option>)}
            </select>
          </Field>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name"><input className="input" required value={form.firstName} onChange={set('firstName')} /></Field>
            <Field label="Last name"><input className="input" required value={form.lastName} onChange={set('lastName')} /></Field>
            <Field label="Email" className="sm:col-span-2"><input type="email" className="input" required value={form.email} onChange={set('email')} /></Field>
            <Field label="Initial password" hint="Share it with them; they can change it." className="sm:col-span-2"><PasswordInput required minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>
          </div>
        )}
        <fieldset>
          <legend className="label">Access level</legend>
          <div className="space-y-2">
            {ELEVATED.map((o) => (
              <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${form.access === o.value ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="access" className="mt-1 accent-brand-700" value={o.value} checked={form.access === o.value} onChange={set('access')} />
                <span><span className="block font-semibold text-slate-900">{o.label}</span><span className="block text-sm text-slate-500">{o.hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

export default function AdminAccess() {
  const { user: me } = useAuth();
  const ask = useConfirm();
  const { data, loading, reload } = useFetch('/users/access/list', { initial: { people: [] } });
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const people = data.people.filter((p) => p.status !== 'inactive');
  const supers = people.filter((p) => accessOf(p) === 'super_admin').length;

  const change = async (p, access) => {
    if (access === 'staff' && !(await ask({
      title: `Remove ${p.firstName}'s access?`,
      message: `${fullName(p)} will keep their staff account but lose ${ACCESS_LABEL[accessOf(p)]} access straight away.`,
      confirmLabel: 'Remove access', tone: 'danger',
    }))) return;
    setBusyId(p._id);
    try {
      await api.put(`/users/${p._id}`, { access });
      toast.success(access === 'staff' ? `${p.firstName}'s access removed` : `${p.firstName} is now ${ACCESS_LABEL[access]}`);
      reload();
    } catch (e) { toastError(e); reload(); } finally { setBusyId(null); }
  };

  return (
    <div>
      <PageHeader title="Admin access" subtitle="Who can use the admin portal and the check-in screen, and how much they can do."
        actions={<Button onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" /> Give access</Button>} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3" bodyClass="p-0" title={`People with access (${people.length})`}>
          {loading ? <Spinner /> : people.length === 0 ? <Empty icon={ShieldCheck} title="Nobody yet" /> : (
            <ul className="divide-y divide-slate-100">
              {people.map((p) => {
                const level = accessOf(p);
                const self = p._id === me._id;
                const lastSuper = level === 'super_admin' && supers <= 1;
                return (
                  <li key={p._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Avatar user={p} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/admin/staff/${p._id}`} className="font-semibold hover:text-brand-700">{fullName(p)}</Link>{self && <span className="ml-1 text-xs text-slate-500">(you)</span>}
                      <p className="truncate text-sm text-slate-500">{p.email} · {p.lastLoginAt ? `last signed in ${fmtDate(p.lastLoginAt)}` : 'never signed in'}</p>
                    </div>
                    {self || lastSuper ? (
                      <span title={self ? 'Another super admin can change your access' : 'There must always be at least one super admin'}><Badge color={COLOR[level]}>{ACCESS_LABEL[level]}</Badge></span>
                    ) : (
                      <select className="input w-auto min-w-40" aria-label={`Access for ${fullName(p)}`} value={level} disabled={busyId === p._id} onChange={(e) => change(p, e.target.value)}>
                        {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === 'staff' ? 'Remove access' : o.label}</option>)}
                      </select>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <div className="xl:col-span-2"><LevelGuide /></div>
      </div>
      <Button variant="ghost" className="mt-4 sm:hidden" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Give access</Button>
      <AddAccess open={adding} onClose={() => setAdding(false)} onDone={reload} />
    </div>
  );
}
