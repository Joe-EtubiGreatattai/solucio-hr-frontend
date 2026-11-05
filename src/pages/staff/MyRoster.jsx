import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { Card, PageHeader, Spinner } from '../../components/ui';
import ShiftSwaps, { SwapRequestModal } from '../../components/ShiftSwaps';
import { titleCase, ymd } from '../../lib/format';

const SHIFT_COLORS = {
  morning: 'bg-sky-100 text-sky-800 border-sky-200', afternoon: 'bg-amber-100 text-amber-800 border-amber-200',
  night: 'bg-indigo-100 text-indigo-800 border-indigo-200', day: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  on_call: 'bg-rose-100 text-rose-800 border-rose-200', custom: 'bg-slate-100 text-slate-700 border-slate-200',
};
export { SHIFT_COLORS };

function AgendaRow({ s, today, onSwap, now, className = '' }) {
  const d = new Date(`${s.date}T12:00:00`);
  const future = new Date(s.startAt) > now;
  const isToday = s.date === today;
  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${isToday ? 'bg-brand-50/60' : ''} ${className}`}>
      <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${isToday ? 'bg-brand-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
        <span className="text-[11px] leading-none">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
        <span className="text-base font-semibold leading-tight">{d.getDate()}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${SHIFT_COLORS[s.shiftType]}`}>{titleCase(s.shiftType)}</span>
        <span className="mt-0.5 block text-sm font-medium text-slate-800">{s.startTime}–{s.endTime}{isToday && <span className="ml-1.5 text-xs font-semibold text-brand-700">Today</span>}</span>
      </span>
      {future && (
        <button type="button" onClick={() => onSwap(s)} aria-label={`Swap or give away ${titleCase(s.shiftType)} on ${s.date}`}
          className="flex min-h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 active:scale-95">
          <Repeat className="h-4 w-4" /> Swap
        </button>
      )}
    </li>
  );
}

// Phones: the month as a list. Shifts still to come lead; ones already worked fold away.
function MonthAgenda({ shifts, today, onSwap }) {
  const [showPast, setShowPast] = useState(false);
  const now = new Date();
  if (!shifts.length) return <p className="px-5 py-10 text-center text-sm text-slate-500 sm:hidden">No shifts this month.</p>;
  const sorted = [...shifts].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const past = sorted.filter((s) => new Date(s.endAt) < now);
  const coming = sorted.filter((s) => !past.includes(s));
  return (
    <div className="sm:hidden">
      {past.length > 0 && (
        <button type="button" onClick={() => setShowPast(!showPast)} className="flex min-h-11 w-full items-center justify-center gap-1 border-b border-slate-100 text-sm font-semibold text-brand-700">
          {showPast ? 'Hide' : 'Show'} {past.length} earlier shift{past.length > 1 ? 's' : ''} <ChevronDown className={`h-4 w-4 transition-transform ${showPast ? 'rotate-180' : ''}`} />
        </button>
      )}
      <ul className="divide-y divide-slate-100">
        {showPast && past.map((s) => <AgendaRow key={s._id} s={s} today={today} onSwap={onSwap} now={now} className="opacity-60" />)}
        {coming.map((s) => <AgendaRow key={s._id} s={s} today={today} onSwap={onSwap} now={now} />)}
      </ul>
      {coming.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">No more shifts this month.</p>}
    </div>
  );
}

export default function MyRoster() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const [swapFor, setSwapFor] = useState(null); // null = closed, {} = choose a shift, shift = that shift
  const [swapKey, setSwapKey] = useState(0);
  const { data: shifts, loading } = useFetch('/rosters/my-shifts', { params: { from: ymd(monthStart), to: ymd(monthEnd) }, initial: [] });

  const cells = useMemo(() => {
    const out = [];
    const lead = (monthStart.getDay() + 6) % 7; // Monday first
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= monthEnd.getDate(); d++) out.push(ymd(new Date(cursor.getFullYear(), cursor.getMonth(), d)));
    return out;
  }, [cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDate = shifts.reduce((m, s) => ((m[s.date] ||= []).push(s), m), {});
  const today = ymd();
  const totalHours = shifts.reduce((a, s) => a + (new Date(s.endAt) - new Date(s.startAt)) / 3600000, 0);

  return (
    <div>
      <PageHeader title="My roster" subtitle={`${shifts.length} shift(s), ${Math.round(totalHours)} scheduled hours this month`} />
      <Card bodyClass="p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <button type="button" aria-label="Previous month" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="h-5 w-5" /></button>
          <h3 className="font-semibold">{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
          <button type="button" aria-label="Next month" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="h-5 w-5" /></button>
        </div>
        {loading ? <Spinner /> : (<>
          {/* Phones: the month as a list of working days; a 7-column grid is too small to read or tap. */}
          <MonthAgenda shifts={shifts} today={today} onSwap={setSwapFor} />
          <div className="hidden grid-cols-7 text-sm sm:grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="border-b border-slate-100 bg-slate-50 py-2 text-center text-xs font-semibold uppercase text-slate-500"><span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span></div>
            ))}
            {cells.map((date, i) => (
              <div key={i} className={`min-h-16 min-w-0 border-b border-r border-slate-100 p-1 sm:min-h-24 sm:p-1.5 ${date === today ? 'bg-brand-50/60' : ''}`}>
                {date && (
                  <>
                    <p className={`mb-1 text-xs font-semibold ${date === today ? 'text-brand-700' : 'text-slate-500'}`}>{Number(date.slice(8))}</p>
                    {(byDate[date] || []).map((s) => {
                      const future = new Date(s.startAt) > new Date();
                      const Tag = future ? 'button' : 'div';
                      return (
                        <Tag key={s._id} type={future ? 'button' : undefined} onClick={future ? () => setSwapFor(s) : undefined}
                          title={`${titleCase(s.shiftType)} ${s.startTime}–${s.endTime}${future ? ' · tap to swap or give away' : ''}`}
                          className={`mb-1 block w-full animate-fade-up truncate rounded border px-1 py-0.5 text-left text-xs leading-tight sm:px-1.5 sm:py-1 ${SHIFT_COLORS[s.shiftType]} ${future ? 'hover:ring-2 hover:ring-brand-300' : ''}`}>
                          <p className="truncate font-semibold"><span className="sm:hidden">{s.startTime}</span><span className="hidden sm:inline">{titleCase(s.shiftType)}</span></p>
                          <p className="hidden truncate sm:block">{s.startTime}–{s.endTime}</p>
                        </Tag>
                      );
                    })}
                  </>
                )}
              </div>
            ))}
          </div>
        </>)}
      </Card>
      <div className="mt-4 hidden flex-wrap items-center gap-2 sm:flex">
        {Object.keys(SHIFT_COLORS).map((k) => (
          <span key={k} className={`rounded border px-2 py-0.5 text-xs font-semibold ${SHIFT_COLORS[k]}`}>{titleCase(k)}</span>
        ))}
        <span className="hidden text-xs text-slate-500 sm:inline">Click an upcoming shift to swap or give it away.</span>
      </div>
      <div className="mt-6"><ShiftSwaps key={swapKey} onAsk={() => setSwapFor({})} /></div>
      {swapFor && <SwapRequestModal initialShift={swapFor._id ? swapFor : null} onClose={() => setSwapFor(null)} onSent={() => { setSwapFor(null); setSwapKey((k) => k + 1); }} />}
    </div>
  );
}
