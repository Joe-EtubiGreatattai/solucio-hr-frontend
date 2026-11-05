import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { errMsg } from '../lib/api';
import { Button, Field, PasswordInput } from '../components/ui';

// Reached from the emailed "Choose a new password" link.
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { signInWith } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pw.password !== pw.confirm) return setError('The two passwords don’t match');
    setBusy(true); setError('');
    try {
      const u = signInWith((await api.post('/auth/reset', { token, password: pw.password }, { anonymous: true })).data);
      navigate(u.role === 'admin' ? '/admin' : '/', { replace: true });
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold">Choose a new password</h1>
        {!token ? <p className="mt-3 text-sm text-slate-600">This link is incomplete. <Link to="/login?forgot=1" className="font-semibold text-brand-700">Ask for a new one</Link>.</p> : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="New password" hint="At least 6 characters"><PasswordInput required minLength={6} autoFocus autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
            <Field label="Type it again"><PasswordInput required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
            {error && <p key={error} role="alert" className="animate-shake rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}{/expired|used/.test(error) && <> <Link to="/login?forgot=1" className="font-semibold underline">Send a new link</Link></>}</p>}
            <Button className="w-full" size="lg" loading={busy}>Save and sign in</Button>
          </form>
        )}
      </div>
    </div>
  );
}
