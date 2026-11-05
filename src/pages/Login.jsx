import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MailCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Field, PasswordInput } from '../components/ui';
import api, { errMsg } from '../lib/api';

export default function Login() {
  const { user, login, codeLogin } = useAuth();
  const [params] = useSearchParams();
  // 'password' | 'code' (one-time code from HR) | 'forgot' (email a reset link)
  const [mode, setMode] = useState(params.get('code') ? 'code' : params.get('forgot') ? 'forgot' : 'password');
  const [codeForm, setCodeForm] = useState({ identifier: '', code: '' });
  const [sentTo, setSentTo] = useState('');
  const navigate = useNavigate();
  const from = useLocation().state?.from;
  const target = (u) => (from ? `${from.pathname}${from.search}` : u.role === 'admin' ? '/admin' : '/');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={target(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'forgot') {
        await api.post('/auth/forgot', { email: form.email }, { anonymous: true });
        return setSentTo(form.email);
      }
      const u = mode === 'code' ? await codeLogin(codeForm.identifier, codeForm.code) : await login(form.email, form.password);
      navigate(target(u), { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <svg viewBox="0 0 32 32" className="h-6 w-6"><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" /></svg>
          </div>
          <span className="text-xl font-bold">Solucio Hospital</span>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">People, shifts and<br />compliance in one place.</h1>
          <p className="mt-4 max-w-md text-brand-100">
            Check in for your shift, view your roster, keep your certificates current, and apply for leave from one portal.
          </p>
        </div>
        <p className="relative text-sm text-brand-200">© {new Date().getFullYear()} Solucio Hospital · Human Resources</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {mode === 'forgot' ? (
            <>
              <button type="button" onClick={() => { setMode('password'); setSentTo(''); setError(''); }} className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Back to sign in</button>
              <h2 className="text-2xl font-bold text-slate-900">Forgot your password?</h2>
              {sentTo ? (
                <div className="mt-6 animate-fade-up rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
                  <MailCheck className="mb-2 h-6 w-6" />
                  If <b>{sentTo}</b> belongs to a staff account, we've emailed a link to choose a new password. It works for one hour.
                  <p className="mt-2 text-brand-800">No email? Go to HR: they can give you a one-time sign-in code.</p>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-slate-500">Enter your work email and we'll send you a link to choose a new one.</p>
                  <form onSubmit={submit} className="mt-8 space-y-4">
                    <Field label="Email"><input className="input" type="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                    {error && <p key={error} role="alert" className="animate-shake rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                    <Button className="w-full" size="lg" loading={busy}>Email me a link</Button>
                  </form>
                  <p className="mt-4 text-center text-sm text-slate-500">No phone or email access? Go to HR for a one-time sign-in code.</p>
                </>
              )}
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
              <div role="tablist" aria-label="How to sign in" className="mt-6 grid grid-cols-2 rounded-full bg-slate-100 p-1 text-sm font-semibold">
                {[['password', 'Password'], ['code', 'Code from HR']].map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setError(''); }}
                    className={`min-h-10 rounded-full transition ${mode === k ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
                ))}
              </div>
              <form onSubmit={submit} className="mt-6 space-y-4">
                {mode === 'password' ? <>
                  <Field label="Email">
                    <input className="input" type="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </Field>
                  <Field label="Password">
                    <PasswordInput required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </Field>
                  <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="-mt-1 text-sm font-semibold text-brand-700 hover:underline">Forgot password?</button>
                </> : <>
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No phone, or can't get into your account? HR can give you a one-time code at the desk.</p>
                  <Field label="Staff ID or email">
                    <input className="input" required autoFocus autoComplete="username" placeholder="e.g. SOL-0004-ABC" value={codeForm.identifier} onChange={(e) => setCodeForm({ ...codeForm, identifier: e.target.value })} />
                  </Field>
                  <Field label="Code from HR">
                    <input className="input font-mono text-lg uppercase tracking-[0.2em]" required autoComplete="one-time-code" placeholder="XXXX-XXXX" maxLength={9} value={codeForm.code} onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase() })} />
                  </Field>
                </>}
                {error && <p key={error} role="alert" className="animate-shake rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                <Button className="w-full" size="lg" loading={busy}>Sign in</Button>
              </form>
            </>
          )}
          <Link to="/track" className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-brand-700">
            <ShieldCheck className="h-4 w-4" /> Check an anonymous report with your tracking code
          </Link>
          <Link to="/careers" className="mt-2 flex min-h-10 items-center justify-center gap-2 text-sm text-slate-500 hover:text-brand-700">Looking for a job? See our open roles</Link>
        </div>
      </div>
    </div>
  );
}
