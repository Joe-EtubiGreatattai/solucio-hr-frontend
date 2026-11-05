import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeftRight, Info, Repeat, Zap } from 'lucide-react';
import api, { toastError } from '../lib/api';
import useFetch from '../lib/useFetch';
import { useConfirm } from './Confirm';
import { Avatar, Badge, Button, Card, Empty, Spinner } from './ui';
import { fullName, timeAgo } from '../lib/format';
import { SWAP_STATUS, shiftText } from '../lib/swaps';

// The hospital-wide switch for letting safe swaps through without HR.
function AutoApproveSetting() {
  const { data, setData } = useFetch('/org/settings', { live: false });
  if (!data) return null;
  const on = data.autoApproveSwaps !== false;
  const toggle = async () => {
    setData({ ...data, autoApproveSwaps: !on });
    try {
      await api.put('/org/settings', { autoApproveSwaps: !on });
      toast.success(!on ? 'Safe swaps will be approved automatically' : 'Every swap now comes to HR');
    } catch (e) { setData(data); toastError(e); }
  };
  return (
    <div className="card flex flex-wrap items-start gap-3 p-4 sm:items-center sm:p-5">
      <span className="rounded-lg bg-brand-50 p-2.5 text-brand-700"><Zap className="h-5 w-5" /></span>
      <div className="min-w-56 flex-1">
        <p className="font-semibold text-slate-900">Approve safe swaps automatically</p>
        <p className="text-sm text-slate-500">
          A shift-for-shift swap goes straight through when both people have the same role and department, both hold
          the certificates and licences their role needs, and nobody ends up over the weekly limit or short of rest.
          Covers and anything else still come to you. You're notified either way.
        </p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="Approve safe swaps automatically" onClick={toggle}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-brand-700' : 'bg-slate-300'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
      </button>
    </div>
  );
}

// HR: swaps both colleagues have agreed, with fresh checks (clashes, long weeks, short rest).
export default function SwapQueue() {
  const { data: swaps, loading, reload } = useFetch('/rosters/swaps', { params: { status: 'all' }, initial: [] });
  const ask = useConfirm();
  const decide = async (s, approve) => {
    let comment;
    if (!approve) { comment = await ask({ title: 'Decline this swap?', message: 'Both staff are told, and their shifts stay as they are.', input: { label: 'Reason (shown to them)', required: false }, confirmLabel: 'Decline', tone: 'danger' }); if (comment === false) return; }
    try { await api.post(`/rosters/swaps/${s._id}/decide`, { approve, comment }); toast.success(approve ? 'Swap approved; the roster is updated' : 'Swap declined'); reload(); } catch (e) { toastError(e); reload(); }
  };
  if (loading && !swaps.length) return <Spinner />;
  const waiting = swaps.filter((s) => s.status === 'pending_hr');
  const asking = swaps.filter((s) => s.status === 'pending_colleague');
  const history = swaps.filter((s) => !['pending_hr', 'pending_colleague'].includes(s.status)).slice(0, 20);
  return (
    <div className="space-y-6">
      <AutoApproveSetting />
      <Card title={`Waiting for HR (${waiting.length})`} bodyClass="p-0">
        {waiting.length === 0 ? <Empty icon={Repeat} title="No swaps to approve">Swaps that pass every check go through on their own; the rest land here once the colleague agrees.</Empty> : (
          <ul className="divide-y divide-slate-100">{waiting.map((s) => (
            <li key={s._id} className="space-y-2 px-5 py-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Avatar user={s.requester} size="sm" /><b>{fullName(s.requester)}</b><ArrowLeftRight className="h-4 w-4 text-slate-400" /><Avatar user={s.colleague} size="sm" /><b>{fullName(s.colleague)}</b>
                <span className="text-xs text-slate-500">· agreed {timeAgo(s.updatedAt)}</span>
              </div>
              <p>{s.colleague.firstName} works <b>{shiftText(s.shiftInfo)}</b>{s.colleagueShift ? <> and {s.requester.firstName} works <b>{shiftText(s.colleagueShiftInfo)}</b></> : ' (cover, no swap back)'}</p>
              {s.message && <p className="text-slate-600">“{s.message}”</p>}
              {s.needsHrBecause?.length > 0 && (
                <div className="flex gap-2 rounded-xl bg-slate-50 p-2 text-slate-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span><b>Needs you because:</b> {s.needsHrBecause.join('; ')}.</span>
                </div>
              )}
              {s.problem && <p className="flex items-center gap-2 rounded-xl bg-rose-50 p-2 text-rose-800"><AlertTriangle className="h-4 w-4" /> Can't go ahead: {s.problem}</p>}
              {s.warnings?.length > 0 && <ul className="rounded-xl bg-amber-50 p-2 text-amber-900">{s.warnings.map((w) => <li key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</li>)}</ul>}
              <div className="flex gap-2"><Button size="sm" variant="success" disabled={!!s.problem} onClick={() => decide(s, true)}>Approve</Button><Button size="sm" variant="secondary" onClick={() => decide(s, false)}>Decline</Button></div>
            </li>
          ))}</ul>
        )}
      </Card>
      {asking.length > 0 && (
        <Card title={`Waiting for the colleague (${asking.length})`} bodyClass="p-0">
          <p className="border-b border-slate-100 px-5 py-2.5 text-xs text-slate-500">Nothing to do yet. These move up to "Waiting for HR" once the colleague agrees.</p>
          <ul className="divide-y divide-slate-100">{asking.map((s) => (
            <li key={s._id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
              <span className="min-w-48 flex-1"><b>{fullName(s.requester)}</b> asked <b>{fullName(s.colleague)}</b> to {s.colleagueShift ? 'swap' : 'cover'}: {shiftText(s.shiftInfo)}</span>
              <span className="text-xs text-slate-500">{timeAgo(s.createdAt)}</span>
            </li>
          ))}</ul>
        </Card>
      )}
      {history.length > 0 && (
        <Card title="Recent swaps" bodyClass="p-0"><ul className="divide-y divide-slate-100">{history.map((s) => (
          <li key={s._id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
            <span className="min-w-48 flex-1">{fullName(s.requester)} ↔ {fullName(s.colleague)}: {shiftText(s.shiftInfo)}</span>
            <Badge color={SWAP_STATUS[s.status][1]}>{s.autoApproved ? 'Approved automatically' : SWAP_STATUS[s.status][0]}</Badge>
            {s.decidedBy && <span className="text-xs text-slate-500">by {s.decidedBy.firstName}</span>}
          </li>
        ))}</ul></Card>
      )}
    </div>
  );
}
