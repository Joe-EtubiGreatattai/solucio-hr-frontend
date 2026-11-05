import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Search } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { Button, Field } from '../../components/ui';
import { fmtDate, fmtDateTime, titleCase } from '../../lib/format';

const STEPS = ['applied', 'screening', 'interview', 'offer', 'hired'];

export default function CareerStatus() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lookup = async (e, value = code) => {
    e?.preventDefault();
    setBusy(true); setError(''); setResult(null);
    try { setResult((await api.get(`/careers/status/${encodeURIComponent(value.trim())}`, { anonymous: true })).data); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  useEffect(() => { if (params.get('code')) lookup(null, params.get('code')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stepIndex = result ? STEPS.indexOf(result.stage) : -1;
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold tracking-tight">Check your application</h1>
      <p className="mt-1 text-slate-600">Enter the reference you received when you applied.</p>
      <form onSubmit={lookup} className="card mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <Field label="Reference" className="flex-1"><input className="input font-mono uppercase tracking-widest" required value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Button loading={busy}><Search className="h-4 w-4" /> Check</Button>
      </form>
      {error && <p key={error} role="alert" className="mt-4 animate-shake rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {result && (
        <div className="card mt-4 animate-fade-up p-6">
          <p className="text-sm text-slate-500">Hi {result.name}, your application for</p>
          <p className="text-xl font-semibold">{result.job}</p>
          <p className="mt-1 text-sm text-slate-500">Applied {fmtDate(result.appliedAt)}</p>
          <p className="mt-4 inline-block rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-800">{result.status}</p>
          {stepIndex >= 0 && (
            <ol className="mt-6 grid grid-cols-5 gap-1" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li key={s} className="text-center">
                  <span className={`mx-auto block h-2 rounded-full ${i <= stepIndex ? 'bg-brand-600' : 'bg-slate-200'}`} />
                  <span className={`mt-1 block text-xs ${i === stepIndex ? 'font-semibold text-brand-800' : 'text-slate-500'}`}>{titleCase(s)}</span>
                </li>
              ))}
            </ol>
          )}
          {result.interview && (
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
              Interview {fmtDateTime(result.interview.scheduledAt)} · {titleCase(result.interview.mode)}{result.interview.location && ` · ${result.interview.location}`}</p>
          )}
        </div>
      )}
    </div>
  );
}
