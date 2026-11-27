import { useMemo, useState } from 'react';
import { AlertTriangle, FileUp } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../lib/api';
import useFetch from '../lib/useFetch';
import { matchStaff, readRoster } from '../lib/rosterImport';
import { ymd } from '../lib/format';
import { Button, Field, Modal } from './ui';

const SHIFT_TYPES = { morning: 'Morning', evening: 'Evening', custom: 'Other hours' };

// Upload a roster PDF in the printed layout, check what was read, then create the shifts.
export default function RosterImport({ open, onClose, roster, presets, onDone }) {
  const { data: staff } = useFetch(open ? '/users/directory' : null, { initial: [] });
  const [parsed, setParsed] = useState(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(''); // YYYY-MM
  const [groups, setGroups] = useState([]);
  const [people, setPeople] = useState([]); // [{ letter, name, user }]
  const [replace, setReplace] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const reset = () => { setParsed(null); setError(''); setGroups([]); setPeople([]); setReplace(false); setRemember(true); };
  const close = () => { reset(); onClose(); };

  const read = async (file) => {
    if (!file) return;
    reset();
    setReading(true);
    try {
      const r = await readRoster(file);
      setParsed(r);
      const start = new Date(roster.startDate);
      setMonth(`${r.year ?? start.getFullYear()}-${String((r.month ?? start.getMonth()) + 1).padStart(2, '0')}`);
      // Which columns actually have anyone assigned across the month.
      const used = r.groups.map((_, gi) => r.rows.some((row) => (row.byGroup[gi] || []).length > 0));
      setGroups(r.groups.map((g, gi) => {
        const type = g.type === 'off' ? 'off' : g.type;
        // Only Morning and Evening are offered now; any other parsed column (e.g. a Night column)
        // comes in as "Other hours" keeping the times read from the file, so nothing is lost.
        const shiftType = type === 'off' ? '' : (SHIFT_TYPES[type] ? type : 'custom');
        // Off, and any empty column (nobody in it, like an unused Afternoon), start unchecked.
        return { ...g, include: g.type !== 'off' && used[gi], hasPeople: used[gi], shiftType,
          start: g.start || presets[type]?.start || '', end: g.end || presets[type]?.end || '' };
      }));
      setPeople(matchStaff(r.key, staff, roster.department));
    } catch (e) {
      setError(e.message || "Couldn't read this file");
    } finally {
      setReading(false);
    }
  };

  // Match again once the staff list arrives (if the PDF was read first).
  if (parsed && staff.length && people.length && people.every((p) => !p.user && p.candidates === 0)) {
    const again = matchStaff(parsed.key, staff, roster.department);
    if (again.some((p) => p.user)) setPeople(again);
  }

  const plan = useMemo(() => {
    if (!parsed || !month) return { shifts: [], outside: 0, unmatched: 0 };
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const userOf = Object.fromEntries(people.filter((p) => p.user).map((p) => [p.letter, p.user]));
    const lo = ymd(roster.startDate);
    const hi = ymd(roster.endDate);
    const shifts = [];
    let outside = 0;
    let unmatched = 0;
    for (const row of parsed.rows) {
      if (row.day < 1 || row.day > last) continue;
      const date = `${month}-${String(row.day).padStart(2, '0')}`;
      groups.forEach((g, gi) => {
        if (!g.include || g.type === 'off') return;
        for (const letter of row.byGroup[gi] || []) {
          if (!userOf[letter]) { unmatched++; continue; }
          if (date < lo || date > hi) { outside++; continue; }
          shifts.push({ user: userOf[letter], date, shiftType: g.shiftType, startTime: g.start, endTime: g.end });
        }
      });
    }
    return { shifts, outside, unmatched };
  }, [parsed, month, people, groups, roster]);

  const missingHours = groups.some((g) => g.include && g.type !== 'off' && (!g.start || !g.end));

  // Does the month we're importing actually fall within this roster's own dates?
  const period = useMemo(() => {
    if (!parsed || !month) return { overlaps: true, label: '' };
    const [y, m] = month.split('-').map(Number);
    const monthLo = `${month}-01`;
    const monthHi = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    const lo = ymd(roster.startDate);
    const hi = ymd(roster.endDate);
    const label = new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return { overlaps: monthLo <= hi && monthHi >= lo, label, lo, hi };
  }, [parsed, month, roster]);

  // People matched by hand whose roster name the system wouldn't recognise next time — offer to remember.
  const toRemember = useMemo(() => {
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');
    return people.filter((p) => p.user).map((p) => {
      const s = staff.find((x) => x._id === p.user);
      if (!s) return null;
      const known = norm(s.firstName) === norm(p.name) || (s.rosterAliases || []).some((a) => norm(a) === norm(p.name));
      return known ? null : { user: p.user, name: p.name };
    }).filter(Boolean);
  }, [people, staff]);

  const doImport = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/rosters/${roster._id}/import`, {
        shifts: plan.shifts, replace,
        letters: people.filter((p) => p.user).map((p) => ({ user: p.user, letter: p.letter })),
      });
      // Teach the system these names so the next import recognises the same people automatically.
      if (remember && toRemember.length) {
        await Promise.allSettled(toRemember.map((r) => api.post(`/users/${r.user}/roster-alias`, { name: r.name })));
      }
      toast.success(`${data.created} shift${data.created === 1 ? '' : 's'} imported${data.removed ? `, ${data.removed} replaced` : ''}`);
      if (data.skipped.length) {
        const reasons = [...new Set(data.skipped.map((s) => s.reason))].slice(0, 2).join('; ');
        toast(`${data.skipped.length} skipped: ${reasons}`, { icon: '⚠️', duration: 8000 });
      }
      onDone?.();
      close();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };

  const setGroup = (i, patch) => setGroups(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  return (
    <Modal open={open} onClose={close} title="Import roster from PDF or Word" size="lg"
      footer={<><Button variant="secondary" onClick={close}>Cancel</Button>
        <Button loading={busy} disabled={!plan.shifts.length || missingHours} onClick={doImport}>Import {plan.shifts.length || ''} shift{plan.shifts.length === 1 ? '' : 's'}</Button></>}>
      <div className="space-y-5">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-brand-500 hover:bg-brand-50/40">
          <FileUp className="h-7 w-7 text-brand-700" />
          <span className="font-semibold">{reading ? 'Reading…' : parsed ? 'Choose a different file' : 'Choose the roster file'}</span>
          <span className="text-sm text-slate-500">A typed roster as a Word (.docx) or PDF file (or one downloaded from here), laid out with a key like A=Grace, a row per day and MORNING / NIGHT / OFF columns. Scans and photos can't be read.</span>
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,.pdf" className="sr-only" onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        {parsed && (
          <>
            <Field label="Month these dates are in" hint={`Found ${parsed.rows.length} days in the file. This roster runs ${ymd(roster.startDate)} to ${ymd(roster.endDate)}.`}>
              <input type="month" className="input max-w-52" value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>

            <div>
              <p className="label">Shift columns</p>
              <div className="space-y-2">
                {groups.map((g, i) => (
                  <div key={g.label + i} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <label className="flex min-w-32 items-center gap-2 font-semibold">
                      <input type="checkbox" className="h-4 w-4 accent-brand-700" disabled={g.type === 'off'} checked={g.include} onChange={(e) => setGroup(i, { include: e.target.checked })} />
                      {g.label}
                    </label>
                    {g.type === 'off' ? <span className="text-sm text-slate-500">Days off aren't shifts, so they're not imported.</span> : !g.hasPeople ? (
                      <span className="text-sm text-slate-500">No one is in this column in the file.</span>
                    ) : (
                      <>
                        <select className="input w-auto" aria-label={`${g.label} shift type`} value={g.shiftType}
                          onChange={(e) => setGroup(i, { shiftType: e.target.value, ...(g.start ? {} : { start: presets[e.target.value]?.start || '', end: presets[e.target.value]?.end || '' }) })}>
                          {Object.entries(SHIFT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <input type="time" className="input w-auto" aria-label={`${g.label} start`} value={g.start} onChange={(e) => setGroup(i, { start: e.target.value })} />
                        <span className="text-slate-400">to</span>
                        <input type="time" className="input w-auto" aria-label={`${g.label} end`} value={g.end} onChange={(e) => setGroup(i, { end: e.target.value })} />
                        {g.hoursText && <span className="text-xs text-slate-500">PDF says {g.hoursText}</span>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="label">Who each letter is</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {people.map((p, i) => (
                  <div key={p.letter} className={`flex items-center gap-2 rounded-xl p-2 ${p.user ? 'bg-slate-50' : 'bg-amber-50'}`}>
                    <span className="w-9 text-center font-mono text-lg font-bold">{p.letter}</span>
                    <select className="input" aria-label={`Staff for letter ${p.letter} (${p.name})`} value={p.user}
                      onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, user: e.target.value } : x)))}>
                      <option value="">{p.name}: choose…</option>
                      {staff.map((s) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName}{s.department ? ` · ${s.department}` : ''}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {toRemember.length > 0 && (
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span><b>Remember {toRemember.length === 1 ? 'this name' : 'these names'} for next time</b><br /><span className="text-slate-500">Save {toRemember.map((r) => `“${r.name}”`).join(', ')} so future roster imports recognise the same {toRemember.length === 1 ? 'person' : 'people'} automatically.</span></span>
              </label>
            )}

            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              <span><b>Replace shifts already on these dates</b><br /><span className="text-slate-500">Removes this roster's existing shifts on the imported days first. Leave it off to add to what's there.</span></span>
            </label>

            {!period.overlaps && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <span>This file is <b>{period.label}</b>, but this roster covers <b>{period.lo}</b> to <b>{period.hi}</b> — they don't overlap, so nothing will import. Open the {period.label} roster instead, or change <b>“Month these dates are in”</b> above to a month inside this roster.</span>
              </div>
            )}

            <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
              <b>{plan.shifts.length} shifts</b> will be created.
              {plan.unmatched > 0 && <span className="mt-1 flex items-center gap-1 text-amber-800"><AlertTriangle className="h-4 w-4" />{plan.unmatched} skipped: their letter isn't matched to anyone yet.</span>}
              {plan.outside > 0 && <span className="mt-1 flex items-center gap-1 text-amber-800"><AlertTriangle className="h-4 w-4" />{plan.outside} skipped: outside this roster's dates ({period.lo} to {period.hi}).</span>}
              {missingHours && <span className="mt-1 flex items-center gap-1 text-amber-800"><AlertTriangle className="h-4 w-4" />Set the hours for each shift column that has people.</span>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
