import { useState } from 'react';
import { CheckCircle2, Inbox, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { openFile, toastError } from '../lib/api';
import useFetch from '../lib/useFetch';
import { Avatar, Badge, Button, Card, Field, Modal } from './ui';
import LeaveImpact from './LeaveImpact';
import { fullName, timeAgo, titleCase } from '../lib/format';
import { REQUEST_TYPES, RequestSummary } from '../pages/staff/Requests';

const label = (t) => REQUEST_TYPES.find((x) => x.value === t)?.label || titleCase(t);

// Line managers approve or decline their team's requests before HR sees them.
export default function TeamRequests() {
  const { data, reload } = useFetch('/requests/team', { initial: { waiting: [], recent: [] } });
  const [open, setOpen] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState('');
  if (!data.waiting.length && !data.recent.length) return null;

  const decide = async (decision) => {
    if (decision === 'rejected' && !comment.trim()) return toast.error('Add a short reason so they understand');
    setBusy(decision);
    try {
      await api.put(`/requests/${open._id}/manager-review`, { decision, comment });
      toast.success(decision === 'approved' ? `Approved. ${open.user.firstName}'s request has gone to HR` : `Declined. ${open.user.firstName} has been told`);
      setOpen(null); setComment(''); reload();
    } catch (e) { toastError(e); } finally { setBusy(''); }
  };

  return (
    <Card className="mb-6" title={`Requests to approve${data.waiting.length ? ` (${data.waiting.length})` : ''}`}>
      {data.waiting.length === 0 ? <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Nothing waiting for you.</p> : (
        <ul className="stagger divide-y divide-slate-100">{data.waiting.map((r) => (
          <li key={r._id}>
            <button type="button" onClick={() => setOpen(r)} className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-slate-50">
              <Avatar user={r.user} size="sm" />
              <span className="min-w-48 flex-1"><span className="block font-medium">{fullName(r.user)} · {label(r.type)}</span><span className="text-xs text-slate-500"><RequestSummary r={r} /> · {timeAgo(r.createdAt)}</span></span>
              <span className="text-sm font-semibold text-brand-700">Review</span>
            </button>
          </li>
        ))}</ul>
      )}
      {data.recent.length > 0 && (
        <details className="mt-3 text-sm"><summary className="min-h-10 cursor-pointer py-2 text-slate-500">Recently decided by you ({data.recent.length})</summary>
          <ul className="space-y-1">{data.recent.map((r) => (
            <li key={r._id} className="flex flex-wrap gap-2 text-slate-600">{fullName(r.user)} · {label(r.type)} <Badge color={r.managerApproval?.decision === 'approved' ? 'green' : 'red'}>{r.managerApproval?.decision === 'approved' ? 'You approved' : 'You declined'}</Badge>
              {r.managerApproval?.decision === 'approved' && <span className="text-xs text-slate-500">HR: {r.status === 'pending' ? 'deciding' : r.status}</span>}</li>
          ))}</ul>
        </details>
      )}

      {open && (
        <Modal open onClose={() => setOpen(null)} title={`${open.user.firstName}'s ${label(open.type).toLowerCase()} request`} size="lg"
          footer={<><Button variant="danger" loading={busy === 'rejected'} onClick={() => decide('rejected')}>Decline</Button><Button variant="success" loading={busy === 'approved'} onClick={() => decide('approved')}>Approve and send to HR</Button></>}>
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3"><Avatar user={open.user} /><div><p className="font-semibold">{fullName(open.user)}</p><p className="text-slate-500">{open.user.jobTitle} · {open.user.department}</p></div></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="font-medium"><RequestSummary r={open} /></p>
              {open.type === 'leave' && open.leaveType === 'annual' && <p className="text-xs text-slate-500">Leave balance: {open.user.leaveBalance} days</p>}
              {open.details && <p className="mt-2 whitespace-pre-wrap text-slate-700">{open.details}</p>}</div>
            {open.attachment?.path && <Button variant="secondary" size="sm" onClick={() => openFile(`/requests/${open._id}/attachment`)}><Paperclip className="h-4 w-4" /> {open.attachment.originalName}</Button>}
            {open.type === 'leave' && <LeaveImpact request={open} canRemoveShifts={false} />}
            <Field label="Comment (needed if you decline)"><textarea rows={3} className="input" value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
            <p className="flex items-center gap-2 text-xs text-slate-500"><Inbox className="h-3.5 w-3.5" /> If you approve, HR makes the final decision.</p>
          </div>
        </Modal>
      )}
    </Card>
  );
}
