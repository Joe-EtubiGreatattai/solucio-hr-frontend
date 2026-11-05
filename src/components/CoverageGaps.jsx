import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldPlus } from 'lucide-react';
import { titleCase } from '../lib/format';

const day = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Roster days that fall below minimum staffing, grouped by date.
export default function CoverageGaps({ coverage, onEditRules, onDateClick, onFill }) {
  const [all, setAll] = useState(false);
  if (!coverage) return null;
  if (!coverage.rules) return (
    <p className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><ShieldPlus className="h-4 w-4" /> Set minimum staffing and this roster will flag any shift that is short.
      <button type="button" onClick={onEditRules} className="font-semibold text-brand-700 hover:underline">Set minimums</button></p>
  );
  if (coverage.past) return null;
  if (!coverage.gaps.length) return <p className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Every remaining shift meets minimum staffing. <button type="button" onClick={onEditRules} className="ml-auto text-xs font-semibold underline">Minimums</button></p>;

  const byDate = Object.entries(coverage.gaps.reduce((a, g) => { (a[g.date] ||= []).push(g); return a; }, {}));
  const shown = all ? byDate : byDate.slice(0, 5);
  return (
    <section className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-900" aria-label="Below minimum staffing">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <p className="flex-1 font-semibold">{coverage.gaps.length} upcoming shift{coverage.gaps.length > 1 ? 's' : ''} below minimum staffing, on {byDate.length} day{byDate.length > 1 ? 's' : ''}</p>
        <button type="button" onClick={onEditRules} className="text-xs font-semibold underline">Minimums</button>
      </div>
      <ul className="mt-2 space-y-1">{shown.map(([date, gs]) => (
        <li key={date} className="flex flex-wrap items-center gap-x-0.5">
          <button type="button" onClick={() => onDateClick?.(date)} title="Show this day on the roster"
            className="min-h-9 rounded-lg px-1.5 font-bold underline decoration-rose-300 underline-offset-4 transition hover:bg-rose-100 hover:decoration-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-700">{day(date)}</button>
          <span aria-hidden="true">:</span>
          {gs.map((g, i) => (
            <span key={g.department + g.shiftType} className="inline-flex items-center">
              {i > 0 && <span className="px-0.5 text-rose-400" aria-hidden="true">·</span>}
              <button type="button" onClick={() => onFill?.(g)} title={`Assign ${g.short} more to the ${titleCase(g.shiftType).toLowerCase()} shift on ${day(date)}`}
                className="min-h-9 rounded-lg px-1.5 transition hover:bg-rose-100 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-700">{g.department} {titleCase(g.shiftType).toLowerCase()} {g.scheduled}/{g.min}</button>
            </span>
          ))}
        </li>
      ))}</ul>
      {byDate.length > 5 && <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs font-semibold underline">{all ? 'Show fewer' : `Show all ${byDate.length} days`}</button>}
      <p className="mt-2 text-xs text-rose-800">Numbers are people rostered / minimum. Click a date to jump to it on the roster, or a shift to assign staff to it.</p>
    </section>
  );
}
