import { createContext, useContext, useEffect, useState } from 'react';
import api, { errMsg } from '../lib/api';
import { Button, Field, Modal, PasswordInput } from '../components/ui';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('token')) return setLoading(false);
    api.get('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  // Store a session returned by any sign-in route (password, emailed reset link, HR code).
  const signInWith = (data) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };
  const login = async (email, password) => signInWith((await api.post('/auth/login', { email, password })).data);
  const codeLogin = async (identifier, code) => signInWith((await api.post('/auth/code', { identifier, code }, { anonymous: true })).data);

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Session expired while working: sign in again in a dialog so the page (and any unsaved form) stays put.
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  useEffect(() => {
    const onExpired = () => { if (localStorage.getItem('token')) setExpired(true); };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const reauth = async (e) => {
    e.preventDefault();
    try {
      await login(user.email, password);
      setExpired(false); setPassword(''); setReauthError('');
    } catch (err) {
      setReauthError(errMsg(err));
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, codeLogin, signInWith, logout, loading, isAdmin: user?.role === 'admin' }}>
      {children}
      <Modal open={expired && !!user} onClose={() => { setExpired(false); logout(); window.location.assign('/login'); }} title="Your session has expired" size="sm" guardChanges={false}
        footer={<><Button variant="secondary" onClick={() => { setExpired(false); logout(); window.location.assign('/login'); }}>Sign out</Button><Button form="reauth-form">Sign in</Button></>}>
        <form id="reauth-form" onSubmit={reauth} className="space-y-3">
          <p className="text-sm text-slate-600">Enter your password to carry on. Nothing on this page has been lost; just try your last action again once you're signed in.</p>
          <Field label={`Password for ${user?.email}`}><PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {reauthError && <p key={reauthError} role="alert" className="animate-shake text-sm text-rose-600">{reauthError}</p>}
        </form>
      </Modal>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
