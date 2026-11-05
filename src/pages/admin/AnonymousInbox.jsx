import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, Field, PageHeader, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fmtDateTime, titleCase } from '../../lib/format';

const CASE_CATEGORY = { misconduct: 'conduct', suggestion: 'other' };

export default function AnonymousInbox() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const { data: reports, loading, reload } = useFetch('/anonymous', { params: status ? { status } : {}, initial: [] });
  const [sel, setSel] = useState(null);

  const save = async () => {
    try {
      await api.put(`/anonymous/${sel._id}`, { status: sel.status, adminNotes: sel.adminNotes, response: sel.response });
      toast.success('Report updated');
      reload();
    } catch (e) { toastError(e); }
  };

  return (
    <div>
      <PageHeader title="Anonymous reports" subtitle="Reports carry no identity. Reporters can see your response using their tracking code." />
      <Tabs value={status} onChange={setStatus} tabs={[
        { value: '', label: 'All' }, { value: 'new', label: 'New' }, { value: 'under_review', label: 'Under review' },
        { value: 'resolved', label: 'Resolved' }, { value: 'dismissed', label: 'Dismissed' },
      ]} />
      {loading ? <Spinner /> : reports.length === 0 ? <Card><Empty icon={ShieldAlert} title="No reports" /></Card> : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card bodyClass="p-0" className="lg:col-span-2">
            <ul className="stagger max-h-[75vh] divide-y divide-slate-100 overflow-y-auto">
              {reports.map((r) => (
                <li key={r._id}>
                  <button onClick={() => setSel({ ...r })} className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${sel?._id === r._id ? 'bg-brand-50' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">{r.title}</p><Badge status={r.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{titleCase(r.category)} · {fmtDate(r.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="lg:col-span-3">
            {!sel ? <Empty icon={ShieldAlert} title="Select a report" /> : (
              <div key={sel._id} className="animate-fade-up space-y-4">
                <div className="flex flex-wrap items-center gap-2"><Badge color="purple">{titleCase(sel.category)}</Badge><span className="font-mono text-xs text-slate-500">#{sel.trackingCode}</span></div>
                <h2 className="text-xl font-bold">{sel.title}</h2>
                <p className="text-sm text-slate-500">
                  Received {fmtDateTime(sel.createdAt)}{sel.incidentDate && ` · Incident date ${fmtDate(sel.incidentDate)}`}{sel.department && ` · ${sel.department}`}
                </p>
                <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-slate-700">{sel.body}</div>
                <div className="grid gap-4 border-t border-slate-100 pt-4">
                  <Field label="Status"><select className="input" value={sel.status} onChange={(e) => setSel({ ...sel, status: e.target.value })}>
                    {['new', 'under_review', 'resolved', 'dismissed'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                  </select></Field>
                  <Field label="Response to reporter" hint="Visible to whoever holds the tracking code."><textarea rows={3} className="input" value={sel.response || ''} onChange={(e) => setSel({ ...sel, response: e.target.value })} /></Field>
                  <Field label="Internal notes" hint="Visible to admins only."><textarea rows={3} className="input" value={sel.adminNotes || ''} onChange={(e) => setSel({ ...sel, adminNotes: e.target.value })} /></Field>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={() => navigate('/admin/relations', { state: { newCase: { fromAnonymous: sel._id, type: 'investigation', category: CASE_CATEGORY[sel.category] || sel.category, severity: ['harassment', 'safety', 'patient_care', 'fraud'].includes(sel.category) ? 'high' : 'medium', title: sel.title, description: sel.body } } })}>
                      <Scale className="h-4 w-4" /> Open formal case</Button>
                    <Button onClick={save}>Save</Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
