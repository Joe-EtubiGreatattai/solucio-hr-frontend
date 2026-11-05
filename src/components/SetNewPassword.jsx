import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { errMsg } from '../lib/api';
import { Button, Field, PasswordInput } from './ui';

// After signing in with a code from HR, the person must pick their own password before going on.
export default function SetNewPassword() {
  const { user, setUser, signInWith, logout } = useAuth();
  const [pw, setPw] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pw.password !== pw.confirm) return setError('The two passwords don’t match');
    setBusy(true); setError('');
    try {
      const { data } = await api.put('/auth/password', { newPassword: pw.password });
      signInWith({ token: data.token, user: { ...user, mustChangePassword: false } });
      setUser((u) => ({ ...u, mustChangePassword: false }));
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-sm p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><KeyRound className="h-6 w-6" /></span>
        <h1 className="mt-4 text-2xl font-bold">Welcome, {user.firstName}</h1>
        <p className="mt-1 text-sm text-slate-600">You signed in with a code from HR. Choose your own password so you can sign in next time.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="New password" hint="At least 6 characters"><PasswordInput required minLength={6} autoFocus autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
          <Field label="Type it again"><PasswordInput required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
          {error && <p key={error} role="alert" className="animate-shake rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Button className="w-full" size="lg" loading={busy}>Save password</Button>
        </form>
        <button type="button" onClick={logout} className="mt-4 w-full text-center text-sm text-slate-500 hover:text-brand-700">Sign out instead</button>
      </div>
    </div>
  );
}
