import { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fmtMoney, titleCase, ymd } from '../../lib/format';
import { useConfirm } from '../../components/Confirm';
import MoneyInput from '../../components/MoneyInput';

export const REQUEST_TYPES = [
  { value: 'leave', label: 'Leave' },
  { value: 'loan', label: 'Staff loan' },
  { value: 'salary_advance', label: 'Salary advance' },
  { value: 'training', label: 'Training / course' },
  { value: 'transfer', label: 'Transfer / redeployment' },
  { value: 'equipment', label: 'Equipment / supplies' },
  { value: 'other', label: 'Other' },
];
const LEAVE_TYPES = ['annual', 'sick', 'maternity', 'paternity', 'compassionate', 'study', 'unpaid'];

export function RequestSummary({ r }) {
  if (r.type === 'leave') return <span>{titleCase(r.leaveType)} leave · {fmtDate(r.startDate)} – {fmtDate(r.endDate)} ({r.days} working day{r.days === 1 ? '' : 's'})</span>;
  if (r.amount) return <span>{fmtMoney(r.amount)} over {r.repaymentMonths} month(s){r.subject && ` · ${r.subject}`}</span>;
  return <span>{r.subject || '—'}</span>;
}

// Mon–Fri days between two YYYY-MM-DD dates, inclusive (matches the server's count).
function workingDays(from, to) {
  if (!from || !to || to < from) return 0;
  let n = 0;
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) n++; d.setDate(d.getDate() + 1); }
  return n;
}

const NEW_FORM = { type: 'leave', leaveType: 'annual' };

export default function Requests() {
  const { user } = useAuth();
  const { data: items, loading, reload } = useFetch('/requests/mine', { initial: [] });
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(NEW_FORM);
  const ask = useConfirm();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  // Changing type starts a clean form so hidden fields from another type aren't sent.
  const setType = (e) => setForm({ ...NEW_FORM, type: e.target.value, details: form.details });

  const days = form.type === 'leave' ? workingDays(form.startDate, form.endDate) : 0;
  const datesInvalid = form.type === 'leave' && form.startDate && form.endDate && form.endDate < form.startDate;
  const overBalance = form.type === 'leave' && form.leaveType === 'annual' && days > user.leaveBalance;

  const submit = async (e) => {
    e.preventDefault();
    if (datesInvalid || overBalance) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v !== '' && v != null && fd.append(k, v));
      if (file) fd.append('attachment', file);
      await api.post('/requests', fd);
      toast.success("Application submitted. HR will review it and you'll get a notification with their decision.", { duration: 6000 });
      setOpen(false);
      setForm(NEW_FORM);
      setFile(null);
      reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (r) => {
    const label = REQUEST_TYPES.find((t) => t.value === r.type)?.label.toLowerCase();
    if (!(await ask({ title: `Cancel this ${label} application?`, message: "HR won't review it. You can submit a new one later.", confirmLabel: 'Cancel application', cancelLabel: 'Keep it', tone: 'danger' }))) return;
    try {
      await api.put(`/requests/${r._id}/cancel`);
      toast.success('Application cancelled');
      reload();
    } catch (e) { toastError(e); }
  };

  const shown = tab === 'all' ? items : items.filter((r) => r.status === tab);

  return (
    <div>
      <PageHeader title="Leave, loans & requests" subtitle={`Annual leave balance: ${user.leaveBalance} day(s)`}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New application</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'all', label: 'All', count: items.length },
        { value: 'pending', label: 'Pending', count: items.filter((r) => r.status === 'pending').length },
        { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' },
      ]} />
      <Card bodyClass="p-0">
        {loading ? <Spinner /> : shown.length === 0 ? <Empty icon={FileText} title="No applications" /> : (
          <div className="stagger divide-y divide-slate-100">
            {shown.map((r) => (
              <div key={r._id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{REQUEST_TYPES.find((t) => t.value === r.type)?.label}</p>
                    <Badge status={r.status} />
                    {r.status === 'pending' && <span className="text-xs text-slate-500">{r.approvalStage === 'manager' ? 'Waiting for your manager' : r.managerApproval?.decision === 'approved' ? 'Manager approved · with HR' : 'With HR'}</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600"><RequestSummary r={r} /></p>
                  {r.details && <p className="mt-1 text-sm text-slate-500">{r.details}</p>}
                  {r.adminComment && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><b>{r.managerApproval?.decision === 'rejected' ? 'Your manager' : 'HR'}:</b> {r.adminComment}</p>}
                  <p className="mt-1 text-xs text-slate-500">Submitted {fmtDate(r.createdAt)}{r.reviewedAt && ` · Reviewed ${fmtDate(r.reviewedAt)}`}</p>
                </div>
                {r.status === 'pending' && <Button variant="secondary" size="sm" onClick={() => cancel(r)}>Cancel</Button>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New application"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button form="req-form" loading={busy} disabled={datesInvalid || overBalance}>Submit</Button></>}>
        <form id="req-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type" className="sm:col-span-2">
            <select className="input" value={form.type} onChange={setType}>
              {REQUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          {form.type === 'leave' && (
            <>
              <Field label="Leave type" className="sm:col-span-2">
                <select className="input" value={form.leaveType} onChange={set('leaveType')}>
                  {LEAVE_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                </select>
              </Field>
              <Field label="Start date"><input type="date" required className="input" min={form.leaveType === 'sick' ? undefined : ymd()} value={form.startDate || ''} onChange={set('startDate')} /></Field>
              <Field label="End date"><input type="date" required className="input" min={form.startDate || undefined} value={form.endDate || ''} onChange={set('endDate')} /></Field>
              <div className={`rounded-lg px-3 py-2 text-sm sm:col-span-2 ${datesInvalid || overBalance ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'}`} role="status">
                {datesInvalid ? 'The end date is before the start date.'
                  : form.leaveType === 'annual'
                    ? <>{days ? <><b>{days}</b> working day{days === 1 ? '' : 's'} · </> : ''}You have <b>{user.leaveBalance}</b> annual leave day{user.leaveBalance === 1 ? '' : 's'}{days ? <> · <b>{Math.max(0, user.leaveBalance - days)}</b> left after this</> : ''}.{overBalance && ' This is more than you have.'}</>
                    : days ? <><b>{days}</b> working day{days === 1 ? '' : 's'}. {titleCase(form.leaveType)} leave doesn't use your annual balance.</> : 'Weekends are not counted.'}
              </div>
            </>
          )}
          {['loan', 'salary_advance'].includes(form.type) && (
            <>
              <Field label="Amount (₦)"><MoneyInput min="1" required className="input" value={form.amount || ''} onChange={set('amount')} /></Field>
              <Field label="Repayment (months)"><input type="number" min="1" max="36" className="input" value={form.repaymentMonths || ''} onChange={set('repaymentMonths')} /></Field>
            </>
          )}
          {form.type !== 'leave' && (
            <Field label="Subject" className="sm:col-span-2"><input className="input" required value={form.subject || ''} onChange={set('subject')} /></Field>
          )}
          <Field label={form.type === 'leave' ? 'Reason / handover notes' : 'Details'} className="sm:col-span-2">
            <textarea rows={4} className="input" value={form.details || ''} onChange={set('details')} />
          </Field>
          <Field label="Supporting document (optional)" className="sm:col-span-2">
            <input type="file" className="input" onChange={(e) => setFile(e.target.files[0])} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
