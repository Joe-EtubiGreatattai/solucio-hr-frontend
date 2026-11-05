import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { openFile, toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fmtMoney, fullName, titleCase } from '../../lib/format';
import { REQUEST_TYPES, RequestSummary } from '../staff/Requests';
import { toastWithAction } from '../../lib/undo';
import { useConfirm } from '../../components/Confirm';
import { Term } from '../../components/InfoTip';
import LeaveImpact from '../../components/LeaveImpact';
import SwapQueue from '../../components/SwapQueue';

export default function AdminRequests() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const type = params.get('type') || '';
  const { data: items, loading, reload } = useFetch('/requests', { params: { status, type }, initial: [] });
  const [review, setReview] = useState(null);
  const [comment, setComment] = useState('');
  const [removeShifts, setRemoveShifts] = useState(true);
  const [busy, setBusy] = useState(false);
  const ask = useConfirm();
  const mine = useRef(new Set()); // requests this admin just acted on
  const previous = useRef(null);
  const filterKey = `${status}|${type}`;

  // When a live refresh removes requests someone else handled, say so instead of letting them silently vanish.
  useEffect(() => {
    const ids = new Set(items.map((r) => r._id));
    const prev = previous.current;
    if (prev && prev.key === filterKey) {
      const goneByOthers = [...prev.ids].filter((id) => !ids.has(id) && !mine.current.has(id));
      if (goneByOthers.length) toast(`${goneByOthers.length} request${goneByOthers.length > 1 ? 's were' : ' was'} just handled by another admin`, { icon: 'ℹ️' });
      if (review && goneByOthers.includes(review._id)) setReview(null);
    }
    previous.current = { key: filterKey, ids };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const reopen = async (r, { silent } = {}) => {
    if (!silent && !(await ask({
      title: 'Reopen this request?',
      message: `It goes back to pending and ${r.user?.firstName} is told the decision was withdrawn.${r.status === 'approved' && r.leaveType === 'annual' ? ` ${r.days} leave day(s) are returned to their balance.` : ''}`,
      confirmLabel: 'Reopen',
    }))) return;
    mine.current.add(r._id);
    try {
      await api.put(`/requests/${r._id}/reopen`);
      toast.success('Request reopened');
      setReview(null);
      reload();
    } catch (e) { toastError(e); }
  };

  const decide = async (decision) => {
    setBusy(true);
    const r = review;
    mine.current.add(r._id);
    try {
      await api.put(`/requests/${r._id}/review`, { status: decision, adminComment: comment, removeShifts: decision === 'approved' && removeShifts });
      toastWithAction(`${REQUEST_TYPES.find((t) => t.value === r.type)?.label} for ${r.user?.firstName} ${decision}`, 'Undo',
        () => reopen({ ...r, status: decision }, { silent: true }));
      setReview(null);
      setComment('');
      setRemoveShifts(true);
      reload();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };

  const set = (k, v) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p); };

  return (
    <div>
      <PageHeader title="Requests" subtitle="Leave, loans, advances, shift swaps and other staff applications" />
      <Tabs value={params.get('tab') === 'swaps' ? 'swaps' : status} onChange={(v) => (v === 'swaps' ? setParams({ tab: 'swaps' }) : setParams({ status: v }))} tabs={[
        { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' },
        { value: 'cancelled', label: 'Cancelled' }, { value: '', label: 'All' }, { value: 'swaps', label: 'Shift swaps' },
      ]} />
      {params.get('tab') === 'swaps' ? <SwapQueue /> : <>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ value: '', label: 'All types' }, ...REQUEST_TYPES].map((t) => (
          <button key={t.value} onClick={() => set('type', t.value)}
            className={`min-h-10 rounded-full px-3.5 py-1.5 text-sm font-semibold desk:min-h-0 desk:px-3 desk:py-1 desk:text-xs ${type === t.value ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{t.label}</button>
        ))}
      </div>
      <Card bodyClass="p-0">
        {loading ? <Spinner /> : items.length === 0 ? <Empty title="No requests here" /> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th><Term>Staff</Term></th><th><Term>Type</Term></th><th><Term>Details</Term></th><th><Term>Submitted</Term></th><th><Term>Status</Term></th><th /></tr></thead>
            <tbody>{items.map((r) => (
              <tr key={r._id}>
                <td><Link to={`/admin/staff/${r.user?._id}`} className="flex items-center gap-2 hover:text-brand-700"><Avatar user={r.user} size="sm" /><span><span className="block font-medium">{fullName(r.user)}</span><span className="text-xs text-slate-500">{r.user?.department}</span></span></Link></td>
                <td className="font-medium">{REQUEST_TYPES.find((t) => t.value === r.type)?.label}</td>
                <td className="max-w-xs text-slate-600"><RequestSummary r={r} />
                  {r.type === 'leave' && r.leaveType === 'annual' && <p className={`text-xs ${r.status === 'pending' && r.days > r.user?.leaveBalance ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>Balance: {r.user?.leaveBalance} day(s)</p>}
                  {r.details && <p className="truncate text-xs text-slate-500">{r.details}</p>}</td>
                <td>{fmtDate(r.createdAt)}</td>
                <td><Badge status={r.status} />{r.status === 'pending' && r.approvalStage === 'manager' && <p className="mt-1 text-xs text-amber-700">With their manager</p>}{r.status === 'pending' && r.managerApproval?.decision === 'approved' && <p className="mt-1 text-xs text-emerald-700">Manager approved</p>}{r.reviewedBy && <p className="mt-1 text-xs text-slate-500">by {fullName(r.reviewedBy)}</p>}</td>
                <td className="text-right"><Button size="sm" variant={r.status === 'pending' ? 'primary' : 'ghost'} onClick={() => setReview(r)}>{r.status === 'pending' ? 'Review' : 'View'}</Button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      </>}
      <Modal open={!!review} onClose={() => setReview(null)} title="Review request"
        footer={review?.status === 'pending' ? <>
          <Button variant="danger" loading={busy} onClick={() => decide('rejected')}>Reject</Button>
          <Button variant="success" loading={busy} onClick={() => decide('approved')}>Approve</Button>
        </> : <>
          {['approved', 'rejected'].includes(review?.status) && <Button variant="secondary" onClick={() => reopen(review)}>Reopen request</Button>}
          <Button variant="secondary" onClick={() => setReview(null)}>Close</Button>
        </>}>
        {review && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3"><Avatar user={review.user} /><div><p className="font-semibold">{fullName(review.user)}</p><p className="text-slate-500">{review.user?.jobTitle} · {review.user?.department}</p></div></div>
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4">
              <div><dt className="label"><Term>Type</Term></dt><dd>{REQUEST_TYPES.find((t) => t.value === review.type)?.label}{review.leaveType && ` (${titleCase(review.leaveType)})`}</dd></div>
              <div><dt className="label"><Term>Status</Term></dt><dd><Badge status={review.status} /></dd></div>
              {review.type === 'leave' && <>
                <div><dt className="label"><Term>Dates</Term></dt><dd>{fmtDate(review.startDate)} – {fmtDate(review.endDate)}</dd></div>
                <div><dt className="label"><Term>Working days</Term></dt><dd>{review.days} (balance {review.user?.leaveBalance})</dd></div>
              </>}
              {review.amount && <>
                <div><dt className="label"><Term>Amount</Term></dt><dd>{fmtMoney(review.amount)}</dd></div>
                <div><dt className="label"><Term>Repayment</Term></dt><dd>{review.repaymentMonths} month(s) · {fmtMoney(Math.ceil(review.amount / review.repaymentMonths))}/month</dd></div>
              </>}
              {review.subject && <div className="col-span-2"><dt className="label"><Term>Subject</Term></dt><dd>{review.subject}</dd></div>}
              {review.details && <div className="col-span-2"><dt className="label"><Term>Details</Term></dt><dd className="whitespace-pre-wrap">{review.details}</dd></div>}
            </dl>
            {review.status === 'pending' && review.approvalStage === 'manager' && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">Waiting for their line manager. If you decide now, you skip the manager's step.</p>}
            {review.managerApproval?.decision && <p className={`rounded-xl p-3 ${review.managerApproval.decision === 'approved' ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}><b>{review.managerApproval.by ? fullName(review.managerApproval.by) : 'Manager'} {review.managerApproval.decision}</b>{review.managerApproval.comment && `: ${review.managerApproval.comment}`}</p>}
            {review.type === 'leave' && review.startDate && <LeaveImpact key={review._id} request={review} removeShifts={removeShifts} onRemoveShifts={setRemoveShifts} />}
            {review.attachment?.path && <Button variant="secondary" size="sm" onClick={() => openFile(`/requests/${review._id}/attachment`)}><Paperclip className="h-4 w-4" /> {review.attachment.originalName}</Button>}
            {review.status === 'pending'
              ? <Field label="Comment to staff (optional)"><textarea rows={3} className="input" value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
              : review.adminComment && <p className="rounded-lg bg-brand-50 p-3"><b>Comment:</b> {review.adminComment}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
