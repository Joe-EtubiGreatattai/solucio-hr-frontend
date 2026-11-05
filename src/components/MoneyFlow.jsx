import { fmtMoney } from '../lib/format';
import { Term } from './InfoTip';
import { PARTS, splitCost } from '../lib/payCost';

// Explains a payroll's money in one picture: what the hospital spends in total (employer cost),
// split into take-home pay, deductions passed on to others, and the hospital's own extras.
export default function MoneyFlow({ totals, who = 'staff' }) {
  const parts = splitCost(totals);
  const total = totals.employerCost || 1;
  return (
    <div className="card animate-fade-up p-5">
      <p className="text-sm text-slate-500"><Term>Employer cost</Term></p>
      <p className="mt-1 text-3xl font-semibold">{fmtMoney(totals.employerCost)}</p>
      <p className="mt-1 text-sm text-slate-600">Everything the hospital spends on {who} pay. Here is where it goes:</p>

      <div className="mt-4 flex h-5 w-full overflow-hidden rounded-full bg-slate-100" role="img"
        aria-label={PARTS.map((p) => `${p.label} ${fmtMoney(parts[p.key])}`).join(', ')}>
        {PARTS.map((p) => parts[p.key] > 0 && (
          <div key={p.key} className={`${p.color} h-full origin-left animate-grow-x`} style={{ width: `${(parts[p.key] / total) * 100}%` }} title={`${p.label}: ${fmtMoney(parts[p.key])}`} />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PARTS.map((p) => (
          <li key={p.key} className="rounded-2xl bg-slate-50 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-800"><span className={`h-3 w-3 shrink-0 rounded-full ${p.color}`} />{p.label}</p>
            <p className="mt-1 text-xl font-semibold">{fmtMoney(parts[p.key])} <span className="text-sm font-normal text-slate-500">{Math.round((parts[p.key] / total) * 100)}%</span></p>
            <p className="mt-0.5 text-xs text-slate-500">{p.hint}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-600 md:grid-cols-2">
        <p><b className="text-slate-900">Gross pay</b> {fmtMoney(totals.gross)} − taken from pay {fmtMoney(parts.deductions)} = <b className="text-brand-700">net pay {fmtMoney(parts.net)}</b></p>
        <p><b className="text-slate-900">Gross pay</b> {fmtMoney(totals.gross)} + hospital extras {fmtMoney(parts.extras)} = <b className="text-slate-900">employer cost {fmtMoney(totals.employerCost)}</b></p>
      </div>
    </div>
  );
}
