import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import useFetch from '../lib/useFetch';
import { Avatar } from './ui';

// Multi-select list of staff with search and department filter.
export default function StaffPicker({ value = [], onChange, height = 'max-h-72' }) {
  const { data: staff = [] } = useFetch('/users/directory', { initial: [] });
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const departments = useMemo(() => [...new Set(staff.map((s) => s.department).filter(Boolean))].sort(), [staff]);
  const list = staff.filter((s) =>
    (!dept || s.department === dept) &&
    `${s.firstName} ${s.lastName} ${s.staffId} ${s.jobTitle}`.toLowerCase().includes(q.toLowerCase())
  );
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const allSelected = list.length > 0 && list.every((s) => value.includes(s._id));

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-col gap-2 border-b border-slate-100 p-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-8" placeholder="Search staff" aria-label="Search staff" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-full sm:w-40" aria-label="Filter by department" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      {/* Everyone selected stays visible here, even when the list below is filtered. */}
      {value.length > 0 && (
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto border-b border-slate-100 px-3 py-2">
          {value.map((id) => {
            const s = staff.find((x) => x._id === id);
            return (
              <span key={id} className="inline-flex animate-pop-in items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand-800">
                {s ? `${s.firstName} ${s.lastName}` : '…'}
                <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${s ? s.firstName : 'staff member'}`} className="rounded-full p-0.5 hover:bg-brand-100">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-500">
        <span>{value.length} selected</span>
        <button
          type="button"
          className="font-semibold text-brand-700 hover:underline"
          onClick={() => onChange(allSelected ? value.filter((v) => !list.some((s) => s._id === v)) : [...new Set([...value, ...list.map((s) => s._id)])])}
        >
          {allSelected ? 'Clear visible' : 'Select visible'}
        </button>
      </div>
      <div className={`${height} overflow-y-auto`}>
        {list.map((s) => {
          const on = value.includes(s._id);
          return (
            <button type="button" key={s._id} aria-pressed={on} onClick={() => toggle(s._id)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 ${on ? 'bg-brand-50/60' : ''}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>
                {on && <Check className="h-3 w-3" />}
              </span>
              <Avatar user={s} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.firstName} {s.lastName}</span>
                <span className="block truncate text-xs text-slate-500">{s.jobTitle || '—'} · {s.department || '—'}</span>
              </span>
            </button>
          );
        })}
        {!list.length && <p className="p-4 text-center text-sm text-slate-500">No staff found</p>}
      </div>
    </div>
  );
}
