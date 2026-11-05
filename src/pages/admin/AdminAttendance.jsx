import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, FileDown, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, ProgressBar, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fmtMinutes, fmtTime, fullName, titleCase, ymd } from '../../lib/format';
import { downloadAttendanceRecordsPdf, downloadPunctualityPdf } from '../../lib/attendancePdf';
import { Term } from '../../components/InfoTip';

const STATE_LABEL = {
  on_duty: 'On duty', on_duty_late: 'On duty (late)', completed: 'Completed', upcoming: 'Upcoming', missing: 'Not checked in', absent: 'Absent',
};

function TodayBoard() {
  const { data, loading } = useFetch('/attendance/today');
  if (loading || !data) return <Spinner />;
  const counts = data.board.reduce((m, b) => ((m[b.state] = (m[b.state] || 0) + 1), m), {});
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATE_LABEL).map(([k, v]) => <Badge key={k} status={k}>{`${v}: ${counts[k] || 0}`}</Badge>)}
        <Badge status="unscheduled">{`Unscheduled: ${data.unscheduled.length}`}</Badge>
      </div>
      <Card bodyClass="p-0" title="Today's rostered shifts">
        {data.board.length === 0 ? <Empty title="No shifts scheduled today on published rosters" /> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th><Term>Staff</Term></th><th><Term>Shift</Term></th><th><Term>Checked in</Term></th><th><Term>Checked out</Term></th><th><Term>Status</Term></th></tr></thead>
            <tbody>{data.board.map(({ shift, attendance, state }) => (
              <tr key={shift._id}>
                <td><Link to={`/admin/staff/${shift.user._id}`} className="flex items-center gap-2 hover:text-brand-700"><Avatar user={shift.user} size="sm" /><span><span className="block font-medium">{fullName(shift.user)}</span><span className="text-xs text-slate-500">{shift.user.department}</span></span></Link></td>
                <td>{titleCase(shift.shiftType)} · {shift.startTime}–{shift.endTime}</td>
                <td>{attendance ? fmtTime(attendance.clockIn) : '—'}{attendance?.lateMinutes > 0 && <span className="ml-1 text-xs text-amber-600">+{attendance.lateMinutes}m</span>}</td>
                <td>{attendance?.clockOut ? fmtTime(attendance.clockOut) : '—'}</td>
                <td><Badge status={state}>{STATE_LABEL[state]}</Badge></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {data.unscheduled.length > 0 && (
        <Card bodyClass="p-0" title="Unscheduled check-ins today">
          <div className="overflow-x-auto"><table className="table"><tbody>{data.unscheduled.map((r) => (
            <tr key={r._id}><td className="font-medium">{fullName(r.user)}</td><td>{fmtTime(r.clockIn)} – {r.clockOut ? fmtTime(r.clockOut) : 'on duty'}</td><td>{r.clockInNote}</td></tr>
          ))}</tbody></table></div>
        </Card>
      )}
    </div>
  );
}

function PdfButton({ onClick, disabled, className = 'ml-auto' }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await onClick(); } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  return <Button variant="secondary" className={className} loading={busy} disabled={disabled} onClick={run}><FileDown className="h-4 w-4" /> Download PDF</Button>;
}

function Records() {
  const [f, setF] = useState({ from: ymd(new Date(Date.now() - 7 * 86400000)), to: ymd(), status: '', department: '' });
  const { data: records, loading, reload } = useFetch('/attendance', { params: f, initial: [] });
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] } });
  const [edit, setEdit] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/attendance/${edit._id}`, {
        clockIn: new Date(edit.clockInLocal).toISOString(),
        clockOut: edit.clockOutLocal ? new Date(edit.clockOutLocal).toISOString() : null,
        status: edit.status, lateMinutes: edit.lateMinutes,
        adjustmentNote: edit.adjustmentNote,
      });
      toast.success('Record updated');
      setEdit(null);
      reload();
    } catch (err) { toastError(err); }
  };
  const local = (d) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

  return (
    <Card bodyClass="p-0">
      <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
        <Field label="From"><input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><input type="date" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="Status"><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="">All</option><option value="on_time">On time</option><option value="late">Late</option><option value="unscheduled">Unscheduled</option>
        </select></Field>
        <Field label="Department"><select className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
          <option value="">All</option>{meta.departments.map((d) => <option key={d}>{d}</option>)}
        </select></Field>
        <PdfButton disabled={!records.length} onClick={() => downloadAttendanceRecordsPdf(records, f)} />
      </div>
      {loading ? <Spinner /> : records.length === 0 ? <Empty title="No records" /> : (
        <div className="overflow-x-auto"><table className="table">
          <thead><tr><th><Term>Staff</Term></th><th><Term>Date</Term></th><th><Term>Shift</Term></th><th><Term>In</Term></th><th><Term>Out</Term></th><th><Term>Worked</Term></th><th><Term>Confirmed by</Term></th><th><Term>Status</Term></th><th /></tr></thead>
          <tbody>{records.map((r) => (
            <tr key={r._id}>
              <td className="font-medium">{fullName(r.user)}<p className="text-xs font-normal text-slate-500">{r.user?.department}</p></td>
              <td>{fmtDate(r.clockIn)}</td>
              <td className="text-slate-500">{r.shift ? `${r.shift.startTime}–${r.shift.endTime}` : '—'}</td>
              <td>{fmtTime(r.clockIn)}</td><td>{r.clockOut ? fmtTime(r.clockOut) : <Badge color="blue">On duty</Badge>}</td>
              <td>{fmtMinutes(r.workedMinutes)}</td>
              <td>{r.confirmedBy ? <span className="text-sm">{r.confirmedBy.firstName} {r.confirmedBy.lastName}{r.checkInMethod === 'manual' && <span className="ml-1 text-xs text-slate-500">(manual)</span>}</span> : <span className="text-xs text-slate-500">—</span>}</td>
              <td><Badge status={r.status}>{r.status === 'late' ? `Late ${r.lateMinutes}m` : undefined}</Badge></td>
              <td><IconButton icon={Pencil} label={`Adjust ${fullName(r.user)}'s record`} onClick={() => setEdit({ ...r, clockInLocal: local(r.clockIn), clockOutLocal: local(r.clockOut) })} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Adjust attendance record" size="sm"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button form="att-form">Save</Button></>}>
        {edit && (
          <form id="att-form" onSubmit={save} className="space-y-3">
            <Field label="Checked in"><input type="datetime-local" className="input" value={edit.clockInLocal} onChange={(e) => setEdit({ ...edit, clockInLocal: e.target.value })} /></Field>
            <Field label="Checked out"><input type="datetime-local" className="input" value={edit.clockOutLocal} onChange={(e) => setEdit({ ...edit, clockOutLocal: e.target.value })} /></Field>
            <Field label="Status"><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
              <option value="on_time">On time</option><option value="late">Late</option><option value="unscheduled">Unscheduled</option>
            </select></Field>
            <Field label="Late minutes"><input type="number" min="0" className="input" value={edit.lateMinutes} onChange={(e) => setEdit({ ...edit, lateMinutes: e.target.value })} /></Field>
            <Field label="Reason for adjustment"><textarea required maxLength={500} className="input min-h-20" value={edit.adjustmentNote || ''} onChange={(e) => setEdit({ ...edit, adjustmentNote: e.target.value })} /></Field>
          </form>
        )}
      </Modal>
    </Card>
  );
}

function Punctuality() {
  const [f, setF] = useState({ from: ymd(new Date(Date.now() - 30 * 86400000)), to: ymd(), department: '' });
  const [sort, setSort] = useState({ key: 'punctualityRate', dir: 1 });
  const { data, loading } = useFetch('/reports/punctuality', { params: f });
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] } });

  const rows = useMemo(() => {
    const list = (data?.rows || []).filter((r) => r.scheduled || r.onTime || r.late || r.unscheduled);
    const val = (r) => (sort.key === 'name' ? fullName(r.user) : r[sort.key] ?? -1);
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [data, sort]);

  const exportCsv = () => {
    const head = ['Name', 'Staff ID', 'Department', 'Scheduled', 'Attended', 'Absences', 'On time', 'Late', 'Avg late (min)', 'Early leaves', 'Hours', 'Punctuality %', 'Attendance %'];
    const lines = rows.map((r) => [fullName(r.user), r.user.staffId, r.user.department, r.scheduled, r.attendedShifts, r.absences, r.onTime, r.late, r.avgLateMinutes, r.earlyLeaves, r.hoursWorked, r.punctualityRate ?? '', r.attendanceRate ?? '']);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `punctuality_${f.from}_${f.to}.csv`;
    a.click();
  };

  const Th = ({ k, children }) => (
    <th className="cursor-pointer select-none hover:text-slate-700" onClick={() => setSort({ key: k, dir: sort.key === k ? -sort.dir : 1 })}>
      {children}{sort.key === k && (sort.dir === 1 ? ' ↑' : ' ↓')}
    </th>
  );

  return (
    <Card bodyClass="p-0">
      <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
        <Field label="From"><input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><input type="date" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="Department"><select className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
          <option value="">All</option>{meta.departments.map((d) => <option key={d}>{d}</option>)}
        </select></Field>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
          <PdfButton className="" disabled={!rows.length} onClick={() => downloadPunctualityPdf(rows, f)} />
        </div>
      </div>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty title="No attendance data in this period" /> : (
        <div className="overflow-x-auto"><table className="table">
          <thead><tr>
            <Th k="name">Staff</Th><Th k="scheduled">Scheduled</Th><Th k="absences">Absences</Th><Th k="late">Late</Th>
            <Th k="avgLateMinutes">Avg late</Th><Th k="earlyLeaves">Early leaves</Th><Th k="hoursWorked">Hours</Th>
            <Th k="attendanceRate">Attendance</Th><Th k="punctualityRate">Punctuality</Th>
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.user._id}>
              <td><Link to={`/admin/staff/${r.user._id}`} className="flex items-center gap-2 hover:text-brand-700"><Avatar user={r.user} size="sm" /><span><span className="block font-medium">{fullName(r.user)}</span><span className="text-xs text-slate-500">{r.user.department}</span></span></Link></td>
              <td>{r.scheduled}</td>
              <td className={r.absences ? 'font-semibold text-rose-600' : ''}>{r.absences}</td>
              <td className={r.late ? 'text-amber-600' : ''}>{r.late}</td>
              <td>{r.avgLateMinutes ? `${r.avgLateMinutes}m` : '—'}</td>
              <td>{r.earlyLeaves}</td><td>{r.hoursWorked}</td>
              <td className="w-36"><div className="flex items-center gap-2"><ProgressBar value={r.attendanceRate} /><span className="w-10 text-right text-xs">{r.attendanceRate ?? '—'}%</span></div></td>
              <td className="w-36"><div className="flex items-center gap-2"><ProgressBar value={r.punctualityRate} /><span className="w-10 text-right text-xs">{r.punctualityRate ?? '—'}%</span></div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
  );
}

export default function AdminAttendance() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'today';
  return (
    <div>
      <PageHeader title="Attendance & punctuality" subtitle="Live duty board, check-in records and punctuality rankings" />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { value: 'today', label: 'Today' }, { value: 'records', label: 'Records' }, { value: 'punctuality', label: 'Punctuality report' },
      ]} />
      {tab === 'today' && <TodayBoard />}
      {tab === 'records' && <Records />}
      {tab === 'punctuality' && <Punctuality />}
    </div>
  );
}
