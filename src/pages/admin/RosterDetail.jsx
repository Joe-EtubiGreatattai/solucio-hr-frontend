import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner } from '../../components/ui';
import { useConfirm } from '../../components/Confirm';
import { useUndoDelete } from '../../lib/undo';
import StaffPicker from '../../components/StaffPicker';
import { fmtDate, fullName, titleCase, ymd } from '../../lib/format';
import { SHIFT_COLORS } from '../staff/MyRoster';
import { Term } from '../../components/InfoTip';
import CoverageGaps from '../../components/CoverageGaps';
import StaffingRules from '../../components/StaffingRules';

function datesBetween(from, to) {
  const out = [];
  const d = new Date(`${ymd(from)}T00:00:00`);
  const end = new Date(`${ymd(to)}T00:00:00`);
  while (d <= end) { out.push(ymd(d)); d.setDate(d.getDate() + 1); }
  return out;
}
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function AssignModal({ open, onClose, roster, presets, preset: initial, onSaved }) {
  const [users, setUsers] = useState([]);
  const [range, setRange] = useState({ from: '', to: '' });
  const [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [shift, setShift] = useState({ shiftType: 'morning', startTime: '', endTime: '', unit: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setUsers(initial?.user ? [initial.user] : []);
      setRange({ from: initial?.date || ymd(roster.startDate), to: initial?.date || ymd(roster.endDate) });
      setWeekdays([0, 1, 2, 3, 4, 5, 6]);
      if (initial?.shiftType) setShift((s) => ({ ...s, shiftType: initial.shiftType, startTime: '', endTime: '' }));
    }
  }

  const dates = range.from && range.to ? datesBetween(range.from, range.to).filter((d) => weekdays.includes(new Date(`${d}T00:00:00`).getDay())) : [];

  const submit = async (e) => {
    e.preventDefault();
    if (!users.length) return toast.error('Select at least one staff member');
    if (!dates.length) return toast.error('No dates selected');
    setBusy(true);
    try {
      const body = { users, dates, shiftType: shift.shiftType, unit: shift.unit, notes: shift.notes };
      if (shift.shiftType === 'custom' || shift.startTime) Object.assign(body, { startTime: shift.startTime, endTime: shift.endTime });
      const { data } = await api.post(`/rosters/${roster._id}/shifts`, body);
      toast.success(`${data.created} shift(s) assigned`);
      if (data.skipped.length) toast(`${data.skipped.length} skipped (overlaps or outside period)`, { icon: '⚠️' });
      onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const p = presets?.[shift.shiftType];
  return (
    <Modal open={open} onClose={onClose} title="Assign shifts" size="xl"
      footer={<><span className="mr-auto self-center text-sm text-slate-500">{users.length} staff × {dates.length} day(s) = {users.length * dates.length} shift(s)</span>
        <Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="assign-form" loading={busy}>Assign</Button></>}>
      <form id="assign-form" onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div><span className="label">Staff</span><StaffPicker value={users} onChange={setUsers} height="max-h-96" /></div>
        <div className="space-y-4">
          <div>
            <span className="label">Shift</span>
            <div className="grid grid-cols-3 gap-2">
              {[...Object.entries(presets || {}), ['custom', { label: 'Custom' }]].map(([k, v]) => (
                <button type="button" key={k} aria-pressed={shift.shiftType === k} onClick={() => setShift({ ...shift, shiftType: k, startTime: '', endTime: '' })}
                  className={`rounded-lg border px-2 py-2 text-left text-xs ${shift.shiftType === k ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200'}`}>
                  <p className="font-semibold">{v.label}</p>
                  {v.start && <p className="text-slate-500">{v.start}–{v.end}</p>}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time"><input type="time" className="input" required={shift.shiftType === 'custom'} value={shift.startTime || p?.start || ''} onChange={(e) => setShift({ ...shift, startTime: e.target.value, endTime: shift.endTime || p?.end || '' })} /></Field>
            <Field label="End time"><input type="time" className="input" required={shift.shiftType === 'custom'} value={shift.endTime || p?.end || ''} onChange={(e) => setShift({ ...shift, endTime: e.target.value, startTime: shift.startTime || p?.start || '' })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><input type="date" className="input" min={ymd(roster.startDate)} max={ymd(roster.endDate)} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
            <Field label="To"><input type="date" className="input" min={ymd(roster.startDate)} max={ymd(roster.endDate)} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
          </div>
          <div>
            <span className="label">On these days</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d, i) => (
                <button type="button" key={d} aria-pressed={weekdays.includes(i)} onClick={() => setWeekdays(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i])}
                  className={`min-h-10 min-w-11 rounded-md px-3 py-1.5 text-sm font-semibold desk:min-h-0 desk:min-w-0 desk:text-xs ${weekdays.includes(i) ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{d}</button>
              ))}
            </div>
          </div>
          <Field label="Unit / ward (optional)"><input className="input" value={shift.unit} onChange={(e) => setShift({ ...shift, unit: e.target.value })} /></Field>
          <Field label="Notes (optional)"><input className="input" value={shift.notes} onChange={(e) => setShift({ ...shift, notes: e.target.value })} /></Field>
        </div>
      </form>
    </Modal>
  );
}

export default function RosterDetail() {
  const { id } = useParams();
  const { data, loading, reload } = useFetch(`/rosters/${id}`);
  const { data: presets } = useFetch('/rosters/presets', { initial: {} });
  const { data: coverage, reload: reloadCoverage } = useFetch(`/rosters/${id}/coverage`);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [assign, setAssign] = useState(null);
  const [selected, setSelected] = useState(null);
  const rosterGridRef = useRef(null);
  const [focusDate, setFocusDate] = useState(null); // column briefly highlighted after jumping to it
  const focusTimer = useRef();
  const undo = useUndoDelete();
  const ask = useConfirm();

  const rows = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const s of undo.visible(data.shifts)) {
      const key = s.user?._id;
      if (!key) continue;
      if (!map.has(key)) map.set(key, { user: s.user, byDate: {} });
      (map.get(key).byDate[s.date] ||= []).push(s);
    }
    return [...map.values()].sort((a, b) => fullName(a.user).localeCompare(fullName(b.user)));
  }, [data, undo]);

  if (loading && !data) return <Spinner />;
  if (!data) return <Empty title="Roster not found" />;
  const { roster, shifts } = data;
  const dates = datesBetween(roster.startDate, roster.endDate);
  const today = ymd();

  const togglePublish = async () => {
    if (roster.status === 'published' && !(await ask({
      title: 'Unpublish this roster?',
      message: `${rows.length} staff will no longer see these shifts, and they won't count toward attendance until you publish again.`,
      confirmLabel: 'Unpublish',
      tone: 'danger',
    }))) return;
    if (roster.status === 'draft' && coverage?.gaps.length && !(await ask({
      title: 'Some shifts are below minimum staffing',
      message: `${coverage.gaps.length} shift(s) have fewer people than your safe minimum. Publish anyway, or go back and assign more staff?`,
      confirmLabel: 'Publish anyway',
    }))) return;
    try {
      await api.post(`/rosters/${id}/publish`, { unpublish: roster.status === 'published', acceptGaps: roster.status === 'draft' && !!coverage?.gaps.length });
      toast.success(roster.status === 'published' ? 'Roster moved back to draft' : 'Roster published and staff notified');
      reload();
    } catch (e) { toastError(e); }
  };

  const removeShift = (s) => {
    setSelected(null);
    undo.remove({ id: s._id, url: `/rosters/shifts/${s._id}`, message: `${fullName(s.user)}'s ${titleCase(s.shiftType).toLowerCase()} shift removed` });
  };

  // Month labels across the top so long rosters are easy to scan.
  const months = dates.reduce((acc, d) => {
    const label = new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (acc.length && acc[acc.length - 1].label === label) acc[acc.length - 1].span++;
    else acc.push({ label, span: 1 });
    return acc;
  }, []);
  const gapDates = new Set((coverage?.gaps || []).map((g) => g.date));
  const isMonday = (d) => new Date(`${d}T00:00:00`).getDay() === 1;
  const goToRosterDate = (date) => {
    const container = rosterGridRef.current;
    const header = container?.querySelector(`[data-roster-date="${date}"]`);
    const staffHeader = container?.querySelector('[data-roster-staff-header]');
    if (!container || !header) return;
    const stickyWidth = staffHeader?.getBoundingClientRect().width || 0;
    const left = container.scrollLeft + header.getBoundingClientRect().left - container.getBoundingClientRect().left - stickyWidth;
    container.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFocusDate(date);
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setFocusDate(null), 2500);
  };

  return (
    <div>
      <Link to="/admin/rosters" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> All rosters</Link>
      <PageHeader
        title={<span className="flex items-center gap-3">{roster.title} <Badge status={roster.status} /></span>}
        subtitle={`${fmtDate(roster.startDate)} – ${fmtDate(roster.endDate)} · ${roster.department || 'All departments'} · ${shifts.length} shifts, ${rows.length} staff`}
        actions={<>
          <Button variant="secondary" onClick={() => setAssign({})}><Plus className="h-4 w-4" /> Assign shifts</Button>
          <Button variant={roster.status === 'published' ? 'secondary' : 'primary'} onClick={togglePublish}>
            {roster.status === 'published' ? <><Undo2 className="h-4 w-4" /> Unpublish</> : <><Send className="h-4 w-4" /> Publish to staff</>}
          </Button>
        </>}
      />
      {roster.status === 'draft' && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">Staff can't see this roster, and it doesn't count toward attendance, until you publish it.</p>}

      <CoverageGaps coverage={coverage} onEditRules={() => setRulesOpen(true)} onDateClick={goToRosterDate} onFill={(g) => setAssign({ date: g.date, shiftType: g.shiftType })} />
      {rulesOpen && <StaffingRules onClose={() => { setRulesOpen(false); reloadCoverage(); }} />}
      {rows.length > 0 && <p className="mb-2 text-xs text-slate-500 sm:hidden">Swipe sideways to see every day. Tap a shift to edit it.</p>}
      <Card bodyClass="p-0">
        {rows.length === 0 ? (
          <Empty title="No shifts assigned yet">Click "Assign shifts" to add staff to this roster.</Empty>
        ) : (
          <div ref={rosterGridRef} className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50" />
                  {months.map((m) => (
                    <th key={m.label} colSpan={m.span} className="border-b border-l-2 border-slate-200 border-l-slate-300 bg-slate-50 px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">{m.label}</th>
                  ))}
                </tr>
                <tr>
                  <th data-roster-staff-header className="sticky left-0 z-10 min-w-32 border-b border-r sm:min-w-48 border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-500"><Term>Staff</Term></th>
                  {dates.map((d) => {
                    const dt = new Date(`${d}T00:00:00`);
                    const weekend = dt.getDay() === 0 || dt.getDay() === 6;
                    return (
                      <th key={d} data-roster-date={d} className={`min-w-20 border-b border-slate-200 px-1 py-2 text-center font-semibold transition-colors duration-500 ${isMonday(d) ? 'border-l-2 border-l-slate-300' : ''} ${d === focusDate ? 'bg-rose-200 text-rose-900' : gapDates.has(d) ? 'bg-rose-50 text-rose-700' : d === today ? 'bg-brand-100 text-brand-800' : weekend ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-500'}`}>
                        <div>{WEEKDAYS[dt.getDay()]}</div><div className="text-sm">{dt.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ user, byDate }) => (
                  <tr key={user._id}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-center gap-2"><span className="hidden sm:block"><Avatar user={user} size="sm" /></span>
                        <div className="min-w-0"><p className="truncate font-semibold text-slate-700">{fullName(user)}</p><p className="truncate text-slate-500">{user.jobTitle}</p></div>
                      </div>
                    </td>
                    {dates.map((d) => (
                      <td key={d} className={`group border-b border-slate-100 p-1 align-top transition-colors duration-500 ${isMonday(d) ? 'border-l-2 border-l-slate-300' : ''} ${d === focusDate ? 'bg-rose-100' : d === today ? 'bg-brand-50/50' : ''}`}>
                        {(byDate[d] || []).map((s) => (
                          <button type="button" key={s._id} aria-label={`${titleCase(s.shiftType)} shift ${s.startTime} to ${s.endTime}, ${fullName(user)}`} onClick={() => setSelected(s)} className={`mb-0.5 block w-full animate-fade-in rounded border px-1 py-0.5 text-left leading-tight transition hover:scale-[1.04] hover:shadow-sm ${SHIFT_COLORS[s.shiftType]}`}>
                            <span className="block font-semibold">{titleCase(s.shiftType)}</span>
                            <span>{s.startTime}–{s.endTime}</span>
                          </button>
                        ))}
                        {!byDate[d] && (
                          // Faint on desktop until hover/focus; always visible on touch screens, which have no hover.
                          <button type="button" aria-label={`Add shift for ${fullName(user)} on ${fmtDate(d)}`} onClick={() => setAssign({ user: user._id, date: d })}
                            className="flex h-10 w-full items-center justify-center rounded border border-dashed border-slate-200 text-slate-300 opacity-0 transition hover:border-brand-400 hover:text-brand-600 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AssignModal open={!!assign} preset={assign} onClose={() => setAssign(null)} roster={roster} presets={presets} onSaved={reload} />

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Shift details" size="sm"
        footer={<><Button variant="danger" onClick={() => removeShift(selected)}><Trash2 className="h-4 w-4" /> Remove shift</Button><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button></>}>
        {selected && (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500"><Term>Staff</Term></dt><dd className="font-medium">{fullName(selected.user)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500"><Term>Date</Term></dt><dd className="font-medium">{fmtDate(selected.startAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500"><Term>Shift</Term></dt><dd className="font-medium">{titleCase(selected.shiftType)} · {selected.startTime}–{selected.endTime}</dd></div>
            {selected.unit && <div className="flex justify-between"><dt className="text-slate-500"><Term>Unit</Term></dt><dd className="font-medium">{selected.unit}</dd></div>}
            {selected.notes && <div className="flex justify-between"><dt className="text-slate-500"><Term>Notes</Term></dt><dd className="font-medium">{selected.notes}</dd></div>}
          </dl>
        )}
      </Modal>
    </div>
  );
}
