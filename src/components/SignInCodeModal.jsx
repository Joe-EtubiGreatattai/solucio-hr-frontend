import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import api, { toastError } from '../lib/api';
import { Button, Modal, Spinner } from './ui';

// HR creates a one-time code for someone at the desk who can't sign in themselves
// (no phone, forgotten password, no access to their email). Shown only to HR; works once, for 15 minutes.
export default function SignInCodeModal({ user, onClose }) {
  const [code, setCode] = useState(null);
  const [now, setNow] = useState(Date.now());
  const create = async () => {
    setCode(null);
    try { setCode((await api.post(`/users/${user._id}/sign-in-code`)).data); } catch (e) { toastError(e); onClose(); }
  };
  useEffect(() => { create(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = code ? Math.max(0, Math.round((new Date(code.expiresAt) - now) / 1000)) : 0;
  const portal = `${window.location.origin}/login?code=1`;

  return (
    <Modal open onClose={onClose} title={`Sign-in code for ${user.firstName} ${user.lastName}`} guardChanges={false}
      footer={<><Button variant="secondary" onClick={create}><RefreshCw className="h-4 w-4" /> New code</Button><Button onClick={onClose}>Done</Button></>}>
      {!code ? <Spinner /> : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Check it's really {user.firstName} (photo or ID) before reading this out.</p>
          <div className="rounded-3xl bg-brand-50 p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">One-time code</p>
            <p className="mt-1 select-all font-mono text-4xl font-bold tracking-[0.2em] text-brand-900 sm:text-5xl">{code.code}</p>
            <p className={`mt-2 text-sm ${left < 60 ? 'text-rose-600' : 'text-brand-800'}`}>{left > 0 ? `Works once · expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Expired: create a new code'}</p>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
            <li>On any computer or a borrowed phone, open <b className="break-all">{portal.replace('?code=1', '')}</b></li>
            <li>Tap <b>Code from HR</b>.</li>
            <li>Enter staff ID <b className="font-mono">{code.staffId}</b> (or {code.email}) and the code above.</li>
            <li>They'll be asked to choose a new password straight away.</li>
          </ol>
          <p className="text-xs text-slate-500">Making a new code cancels this one. If they're using an HR computer, remind them to sign out when finished.</p>
        </div>
      )}
    </Modal>
  );
}
