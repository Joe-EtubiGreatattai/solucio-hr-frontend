import { AlertTriangle, CalendarX2, CheckCircle2, Users } from 'lucide-react';
import useFetch from '../lib/useFetch';
import { Spinner } from './ui';
import { fmtDate, titleCase } from '../lib/format';

const day = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Before approving leave: the shifts it affects, who else in the department is away, and unsafe staffing.
export default function LeaveImpact({ request, removeShifts, onRemoveShifts, canRemoveShifts = true }) {
  const { data: x, loading } = useFetch(`/requests/${request._id}/impact`, { live: false });
  if (loading && !x) return <Spinner />;
  if (!x) return null;
  const pending = request.status === 'pending';
  const share = x.departmentSize ? Math.round((x.peakAway / x.departmentSize) * 100) : 0;
  const clear = !x.shifts.length && !x.teamOff.length && !x.understaffed.length;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 p-4" aria-label="Effect on the roster">
      <p className="font-semibold">Effect on the roster</p>
      {clear && <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> No rostered shifts in these dates and nobody else from {x.department || 'their department'} is away.</p>}

      {x.understaffed.length > 0 && (
        <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Below safe staffing without them</p>
          <ul className="mt-1 list-disc pl-6">{x.understaffed.map((g) => <li key={g.date + g.shiftType}>{day(g.date)} {titleCase(g.shiftType)}: would have {g.scheduled ? `only ${g.scheduled}` : 'nobody'}, minimum is {g.min} {g.department} staff</li>)}</ul>
          <p className="mt-1 text-xs">Find cover on the roster before or after approving.</p>
        </div>
      )}

      {x.shifts.length > 0 && (
        <div className="text-sm">
          <p className="flex items-center gap-2 font-medium"><CalendarX2 className="h-4 w-4 text-amber-600" /> {x.shifts.length} rostered shift{x.shifts.length > 1 ? 's' : ''} in these dates</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{x.shifts.map((s) => <span key={s._id} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-900">{day(s.date)} · {titleCase(s.shiftType)} {s.startTime}–{s.endTime}{!s.published && ' (draft)'}</span>)}</div>
          {pending && canRemoveShifts && <label className="mt-3 flex items-start gap-3"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-700" checked={removeShifts} onChange={(e) => onRemoveShifts(e.target.checked)} />
            <span>Take these shifts off the roster when I approve <span className="block text-xs text-slate-500">They come back if you reopen the request.</span></span></label>}
        </div>
      )}

      {x.teamOff.length > 0 && (
        <div className="text-sm">
          <p className="flex items-center gap-2 font-medium"><Users className="h-4 w-4 text-slate-500" /> Also away from {x.department}</p>
          <ul className="mt-1 space-y-1">{x.teamOff.map((t) => <li key={t._id} className="text-slate-700">{t.user.firstName} {t.user.lastName}: {fmtDate(t.startDate)} – {fmtDate(t.endDate)} <span className="text-xs text-slate-500">({t.status === 'pending' ? 'asked, not yet approved' : `${titleCase(t.leaveType || 'leave')} approved`})</span></li>)}</ul>
          <p className={`mt-2 text-xs ${share >= 34 ? 'font-semibold text-rose-700' : 'text-slate-500'}`}>Busiest day ({day(x.peakDate)}): {x.peakAway} of {x.departmentSize} {x.department} staff away ({share}%)</p>
        </div>
      )}
    </section>
  );
}
