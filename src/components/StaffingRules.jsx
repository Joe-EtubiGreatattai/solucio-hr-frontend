import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../lib/api';
import useFetch from '../lib/useFetch';
import { Button, Field, IconButton, Modal } from './ui';
import { titleCase } from '../lib/format';

const SHIFTS = ['morning', 'afternoon', 'night', 'day', 'on_call', 'custom'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Minimum safe staffing per department and shift. Rosters and the dashboard flag anything below it.
export default function StaffingRules({ onClose }) {
  const { data: rules, reload } = useFetch('/rosters/staffing-rules', { initial: [] });
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] }, live: false });
  const blank = { department: '', shiftType: 'night', minStaff: 2, days: [], note: '' };
  const [f, setF] = useState(blank);
  const add = async (e) => {
    e.preventDefault();
    try { await api.post('/rosters/staffing-rules', f); toast.success('Minimum saved'); setF({ ...blank, department: f.department }); reload(); } catch (err) { toastError(err); }
  };
  const remove = async (r) => { try { await api.delete(`/rosters/staffing-rules/${r._id}`); reload(); } catch (err) { toastError(err); } };
  const toggleDay = (d) => setF({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort() });

  return (
    <Modal open onClose={onClose} title="Minimum staffing" size="lg" footer={<Button onClick={onClose}>Done</Button>}>
      <p className="mb-4 text-sm text-slate-600">Set the fewest people each department needs on a shift to be safe. Rosters show any day below it before you publish, leave approvals warn you, and the dashboard flags shifts that are short today.</p>
      {rules.length > 0 && (
        <ul className="mb-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">{rules.map((r) => (
          <li key={r._id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="flex-1"><b>{r.department}</b> · {titleCase(r.shiftType)} shift: at least <b>{r.minStaff}</b>{r.days?.length ? ` on ${r.days.map((d) => DAYS[d]).join(', ')}` : ' every day'}{r.note && <span className="block text-xs text-slate-500">{r.note}</span>}</span>
            <IconButton icon={Trash2} tone="danger" label={`Remove ${r.department} ${r.shiftType} minimum`} onClick={() => remove(r)} />
          </li>
        ))}</ul>
      )}
      <form onSubmit={add} className="grid grid-cols-1 gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
        <Field label="Department"><select className="input" required value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}><option value="">Choose…</option>{meta.departments.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Shift"><select className="input" value={f.shiftType} onChange={(e) => setF({ ...f, shiftType: e.target.value })}>{SHIFTS.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select></Field>
        <Field label="At least (people)"><input type="number" min="1" className="input" required value={f.minStaff} onChange={(e) => setF({ ...f, minStaff: e.target.value })} /></Field>
        <div className="sm:col-span-3"><span className="label">Which days</span>
          <div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => (
            <button key={d} type="button" aria-pressed={f.days.includes(i)} onClick={() => toggleDay(i)} className={`min-h-10 rounded-full border px-3 text-sm ${f.days.includes(i) ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 bg-white'}`}>{d}</button>
          ))}<span className="self-center pl-1 text-xs text-slate-500">{f.days.length ? '' : 'None picked = every day'}</span></div>
        </div>
        <Field label="Note (optional)" className="sm:col-span-2"><input className="input" placeholder="e.g. Ward B needs 2 nurses at night" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="self-end"><Button className="w-full"><Plus className="h-4 w-4" /> Add minimum</Button></div>
      </form>
    </Modal>
  );
}
