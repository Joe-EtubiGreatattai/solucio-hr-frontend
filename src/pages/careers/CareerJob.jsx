import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, CalendarClock, Copy, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Button, Empty, Field, Spinner, SuccessCheck } from '../../components/ui';
import { fmtDate, fmtMoney } from '../../lib/format';
import { employmentLabel } from './Careers';
import { Term } from '../../components/InfoTip';

export default function CareerJob() {
  const { id } = useParams();
  const { data: job, loading } = useFetch(`/careers/jobs/${id}`, { live: false });
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', location: '', currentEmployer: '', yearsExperience: '', coverLetter: '' });
  const [cv, setCv] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (loading) return <Spinner />;
  if (!job) return <div className="card"><Empty title="This role is no longer open"><Link className="font-semibold text-brand-700" to="/careers">See all open roles</Link></Empty></div>;

  const apply = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (cv) fd.append('cv', cv);
      fd.append('consent', String(consent));
      const { data } = await api.post(`/careers/jobs/${id}/apply`, fd, { anonymous: true });
      setCode(data.trackingCode);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  if (code) return (
    <div className="card mx-auto max-w-lg animate-fade-up p-8 text-center">
      <SuccessCheck className="h-16 w-16" />
      <h1 className="mt-4 text-2xl font-semibold">Application sent</h1>
      <p className="mt-2 text-slate-600">Thank you for applying for <b>{job.title}</b>. Keep this reference to check your application's progress:</p>
      <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-white px-5 py-3">
        <span className="font-mono text-2xl font-bold tracking-widest">{code}</span>
        <button type="button" aria-label="Copy reference" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" onClick={() => { navigator.clipboard.writeText(code); toast.success('Copied'); }}><Copy className="h-5 w-5" /></button>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2"><Link to={`/careers/status?code=${code}`}><Button variant="secondary">Check status</Button></Link><Link to="/careers"><Button>More roles</Button></Link></div>
    </div>
  );

  return (
    <div>
      <Link to="/careers" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> All roles</Link>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <article className="card p-6 lg:col-span-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{job.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" />{job.department} · {employmentLabel(job.employmentType)}</span>
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>
            {job.closingDate && <span className="flex items-center gap-1"><CalendarClock className="h-4 w-4" />Closes {fmtDate(job.closingDate)}</span>}
          </div>
          {job.showSalary && job.salaryMin && <p className="mt-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">{fmtMoney(job.salaryMin)}–{fmtMoney(job.salaryMax)} per month</p>}
          {job.summary && <p className="mt-5 text-lg text-slate-700">{job.summary}</p>}
          {job.description && <p className="mt-4 whitespace-pre-wrap leading-relaxed text-slate-700">{job.description}</p>}
          {job.responsibilities?.length > 0 && <><h2 className="mt-6 font-semibold"><Term>What you'll do</Term></h2><ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">{job.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul></>}
          {job.requirements?.length > 0 && <><h2 className="mt-6 font-semibold"><Term>What you'll need</Term></h2><ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">{job.requirements.map((r) => <li key={r}>{r}</li>)}</ul></>}
        </article>

        <form onSubmit={apply} className="card h-fit space-y-4 p-6 lg:sticky lg:top-6 lg:col-span-2">
          <h2 className="text-lg font-semibold"><Term>Apply for this role</Term></h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name"><input className="input" required autoComplete="given-name" value={form.firstName} onChange={set('firstName')} /></Field>
            <Field label="Last name"><input className="input" required autoComplete="family-name" value={form.lastName} onChange={set('lastName')} /></Field>
          </div>
          <Field label="Email"><input type="email" className="input" required autoComplete="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="Phone"><input type="tel" className="input" autoComplete="tel" value={form.phone} onChange={set('phone')} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Years' experience"><input type="number" min="0" inputMode="numeric" className="input" value={form.yearsExperience} onChange={set('yearsExperience')} /></Field>
            <Field label="Location"><input className="input" value={form.location} onChange={set('location')} /></Field>
          </div>
          <Field label="Current employer"><input className="input" value={form.currentEmployer} onChange={set('currentEmployer')} /></Field>
          <Field label="CV (PDF or Word)"><input type="file" required accept=".pdf,.doc,.docx" className="input" onChange={(e) => setCv(e.target.files[0])} /></Field>
          <Field label="Why this role? (optional)"><textarea rows={4} className="input" value={form.coverLetter} onChange={set('coverLetter')} /></Field>
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I agree to Solucio Hospital processing my details to assess this application, in line with the Nigeria Data Protection Act 2023.</span>
          </label>
          {error && <p key={error} role="alert" className="animate-shake rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <Button className="w-full" size="lg" loading={busy} disabled={!consent}>Submit application</Button>
        </form>
      </div>
    </div>
  );
}
