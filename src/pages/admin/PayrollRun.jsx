import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileDown, Plus, RefreshCw, RotateCcw, Trash2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import { Avatar, Badge, Button, Card, Empty, IconButton, Modal, Spinner } from '../../components/ui';
import { fmtDateTime, fmtMoney, periodLabel, titleCase } from '../../lib/format';
import { downloadCsv, downloadPayslipPdf } from '../../lib/payslipPdf';
import MoneyFlow from '../../components/MoneyFlow';
import { Term } from '../../components/InfoTip';
import MoneyInput from '../../components/MoneyInput';

const Row = ({ l, cls = '' }) => <li className={`flex justify-between gap-3 py-1.5 text-sm ${cls}`}><span><Term>{l.name}</Term></span><span className="tabular-nums">{fmtMoney(l.amount)}</span></li>;

// Gross → minus deductions → take-home, plus what the hospital pays on top.
function SlipSummary({ slip }) {
  const extras = (slip.employerContributions || []).reduce((a, l) => a + l.amount, 0);
  const steps = [
    ['Earned (gross)', slip.gross, 'bg-slate-50 text-slate-900'],
    ['Taken off', -slip.totalDeductions, 'bg-amber-50 text-amber-900'],
    ['Take-home (net)', slip.net, 'bg-brand-700 text-white'],
  ];
  return (
    <div>
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {steps.map(([l, v, cls], i) => (
          <div key={l} className="contents">
            {i > 0 && <span className="hidden text-center text-lg text-slate-400 sm:block" aria-hidden="true">{i === 1 ? '−' : '='}</span>}
            <div className={`rounded-2xl p-3 ${cls}`}><p className="text-xs opacity-80">{l}</p><p className="text-lg font-semibold">{fmtMoney(Math.abs(v))}</p></div>
          </div>
        ))}
      </div>
      {extras > 0 && <p className="mt-2 text-xs text-slate-500">The hospital also pays {fmtMoney(extras)} on top (its pension share, levies and insurance), so the total cost to the hospital is {fmtMoney(slip.gross + extras)}. None of that comes out of take-home pay.</p>}
    </div>
  );
}

export function PayslipBreakdown({ slip }) {
  return (
    <div className="space-y-4">
      <SlipSummary slip={slip} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div><p className="label"><Term>Earnings</Term></p><ul className="divide-y divide-slate-100">{slip.earnings.map((l, i) => <Row key={i} l={l} cls={l.amount < 0 ? 'text-rose-600' : ''} />)}<Row l={{ name: 'Gross pay', amount: slip.gross }} cls="font-semibold" /></ul></div>
        <div><p className="label"><Term>Deductions</Term></p><ul className="divide-y divide-slate-100">{slip.deductions.map((l, i) => <Row key={i} l={l} />)}<Row l={{ name: 'Total deductions', amount: slip.totalDeductions }} cls="font-semibold" /></ul></div>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3"><span className="font-semibold text-brand-900">Net pay</span><span className="text-2xl font-semibold text-brand-900">{fmtMoney(slip.net)}</span></div>
      <div><p className="label"><Term>Paid by the hospital on top</Term></p><ul className="divide-y divide-slate-100">{slip.employerContributions.map((l, i) => <Row key={i} l={l} />)}</ul></div>
      {slip.notes?.length > 0 && <p className="text-xs text-slate-500">{slip.notes.join(' · ')}</p>}
    </div>
  );
}

function SlipModal({ slip, editable, onClose, onSaved }) {
  const [adjustments, setAdjustments] = useState(slip.adjustments?.length ? slip.adjustments : []);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.put(`/payroll/payslips/${slip._id}/adjustments`, { adjustments }); toast.success('Adjustment saved and payroll recalculated'); onSaved(); } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${slip.employee.name} · ${periodLabel(slip.period)}`} size="lg"
      footer={<><Button variant="secondary" onClick={async () => downloadPayslipPdf((await api.get(`/payroll/payslips/${slip._id}`)).data)}><FileDown className="h-4 w-4" /> PDF</Button>{editable && <Button loading={busy} onClick={save}>Save adjustments</Button>}</>}>
      <PayslipBreakdown slip={slip} />
      {editable && (
        <div className="mt-6 rounded-2xl border border-slate-200 p-4">
          <p className="font-semibold">One-off adjustments</p>
          <p className="mb-3 text-sm text-slate-500">Positive amounts are added to pay (and taxed); negative amounts are deducted after tax.</p>
          <ul className="space-y-2">{adjustments.map((a, i) => (
            <li key={i} className="grid grid-cols-[1fr_9rem_auto] gap-2">
              <input className="input" aria-label="What for" placeholder="e.g. Night shift bonus" value={a.name} onChange={(e) => setAdjustments(adjustments.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <MoneyInput allowNegative className="input" aria-label="Amount" value={a.amount} onChange={(e) => setAdjustments(adjustments.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} />
              <IconButton icon={Trash2} tone="danger" label="Remove" onClick={() => setAdjustments(adjustments.filter((_, j) => j !== i))} />
            </li>
          ))}</ul>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => setAdjustments([...adjustments, { name: '', amount: 0 }])}><Plus className="h-4 w-4" /> Add adjustment</Button>
        </div>
      )}
    </Modal>
  );
}

export default function PayrollRun() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, reload } = useFetch(`/payroll/runs/${id}`);
  const ask = useConfirm();
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState('');
  if (loading && !data) return <Spinner />;
  if (!data) return <Empty title="Payroll run not found" />;
  const { run, payslips } = data;
  const t = run.totals;
  const draft = run.status === 'draft';

  const act = async (action, confirm, msg) => {
    if (confirm && !(await ask(confirm))) return;
    setBusy(action);
    try {
      if (action === 'delete') { await api.delete(`/payroll/runs/${id}`); toast.success('Draft deleted'); return navigate('/admin/payroll'); }
      await api.post(`/payroll/runs/${id}/${action}`); toast.success(msg); reload();
    } catch (e) { toastError(e); } finally { setBusy(''); }
  };
  const loans = (s) => s.deductions.filter((d) => d.kind === 'loan').reduce((a, d) => a + d.amount, 0);

  return (
    <div>
      <Link to="/admin/payroll" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Payroll</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><Badge color={{ draft: 'amber', approved: 'blue', paid: 'green' }[run.status]}>{titleCase(run.status)}</Badge>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{periodLabel(run.period)} payroll</h1>
          <p className="text-sm text-slate-500">{run.approvedAt ? `Approved ${fmtDateTime(run.approvedAt)}` : 'Draft: nothing has been paid or shared yet'}{run.paidAt && ` · paid ${fmtDateTime(run.paidAt)}`}</p></div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {draft && <>
            <Button variant="secondary" loading={busy === 'recalculate'} onClick={() => act('recalculate', null, 'Recalculated with the latest data')}><RefreshCw className="h-4 w-4" /> Recalculate</Button>
            <Button variant="ghost" onClick={() => act('delete', { title: 'Delete this draft?', confirmLabel: 'Delete', tone: 'danger' })}><Trash2 className="h-4 w-4" /> Delete</Button>
            <Button variant="success" loading={busy === 'approve'} onClick={() => act('approve', { title: `Approve ${periodLabel(run.period)} payroll?`, message: `${t.headcount} payslips totalling ${fmtMoney(t.net)} net are locked, loan repayments are recorded, and everyone is told their payslip is ready.`, confirmLabel: 'Approve payroll' }, 'Payroll approved; staff notified')}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
          </>}
          {run.status === 'approved' && <>
            <Button variant="ghost" onClick={() => act('reopen', { title: 'Reopen this payroll?', message: 'Payslips go back to draft and loan repayments for this month are reversed.', confirmLabel: 'Reopen' }, 'Reopened as draft')}><RotateCcw className="h-4 w-4" /> Reopen</Button>
            <Button onClick={() => act('paid', { title: 'Mark as paid?', message: 'Confirm the bank has paid everyone. This cannot be reopened afterwards.', confirmLabel: 'Mark paid' }, 'Marked as paid')}><Wallet className="h-4 w-4" /> Mark paid</Button>
          </>}
        </div>
      </div>

      <div className="mb-6"><MoneyFlow totals={t} /></div>

      <p className="mb-2 text-sm font-medium text-slate-600">Who receives the money taken from pay, and the hospital’s pension share</p>
      <div className="stagger mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[['PAYE tax', t.paye, 'Tax office'], ['Pension (staff)', t.pensionEmployee, 'Pension companies'], ['Pension (hospital)', t.pensionEmployer, 'Pension companies'], ['NHF', t.nhf, 'Federal Mortgage Bank'], ['Loan recoveries', t.loans, 'Back to the hospital']].map(([l, v, to]) => (
          <div key={l} className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500"><Term>{l}</Term></p><p className="mt-1 text-lg font-semibold">{fmtMoney(v)}</p><p className="text-xs text-slate-500">→ {to}</p></div>
        ))}
      </div>

      {run.warnings?.length > 0 && draft && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Check before approving</p>
          <ul className="list-disc pl-6">{run.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      {!draft && (
        <Card className="mb-6" title="Schedules">
          <div className="flex flex-wrap gap-2">
            {[['bank', 'Bank payment schedule'], ['pension', 'Pension remittance (PFAs)'], ['paye', 'PAYE remittance']].map(([k, l]) => (
              <Button key={k} variant="secondary" onClick={() => downloadCsv(api, `/payroll/runs/${id}/export/${k}`, `${k}-${run.period}.csv`).catch(toastError)}><Download className="h-4 w-4" /> {l}</Button>
            ))}
          </div>
        </Card>
      )}

      <Card title={`${payslips.length} payslips`} bodyClass="p-0">
        <div className="overflow-x-auto"><table className="table">
          <thead><tr><th><Term>Employee</Term></th><th><Term>Gross</Term></th><th><Term>PAYE</Term></th><th><Term>Pension</Term></th><th><Term>Loans</Term></th><th><Term>Net pay</Term></th><th /></tr></thead>
          <tbody>{payslips.map((s) => (
            <tr key={s._id} className="cursor-pointer" onClick={() => setOpen(s)}>
              <td><span className="flex items-center gap-2"><Avatar user={s.user} size="sm" /><span><span className="block font-medium">{s.employee.name}</span><span className="text-xs text-slate-500">{s.employee.department}{s.adjustments?.length ? ' · adjusted' : ''}{s.notes?.length ? ` · ${s.notes[0]}` : ''}</span></span></span></td>
              <td>{fmtMoney(s.gross)}</td><td>{fmtMoney(s.paye)}</td><td>{fmtMoney(s.deductions.find((d) => d.kind === 'pension')?.amount)}</td>
              <td>{loans(s) ? fmtMoney(loans(s)) : '—'}</td><td className="font-semibold">{fmtMoney(s.net)}</td>
              <td className="text-right"><span className="text-sm font-semibold text-brand-700">View</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {open && <SlipModal slip={open} editable={draft} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); reload(); }} />}
    </div>
  );
}
