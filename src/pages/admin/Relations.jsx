import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Gavel, Plus, Scale, Timer } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner, StatCard, Tabs } from '../../components/ui';
import { fmtDate, fullName, titleCase } from '../../lib/format';
import { CASE_CATEGORIES, CASE_STATUS, CASE_TYPE_LABEL, OUTCOME_LABEL, SEVERITY_COLOR } from '../../lib/relations';
import { Term } from '../../components/InfoTip';

function NewCase({ prefill, onClose }) {
  const navigate = useNavigate();
  const { data: staff } = useFetch('/users/directory', { initial: [] });
  const [f, setF] = useState({ type: 'disciplinary', category: 'conduct', severity: 'medium', title: '', description: '', employee: '', against: [], ...prefill });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post('/relations', f); toast.success(`Case ${data.reference} opened`); navigate(`/admin/relations/${data._id}`); } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Open a case" size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="case-form" loading={busy}>Open case</Button></>}>
      <form id="case-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {prefill?.fromAnonymous && <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900 sm:col-span-2">From an anonymous report. The reporter will see that a formal investigation has started, but nothing that identifies anyone.</p>}
        {prefill?.fromNote && <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900 sm:col-span-2">From a staff report, which will be marked as actioned.</p>}
        <Field label="Type"><select className="input" value={f.type} onChange={set('type')}>{Object.entries(CASE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label={f.type === 'grievance' ? 'Raised by (employee)' : 'Employee concerned'} hint={f.type === 'investigation' ? 'Optional: leave blank for a general investigation' : undefined}>
          <select className="input" required={f.type !== 'investigation'} value={f.employee} onChange={set('employee')}><option value="">Choose…</option>{staff.map((s) => <option key={s._id} value={s._id}>{fullName(s)} · {s.department}</option>)}</select></Field>
        <Field label="Category"><select className="input" value={f.category} onChange={set('category')}>{CASE_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
        <Field label="Severity"><select className="input" value={f.severity} onChange={set('severity')}>{['low', 'medium', 'high', 'critical'].map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
        <Field label="Title" className="sm:col-span-2"><input className="input" required value={f.title} onChange={set('title')} /></Field>
        <Field label={f.type === 'disciplinary' ? 'The allegation (the employee will see this)' : 'Details'} className="sm:col-span-2"><textarea rows={5} className="input" required value={f.description} onChange={set('description')} /></Field>
        {f.type === 'disciplinary' && <p className="text-xs text-slate-500 sm:col-span-2">The employee is told a case has been opened and can respond with their own statement. Internal notes stay private.</p>}
      </form>
    </Modal>
  );
}

export default function Relations() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'active';
  const { data: cases, loading } = useFetch('/relations', { params: { status: tab === 'all' ? undefined : tab === 'closed' ? 'closed' : 'active' }, initial: [] });
  const { data: sum } = useFetch('/relations/summary', { initial: null });
  // Other pages (anonymous inbox, staff reports) open this form with a prefilled case in router state, not the URL.
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = location.state?.newCase || null;
  const [creating, setCreating] = useState(false);
  const closeNew = () => { setCreating(false); if (prefill) navigate(location.pathname + location.search, { replace: true, state: null }); };

  return (
    <div>
      <PageHeader title="Employee relations" subtitle="Grievances, disciplinary cases and investigations, handled fairly and on the record."
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Open a case</Button>} />
      {sum && (
        <div className="stagger mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Open cases" value={sum.open} icon={Scale} hint={`${sum.openByType.grievance} grievance · ${sum.openByType.disciplinary} disciplinary`} />
          <StatCard label="Overdue" value={sum.overdue} icon={AlertTriangle} tone={sum.overdue ? 'red' : 'green'} />
          <StatCard label="Appeals pending" value={sum.appeals} icon={Gavel} tone={sum.appeals ? 'amber' : 'brand'} />
          <StatCard label="Average days to close" value={sum.avgDaysToClose ?? '—'} icon={Timer} tone="blue" hint={`${sum.activeWarnings} live warning(s)`} />
        </div>
      )}
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }, { value: 'all', label: 'All' }]} />
      <Card bodyClass="p-0">
        {loading ? <Spinner /> : cases.length === 0 ? <Empty icon={Scale} title="No cases here" /> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th><Term>Case</Term></th><th><Term>Employee</Term></th><th><Term>Category</Term></th><th><Term>Status</Term></th><th><Term>Owner</Term></th><th><Term>Due</Term></th></tr></thead>
            <tbody>{cases.map((c) => (
              <tr key={c._id}>
                <td><Link to={`/admin/relations/${c._id}`} className="font-semibold text-brand-800 hover:underline">{c.title}</Link>
                  <span className="block text-xs text-slate-500">{c.reference} · {CASE_TYPE_LABEL[c.type]} · {c.ageDays}d old{c.source?.kind === 'anonymous' ? ' · from anonymous report' : ''}</span></td>
                <td>{c.employee ? <span className="flex items-center gap-2"><Avatar user={c.employee} size="sm" /><span>{fullName(c.employee)}<span className="block text-xs text-slate-500">{c.employee.department}</span></span></span> : <span className="text-slate-500">General</span>}</td>
                <td><span className="flex flex-wrap gap-1"><Badge color="slate">{titleCase(c.category)}</Badge><Badge color={SEVERITY_COLOR[c.severity]}>{titleCase(c.severity)}</Badge></span></td>
                <td><Badge color={CASE_STATUS[c.status][1]}>{CASE_STATUS[c.status][0]}</Badge>{c.outcome && <span className="mt-1 block text-xs text-slate-500">{OUTCOME_LABEL[c.outcome]}</span>}</td>
                <td>{c.assignedTo ? fullName(c.assignedTo) : '—'}</td>
                <td className={c.overdue ? 'font-semibold text-rose-600' : ''}>{c.status === 'closed' ? '—' : fmtDate(c.dueDate)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {(creating || prefill) && <NewCase prefill={prefill || undefined} onClose={closeNew} />}
    </div>
  );
}
