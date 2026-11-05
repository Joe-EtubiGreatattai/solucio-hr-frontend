import { useState } from 'react';
import { ArrowLeftRight, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../lib/api';
import useFetch from '../lib/useFetch';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from './Confirm';
import { Avatar, Badge, Button, Card, Field, Modal, Spinner } from './ui';
import { fullName, ymd } from '../lib/format';
import { SWAP_STATUS, shiftText } from '../lib/swaps';

// Ask a colleague to swap or cover a shift. Shown from My roster.
export function SwapRequestModal({ initialShift, onClose, onSent }) {
  const { user } = useAuth();
  const { data: mine } = useFetch('/rosters/my-shifts', { params: { from: ymd(), to: ymd(new Date(Date.now() + 60 * 86400000)) }, initial: [] });
  const { data: people } = useFetch('/users/directory', { initial: [] });
  const [f, setF] = useState({ shift: initialShift?._id || '', colleague: '', colleagueShift: '', message: '' });
  const { data: theirs, loading } = useFetch(f.colleague ? `/rosters/colleagues/${f.colleague}/shifts` : null, { initial: [] });
  const [busy, setBusy] = useState(false);
  const upcoming = mine.filter((s) => new Date(s.startAt) > new Date());
  // Same department first: they can usually cover each other's work.
  const colleagues = people.filter((p) => p._id !== user._id).sort((a, b) => (b.department === user.department) - (a.department === user.department) || a.firstName.localeCompare(b.firstName));
  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/rosters/swaps', { ...f, colleagueShift: f.colleagueShift || undefined }); toast.success('Request sent. You’ll be notified when they answer'); onSent(); }
    catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Swap or give away a shift" size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="swap-form" loading={busy}>Send request</Button></>}>
      <form id="swap-form" onSubmit={send} className="space-y-4">
        <Field label="Your shift"><select className="input" required value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })}><option value="">Choose…</option>{upcoming.map((s) => <option key={s._id} value={s._id}>{shiftText(s)}</option>)}</select></Field>
        <Field label="Colleague"><select className="input" required value={f.colleague} onChange={(e) => setF({ ...f, colleague: e.target.value, colleagueShift: '' })}><option value="">Choose…</option>{colleagues.map((p) => <option key={p._id} value={p._id}>{fullName(p)} · {p.jobTitle || '—'}{p.department === user.department ? '' : ` (${p.department})`}</option>)}</select></Field>
        {f.colleague && (
          <div>
            <span className="label">What you'd like</span>
            {loading ? <Spinner /> : (
              <div className="space-y-2">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="radio" name="kind" className="h-4 w-4 accent-brand-700" checked={!f.colleagueShift} onChange={() => setF({ ...f, colleagueShift: '' })} /> They cover my shift (no swap back)</label>
                {theirs.length > 0 && <p className="pt-1 text-xs text-slate-500">Or swap for one of theirs:</p>}
                {theirs.map((s) => (
                  <label key={s._id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="radio" name="kind" className="h-4 w-4 accent-brand-700" checked={f.colleagueShift === s._id} onChange={() => setF({ ...f, colleagueShift: s._id })} /> I take their {shiftText(s)}</label>
                ))}
              </div>
            )}
          </div>
        )}
        <Field label="Message (optional)"><input className="input" placeholder="e.g. Family wedding that weekend" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
        <p className="text-xs text-slate-500">Your colleague accepts first, then HR approves. Your roster only changes once HR approves.</p>
      </form>
    </Modal>
  );
}

// Swap requests the person sent or received, with the actions they can take.
export default function ShiftSwaps({ onAsk }) {
  const { user } = useAuth();
  const { data: swaps, reload } = useFetch('/rosters/swaps/mine', { initial: [] });
  const ask = useConfirm();
  const act = async (path, body, msg) => {
    try { const { data } = await api.post(`/rosters/swaps/${path}`, body); toast.success(typeof msg === 'function' ? msg(data) : msg); reload(); } catch (e) { toastError(e); }
  };
  const respond = async (s, accept) => {
    if (accept) return act(`${s._id}/respond`, { accept: true }, (r) => (r.autoApproved ? 'Swap approved. Your roster is updated' : 'Accepted. HR will confirm'));
    const note = await ask({ title: `Decline ${s.requester.firstName}'s request?`, input: { label: 'Reason (optional)', required: false }, confirmLabel: 'Decline' });
    if (note !== false) act(`${s._id}/respond`, { accept: false, note }, 'Declined');
  };
  const incoming = swaps.filter((s) => s.colleague._id === user._id && s.status === 'pending_colleague');
  const rest = swaps.filter((s) => !incoming.includes(s)).slice(0, 8);
  return (
    <Card title="Shift swaps" action={<Button size="sm" variant="secondary" onClick={() => onAsk()}><Repeat className="h-4 w-4" /> Ask for a swap</Button>}>
      {swaps.length === 0 && <p className="text-sm text-slate-500">Can't work a shift? Ask a colleague to swap or cover it.</p>}
      {incoming.length > 0 && (
        <ul className="mb-4 space-y-3">{incoming.map((s) => (
          <li key={s._id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <div className="flex items-center gap-2"><Avatar user={s.requester} size="sm" /><b>{fullName(s.requester)}</b> asks you to {s.colleagueShift ? 'swap' : 'cover'}</div>
            <p className="mt-2">You'd work: <b>{shiftText(s.shiftInfo)}</b></p>
            {s.colleagueShift && <p>They'd take your: <b>{shiftText(s.colleagueShiftInfo)}</b></p>}
            {s.message && <p className="mt-1 text-slate-600">“{s.message}”</p>}
            <div className="mt-3 flex gap-2"><Button size="sm" variant="success" onClick={() => respond(s, true)}>Accept</Button><Button size="sm" variant="secondary" onClick={() => respond(s, false)}>Decline</Button></div>
          </li>
        ))}</ul>
      )}
      {rest.length > 0 && (
        <ul className="divide-y divide-slate-100">{rest.map((s) => {
          const mineSent = s.requester._id === user._id;
          const other = mineSent ? s.colleague : s.requester;
          return (
            <li key={s._id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <ArrowLeftRight className="h-4 w-4 text-slate-400" />
              <span className="min-w-48 flex-1">{mineSent ? 'You → ' : ''}{fullName(other)}{mineSent ? '' : ' → you'}: {shiftText(s.shiftInfo)}{s.colleagueShift && <> ↔ {shiftText(s.colleagueShiftInfo)}</>}</span>
              <Badge color={SWAP_STATUS[s.status][1]}>{s.autoApproved ? 'Approved automatically' : SWAP_STATUS[s.status][0]}</Badge>
              {mineSent && ['pending_colleague', 'pending_hr'].includes(s.status) && <Button size="sm" variant="ghost" onClick={() => act(`${s._id}/cancel`, {}, 'Request cancelled')}>Cancel</Button>}
            </li>
          );
        })}</ul>
      )}
    </Card>
  );
}
