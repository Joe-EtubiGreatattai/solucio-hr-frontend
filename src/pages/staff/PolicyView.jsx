import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { openFile, toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, Spinner, SuccessCheck } from '../../components/ui';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { POLICY_CATEGORIES } from '../admin/AdminPolicies';

export default function PolicyView() {
  const { id } = useParams();
  const { data: p, loading, reload } = useFetch(`/policies/${id}`);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (loading && !p) return <Spinner />;
  if (!p) return <Empty title="Policy not found" />;

  const acknowledge = async () => {
    setBusy(true);
    try { await api.post(`/policies/${id}/acknowledge`); toast.success('Thanks, your acknowledgement is recorded'); reload(); }
    catch (e) { toastError(e); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/policies" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> All policies</Link>
      <Card>
        <div className="flex flex-wrap items-center gap-2"><Badge color="teal">{POLICY_CATEGORIES[p.category]}</Badge><Badge color="slate">Version {p.version}</Badge>
          {p.effectiveDate && <span className="text-xs text-slate-500">Effective {fmtDate(p.effectiveDate)}</span>}</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{p.title}</h1>
        {p.summary && <p className="mt-2 text-slate-600">{p.summary}</p>}
        {p.changeNote && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>What changed in this version:</b> {p.changeNote}</p>}
        {p.body && <div className="mt-6 whitespace-pre-wrap leading-relaxed text-slate-700">{p.body}</div>}
        {p.file?.path && <Button variant="secondary" className="mt-6" onClick={() => openFile(`/policies/${id}/file`)}><FileDown className="h-4 w-4" /> Open full document ({p.file.originalName})</Button>}
      </Card>

      {p.requiresAcknowledgement && (
        <Card className="mt-4">
          {p.acknowledged ? (
            <div className="flex animate-fade-up items-center gap-4"><SuccessCheck className="h-12 w-12 shrink-0" />
              <p><b>You've acknowledged version {p.version}.</b><br /><span className="text-sm text-slate-500">{fmtDateTime(p.acknowledgedAt)}</span></p></div>
          ) : (
            <div className="space-y-4">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-700" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>I have read and understood this policy and agree to follow it.</span>
              </label>
              <Button className="w-full sm:w-auto" disabled={!confirmed} loading={busy} onClick={acknowledge}>Confirm I've read it</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
