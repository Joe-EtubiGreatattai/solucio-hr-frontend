import { Term } from './InfoTip';
import { Card } from './ui';

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const one = (n) => Math.round(n * 10) / 10;

// Self-assessment next to the manager's ratings, with how far apart they are.
// `self` and `manager` are { competencies: [{ name, rating }], goals: [{ goal, title, rating }] }.
export default function RatingGap({ self, manager, employee, reviewer, viewer, live }) {
  const key = (r) => String(r.goal || r.name || r.title);
  const rows = [
    ...(self.competencies || []).map((s) => ({ group: 'Competencies', label: s.name, self: s.rating, mgr: manager.competencies?.find((m) => m.name === s.name)?.rating })),
    ...(self.goals || []).map((s) => ({ group: 'Goals', label: s.title, self: s.rating, mgr: manager.goals?.find((m) => key(m) === key(s))?.rating })),
  ].filter((r) => r.self && r.mgr).map((r) => ({ ...r, diff: r.self - r.mgr }));
  if (!rows.length) return null;

  const you = viewer === 'self';
  const them = you ? 'You' : employee;
  const boss = you ? (reviewer || 'your manager') : (reviewer || 'the manager');
  const selfAvg = avg(rows.map((r) => r.self));
  const mgrAvg = avg(rows.map((r) => r.mgr));
  const gap = one(selfAvg - mgrAvg);
  const close = rows.filter((r) => Math.abs(r.diff) <= 1).length;
  const exact = rows.filter((r) => r.diff === 0).length;
  const big = rows.filter((r) => Math.abs(r.diff) >= 2);
  const summary = Math.abs(gap) < 0.25
    ? `${them} and ${boss} agree overall (${one(selfAvg)} vs ${one(mgrAvg)} on average).`
    : `${them} rated ${you ? 'yourself' : 'themselves'} ${Math.abs(gap)} point${Math.abs(gap) === 1 ? '' : 's'} ${gap > 0 ? 'higher' : 'lower'} than ${boss} on average (${one(selfAvg)} vs ${one(mgrAvg)}).`;

  return (
    <Card title={<Term tip="Compares how the employee rated themselves with how their manager rated them, item by item. Big gaps (2 points or more) are worth talking through in the review meeting.">Self vs manager</Term>}
      action={live && <span className="text-xs text-amber-700">Updates as you rate</span>}>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3 sm:col-span-3"><p className="text-sm text-slate-800">{summary}</p></div>
        <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Average gap</p><p className={`text-2xl font-semibold ${Math.abs(gap) >= 1 ? 'text-rose-600' : Math.abs(gap) >= 0.5 ? 'text-amber-600' : 'text-emerald-700'}`}>{gap > 0 ? '+' : ''}{gap}</p><p className="text-xs text-slate-500">self minus manager</p></div>
        <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Within 1 point</p><p className="text-2xl font-semibold">{close}/{rows.length}</p><p className="text-xs text-slate-500">{exact} exactly the same</p></div>
        <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Big gaps (2+ points)</p><p className={`text-2xl font-semibold ${big.length ? 'text-rose-600' : 'text-emerald-700'}`}>{big.length}</p><p className="truncate text-xs text-slate-500">{big.length ? big.map((r) => r.label).join(', ') : 'none to discuss'}</p></div>
      </div>

      <div className="mb-2 hidden grid-cols-[1fr_3rem_3rem_10rem] items-end gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
        <span /><span className="text-center">{you ? 'You' : 'Self'}</span><span className="text-center">Mgr</span>
        <span className="flex justify-between gap-2"><span>← Mgr higher</span><span>Self higher →</span></span>
      </div>
      {['Competencies', 'Goals'].map((group) => rows.some((r) => r.group === group) && (
        <div key={group} className="mb-3">
          <p className="label">{group}</p>
          <ul className="divide-y divide-slate-100">{rows.filter((r) => r.group === group).map((r) => {
            const tone = Math.abs(r.diff) >= 2 ? 'bg-rose-500' : Math.abs(r.diff) === 1 ? 'bg-amber-400' : 'bg-emerald-500';
            const words = r.diff === 0 ? 'Same' : `${you && r.diff > 0 ? 'You' : r.diff > 0 ? 'Self' : 'Manager'} ${Math.abs(r.diff)} higher`;
            return (
              <li key={r.label} className={`grid grid-cols-[1fr_2.5rem_2.5rem] items-center gap-3 py-2.5 text-sm sm:grid-cols-[1fr_3rem_3rem_10rem] ${Math.abs(r.diff) >= 2 ? 'rounded-lg bg-rose-50/60' : ''}`}>
                <span className="min-w-0 px-1"><span className="block truncate font-medium">{r.label}</span><span className={`text-xs ${Math.abs(r.diff) >= 2 ? 'font-semibold text-rose-700' : 'text-slate-500'}`}>{words}</span></span>
                <span className="text-center font-semibold">{r.self}</span>
                <span className="text-center font-semibold">{r.mgr}</span>
                {/* Diverging bar: left of centre = manager rated higher, right = self rated higher. */}
                <span className="relative col-span-3 h-3 rounded-full bg-slate-100 sm:col-span-1" role="img" aria-label={words}>
                  <span className="absolute inset-y-0 left-1/2 w-px bg-slate-400" />
                  {r.diff !== 0 && <span className={`absolute inset-y-0 rounded-full ${tone}`} style={r.diff > 0 ? { left: '50%', width: `${(r.diff / 4) * 50}%` } : { right: '50%', width: `${(-r.diff / 4) * 50}%` }} />}
                  {r.diff === 0 && <span className={`absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${tone}`} />}
                </span>
              </li>
            );
          })}</ul>
        </div>
      ))}
      <p className="text-xs text-slate-500">A self-rating well above the manager's can mean expectations weren't clear; well below can mean low confidence. Either is a good conversation to have.</p>
    </Card>
  );
}
