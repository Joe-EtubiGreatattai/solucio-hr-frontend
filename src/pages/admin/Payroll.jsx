import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Banknote, Pencil, Plus, Scale, Trash2, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import MoneyFlow from '../../components/MoneyFlow';
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fmtMoney, fullName, periodLabel, titleCase, ymd } from '../../lib/format';
import { Term } from '../../components/InfoTip';
import MoneyInput from '../../components/MoneyInput';

const RUN_COLOR = { draft: 'amber', approved: 'blue', paid: 'green' };
const idOf = (v) => (v && typeof v === 'object' ? v._id : v || '');

function Runs() {
  const navigate = useNavigate();
  const { data: runs, loading, reload } = useFetch('/payroll/runs', { initial: [] });
  const [period, setPeriod] = useState(ymd().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try { const { data } = await api.post('/payroll/runs', { period }); toast.success(`${periodLabel(period)} payroll calculated`); navigate(`/admin/payroll/runs/${data._id}`); }
    catch (e) { toastError(e); reload(); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-6">
      <Card title="Run payroll">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Month"><input type="month" className="input w-full sm:w-52" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
          <Button loading={busy} onClick={create}><Banknote className="h-4 w-4" /> Calculate payroll</Button>
          <p className="text-sm text-slate-500"><Term>Uses everyone's pay, attendance (overtime), unpaid leave, loans and benefits. Nothing is final until you approve it.</Term></p>
        </div>
      </Card>
      {loading ? <Spinner /> : runs.length === 0 ? <Card><Empty title="No payroll runs yet" /></Card> : (
        <Card bodyClass="p-0"><div className="overflow-x-auto"><table className="table">
          <thead><tr><th><Term>Month</Term></th><th><Term>Staff</Term></th><th><Term>Gross</Term></th><th><Term>Net pay</Term></th><th><Term>PAYE</Term></th><th><Term>Employer cost</Term></th><th><Term>Status</Term></th><th /></tr></thead>
          <tbody>{runs.map((r) => (
            <tr key={r._id}>
              <td className="font-semibold">{periodLabel(r.period)}</td><td>{r.totals?.headcount}</td>
              <td>{fmtMoney(r.totals?.gross)}</td><td className="font-semibold">{fmtMoney(r.totals?.net)}</td><td>{fmtMoney(r.totals?.paye)}</td><td>{fmtMoney(r.totals?.employerCost)}</td>
              <td><Badge color={RUN_COLOR[r.status]}>{titleCase(r.status)}</Badge>{r.warnings?.length > 0 && r.status === 'draft' && <Badge color="red">{`${r.warnings.length} warnings`}</Badge>}</td>
              <td className="text-right"><Link to={`/admin/payroll/runs/${r._id}`} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-700 hover:underline">Open</Link></td>
            </tr>
          ))}</tbody>
        </table></div></Card>
      )}
    </div>
  );
}

function CompensationEditor({ userId, onClose, onSaved }) {
  const { data, loading } = useFetch(`/payroll/compensation/${userId}`);
  const { data: grades } = useFetch('/org/grades', { initial: [] });
  const [f, setF] = useState(null);
  if (loading || !data) return <Modal open onClose={onClose} title="Pay"><Spinner /></Modal>;
  const c = data.compensation;
  const form = f || { basicSalary: c?.basicSalary || data.user.grade?.minSalary || '', grade: idOf(data.user.grade), allowances: c?.allowances || data.user.grade?.allowances || [],
    recurringDeductions: c?.recurringDeductions || [], annualRent: c?.annualRent || '', taxId: c?.taxId || '', pfa: c?.pfa || '', pensionPin: c?.pensionPin || '', nhfNumber: c?.nhfNumber || '',
    payOvertime: c?.payOvertime ?? true, reason: c ? 'adjustment' : 'hire', effectiveDate: ymd(), notes: '' };
  const set = (k, v) => setF({ ...form, [k]: v });
  const grade = grades.find((g) => g._id === form.grade);
  const save = async (e) => { e.preventDefault(); try { await api.put(`/payroll/compensation/${userId}`, form); toast.success('Pay saved'); onSaved(); } catch (err) { toastError(err); } };
  return (
    <Modal open onClose={onClose} title={`Pay · ${fullName(data.user)}`} size="xl" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="comp-form">Save</Button></>}>
      <form id="comp-form" onSubmit={save} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Grade"><select className="input" value={form.grade} onChange={(e) => { const g = grades.find((x) => x._id === e.target.value); setF({ ...form, grade: e.target.value, allowances: g?.allowances || form.allowances }); }}><option value="">—</option>{grades.map((g) => <option key={g._id} value={g._id}>{g.code} · {g.name}</option>)}</select></Field>
            <Field label="Monthly basic (₦)" hint={grade ? `${grade.code} band ${fmtMoney(grade.minSalary)}–${fmtMoney(grade.maxSalary)}` : undefined}>
              <MoneyInput min="0" required className="input" value={form.basicSalary} onChange={(e) => set('basicSalary', Number(e.target.value))} /></Field>
          </div>
          {grade && form.basicSalary && (form.basicSalary < grade.minSalary || form.basicSalary > grade.maxSalary) && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Outside the {grade.code} band.</p>}
          <div><span className="label">Allowances (from the grade, adjustable)</span>
            <ul className="space-y-2">{form.allowances.map((a, i) => (
              <li key={i} className="grid grid-cols-[1fr_8rem_8rem_auto] items-center gap-2">
                <input className="input" aria-label="Allowance" value={a.name} onChange={(e) => set('allowances', form.allowances.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <select className="input" aria-label="Type" value={a.type} onChange={(e) => set('allowances', form.allowances.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}><option value="fixed">₦ fixed</option><option value="percent_of_basic">% basic</option></select>
                <MoneyInput className="input" aria-label="Amount" value={a.amount} onChange={(e) => set('allowances', form.allowances.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} />
                <IconButton icon={Trash2} tone="danger" label="Remove" onClick={() => set('allowances', form.allowances.filter((_, j) => j !== i))} />
              </li>
            ))}</ul>
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => set('allowances', [...form.allowances, { name: '', type: 'fixed', amount: 0, taxable: true, pensionable: false }])}><Plus className="h-4 w-4" /> Allowance</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Pension administrator (PFA)"><input className="input" value={form.pfa} onChange={(e) => set('pfa', e.target.value)} /></Field>
            <Field label="RSA PIN"><input className="input" value={form.pensionPin} onChange={(e) => set('pensionPin', e.target.value)} /></Field>
            <Field label="Tax ID (TIN)"><input className="input" value={form.taxId} onChange={(e) => set('taxId', e.target.value)} /></Field>
            <Field label="Annual rent declared (₦)" hint="For rent relief"><MoneyInput className="input" value={form.annualRent} onChange={(e) => set('annualRent', Number(e.target.value))} /></Field>
          </div>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={form.payOvertime} onChange={(e) => set('payOvertime', e.target.checked)} /> Pay overtime from attendance</label>
          {c && <div className="grid grid-cols-1 gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
            <p className="label sm:col-span-3">If basic or grade changes</p>
            <Field label="Reason"><select className="input" value={form.reason} onChange={(e) => set('reason', e.target.value)}>{['adjustment', 'promotion', 'annual_review', 'cost_of_living', 'correction'].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select></Field>
            <Field label="Effective"><input type="date" className="input" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} /></Field>
            <Field label="Note"><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          </div>}
        </div>
        <div>
          <p className="label"><Term>Pay history</Term></p>
          {data.history.length === 0 ? <p className="text-sm text-slate-500"><Term>None yet.</Term></p> : (
            <ol className="relative space-y-3 border-l-2 border-slate-200 pl-4">{data.history.map((h) => (
              <li key={h._id} className="relative text-sm"><span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600" />
                <b>{fmtMoney(h.toBasic)}</b>{h.fromBasic ? <span className="text-slate-500"> from {fmtMoney(h.fromBasic)} ({h.fromBasic ? `${Math.round(((h.toBasic - h.fromBasic) / h.fromBasic) * 100)}%` : ''})</span> : ''}
                <span className="block text-xs text-slate-500">{titleCase(h.reason)} · {fmtDate(h.effectiveDate)}{h.notes && ` · ${h.notes}`}</span></li>
            ))}</ol>
          )}
        </div>
      </form>
    </Modal>
  );
}

function Compensation() {
  const { data: rows, loading, reload } = useFetch('/payroll/compensation', { initial: [] });
  const [editing, setEditing] = useState(null);
  const missing = rows.filter((r) => !r.compensation).length;
  return (
    <>
      {missing > 0 && <p className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="h-4 w-4" />{missing} staff have no pay set up and won't be paid until you add it.</p>}
      <Card bodyClass="p-0">{loading ? <Spinner /> : (
        <div className="overflow-x-auto"><table className="table">
          <thead><tr><th><Term>Staff</Term></th><th><Term>Grade</Term></th><th><Term>Basic / month</Term></th><th><Term>Gross / month</Term></th><th><Term>Position in band</Term></th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.user._id}>
              <td><span className="flex items-center gap-2"><Avatar user={r.user} size="sm" /><span><span className="block font-medium">{fullName(r.user)}</span><span className="text-xs text-slate-500">{r.user.jobTitle}</span></span></span></td>
              <td>{r.user.grade?.code || '—'}</td>
              <td>{r.compensation ? fmtMoney(r.compensation.basicSalary) : <Badge color="amber">Not set</Badge>}</td>
              <td>{r.monthlyGross ? fmtMoney(r.monthlyGross) : '—'}</td>
              <td>{r.compaRatio != null ? <span className={r.outOfBand ? 'font-semibold text-rose-600' : r.compaRatio < 90 ? 'text-amber-700' : 'text-slate-700'} title="Basic as % of the grade midpoint">{r.compaRatio}% of midpoint{r.outOfBand && ' · outside band'}</span> : '—'}</td>
              <td className="text-right"><IconButton icon={Pencil} label={`Edit pay for ${fullName(r.user)}`} onClick={() => setEditing(r.user._id)} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}</Card>
      {editing && <CompensationEditor userId={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function Raises() {
  const { data: rows, loading, reload } = useFetch('/payroll/pending-raises', { initial: [] });
  const ask = useConfirm();
  const apply = async (r) => {
    if (!(await ask({ title: `Apply ${r.review.raisePercent || 0}% for ${r.review.user.firstName}?`, message: `Basic goes from ${fmtMoney(r.currentBasic)} to ${fmtMoney(r.proposedBasic)} from today, and they're notified.`, confirmLabel: 'Apply raise' }))) return;
    try { await api.post(`/payroll/apply-raise/${r.review._id}`, {}); toast.success('Raise applied'); reload(); } catch (e) { toastError(e); }
  };
  return (
    <Card title="Raises & promotions from performance reviews" bodyClass="p-0">
      {loading ? <Spinner /> : rows.length === 0 ? <Empty icon={TrendingUp} title="Nothing waiting">Finalised reviews recommending a raise or promotion appear here.</Empty> : (
        <ul className="divide-y divide-slate-100">{rows.map((r) => (
          <li key={r.review._id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <Avatar user={r.review.user} size="sm" />
            <span className="min-w-48 flex-1"><span className="block font-medium">{fullName(r.review.user)}</span><span className="text-xs text-slate-500">{r.review.cycle?.name} · rated {r.review.finalRating}/5 · {titleCase(r.review.finalOutcome)} {r.review.raisePercent}%</span></span>
            <span className="text-sm">{r.currentBasic != null ? <>{fmtMoney(r.currentBasic)} → <b>{fmtMoney(r.proposedBasic)}</b></> : <Badge color="amber">No pay record</Badge>}</span>
            <Button size="sm" disabled={r.currentBasic == null} onClick={() => apply(r)}>Apply</Button>
          </li>
        ))}</ul>
      )}
    </Card>
  );
}

function Benefits() {
  const { data: plans, reload } = useFetch('/payroll/benefit-plans', { initial: [] });
  const { data: enrolments, reload: reloadE } = useFetch('/payroll/benefit-enrollments', { params: { status: 'pending' }, initial: [] });
  const [editing, setEditing] = useState(null);
  const decide = async (e, status) => { try { await api.put(`/payroll/benefit-enrollments/${e._id}`, { status }); toast.success(status === 'active' ? 'Enrolment confirmed' : 'Declined'); reloadE(); reload(); } catch (err) { toastError(err); } };
  const save = async (ev) => {
    ev.preventDefault();
    try { const { data } = editing._id ? await api.put(`/payroll/benefit-plans/${editing._id}`, editing) : await api.post('/payroll/benefit-plans', editing); toast.success(data.autoEnrolled ? `Saved; ${data.autoEnrolled} staff enrolled` : 'Plan saved'); setEditing(null); reload(); } catch (err) { toastError(err); }
  };
  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value });
  return (
    <div className="space-y-6">
      {enrolments.length > 0 && (
        <Card title={`Enrolments to approve (${enrolments.length})`} bodyClass="p-0"><ul className="divide-y divide-slate-100">{enrolments.map((e) => (
          <li key={e._id} className="flex flex-wrap items-center gap-3 px-5 py-3"><Avatar user={e.user} size="sm" /><span className="flex-1"><b>{fullName(e.user)}</b> → {e.plan.name}{e.dependants?.length ? ` with ${e.dependants.length} dependant(s)` : ''}</span>
            <Button size="sm" variant="secondary" onClick={() => decide(e, 'declined')}>Decline</Button><Button size="sm" onClick={() => decide(e, 'active')}>Approve</Button></li>
        ))}</ul></Card>
      )}
      <div className="flex justify-end"><Button onClick={() => setEditing({ name: '', type: 'health', provider: '', description: '', employeeCost: 0, employerCost: 0, dependantCost: 0, coversDependants: false, maxDependants: 0, autoEnrol: false, status: 'active' })}><Plus className="h-4 w-4" /> New plan</Button></div>
      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{plans.map((p) => (
        <Card key={p._id}>
          <div className="flex items-start justify-between gap-2"><div><Badge color="teal">{titleCase(p.type)}</Badge><h3 className="mt-2 font-semibold">{p.name}</h3><p className="text-xs text-slate-500">{p.provider}</p></div><IconButton icon={Pencil} label={`Edit ${p.name}`} onClick={() => setEditing(p)} /></div>
          <p className="mt-2 text-sm text-slate-600">{p.description}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-slate-50 p-2"><dt className="text-xs text-slate-500"><Term>Staff pays</Term></dt><dd className="font-semibold">{fmtMoney(p.employeeCost)}/mo</dd></div>
            <div className="rounded-xl bg-slate-50 p-2"><dt className="text-xs text-slate-500"><Term>Hospital pays</Term></dt><dd className="font-semibold">{fmtMoney(p.employerCost)}/mo</dd></div>
          </dl>
          <p className="mt-3 text-sm"><b>{p.enrolled}</b> enrolled{p.dependants ? ` · ${p.dependants} dependants` : ''} · costs the hospital <b>{fmtMoney(p.monthlyEmployerCost)}</b>/month</p>
        </Card>
      ))}</div>
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing._id ? `Edit ${editing.name}` : 'New benefit plan'} footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button form="plan-form">Save</Button></>}>
          <form id="plan-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2"><input className="input" required value={editing.name} onChange={set('name')} /></Field>
            <Field label="Type"><select className="input" value={editing.type} onChange={set('type')}>{['health', 'life_insurance', 'pension_voluntary', 'meal', 'transport', 'housing', 'education', 'wellness', 'other'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></Field>
            <Field label="Provider"><input className="input" value={editing.provider || ''} onChange={set('provider')} /></Field>
            <Field label="Staff pays (₦/month)"><MoneyInput min="0" className="input" value={editing.employeeCost} onChange={set('employeeCost')} /></Field>
            <Field label="Hospital pays (₦/month)"><MoneyInput min="0" className="input" value={editing.employerCost} onChange={set('employerCost')} /></Field>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={editing.coversDependants} onChange={set('coversDependants')} /> Covers dependants</label>
            {editing.coversDependants && <><Field label="Per dependant (₦/month, staff pays)"><MoneyInput min="0" className="input" value={editing.dependantCost} onChange={set('dependantCost')} /></Field>
              <Field label="Max dependants"><input type="number" min="0" className="input" value={editing.maxDependants} onChange={set('maxDependants')} /></Field></>}
            <label className="flex items-center gap-3 text-sm sm:col-span-2"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={editing.autoEnrol} onChange={set('autoEnrol')} /> Enrol everyone automatically (e.g. employer-paid cover)</label>
            <Field label="Description" className="sm:col-span-2"><textarea rows={3} className="input" value={editing.description || ''} onChange={set('description')} /></Field>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Equity() {
  const { data: rows, loading } = useFetch('/payroll/equity', { initial: [] });
  return (
    <Card title={<span className="flex items-center gap-2"><Scale className="h-4 w-4" /> Pay by grade</span>} bodyClass="p-0">
      {loading ? <Spinner /> : rows.length === 0 ? <Empty title="No pay data yet" /> : (
        <div className="overflow-x-auto"><table className="table">
          <thead><tr><th><Term>Grade</Term></th><th><Term>Staff</Term></th><th><Term>Band</Term></th><th><Term>Lowest</Term></th><th><Term>Average</Term></th><th><Term>Highest</Term></th></tr></thead>
          <tbody>{rows.map((g) => (
            <tr key={g.grade}><td className="font-semibold">{g.grade}</td><td>{g.count}</td><td className="text-slate-500">{fmtMoney(g.band[0])}–{fmtMoney(g.band[1])}</td>
              <td>{fmtMoney(g.min)}</td><td className="font-medium">{fmtMoney(g.average)}</td><td>{fmtMoney(g.max)}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
  );
}

function Settings() {
  const { data, setData, loading } = useFetch('/payroll/settings', { live: false });
  const [busy, setBusy] = useState(false);
  if (loading || !data) return <Spinner />;
  const num = (k) => (e) => setData({ ...data, [k]: Number(e.target.value) });
  const setBand = (i, patch) => setData({ ...data, taxBands: data.taxBands.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const save = async (e) => { e.preventDefault(); setBusy(true); try { await api.put('/payroll/settings', data); toast.success('Payroll settings saved. Recalculate draft runs to use them'); } catch (err) { toastError(err); } finally { setBusy(false); } };
  return (
    <form onSubmit={save} className="space-y-6">
      <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>These defaults follow the Nigeria Tax Act 2025 (in force from January 2026), the Pension Reform Act 2014 and the NHF Act. <b>Have your accountant confirm them</b> before relying on payroll, and update them whenever the law changes.</span></p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Statutory rates">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pension: employee %"><input type="number" step="0.1" className="input" value={data.pensionEmployeeRate} onChange={num('pensionEmployeeRate')} /></Field>
            <Field label="Pension: employer %"><input type="number" step="0.1" className="input" value={data.pensionEmployerRate} onChange={num('pensionEmployerRate')} /></Field>
            <Field label="NHF % of basic"><input type="number" step="0.1" className="input" value={data.nhfRate} onChange={num('nhfRate')} /></Field>
            <label className="flex items-center gap-3 self-end pb-2.5 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={data.nhfEnabled} onChange={(e) => setData({ ...data, nhfEnabled: e.target.checked })} /> Deduct NHF</label>
            <Field label="NSITF (employer) %"><input type="number" step="0.1" className="input" value={data.nsitfEmployerRate} onChange={num('nsitfEmployerRate')} /></Field>
            <Field label="ITF (employer) %"><input type="number" step="0.1" className="input" value={data.itfEmployerRate} onChange={num('itfEmployerRate')} /></Field>
            <Field label="Rent relief % of rent"><input type="number" className="input" value={data.rentReliefRate} onChange={num('rentReliefRate')} /></Field>
            <Field label="Rent relief cap (₦/yr)"><MoneyInput className="input" value={data.rentReliefCap} onChange={num('rentReliefCap')} /></Field>
            <Field label="Overtime multiplier"><input type="number" step="0.1" className="input" value={data.overtimeMultiplier} onChange={num('overtimeMultiplier')} /></Field>
            <Field label="Standard weekly hours"><input type="number" className="input" value={data.standardWeeklyHours} onChange={num('standardWeeklyHours')} /></Field>
          </div>
        </Card>
        <Card title="PAYE tax bands (annual taxable income)">
          <ul className="space-y-2">{data.taxBands.map((b, i) => (
            <li key={i} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
              <Field label={i === 0 ? 'Up to (₦)' : `Next band up to (₦)`}><MoneyInput className="input" placeholder="No upper limit" value={b.upTo ?? ''} onChange={(e) => setBand(i, { upTo: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
              <Field label="Rate %"><input type="number" step="0.5" className="input" value={b.rate} onChange={(e) => setBand(i, { rate: Number(e.target.value) })} /></Field>
              <IconButton icon={Trash2} tone="danger" label="Remove band" onClick={() => setData({ ...data, taxBands: data.taxBands.filter((_, j) => j !== i) })} />
            </li>
          ))}</ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setData({ ...data, taxBands: [...data.taxBands, { upTo: null, rate: 0 }] })}><Plus className="h-4 w-4" /> Band</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setData({ ...data, ...data.defaults })}>Restore defaults</Button>
          </div>
        </Card>
      </div>
      <Button loading={busy}>Save settings</Button>
    </form>
  );
}

export default function Payroll() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'runs';
  const { data: runs } = useFetch('/payroll/runs', { initial: [] });
  const last = runs.find((r) => r.status !== 'draft');
  return (
    <div>
      <PageHeader title="Pay & benefits" subtitle="Salaries, monthly payroll with PAYE, pension and NHF, loans and staff benefits." />
      {last && (
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-slate-600">Last approved payroll: {periodLabel(last.period)} · {last.totals.headcount} staff</p>
          <MoneyFlow totals={last.totals} />
        </div>
      )}
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ value: 'runs', label: 'Payroll' }, { value: 'compensation', label: 'Compensation' }, { value: 'raises', label: 'Review raises' },
        { value: 'benefits', label: 'Benefits' }, { value: 'equity', label: 'Pay by grade' }, { value: 'settings', label: 'Settings' }]} />
      {tab === 'runs' && <Runs />}
      {tab === 'compensation' && <Compensation />}
      {tab === 'raises' && <Raises />}
      {tab === 'benefits' && <Benefits />}
      {tab === 'equity' && <Equity />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}
