import { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, BadgeCheck, Clock, Landmark, ShieldCheck } from 'lucide-react';
import api, { toastError } from '../lib/api';
import useFetch from '../lib/useFetch';
import { useConfirm } from './Confirm';
import { Badge, Button, Card, Field, Modal, PasswordInput } from './ui';
import { fmtDate } from '../lib/format';

const masked = (n) => (n ? `•••• ${String(n).slice(-4)}` : '');

// Staff: the salary account on file, and a checked, HR-approved way to change it.
export default function BankAccountCard({ user }) {
  const { data: requests, reload } = useFetch('/bank-changes/mine', { initial: [] });
  const [open, setOpen] = useState(false);
  const ask = useConfirm();
  const pending = requests.find((r) => r.status === 'pending');
  const lastDecision = requests.find((r) => r.status === 'rejected' && !pending);
  const b = user.bankDetails || {};

  const cancel = async () => {
    if (!(await ask({ title: 'Cancel this request?', message: 'Your salary account stays as it is.', confirmLabel: 'Cancel request', tone: 'danger' }))) return;
    try { await api.post(`/bank-changes/${pending.id}/cancel`); toast.success('Request cancelled'); reload(); } catch (e) { toastError(e); }
  };

  return (
    <Card title="Salary account" action={<span className="text-xs text-slate-500">Used for salary and approved loans</span>}>
      {b.accountNumber ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700"><Landmark className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{b.bankName}</p>
            <p className="text-sm text-slate-500">{b.accountName} · {masked(b.accountNumber)}</p>
          </div>
        </div>
      ) : <p className="text-sm text-slate-500">No salary account yet. Add one so HR can pay you.</p>}

      {pending ? (
        <div className="mt-4 flex animate-fade-up flex-wrap items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1">Waiting for HR to approve <b>{pending.bankName} {pending.accountNumber}</b>{pending.accountName && <> ({pending.accountName})</>}, asked {fmtDate(pending.createdAt)}. Until then you're paid into the account above.</p>
          <Button size="sm" variant="secondary" onClick={cancel}>Cancel request</Button>
        </div>
      ) : (
        <>
          {lastDecision && <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Your last change wasn't approved: {lastDecision.reason}</p>}
          <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => setOpen(true)}>{b.accountNumber ? 'Change salary account' : 'Add salary account'}</Button>
        </>
      )}
      <p className="mt-3 flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> To protect your pay, a new account is checked with the bank, needs your password and is approved by HR before it's used. We'll email you about any change.</p>
      <ChangeModal open={open} onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />
    </Card>
  );
}

function ChangeModal({ open, onClose, onDone }) {
  const { data: banks, loading: banksLoading } = useFetch(open ? '/bank-changes/banks' : null, { initial: [], live: false });
  const [form, setForm] = useState({ bankCode: '', accountNumber: '', password: '' });
  const [check, setCheck] = useState(null); // { accountName, nameMatches } | { error }
  const [busy, setBusy] = useState('');
  const set = (k) => (e) => { setForm({ ...form, [k]: k === 'accountNumber' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value }); if (k !== 'password') setCheck(null); };
  const ready = form.bankCode && form.accountNumber.length === 10;

  const verify = async () => {
    setBusy('verify');
    try { setCheck((await api.post('/bank-changes/verify', { bankCode: form.bankCode, accountNumber: form.accountNumber })).data); }
    catch (e) { setCheck({ error: e.response?.data?.message || e.message, unavailable: e.response?.status === 503 }); }
    finally { setBusy(''); }
  };
  const submit = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // events from this dialog bubble through React to the page behind it
    setBusy('submit');
    try {
      await api.post('/bank-changes', { ...form, bankName: banks.find((b) => b.code === form.bankCode)?.name });
      toast.success('Sent to HR. You\'ll be told when it\'s approved.');
      setForm({ bankCode: '', accountNumber: '', password: '' });
      setCheck(null);
      onDone();
    } catch (err) { toastError(err); }
    finally { setBusy(''); }
  };
  const canSend = ready && form.password && (check?.accountName || check?.unavailable);

  return (
    <Modal open={open} onClose={onClose} title="Change salary account"
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button form="bank-change" loading={busy === 'submit'} disabled={!canSend}>Send to HR</Button></>}>
      <form id="bank-change" onSubmit={submit} className="space-y-4">
        <Field label="Bank">
          <select className="input" required value={form.bankCode} onChange={set('bankCode')} disabled={banksLoading}>
            <option value="">{banksLoading ? 'Loading banks…' : banks.length ? 'Choose your bank' : 'Banks unavailable right now'}</option>
            {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Account number" hint="10 digits (NUBAN)">
          <div className="flex gap-2">
            <input className="input flex-1 tabular-nums" inputMode="numeric" autoComplete="off" required value={form.accountNumber} onChange={set('accountNumber')} />
            <Button type="button" variant="secondary" disabled={!ready} loading={busy === 'verify'} onClick={verify}>Check</Button>
          </div>
        </Field>
        {check?.accountName && (
          <div className={`flex animate-fade-up items-start gap-2 rounded-xl p-3 text-sm ${check.nameMatches ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
            {check.nameMatches ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>The bank says this account belongs to <b>{check.accountName}</b>.{!check.nameMatches && ' That doesn\'t look like your name. HR will ask you about it; salary should go into an account in your own name.'}</span>
          </div>
        )}
        {check?.error && (
          <p className={`flex items-start gap-2 rounded-xl p-3 text-sm ${check.unavailable ? 'bg-slate-50 text-slate-700' : 'bg-rose-50 text-rose-800'}`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {check.error}{check.unavailable && ' You can still send it; HR will check the account.'}
          </p>
        )}
        <Field label="Your password" hint="Confirms it's really you asking"><PasswordInput required autoComplete="current-password" value={form.password} onChange={set('password')} /></Field>
      </form>
    </Modal>
  );
}

// HR: requests waiting for review
export function BankChangeQueue() {
  const [status, setStatus] = useState('pending');
  const { data: list, loading, reload } = useFetch('/bank-changes', { params: { status }, initial: [] });
  const ask = useConfirm();
  const approve = async (r) => {
    const ok = await ask({
      title: `Approve ${r.user.firstName}'s new salary account?`,
      message: `Salary will go to ${r.bankName} ${r.accountNumber} (${r.accountName || 'name not checked'}) from the next payment. If anything looks off, call ${r.user.firstName} on a number you already have before approving.`,
      confirmLabel: 'Approve',
    });
    if (!ok) return;
    try { await api.post(`/bank-changes/${r.id}/approve`); toast.success('Approved. Payroll has the new account.'); reload(); } catch (e) { toastError(e); reload(); }
  };
  const reject = async (r) => {
    const reason = await ask({ title: 'Reject this change?', message: 'Their salary account stays as it is.', input: { label: 'Reason (shown to them)', required: true }, confirmLabel: 'Reject', tone: 'danger' });
    if (reason === false) return;
    try { await api.post(`/bank-changes/${r.id}/reject`, { reason }); toast.success('Rejected'); reload(); } catch (e) { toastError(e); reload(); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {['pending', 'approved', 'rejected', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`min-h-10 rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize desk:min-h-0 desk:px-3 desk:py-1 desk:text-xs ${status === s ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{s}</button>
        ))}
      </div>
      <Card bodyClass="p-0">
        {loading && !list.length ? <p className="p-6 text-sm text-slate-500">Loading…</p> : list.length === 0 ? (
          <p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Landmark className="h-4 w-4" /> No {status} bank account changes.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((r) => (
              <li key={r.id} className="space-y-2 px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-slate-900">{r.user?.firstName} {r.user?.lastName}</b>
                  <span className="text-slate-500">{r.user?.staffId} · {r.user?.department || '—'} · asked {fmtDate(r.createdAt)}</span>
                  {r.verified ? <Badge color={r.nameMatches ? 'green' : 'amber'}>{r.nameMatches ? 'Bank checked, name matches' : 'Name doesn\'t match'}</Badge> : <Badge color="slate">Not checked with the bank</Badge>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3"><p className="label">Now</p><p>{r.previous?.bankName || 'No account'} {r.previous?.accountNumber}</p><p className="text-slate-500">{r.previous?.accountName}</p></div>
                  <div className="rounded-xl bg-brand-50 p-3"><p className="label">New</p><p className="font-semibold">{r.bankName} <span className="tabular-nums">{r.accountNumber}</span></p><p className="text-slate-600">{r.accountName || 'Name not checked'}</p></div>
                </div>
                {r.status === 'pending' ? (
                  <div className="flex gap-2"><Button size="sm" variant="success" onClick={() => approve(r)}>Approve</Button><Button size="sm" variant="secondary" onClick={() => reject(r)}>Reject</Button></div>
                ) : (
                  <p className="text-slate-500">{r.status === 'cancelled' ? 'Cancelled by them' : `${r.status === 'approved' ? 'Approved' : 'Rejected'} by ${r.reviewedBy?.firstName || 'HR'} ${fmtDate(r.reviewedAt)}`}{r.reason && `: ${r.reason}`}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
