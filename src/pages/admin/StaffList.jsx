import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound, LogIn, Pencil, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import SignInCodeModal from '../../components/SignInCodeModal';
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, PasswordInput, Spinner } from '../../components/ui';
import { fmtDate, ymd } from '../../lib/format';
import { useConfirm } from '../../components/Confirm';
import useDebounced from '../../lib/useDebounced';
import { Term } from '../../components/InfoTip';
import { useAuth } from '../../context/AuthContext';
import { ACCESS_LABEL, ACCESS_OPTIONS, accessOf } from '../../lib/access';

const blank = {
  firstName: '', lastName: '', email: '', password: '', access: 'staff', department: '', jobTitle: '',
  employmentType: 'full_time', phone: '', dateJoined: ymd(), status: 'active', leaveBalance: 21,
  position: '', grade: '', manager: '', probationEndDate: '', contractEndDate: '', plannedExitDate: '',
  payrollAccess: false, emrRoles: [],
};

const EMR_ROLES = [['reception', 'Reception'], ['nurse', 'Nurse'], ['doctor', 'Doctor'], ['lab', 'Lab'], ['pharmacy', 'Pharmacy'], ['cashier', 'Cashier'], ['billing', 'Billing officer'], ['admin', 'EMR admin']];

const idOf = (v) => (v && typeof v === 'object' ? v._id : v || '');
const dateOf = (v) => (v ? ymd(v) : '');

// Edit form values from a (possibly populated) staff record.
const toForm = (staff) => ({
  ...blank, ...staff, password: '', access: accessOf(staff),
  position: idOf(staff.position), grade: idOf(staff.grade), manager: idOf(staff.manager),
  dateJoined: dateOf(staff.dateJoined), probationEndDate: dateOf(staff.probationEndDate),
  contractEndDate: dateOf(staff.contractEndDate), plannedExitDate: dateOf(staff.plannedExitDate),
});

export function StaffFormModal({ open, onClose, staff, onSaved }) {
  const { can, user: me } = useAuth();
  const canSetAccess = can('admins') && staff?._id !== me?._id; // super admins, and not for themselves
  const payOk = can('pay');
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [], jobTitles: [] } });
  const { data: positions } = useFetch('/org/positions', { initial: [] });
  const { data: grades } = useFetch('/org/grades', { initial: [] });
  const { data: people } = useFetch('/users/directory', { initial: [] });
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState(null);
  const key = open ? staff?._id || 'new' : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (open) setForm(staff ? toForm(staff) : blank);
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  // Choosing a position fills in its department, title and grade.
  const choosePosition = (e) => {
    const pos = positions.find((p) => p._id === e.target.value);
    setForm({ ...form, position: e.target.value, ...(pos ? { department: pos.department, jobTitle: pos.title, grade: idOf(pos.grade) || form.grade } : {}) });
  };
  const selectedPosition = positions.find((p) => p._id === form.position);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { password: _password, role: _role, adminLevel: _level, frontDesk: _desk, ...rest } = form;
      const payload = { ...(staff ? rest : { ...rest, password: form.password }) };
      if (!canSetAccess) delete payload.access;
      if (!payOk) { delete payload.payrollAccess; delete payload.bankDetails; }
      const { data } = staff ? await api.put(`/users/${staff._id}`, payload) : await api.post('/users', payload);
      toast.success(staff ? 'Staff updated' : `Staff created (ID ${data.staffId})`);
      onSaved?.(data);
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={staff ? 'Edit staff' : 'Add staff'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="staff-form" loading={busy}>Save</Button></>}>
      <form id="staff-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name"><input className="input" required value={form.firstName} onChange={set('firstName')} /></Field>
        <Field label="Last name"><input className="input" required value={form.lastName} onChange={set('lastName')} /></Field>
        <Field label="Email"><input type="email" className="input" required value={form.email} onChange={set('email')} /></Field>
        {!staff && <Field label="Initial password" hint="Share it with the staff member; they can change it."><PasswordInput required minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>}
        <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Position" hint={selectedPosition ? `${selectedPosition.filled}/${selectedPosition.approvedHeadcount} filled` : 'Sets department, title and grade'}>
          <select className="input" value={form.position} onChange={choosePosition}>
            <option value="">No position</option>
            {positions.map((p) => <option key={p._id} value={p._id}>{p.title} · {p.department}</option>)}
          </select>
        </Field>
        <Field label="Department">
          <input className="input" list="departments" value={form.department} disabled={!!form.position} onChange={set('department')} />
          <datalist id="departments">{meta.departments.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
        <Field label="Job title / category">
          <input className="input" list="jobtitles" value={form.jobTitle} disabled={!!form.position} onChange={set('jobTitle')} />
          <datalist id="jobtitles">{meta.jobTitles.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
        <Field label="Grade">
          <select className="input" value={form.grade} onChange={set('grade')}>
            <option value="">Not set</option>{grades.map((g) => <option key={g._id} value={g._id}>{g.code} · {g.name}</option>)}
          </select>
        </Field>
        <Field label="Line manager">
          <select className="input" value={form.manager} onChange={set('manager')}>
            <option value="">None</option>
            {people.filter((p) => p._id !== staff?._id).map((p) => <option key={p._id} value={p._id}>{p.firstName} {p.lastName} · {p.jobTitle || '—'}</option>)}
          </select>
        </Field>
        <Field label="Employment type">
          <select className="input" value={form.employmentType} onChange={set('employmentType')}>
            {['full_time', 'part_time', 'contract', 'locum', 'intern'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </Field>
        {canSetAccess ? (
          <Field label="Access" hint={ACCESS_OPTIONS.find((o) => o.value === form.access)?.hint}>
            <select className="input" value={form.access} onChange={set('access')}>
              {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Access" hint={staff?._id === me?._id ? 'Another super admin can change your access.' : 'Only super admins can change access.'}>
            <input className="input" disabled value={ACCESS_LABEL[form.access] || 'Staff'} />
          </Field>
        )}
        {payOk && <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-3 sm:col-span-2">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-700" checked={!!form.payrollAccess} onChange={(e) => setForm({ ...form, payrollAccess: e.target.checked })} />
          <span className="text-sm"><span className="font-semibold text-slate-800">Payroll access</span><br />
            <span className="text-slate-500">Can sign in to Solucio Payroll with this account and send salaries, and gets payroll emails. Give it only to the people who run payroll.</span></span>
        </label>}
        <div className="rounded-2xl bg-slate-50 p-3 sm:col-span-2">
          <p className="text-sm font-semibold text-slate-800">EMR roles</p>
          <p className="mb-2 text-sm text-slate-500">What this person does in Solucio EMR. They sign in there with this account. None ticked = no EMR access.</p>
          <div className="flex flex-wrap gap-2">
            {EMR_ROLES.map(([value, label]) => {
              const on = (form.emrRoles || []).includes(value);
              return (
                <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 transition ${on ? 'bg-brand-50 font-semibold text-brand-800 ring-brand-300' : 'bg-white text-slate-600 ring-slate-200'}`}>
                  <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={on}
                    onChange={(e) => setForm({ ...form, emrRoles: e.target.checked ? [...(form.emrRoles || []), value] : (form.emrRoles || []).filter((r) => r !== value) })} />
                  {label}
                </label>
              );
            })}
          </div>
        </div>
        <Field label="Date joined"><input type="date" className="input" value={form.dateJoined} onChange={set('dateJoined')} /></Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={set('status')}>
            {['active', 'on_leave', 'suspended', 'inactive'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Annual leave balance (days)"><input type="number" className="input" value={form.leaveBalance} onChange={set('leaveBalance')} /></Field>
        <div className="grid grid-cols-1 gap-4 rounded-2xl bg-slate-50 p-4 sm:col-span-2 sm:grid-cols-3">
          <p className="label sm:col-span-3">Employment dates</p>
          <Field label="Probation ends" hint={!staff ? 'Leave blank to use the standard probation period' : undefined}><input type="date" className="input" value={form.probationEndDate} onChange={set('probationEndDate')} /></Field>
          <Field label="Contract ends" hint="Fixed-term staff"><input type="date" className="input" value={form.contractEndDate} onChange={set('contractEndDate')} /></Field>
          <Field label="Planned exit" hint="Resignation or non-renewal"><input type="date" className="input" value={form.plannedExitDate} onChange={set('plannedExitDate')} /></Field>
        </div>
      </form>
    </Modal>
  );
}

export default function StaffList() {
  const [filters, setFilters] = useState({ q: '', department: '', status: '' });
  // Wait for a pause in typing before searching, and keep the current list visible meanwhile.
  const q = useDebounced(filters.q);
  const { data: staff, loading, refreshing, reload } = useFetch('/users', { params: { ...filters, q }, initial: [] });
  const ask = useConfirm();
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] } });
  const [editing, setEditing] = useState(null);
  const [codeFor, setCodeFor] = useState(null);
  // "Add staff" on the dashboard links here with ?new=1 to open the form straight away.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') === '1') { setEditing({}); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const resetPassword = async (s) => {
    const password = await ask({
      title: `Reset password for ${s.firstName} ${s.lastName}`,
      message: 'They will need this password to sign in. Share it with them privately; they can change it from their profile.',
      password: true,
      confirmLabel: 'Reset password',
    });
    if (password === false) return;
    try { await api.post(`/users/${s._id}/reset-password`, { password }); toast.success(`Password reset for ${s.firstName}`); } catch (e) { toastError(e); }
  };

  return (
    <div>
      <PageHeader title="Staff" subtitle={`${staff.length} staff member(s)`} actions={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add staff</Button>} />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <div className="relative w-full flex-1 sm:w-auto sm:min-w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search by name, email or staff ID" aria-label="Search staff" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </div>
          <select className="input w-full sm:w-48" aria-label="Department" value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>
            <option value="">All departments</option>
            {meta.departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select className="input w-full sm:w-40" aria-label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Any status</option>
            {['active', 'on_leave', 'suspended', 'inactive'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        {loading ? <Spinner /> : staff.length === 0 ? <Empty title="No staff match your filters" /> : (
          <div className={`overflow-x-auto transition-opacity ${refreshing ? 'opacity-60' : ''}`} aria-busy={refreshing}>
            <table className="table">
              <thead><tr><th><Term>Name</Term></th><th><Term>Staff ID</Term></th><th><Term>Department</Term></th><th><Term>Job title</Term></th><th><Term>Joined</Term></th><th><Term>Profile</Term></th><th><Term>Status</Term></th><th /></tr></thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <Link to={`/admin/staff/${s._id}`} className="flex items-center gap-3 hover:text-brand-700">
                        <Avatar user={s} size="sm" />
                        <span><span className="block font-semibold">{s.firstName} {s.lastName}</span><span className="text-xs text-slate-500">{s.email}</span></span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs">{s.staffId}</td>
                    <td>{s.department || '—'}</td>
                    <td>{s.jobTitle || '—'}{accessOf(s) !== 'staff' && <span className="ml-1"><Badge color="purple">{ACCESS_LABEL[accessOf(s)]}</Badge></span>}{s.payrollAccess && <span className="ml-1"><Badge color="teal">Payroll</Badge></span>}{s.emrRoles?.length > 0 && <span className="ml-1"><Badge color="blue">EMR</Badge></span>}</td>
                    <td>{fmtDate(s.dateJoined)}</td>
                    <td><span className={s.profileCompletion < 60 ? 'text-amber-600' : 'text-slate-600'}>{s.profileCompletion}%</span></td>
                    <td><Badge status={s.status} /></td>
                    <td className="whitespace-nowrap text-right">
                      <Link to={`/admin/staff/${s._id}`} className="mr-1 text-sm font-semibold text-brand-700 hover:underline">Report</Link>
                      <IconButton icon={Pencil} label={`Edit ${s.firstName} ${s.lastName}`} onClick={() => setEditing(s)} />
                      <IconButton icon={KeyRound} label={`Reset password for ${s.firstName} ${s.lastName}`} onClick={() => resetPassword(s)} />
                      {s.status !== 'inactive' && <IconButton icon={LogIn} label={`One-time sign-in code for ${s.firstName} ${s.lastName}`} onClick={() => setCodeFor(s)} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {codeFor && <SignInCodeModal user={codeFor} onClose={() => setCodeFor(null)} />}
      <StaffFormModal open={!!editing} staff={editing?._id ? editing : null} onClose={() => setEditing(null)} onSaved={reload} />
    </div>
  );
}
