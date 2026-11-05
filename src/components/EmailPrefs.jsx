import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { toastError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Card } from './ui';

const OPTIONS = [
  ['certificates', 'Certificates', 'A certificate is expiring, or HR asks you for one'],
  ['pay', 'Payslips', 'Your payslip is ready'],
  ['requests', 'Leave and requests', 'A decision on something you applied for'],
  ['roster', 'Roster changes', 'A shift swap is approved'],
];

// Which notifications are also sent by email. Saves as soon as a switch changes.
export default function EmailPrefs() {
  const { user, setUser } = useAuth();
  const [prefs, setPrefs] = useState({ certificates: true, pay: true, requests: true, roster: true, ...user.emailPrefs });
  const toggle = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try { const { data } = await api.put('/users/me', { emailPrefs: next }); setUser(data); toast.success('Email settings saved'); }
    catch (e) { setPrefs(prefs); toastError(e); }
  };
  return (
    <Card title="Emails">
      <p className="mb-3 text-sm text-slate-600">We email <b>{user.email}</b> only about things that need you. Everything still appears in your notifications.</p>
      <ul className="divide-y divide-slate-100">
        {OPTIONS.map(([key, label, hint]) => (
          <li key={key}>
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-2">
              <span><span className="block text-sm font-medium">{label}</span><span className="text-xs text-slate-500">{hint}</span></span>
              <input type="checkbox" role="switch" className="h-5 w-5 shrink-0 accent-brand-700" checked={prefs[key] !== false} onChange={() => toggle(key)} />
            </label>
          </li>
        ))}
        <li className="py-2 text-xs text-slate-500">Hearing invitations and decisions on formal HR cases are always emailed.</li>
      </ul>
    </Card>
  );
}
