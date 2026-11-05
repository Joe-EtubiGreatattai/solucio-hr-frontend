import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { Badge, Button, Card } from '../components/ui';
import { fmtDateTime, titleCase } from '../lib/format';
import { Term } from '../components/InfoTip';

export function TrackForm() {
  const [code, setCode] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lookup = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setReport(null);
    try {
      const { data } = await api.get(`/anonymous/track/${encodeURIComponent(code)}`, { anonymous: true });
      setReport(data);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <form onSubmit={lookup} className="flex gap-2">
        <label className="sr-only" htmlFor="tracking-code">Tracking code</label>
        <input id="tracking-code" className="input font-mono uppercase" placeholder="e.g. 4F9A2C81B0" value={code} onChange={(e) => setCode(e.target.value)} required />
        <Button loading={busy}><Search className="h-4 w-4" /> Check</Button>
      </form>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      {report && (
        <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{report.title}</span>
            <Badge status={report.status} />
          </div>
          <p className="text-slate-500">{titleCase(report.category)} · submitted {fmtDateTime(report.createdAt)}</p>
          <div className="border-t border-slate-200 pt-2">
            <p className="label"><Term>Response from management</Term></p>
            <p className="whitespace-pre-wrap text-slate-700">{report.response || 'No response yet. Check back later.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackReport() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <Link to="/login" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
        <Card title="Track an anonymous report">
          <p className="mb-4 text-sm text-slate-500">Enter the code you received when you submitted your report.</p>
          <TrackForm />
        </Card>
      </div>
    </div>
  );
}
