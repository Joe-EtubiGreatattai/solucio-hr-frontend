import { useMemo, useState } from 'react';
import useFetch from '../../lib/useFetch';
import { Badge, Card, Empty, PageHeader, Spinner, StatCard } from '../../components/ui';
import { fmtDate, fmtMinutes, fmtTime, ymd } from '../../lib/format';
import { ClockCard } from './Dashboard';
import { Clock, Timer, TrendingUp, AlarmClock } from 'lucide-react';
import { Term } from '../../components/InfoTip';

export default function MyAttendance() {
  const [from, setFrom] = useState(ymd(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(ymd());
  const { data: records, loading } = useFetch('/attendance/mine', { params: { from, to }, initial: [] });

  const stats = useMemo(() => {
    const onTime = records.filter((r) => r.status === 'on_time').length;
    const late = records.filter((r) => r.status === 'late').length;
    return {
      onTime, late,
      punctuality: onTime + late ? Math.round((onTime / (onTime + late)) * 100) : null,
      minutes: records.reduce((a, r) => a + (r.workedMinutes || 0), 0),
    };
  }, [records]);

  return (
    <div>
      <PageHeader title="My attendance" subtitle="Your check-in history and punctuality" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ClockCard />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-2">
          <StatCard label="Punctuality" value={stats.punctuality == null ? '—' : `${stats.punctuality}%`} icon={TrendingUp} tone={stats.punctuality >= 85 ? 'green' : 'amber'} />
          <StatCard label="Hours worked" value={fmtMinutes(stats.minutes)} icon={Timer} />
          <StatCard label="On-time check-ins" value={stats.onTime} icon={Clock} tone="green" />
          <StatCard label="Late check-ins" value={stats.late} icon={AlarmClock} tone="red" />
        </div>
      </div>

      <Card className="mt-6" title="History" bodyClass="p-0" action={
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:w-auto">
          <input type="date" className="input min-w-0 w-full sm:w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-slate-500">to</span>
          <input type="date" className="input min-w-0 w-full sm:w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      }>
        {loading ? <Spinner /> : records.length === 0 ? <Empty title="No attendance records in this period" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th><Term>Date</Term></th><th><Term>Shift</Term></th><th><Term>Checked in</Term></th><th><Term>Checked out</Term></th><th><Term>Worked</Term></th><th><Term>Status</Term></th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id}>
                    <td className="font-medium">{fmtDate(r.clockIn)}</td>
                    <td className="text-slate-500">{r.shift ? `${r.shift.startTime}–${r.shift.endTime}` : 'Unscheduled'}</td>
                    <td>{fmtTime(r.clockIn)}</td>
                    <td>{r.clockOut ? fmtTime(r.clockOut) : <Badge color="blue">On duty</Badge>}</td>
                    <td>{fmtMinutes(r.workedMinutes)}</td>
                    <td>
                      <Badge status={r.status}>{r.status === 'late' ? `Late ${r.lateMinutes}m` : undefined}</Badge>
                      {r.earlyLeaveMinutes > 0 && <span className="ml-1"><Badge color="amber">Left {r.earlyLeaveMinutes}m early</Badge></span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
