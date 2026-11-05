import { useState } from 'react';
import { FileDown, HeartPulse, Plus, Trash2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import { Badge, Button, Card, Empty, IconButton, Modal, PageHeader, ProgressBar, Spinner } from '../../components/ui';
import { fmtDate, fmtMoney, periodLabel, titleCase } from '../../lib/format';
import { downloadPayslipPdf } from '../../lib/payslipPdf';
import { PayslipBreakdown } from '../admin/PayrollRun';
import { Term } from '../../components/InfoTip';

function EnrolModal({ plan, onClose, onDone }) {
  const [dependants, setDependants] = useState([]);
  const [busy, setBusy] = useState(false);
  const max = plan.coversDependants ? plan.maxDependants || 0 : 0;
  const submit = async () => {
    setBusy(true);
    try { await api.post(`/payroll/benefits/${plan._id}/enrol`, { dependants }); toast.success('Request sent to HR'); onDone(); } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  const monthly = plan.employeeCost + dependants.length * (plan.dependantCost || 0);
  return (
    <Modal open onClose={onClose} title={`Join ${plan.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Request to join</Button></>}>
      <p className="text-sm text-slate-600">{plan.description}</p>
      {max > 0 && (
        <div className="mt-4">
          <p className="label">Dependants (up to {max})</p>
          <ul className="space-y-2">{dependants.map((d, i) => (
            <li key={i} className="grid grid-cols-[1fr_8rem_auto] gap-2">
              <input className="input" aria-label="Name" placeholder="Full name" value={d.name} onChange={(e) => setDependants(dependants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <select className="input" aria-label="Relationship" value={d.relationship} onChange={(e) => setDependants(dependants.map((x, j) => (j === i ? { ...x, relationship: e.target.value } : x)))}>{['spouse', 'child', 'parent', 'other'].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select>
              <IconButton icon={Trash2} tone="danger" label="Remove" onClick={() => setDependants(dependants.filter((_, j) => j !== i))} />
            </li>
          ))}</ul>
          {dependants.length < max && <Button size="sm" variant="secondary" className="mt-2" onClick={() => setDependants([...dependants, { name: '', relationship: 'child' }])}><Plus className="h-4 w-4" /> Add dependant</Button>}
        </div>
      )}
      <p className="mt-4 rounded-2xl bg-brand-50 p-3 text-sm text-brand-900">You'll pay <b>{fmtMoney(monthly)}</b> a month from your salary{plan.employerCost ? <>; the hospital adds <b>{fmtMoney(plan.employerCost)}</b></> : ''}. HR confirms before it starts.</p>
    </Modal>
  );
}

export default function Pay() {
  const { data: pkg, loading } = useFetch('/payroll/my-package');
  const { data: slips } = useFetch('/payroll/my-payslips', { initial: [] });
  const { data: plans, reload: reloadPlans } = useFetch('/payroll/benefits', { initial: [] });
  const ask = useConfirm();
  const [viewing, setViewing] = useState(null);
  const [enrolling, setEnrolling] = useState(null);
  const open = async (id) => { try { setViewing((await api.get(`/payroll/payslips/${id}`)).data); } catch (e) { toastError(e); } };
  const pdf = async (id) => { try { await downloadPayslipPdf((await api.get(`/payroll/payslips/${id}`)).data); } catch (e) { toastError(e); } };
  const cancel = async (p) => {
    if (!(await ask({ title: `Leave ${p.name}?`, message: 'Deductions stop from the next payroll.', confirmLabel: 'Leave plan', tone: 'danger' }))) return;
    try { await api.post(`/payroll/benefits/enrollments/${p.enrollment._id}/cancel`, {}); toast.success('Left the plan'); reloadPlans(); } catch (e) { toastError(e); }
  };
  if (loading && !pkg) return <Spinner />;
  const c = pkg?.compensation;
  const est = pkg?.estimate;

  return (
    <div>
      <PageHeader title="My pay" subtitle="Your salary, payslips, loans and benefits." />
      {!c ? <Card className="mb-6"><Empty icon={Wallet} title="Your pay isn't set up yet">HR will add your salary details; payslips appear here after each payroll.</Empty></Card> : (
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="animate-fade-up rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-6 text-white shadow-sm lg:col-span-1 lg:self-start">
            <p className="text-sm text-brand-100"><Term>Estimated take-home this month</Term></p>
            <p className="mt-2 text-4xl font-semibold">{fmtMoney(est?.net)}</p>
            <p className="mt-1 text-sm text-brand-100">from {fmtMoney(est?.gross)} gross · final figure on your payslip</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-brand-100"><Term>Basic</Term></dt><dd className="font-semibold">{fmtMoney(c.basicSalary)}</dd></div>
              <div><dt className="text-brand-100"><Term>Tax (PAYE)</Term></dt><dd className="font-semibold">{fmtMoney(est?.paye)}</dd></div>
            </dl>
          </div>
          <Card title="This month's breakdown" className="lg:col-span-2">{est ? <PayslipBreakdown slip={est} /> : <Spinner />}</Card>
          <Card title="Pension & tax details" className="lg:col-span-3">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              {[['Pension administrator', c.pfa], ['RSA PIN', c.pensionPin], ['Tax ID (TIN)', c.taxId]].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500"><Term>{l}</Term></dt><dd className="font-medium">{v || <span className="text-amber-700">Not on file: tell HR</span>}</dd></div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Payslips" bodyClass="p-0">
          {slips.length === 0 ? <Empty title="No payslips yet">They appear once HR approves the month's payroll.</Empty> : (
            <ul className="stagger divide-y divide-slate-100">{slips.map((s) => (
              <li key={s._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <button className="min-w-40 flex-1 text-left" onClick={() => open(s._id)}><span className="block font-medium">{periodLabel(s.period)}</span><span className="text-xs text-slate-500">Gross {fmtMoney(s.gross)} · tax {fmtMoney(s.paye)}</span></button>
                <span className="font-semibold">{fmtMoney(s.net)}</span>
                <IconButton icon={FileDown} label={`Download ${periodLabel(s.period)} payslip`} onClick={() => pdf(s._id)} />
              </li>
            ))}</ul>
          )}
        </Card>

        <Card title="Loans & advances">
          {!pkg?.loans?.length ? <p className="text-sm text-slate-500"><Term>No approved loans.</Term></p> : (
            <ul className="space-y-4">{pkg.loans.map((l) => {
              const pct = l.amount ? Math.min(100, Math.round(((l.repaidAmount || 0) / l.amount) * 100)) : 0;
              return (
                <li key={l._id}>
                  <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{l.subject || titleCase(l.type)}</span>{l.fullyRepaid ? <Badge color="green">Repaid</Badge> : <span className="text-slate-500">{fmtMoney(l.amount - (l.repaidAmount || 0))} left</span>}</div>
                  <div className="mt-2"><ProgressBar value={pct} tone="bg-brand-600" /></div>
                  <p className="mt-1 text-xs text-slate-500">{fmtMoney(l.repaidAmount || 0)} of {fmtMoney(l.amount)} · {l.repaymentMonths || 1} monthly instalment(s) from payroll · approved {fmtDate(l.reviewedAt)}</p>
                </li>
              );
            })}</ul>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-lg font-semibold"><HeartPulse className="h-5 w-5 text-brand-700" /> Benefits</h2>
      {plans.length === 0 ? <Card><Empty title="No benefit plans available" /></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{plans.map((p) => (
          <Card key={p._id}>
            <div className="flex items-start justify-between gap-2"><Badge color="teal">{titleCase(p.type)}</Badge>
              {p.enrollment && <Badge color={p.enrollment.status === 'active' ? 'green' : 'amber'}>{p.enrollment.status === 'active' ? 'Enrolled' : 'Waiting for HR'}</Badge>}</div>
            <h3 className="mt-2 font-semibold">{p.name}</h3><p className="text-xs text-slate-500">{p.provider}</p>
            <p className="mt-2 text-sm text-slate-600">{p.description}</p>
            <p className="mt-3 text-sm">You pay <b>{fmtMoney(p.employeeCost)}</b>/mo{p.employerCost ? <> · hospital pays <b>{fmtMoney(p.employerCost)}</b></> : ''}</p>
            <div className="mt-4">{p.enrollment
              ? (!p.autoEnrol && <Button size="sm" variant="ghost" onClick={() => cancel(p)}>{p.enrollment.status === 'active' ? 'Leave plan' : 'Withdraw request'}</Button>)
              : <Button size="sm" onClick={() => setEnrolling(p)}>Join</Button>}</div>
          </Card>
        ))}</div>
      )}

      {viewing && <Modal open onClose={() => setViewing(null)} title={`Payslip · ${periodLabel(viewing.period)}`} size="lg"
        footer={<Button onClick={() => downloadPayslipPdf(viewing)}><FileDown className="h-4 w-4" /> Download PDF</Button>}><PayslipBreakdown slip={viewing} /></Modal>}
      {enrolling && <EnrolModal plan={enrolling} onClose={() => setEnrolling(null)} onDone={() => { setEnrolling(null); reloadPlans(); }} />}
    </div>
  );
}
