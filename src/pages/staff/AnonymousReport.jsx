import { useState } from 'react';
import { Copy, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import { Button, Card, Field, PageHeader, SuccessCheck } from '../../components/ui';
import { TrackForm } from '../TrackReport';

const CATEGORIES = [
  ['harassment', 'Harassment or bullying'], ['discrimination', 'Discrimination'], ['safety', 'Health & safety'],
  ['patient_care', 'Patient care concern'], ['fraud', 'Fraud or theft'], ['misconduct', 'Misconduct'],
  ['suggestion', 'Suggestion'], ['other', 'Other'],
];

export default function AnonymousReport() {
  const [form, setForm] = useState({ category: 'safety', title: '', body: '', department: '', incidentDate: '' });
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      // `anonymous: true` stops the API client from attaching your login token.
      const { data } = await api.post('/anonymous', form, { anonymous: true });
      setCode(data.trackingCode);
      setForm({ category: 'safety', title: '', body: '', department: '', incidentDate: '' });
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Anonymous report" subtitle="Raise a concern without revealing who you are." />
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Reports are sent without your login details and the system does not store your name, account or IP address with them.
          Leave out details that could identify you, such as your name or a situation only you were in.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Submit a report" className="lg:col-span-2">
          {code ? (
            <div className="animate-fade-up py-6 text-center">
              <SuccessCheck />
              <p className="mt-3 text-lg font-semibold">Report submitted</p>
              <p className="mt-1 text-sm text-slate-500">Save this tracking code. It is the only way to see management's response, and it is not shown again.</p>
              <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-lg border-2 border-dashed border-brand-300 bg-white px-5 py-3">
                <span className="font-mono text-2xl font-bold tracking-widest">{code}</span>
                <button onClick={() => { navigator.clipboard.writeText(code); toast.success('Copied'); }} className="text-slate-500 hover:text-brand-700"><Copy className="h-5 w-5" /></button>
              </div>
              <Button variant="secondary" className="mt-6" onClick={() => setCode(null)}>Submit another</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select className="input" value={form.category} onChange={set('category')}>
                  {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="When did it happen? (optional)"><input type="date" className="input" value={form.incidentDate} onChange={set('incidentDate')} /></Field>
              <Field label="Department / location (optional)" className="sm:col-span-2"><input className="input" value={form.department} onChange={set('department')} /></Field>
              <Field label="Title" className="sm:col-span-2"><input className="input" required value={form.title} onChange={set('title')} /></Field>
              <Field label="What happened?" className="sm:col-span-2"><textarea rows={7} className="input" required value={form.body} onChange={set('body')} /></Field>
              <div className="sm:col-span-2 flex justify-end"><Button loading={busy}>Submit anonymously</Button></div>
            </form>
          )}
        </Card>
        <Card title="Check a previous report">
          <p className="mb-3 text-sm text-slate-500">Enter your tracking code to see its status and any response.</p>
          <TrackForm />
        </Card>
      </div>
    </div>
  );
}
