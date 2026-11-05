import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, Award, Bell, FileText, KeyRound, Mail, Pencil, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Avatar, Badge, Button, Card, Empty, ProgressBar, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fmtDateTime, fmtMinutes, fmtMoney, fmtTime, fullName, titleCase, ymd } from '../../lib/format';
import { REQUEST_TYPES, RequestSummary } from '../staff/Requests';
import { KIND_COLOR } from '../staff/Notes';
import { StaffFormModal } from './StaffList';
import { CertRequestModal, MessageModal } from '../../components/AdminModals';
import { CertStatus, CertThumb, ExpiryCell, KIND_LABEL } from '../../components/CertificateFile';
import SignInCodeModal from '../../components/SignInCodeModal';
import LetterModal from '../../components/LetterModal';
import { Term } from '../../components/InfoTip';

function Metric({ label, value, sub, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500"><Term>{label}</Term></p>
      <p className={`mt-1 text-2xl font-bold ${tone || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

const rateTone = (v) => (v == null ? '' : v >= 85 ? 'text-emerald-600' : v >= 65 ? 'text-amber-600' : 'text-rose-600');

export default function StaffReport() {
  const { id } = useParams();
  const [days, setDays] = useState(90);
  const from = ymd(new Date(Date.now() - days * 86400000));
  const { data, loading, reload } = useFetch(`/reports/staff/${id}`, { params: { from } });
  const [tab, setTab] = useState('attendance');
  const [params, setParams] = useSearchParams();
  const letterParam = params.get('letter');
  const [modal, setModal] = useState(null);

  if (loading && !data) return <Spinner />;
  if (!data) return <Empty title="Staff not found" />;
  const { user, attendance, certificates, requests, notes, performance = { reviews: [], goals: [] }, employmentHistory = [] } = data;
  const m = attendance.metrics;

  const remind = async (c) => {
    try { await api.post(`/certificates/${c._id}/remind`); toast.success('Reminder sent'); } catch (e) { toastError(e); }
  };

  return (
    <div>
      <Link to="/admin/staff" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700 print:hidden"><ArrowLeft className="h-4 w-4" /> All staff</Link>

      <div className="card mb-6 flex flex-wrap items-center gap-5 p-6">
        <Avatar user={user} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{fullName(user)}</h1>
            <Badge status={user.status} />
            {user.role === 'admin' && <Badge color="purple">Admin</Badge>}
          </div>
          <p className="text-slate-500">{user.jobTitle || '—'} · {user.department || '—'} · {titleCase(user.employmentType)}</p>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono">{user.staffId}</span> · {user.email} · {user.phone || 'No phone'} · Joined {fmtDate(user.dateJoined)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" size="sm" onClick={() => setModal('edit')}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="secondary" size="sm" onClick={() => setModal('message')}><Mail className="h-4 w-4" /> Message</Button>
          <Button variant="secondary" size="sm" onClick={() => setModal('cert')}><Award className="h-4 w-4" /> Request certificate</Button>
          <Button variant="secondary" size="sm" onClick={() => setModal('letter')}><FileText className="h-4 w-4" /> Letter</Button>
          {user.status !== 'inactive' && <Button variant="secondary" size="sm" onClick={() => setModal('code')}><KeyRound className="h-4 w-4" /> Sign-in code</Button>}
          <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-slate-700"><Term>Attendance & work summary</Term></h2>
        <select className="input w-full sm:w-auto print:hidden" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[30, 90, 180, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="Punctuality" value={m.punctualityRate == null ? '—' : `${m.punctualityRate}%`} tone={rateTone(m.punctualityRate)} sub={`${m.onTime} on time`} />
        <Metric label="Attendance" value={m.attendanceRate == null ? '—' : `${m.attendanceRate}%`} tone={rateTone(m.attendanceRate)} sub={`${m.attendedShifts}/${m.scheduled} shifts`} />
        <Metric label="Late arrivals" value={m.late} sub={m.late ? `avg ${m.avgLateMinutes} min` : 'none'} tone={m.late ? 'text-amber-600' : ''} />
        <Metric label="Absences" value={m.absences} tone={m.absences ? 'text-rose-600' : ''} sub="missed shifts" />
        <Metric label="Early leaves" value={m.earlyLeaves} />
        <Metric label="Hours worked" value={m.hoursWorked} sub={`${m.unscheduled} unscheduled`} />
        <Metric label="Leave taken" value={`${requests.leaveDaysTaken}d`} sub={`${user.leaveBalance}d remaining`} />
        <Metric label="Loans approved" value={fmtMoney(requests.loansApproved)} />
      </div>

      {data.relations && (data.relations.cases.length > 0 || data.relations.exit || data.relations.risk?.factors.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {data.relations.risk?.factors.length > 0 && (
            <Link to="/admin/engagement?tab=retention" className="card lift p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Retention signals</p>
              <p className="mt-1 flex items-center gap-2"><Badge color={{ high: 'red', medium: 'amber', low: 'green' }[data.relations.risk.level]}>{titleCase(data.relations.risk.level)} flight risk</Badge><span className="text-xs text-slate-500">{data.relations.risk.score}/100</span></p>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">{data.relations.risk.factors.slice(0, 3).map((f) => <li key={f.label}>{f.label}</li>)}</ul>
            </Link>
          )}
          {data.relations.cases.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employee relations</p>
              <ul className="mt-2 space-y-1.5 text-sm">{data.relations.cases.map((c) => (
                <li key={c._id}><Link className="font-medium text-brand-800 hover:underline" to={`/admin/relations/${c._id}`}>{c.reference}</Link> {c.title} <span className="text-xs text-slate-500">· {titleCase(c.status)}{c.outcome ? ` · ${titleCase(c.outcome)}` : ''}</span>
                  {c.warningExpires && new Date(c.warningExpires) > new Date() && <Badge color="amber">{`Live until ${fmtDate(c.warningExpires)}`}</Badge>}</li>
              ))}</ul>
            </div>
          )}
          {data.relations.exit && (
            <Link to={`/admin/engagement?tab=exits&exit=${data.relations.exit._id}`} className="card lift p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leaving</p>
              <p className="mt-1 font-semibold">{titleCase(data.relations.exit.type)} · last day {fmtDate(data.relations.exit.lastDay)}</p>
              <p className="text-sm text-slate-500">{titleCase(data.relations.exit.status)}</p>
            </Link>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* One bar per month: on time below, late on top, with the month's punctuality written above it. */}
        <Card title="Monthly punctuality" className="lg:col-span-2">
          {attendance.monthly.length === 0 ? <Empty title="No attendance data yet" /> : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={attendance.monthly.map((m) => ({ ...m, label: new Date(`${m.month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) }))} margin={{ top: 28, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 13, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} label={{ value: 'Shifts', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="onTime" name="On time" stackId="a" fill="#129d8f" maxBarSize={72} />
                  <Bar dataKey="late" name="Late" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={72}>
                    <LabelList dataKey="punctuality" position="top" formatter={(v) => (v == null ? '' : `${v}% on time`)} style={{ fontSize: 12, fontWeight: 600, fill: '#334155' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Profile">
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Profile completion</span><span>{user.profileCompletion}%</span></div>
            <ProgressBar value={user.profileCompletion} />
          </div>
          <dl className="space-y-2 text-sm">
            {[
              ['Position', user.position ? `${user.position.title} · ${user.position.department}` : 'Not assigned'],
              ['Grade', user.grade ? `${user.grade.code} · ${user.grade.name}` : '—'],
              ['Line manager', user.manager ? fullName(user.manager) : '—'],
              ...(user.probationEndDate ? [['Probation ends', fmtDate(user.probationEndDate)]] : []),
              ...(user.contractEndDate ? [['Contract ends', fmtDate(user.contractEndDate)]] : []),
              ...(user.plannedExitDate ? [['Planned exit', fmtDate(user.plannedExitDate)]] : []),
              ['Skills', user.skills?.length ? user.skills.map((s) => `${s.name} (${s.level}/5)`).join(', ') : '—'],
              ['Gender', titleCase(user.gender) || '—'], ['Date of birth', fmtDate(user.dateOfBirth)], ['Address', user.address || '—'],
              ['Qualifications', user.qualifications || '—'],
              ['Emergency contact', user.emergencyContact?.name ? `${user.emergencyContact.name} (${user.emergencyContact.relationship || '—'}) ${user.emergencyContact.phone || ''}` : '—'],
              ['Bank', user.bankDetails?.accountNumber ? `${user.bankDetails.bankName} · ${user.bankDetails.accountNumber}` : '—'],
              ['Last login', fmtDateTime(user.lastLoginAt)],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="mt-8">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'attendance', label: 'Attendance log', count: attendance.recent.length },
          { value: 'shifts', label: 'Upcoming shifts', count: attendance.upcomingShifts.length },
          { value: 'certificates', label: 'Certificates', count: certificates.items.length },
          { value: 'requests', label: 'Requests', count: requests.items.length },
          { value: 'notes', label: 'Reports & observations', count: notes.authored.length + notes.about.length },
          { value: 'performance', label: 'Performance', count: performance.reviews.length },
          { value: 'history', label: 'Employment history', count: employmentHistory.length },
        ]} />

        {tab === 'attendance' && (
          <Card bodyClass="p-0">
            {attendance.recent.length === 0 ? <Empty title="No check-ins in this period" /> : (
              <div className="overflow-x-auto"><table className="table">
                <thead><tr><th><Term>Date</Term></th><th><Term>Shift</Term></th><th><Term>In</Term></th><th><Term>Out</Term></th><th><Term>Worked</Term></th><th><Term>Confirmed by</Term></th><th><Term>Status</Term></th></tr></thead>
                <tbody>{attendance.recent.map((r) => (
                  <tr key={r._id}>
                    <td>{fmtDate(r.clockIn)}</td>
                    <td className="text-slate-500">{r.shift ? `${titleCase(r.shift.shiftType)} ${r.shift.startTime}–${r.shift.endTime}` : 'Unscheduled'}</td>
                    <td>{fmtTime(r.clockIn)}</td><td>{fmtTime(r.clockOut)}</td><td>{fmtMinutes(r.workedMinutes)}</td>
                    <td>{r.confirmedBy ? <span className="text-sm">{r.confirmedBy.firstName} {r.confirmedBy.lastName}{r.checkInMethod === 'manual' && <span className="ml-1 text-xs text-slate-500">(manual)</span>}</span> : <span className="text-xs text-slate-500">—</span>}</td>
                    <td><Badge status={r.status}>{r.status === 'late' ? `Late ${r.lateMinutes}m` : undefined}</Badge>
                      {r.earlyLeaveMinutes > 0 && <span className="ml-1"><Badge color="amber">Left {r.earlyLeaveMinutes}m early</Badge></span>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        )}

        {tab === 'shifts' && (
          <Card bodyClass="p-0">
            {attendance.upcomingShifts.length === 0 ? <Empty title="No upcoming shifts" /> : (
              <div className="overflow-x-auto"><table className="table"><thead><tr><th><Term>Date</Term></th><th><Term>Shift</Term></th><th><Term>Time</Term></th><th><Term>Roster</Term></th></tr></thead>
                <tbody>{attendance.upcomingShifts.map((s) => (
                  <tr key={s._id}><td>{fmtDate(s.startAt)}</td><td>{titleCase(s.shiftType)}</td><td>{s.startTime}–{s.endTime}</td><td>{s.roster?.title}</td></tr>
                ))}</tbody></table></div>
            )}
          </Card>
        )}

        {tab === 'certificates' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge color="green">{certificates.counts.valid} approved & valid</Badge>
              <Badge color="amber">{certificates.counts.expiring} licence{certificates.counts.expiring === 1 ? '' : 's'} expiring</Badge>
              <Badge color="red">{certificates.counts.expired} licence{certificates.counts.expired === 1 ? '' : 's'} expired</Badge>
              {certificates.counts.pendingVerification > 0 && <Link to="/admin/certificates?verification=pending"><Badge color="blue">{certificates.counts.pendingVerification} awaiting approval</Badge></Link>}
              {certificates.counts.rejected > 0 && <Badge color="slate">{certificates.counts.rejected} not approved</Badge>}
              {certificates.requests.filter((r) => r.status === 'open').map((r) => <Badge key={r._id} color="blue">Requested: {r.title}</Badge>)}
            </div>
            <Card bodyClass="p-0">
              {certificates.items.length === 0 ? <Empty title="No certificates or licences uploaded" /> : (
                <div className="overflow-x-auto"><table className="table"><thead><tr><th>Name</th><th><Term>Type</Term></th><th><Term>Expires</Term></th><th><Term>Status</Term></th><th /></tr></thead>
                  <tbody>{certificates.items.map((c) => (
                    <tr key={c._id}>
                      <td><div className="flex items-center gap-3"><CertThumb cert={c} /><div><p className="font-medium">{c.title}</p><p className="text-xs text-slate-500">{c.issuer}</p></div></div></td>
                      <td><Badge color={c.kind === 'licence' ? 'blue' : 'slate'}>{KIND_LABEL[c.kind] || 'Certificate'}</Badge></td>
                      <td><ExpiryCell cert={c} /></td><td><CertStatus cert={c} /></td>
                      <td className="whitespace-nowrap text-right">
                        {c.verification === 'verified' && ['expired', 'expiring_soon'].includes(c.expiryStatus) && <Button variant="ghost" size="sm" onClick={() => remind(c)}><Bell className="h-4 w-4" /> Remind</Button>}
                      </td>
                    </tr>
                  ))}</tbody></table></div>
              )}
            </Card>
          </div>
        )}

        {tab === 'requests' && (
          <Card bodyClass="p-0">
            {requests.items.length === 0 ? <Empty title="No requests" /> : (
              <div className="overflow-x-auto"><table className="table"><thead><tr><th><Term>Type</Term></th><th><Term>Details</Term></th><th><Term>Submitted</Term></th><th><Term>Status</Term></th></tr></thead>
                <tbody>{requests.items.map((r) => (
                  <tr key={r._id}>
                    <td className="font-medium">{REQUEST_TYPES.find((t) => t.value === r.type)?.label}</td>
                    <td className="text-slate-600"><RequestSummary r={r} /></td>
                    <td>{fmtDate(r.createdAt)}</td><td><Badge status={r.status} /></td>
                  </tr>
                ))}</tbody></table></div>
            )}
          </Card>
        )}

        {tab === 'notes' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Submitted by this staff member" bodyClass="divide-y divide-slate-100">
              {notes.authored.length === 0 ? <Empty title="None shared" /> : notes.authored.map((n) => (
                <div key={n._id} className="px-5 py-3">
                  <div className="flex items-center gap-2"><Badge color={KIND_COLOR[n.kind]}>{titleCase(n.kind)}</Badge><span className="font-medium">{n.title}</span></div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-500">{fmtDateTime(n.createdAt)}</p>
                </div>
              ))}
            </Card>
            <Card title="Filed about this staff member" bodyClass="divide-y divide-slate-100">
              {notes.about.length === 0 ? <Empty title="None" /> : notes.about.map((n) => (
                <div key={n._id} className="px-5 py-3">
                  <div className="flex items-center gap-2"><Badge color={KIND_COLOR[n.kind]}>{titleCase(n.kind)}</Badge><span className="font-medium">{n.title}</span></div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-500">By {fullName(n.author)} · {fmtDateTime(n.createdAt)}</p>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab === 'performance' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Goals" bodyClass="divide-y divide-slate-100">
              {performance.goals.length === 0 ? <Empty title="No goals recorded" /> : performance.goals.map((g) => (
                <div key={g._id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{g.title}</p><Badge status={g.status} /></div>
                  <p className="mt-1 text-sm text-slate-600">{g.measure || g.target || 'No measure recorded'} · {g.progress || 0}% complete</p>
                  <p className="mt-1 text-xs text-slate-500">{g.cycle?.name || 'Individual goal'}{g.dueDate ? ` · Due ${fmtDate(g.dueDate)}` : ''}</p>
                </div>
              ))}
            </Card>
            <Card title="Review history" bodyClass="divide-y divide-slate-100">
              {performance.reviews.length === 0 ? <Empty title="No reviews recorded" /> : performance.reviews.map((r) => (
                <div key={r._id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{r.cycle?.name || 'Performance review'}</p><Badge status={r.status} /></div>
                  <p className="mt-1 text-sm text-slate-600">Final rating: {r.finalRating ?? 'Not finalized'}{r.finalOutcome && r.finalOutcome !== 'none' ? ` · ${titleCase(r.finalOutcome)}` : ''}</p>
                  {r.reviewer && <p className="mt-1 text-xs text-slate-500">Reviewer: {fullName(r.reviewer)}</p>}
                  {r.self?.achievements && <p className="mt-3 text-sm"><b>Self assessment:</b> {r.self.achievements}</p>}
                  {r.self?.developmentNeeds && <p className="mt-1 text-sm"><b>Development needs:</b> {r.self.developmentNeeds}</p>}
                  {r.manager?.overallComment && <p className="mt-3 text-sm"><b>Manager feedback:</b> {r.manager.overallComment}</p>}
                  {r.employeeComment && <p className="mt-1 text-sm"><b>Staff response:</b> {r.employeeComment}</p>}
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab === 'history' && (
          <Card title="Employment history" bodyClass="divide-y divide-slate-100">
            {employmentHistory.length === 0 ? <Empty title="No employment changes recorded" /> : employmentHistory.map((event) => (
              <div key={event._id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><Badge color={event.eventType === 'exit' ? 'red' : event.eventType === 'hire' ? 'green' : 'blue'}>{titleCase(event.eventType)}</Badge><span className="text-xs text-slate-500">{fmtDateTime(event.effectiveAt)}{event.changedBy ? ` · ${fullName(event.changedBy)}` : ''}</span></div>
                <div className="mt-2 flex flex-wrap gap-2">{event.changes.map((change) => <span key={change.field} className="rounded bg-slate-100 px-2 py-1 text-xs"><b>{titleCase(change.field)}:</b> {change.from || '—'} → {change.to || '—'}</span>)}</div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <StaffFormModal open={modal === 'edit'} staff={user} onClose={() => setModal(null)} onSaved={reload} />
      <MessageModal open={modal === 'message'} onClose={() => setModal(null)} users={[user._id]} title={`Message ${user.firstName}`} />
      {(modal === 'letter' || letterParam) && <LetterModal userId={user._id} initialType={letterParam || undefined} onClose={() => { setModal(null); if (letterParam) { params.delete('letter'); setParams(params); } }} />}
      {modal === 'code' && <SignInCodeModal user={user} onClose={() => setModal(null)} />}
      <CertRequestModal open={modal === 'cert'} onClose={() => setModal(null)} users={[user._id]} onSaved={reload} />
    </div>
  );
}
