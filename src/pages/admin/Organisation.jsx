import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, Spinner, Tabs, TagInput } from '../../components/ui';
import { fmtMoney, fullName } from '../../lib/format';
import { Term } from '../../components/InfoTip';
import MoneyInput from '../../components/MoneyInput';

const idOf = (v) => (v && typeof v === 'object' ? v._id : v || '');

// ---------------- Departments ----------------
function Departments() {
  const { data: rows, loading, reload } = useFetch('/org/departments', { initial: [] });
  const { data: staff } = useFetch('/users/directory', { initial: [] });
  const ask = useConfirm();
  const [edit, setEdit] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...edit, head: idOf(edit.head) || '' };
      if (edit._id) await api.put(`/org/departments/${edit._id}`, body); else await api.post('/org/departments', body);
      toast.success('Department saved'); setEdit(null); reload();
    } catch (err) { toastError(err); }
  };
  const remove = async (d) => {
    if (!(await ask({ title: `Delete ${d.name}?`, message: 'Only empty departments can be deleted.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    try { await api.delete(`/org/departments/${d._id}`); reload(); } catch (e) { toastError(e); }
  };

  return (
    <Card bodyClass="p-0" title={`${rows.length} departments`} action={<Button size="sm" onClick={() => setEdit({ name: '', code: '', costCentre: '', description: '' })}><Plus className="h-4 w-4" /> Add department</Button>}>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty title="No departments yet" /> : (
        <div className="overflow-x-auto"><table className="table">
          <thead><tr><th><Term>Department</Term></th><th><Term>Head</Term></th><th><Term>Staff</Term></th><th><Term>Establishment</Term></th><th><Term>Cost centre</Term></th><th /></tr></thead>
          <tbody>{rows.map((d) => (
            <tr key={d._id}>
              <td><p className="font-semibold">{d.name}</p>{d.code && <p className="text-xs text-slate-500">{d.code}</p>}</td>
              <td>{d.head ? <span className="flex items-center gap-2"><Avatar user={d.head} size="sm" />{fullName(d.head)}</span> : <span className="text-slate-500">Not set</span>}</td>
              <td>{d.headcount}</td>
              <td>{d.approvedHeadcount ? <span className={d.headcount < d.approvedHeadcount ? 'font-semibold text-amber-700' : ''}>{d.headcount}/{d.approvedHeadcount} filled</span> : '—'}</td>
              <td>{d.costCentre || '—'}</td>
              <td className="whitespace-nowrap text-right">
                <IconButton icon={Pencil} label={`Edit ${d.name}`} onClick={() => setEdit(d)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${d.name}`} onClick={() => remove(d)} />
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? 'Edit department' : 'Add department'}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button form="dept-form">Save</Button></>}>
        {edit && (
          <form id="dept-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name"><input className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Code"><input className="input" value={edit.code || ''} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>
            <Field label="Head of department">
              <select className="input" value={idOf(edit.head)} onChange={(e) => setEdit({ ...edit, head: e.target.value })}>
                <option value="">Not set</option>
                {staff.map((s) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} · {s.jobTitle || '—'}</option>)}
              </select>
            </Field>
            <Field label="Cost centre"><input className="input" value={edit.costCentre || ''} onChange={(e) => setEdit({ ...edit, costCentre: e.target.value })} /></Field>
            <Field label="Description" className="sm:col-span-2"><textarea rows={3} className="input" value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          </form>
        )}
      </Modal>
    </Card>
  );
}

// ---------------- Positions ----------------
function Positions() {
  const [dept, setDept] = useState('');
  const { data: rows, loading, reload } = useFetch('/org/positions', { params: dept ? { department: dept } : {}, initial: [] });
  const { data: departments } = useFetch('/org/departments', { initial: [] });
  const { data: grades } = useFetch('/org/grades', { initial: [] });
  const { data: certTitles } = useFetch('/certificates/titles', { initial: [] });
  const ask = useConfirm();
  const [edit, setEdit] = useState(null);

  const blank = { title: '', code: '', department: dept || departments[0]?.name || '', grade: '', approvedHeadcount: 1, reportsTo: '', description: '', requiredCertificates: [], requiredSkills: [], status: 'active' };
  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...edit, grade: idOf(edit.grade) || null, reportsTo: idOf(edit.reportsTo) || null };
      if (edit._id) await api.put(`/org/positions/${edit._id}`, body); else await api.post('/org/positions', body);
      toast.success('Position saved'); setEdit(null); reload();
    } catch (err) { toastError(err); }
  };
  const remove = async (p) => {
    if (!(await ask({ title: `Delete ${p.title}?`, message: 'Only positions nobody holds can be deleted.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    try { await api.delete(`/org/positions/${p._id}`); reload(); } catch (e) { toastError(e); }
  };

  return (
    <Card bodyClass="p-0" title="Positions & establishment"
      action={<div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <select className="input w-full sm:w-48" aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>{departments.map((d) => <option key={d._id}>{d.name}</option>)}
        </select>
        <Button size="sm" onClick={() => setEdit(blank)}><Plus className="h-4 w-4" /> Add position</Button>
      </div>}>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty title="No positions yet">Positions define how many people each role should have, at what grade, with which certificates.</Empty> : (
        <div className="overflow-x-auto"><table className="table">
          <thead><tr><th><Term>Position</Term></th><th><Term>Department</Term></th><th><Term>Grade</Term></th><th><Term>Filled</Term></th><th><Term>Must hold</Term></th><th><Term>Status</Term></th><th /></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p._id}>
              <td><p className="font-semibold">{p.title}</p>{p.reportsTo && <p className="text-xs text-slate-500">Reports to {p.reportsTo.title}</p>}</td>
              <td>{p.department}</td>
              <td>{p.grade ? `${p.grade.code} · ${p.grade.name}` : '—'}</td>
              <td><span className={p.filled < p.approvedHeadcount ? 'font-semibold text-amber-700' : p.filled > p.approvedHeadcount ? 'font-semibold text-rose-700' : 'text-emerald-700'}>{p.filled}/{p.approvedHeadcount}</span></td>
              <td className="max-w-xs"><span className="flex flex-wrap justify-end gap-1 sm:justify-start">{p.requiredCertificates.length ? p.requiredCertificates.map((c) => <Badge key={c} color="teal">{c}</Badge>) : <span className="text-slate-500">—</span>}</span></td>
              <td><Badge status={p.status === 'active' ? 'active' : 'draft'}>{p.status === 'frozen' ? 'Frozen' : 'Active'}</Badge></td>
              <td className="whitespace-nowrap text-right">
                <IconButton icon={Pencil} label={`Edit ${p.title}`} onClick={() => setEdit(p)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${p.title}`} onClick={() => remove(p)} />
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? `Edit ${edit.title}` : 'Add position'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button form="pos-form">Save</Button></>}>
        {edit && (
          <form id="pos-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Job title"><input className="input" required value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Department">
              <select className="input" required value={edit.department} onChange={(e) => setEdit({ ...edit, department: e.target.value })}>
                <option value="">Choose…</option>{departments.map((d) => <option key={d._id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Grade">
              <select className="input" value={idOf(edit.grade)} onChange={(e) => setEdit({ ...edit, grade: e.target.value })}>
                <option value="">Not set</option>{grades.map((g) => <option key={g._id} value={g._id}>{g.code} · {g.name}</option>)}
              </select>
            </Field>
            <Field label="Approved headcount" hint="How many people this role should have (establishment)">
              <input type="number" min="0" className="input" value={edit.approvedHeadcount} onChange={(e) => setEdit({ ...edit, approvedHeadcount: Number(e.target.value) })} />
            </Field>
            <Field label="Reports to">
              <select className="input" value={idOf(edit.reportsTo)} onChange={(e) => setEdit({ ...edit, reportsTo: e.target.value })}>
                <option value="">—</option>{rows.filter((r) => r._id !== edit._id).map((r) => <option key={r._id} value={r._id}>{r.title} · {r.department}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                <option value="active">Active</option><option value="frozen">Frozen (no hiring)</option>
              </select>
            </Field>
            <div className="sm:col-span-2"><span className="label">Required certificates</span>
              <TagInput label="Required certificates" value={edit.requiredCertificates} onChange={(v) => setEdit({ ...edit, requiredCertificates: v })} suggestions={certTitles.map((t) => t.title)} placeholder="e.g. Basic Life Support (BLS)" />
            </div>
            <div className="sm:col-span-2"><span className="label">Required skills</span>
              <TagInput label="Required skills" value={edit.requiredSkills} onChange={(v) => setEdit({ ...edit, requiredSkills: v })} placeholder="e.g. IV cannulation" />
            </div>
            <Field label="Job description" className="sm:col-span-2"><textarea rows={4} className="input" value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          </form>
        )}
      </Modal>
    </Card>
  );
}

// ---------------- Grades ----------------
function Grades() {
  const { data: rows, loading, reload } = useFetch('/org/grades', { initial: [] });
  const ask = useConfirm();
  const [edit, setEdit] = useState(null);
  const blankAllowance = { name: '', type: 'fixed', amount: 0, taxable: true, pensionable: false };

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...edit, allowances: edit.allowances.filter((a) => a.name.trim()) };
      if (edit._id) await api.put(`/org/grades/${edit._id}`, body); else await api.post('/org/grades', body);
      toast.success('Grade saved'); setEdit(null); reload();
    } catch (err) { toastError(err); }
  };
  const remove = async (g) => {
    if (!(await ask({ title: `Delete ${g.code}?`, confirmLabel: 'Delete', tone: 'danger' }))) return;
    try { await api.delete(`/org/grades/${g._id}`); reload(); } catch (e) { toastError(e); }
  };
  const setAllowance = (i, patch) => setEdit({ ...edit, allowances: edit.allowances.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  return (
    <Card bodyClass="p-0" title="Grades & salary bands" action={<Button size="sm" onClick={() => setEdit({ code: '', name: '', level: (rows.at(-1)?.level || 0) + 2, minSalary: '', maxSalary: '', allowances: [] })}><Plus className="h-4 w-4" /> Add grade</Button>}>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty title="No grades yet" /> : (
        <div className="overflow-x-auto"><table className="table">
          <thead><tr><th><Term>Grade</Term></th><th><Term>Monthly basic band</Term></th><th><Term>Allowances</Term></th><th><Term>Staff</Term></th><th /></tr></thead>
          <tbody>{rows.map((g) => (
            <tr key={g._id}>
              <td><p className="font-semibold">{g.code}</p><p className="text-xs text-slate-500">{g.name} · level {g.level}</p></td>
              <td className="whitespace-nowrap">{fmtMoney(g.minSalary)} – {fmtMoney(g.maxSalary)}</td>
              <td className="max-w-sm"><span className="flex flex-wrap justify-end gap-1 sm:justify-start">{g.allowances.map((a) => <Badge key={a.name} color="slate">{a.name} {a.type === 'percent_of_basic' ? `${a.amount}%` : fmtMoney(a.amount)}</Badge>)}</span></td>
              <td>{g.staffCount}</td>
              <td className="whitespace-nowrap text-right">
                <IconButton icon={Pencil} label={`Edit ${g.code}`} onClick={() => setEdit(g)} />
                <IconButton icon={Trash2} tone="danger" label={`Delete ${g.code}`} onClick={() => remove(g)} />
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? `Edit ${edit.code}` : 'Add grade'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button form="grade-form">Save</Button></>}>
        {edit && (
          <form id="grade-form" onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Code"><input className="input" required value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>
              <Field label="Level"><input type="number" className="input" required value={edit.level} onChange={(e) => setEdit({ ...edit, level: Number(e.target.value) })} /></Field>
              <Field label="Name" className="col-span-2"><input className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Min monthly basic (₦)" className="col-span-2"><MoneyInput min="0" className="input" required value={edit.minSalary} onChange={(e) => setEdit({ ...edit, minSalary: Number(e.target.value) })} /></Field>
              <Field label="Max monthly basic (₦)" className="col-span-2"><MoneyInput min="0" className="input" required value={edit.maxSalary} onChange={(e) => setEdit({ ...edit, maxSalary: Number(e.target.value) })} /></Field>
            </div>
            <div>
              <span className="label">Standard allowances</span>
              <div className="space-y-2">
                {edit.allowances.map((a, i) => (
                  <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                    <Field label="Name"><input className="input" value={a.name} onChange={(e) => setAllowance(i, { name: e.target.value })} /></Field>
                    <Field label="Type">
                      <select className="input" value={a.type} onChange={(e) => setAllowance(i, { type: e.target.value })}>
                        <option value="fixed">Fixed ₦</option><option value="percent_of_basic">% of basic</option>
                      </select>
                    </Field>
                    <Field label={a.type === 'fixed' ? 'Amount (₦)' : 'Percent'}><MoneyInput min="0" className="input" value={a.amount} onChange={(e) => setAllowance(i, { amount: Number(e.target.value) })} /></Field>
                    <IconButton icon={Trash2} tone="danger" label="Remove allowance" onClick={() => setEdit({ ...edit, allowances: edit.allowances.filter((_, j) => j !== i) })} />
                    <label className="col-span-2 flex flex-wrap gap-4 text-sm sm:col-span-4">
                      <span className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={a.taxable} onChange={(e) => setAllowance(i, { taxable: e.target.checked })} /> Taxable</span>
                      <span className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={a.pensionable} onChange={(e) => setAllowance(i, { pensionable: e.target.checked })} /> Counts toward pension</span>
                    </label>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => setEdit({ ...edit, allowances: [...edit.allowances, blankAllowance] })}><Plus className="h-4 w-4" /> Add allowance</Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

// ---------------- Org chart ----------------
function OrgNode({ person, byManager, depth }) {
  const reports = byManager.get(String(person._id)) || [];
  return (
    <li className="relative">
      <Link to={`/admin/staff/${person._id}`} className="lift flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <Avatar user={person} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{fullName(person)}</span>
          <span className="block truncate text-xs text-slate-500">{person.position?.title || person.jobTitle || '—'} · {person.department || '—'}</span>
        </span>
        {reports.length > 0 && <Badge color="teal"><Users className="mr-1 h-3 w-3" />{reports.length}</Badge>}
      </Link>
      {reports.length > 0 && (
        <ul className="ml-5 mt-2 space-y-2 border-l-2 border-dashed border-slate-200 pl-4 sm:ml-8 sm:pl-6">
          {reports.map((r) => <OrgNode key={r._id} person={r} byManager={byManager} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
}

function OrgChart() {
  const { data: people, loading } = useFetch('/org/chart', { initial: [] });
  const { roots, byManager } = useMemo(() => {
    const ids = new Set(people.map((p) => String(p._id)));
    const map = new Map();
    for (const p of people) {
      const m = p.manager && ids.has(String(p.manager)) ? String(p.manager) : null;
      if (m) (map.get(m) || map.set(m, []).get(m)).push(p);
    }
    return { byManager: map, roots: people.filter((p) => !p.manager || !ids.has(String(p.manager))) };
  }, [people]);
  if (loading) return <Spinner />;
  return (
    <Card title="Reporting lines" action={<span className="text-xs text-slate-500">Set a person's manager on their staff record</span>}>
      {people.length === 0 ? <Empty title="No staff yet" /> : <ul className="space-y-3">{roots.map((r) => <OrgNode key={r._id} person={r} byManager={byManager} depth={0} />)}</ul>}
    </Card>
  );
}

// ---------------- HR rules ----------------
function HrRules() {
  const { data, setData, loading } = useFetch('/org/settings', { live: false });
  const [busy, setBusy] = useState(false);
  if (loading || !data) return <Spinner />;
  const set = (k) => (e) => setData({ ...data, [k]: Number(e.target.value) || e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.put('/org/settings', data); toast.success('HR rules saved'); } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Card title="HR rules">
      <form onSubmit={save} className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Organisation name" className="sm:col-span-2"><input className="input" value={data.organisationName} onChange={(e) => setData({ ...data, organisationName: e.target.value })} /></Field>
        <Field label="Retirement age" hint="Staff reaching this age appear as planned exits"><input type="number" className="input" value={data.retirementAge} onChange={set('retirementAge')} /></Field>
        <Field label="Probation (months)" hint="Sets the probation end date for new staff"><input type="number" className="input" value={data.probationMonths} onChange={set('probationMonths')} /></Field>
        <Field label="Maximum weekly hours" hint="Workload above this is flagged"><input type="number" className="input" value={data.maxWeeklyHours} onChange={set('maxWeeklyHours')} /></Field>
        <Field label="Planning horizon (months)" hint="How far ahead the workforce plan looks"><input type="number" className="input" value={data.planningHorizonMonths} onChange={set('planningHorizonMonths')} /></Field>
        <div className="sm:col-span-2"><Button loading={busy}>Save rules</Button></div>
      </form>
    </Card>
  );
}

export default function Organisation() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'departments';
  return (
    <div>
      <PageHeader title="Organisation" subtitle="Departments, positions, pay grades and reporting lines: the structure everything else plans against." />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { value: 'departments', label: 'Departments' }, { value: 'positions', label: 'Positions' }, { value: 'grades', label: 'Grades' },
        { value: 'chart', label: 'Org chart' }, { value: 'rules', label: 'HR rules' },
      ]} />
      {tab === 'departments' && <Departments />}
      {tab === 'positions' && <Positions />}
      {tab === 'grades' && <Grades />}
      {tab === 'chart' && <OrgChart />}
      {tab === 'rules' && <HrRules />}
    </div>
  );
}
