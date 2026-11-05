import { useState } from 'react';
import { Camera, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api, { toastError } from '../../lib/api';
import { Avatar, Button, Card, Field, IconButton, PageHeader, PasswordInput, ProgressBar } from '../../components/ui';
import { fmtDate, titleCase, ymd } from '../../lib/format';
import EmailPrefs from '../../components/EmailPrefs';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    firstName: user.firstName, lastName: user.lastName, phone: user.phone || '', gender: user.gender || '',
    dateOfBirth: user.dateOfBirth ? ymd(user.dateOfBirth) : '', address: user.address || '',
    qualifications: user.qualifications || '', bio: user.bio || '',
    emergencyContact: { name: '', relationship: '', phone: '', ...user.emergencyContact },
    bankDetails: { bankName: '', accountName: '', accountNumber: '', ...user.bankDetails },
    skills: (user.skills || []).map(({ name, level }) => ({ name, level })),
  });
  const LEVELS = ['', 'Beginner', 'Developing', 'Competent', 'Proficient', 'Expert'];
  const setSkill = (i, patch) => setForm({ ...form, skills: form.skills.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const [avatar, setAvatar] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setNested = (group, k) => (e) => setForm({ ...form, [group]: { ...form[group], [k]: e.target.value } });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries({ ...form, skills: form.skills.filter((sk) => sk.name.trim()) }).forEach(([k, v]) => fd.append(k, typeof v === 'object' ? JSON.stringify(v) : v));
      if (avatar) fd.append('avatar', avatar);
      const { data } = await api.put('/users/me', fd);
      setUser(data);
      setAvatar(null);
      toast.success('Profile saved');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return toast.error('Passwords do not match');
    try {
      const { data } = await api.put('/auth/password', pw);
      localStorage.setItem('token', data.token); // changing the password signs out other sessions, not this one
      toast.success('Password changed. Any other devices have been signed out');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toastError(err);
    }
  };

  const preview = avatar ? { ...user, avatar: URL.createObjectURL(avatar) } : user;

  return (
    <div>
      <PageHeader title="My profile" subtitle="Keep your personal details current so HR can reach you." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center">
              {/* Always-visible camera badge so phone users know the photo can be changed; keyboard-focusable. */}
              <label className="relative cursor-pointer rounded-full focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2">
                <Avatar user={preview} size="xl" />
                <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-white shadow ring-2 ring-white">
                  <Camera className="h-4 w-4" />
                </span>
                <input type="file" accept="image/*" className="sr-only" aria-label="Change profile photo" onChange={(e) => setAvatar(e.target.files[0])} />
              </label>
              <p className="mt-2 text-xs text-slate-500">{avatar ? 'New photo selected. Save your profile to keep it.' : 'Tap the photo to change it. HR uses it to confirm who you are at check-in.'}</p>
              <p className="mt-3 text-lg font-bold">{user.firstName} {user.lastName}</p>
              <p className="text-sm text-slate-500">{user.jobTitle || '—'} · {user.department || '—'}</p>
              <div className="mt-4 w-full text-left">
                <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Profile completion</span><span>{user.profileCompletion}%</span></div>
                <ProgressBar value={user.profileCompletion} />
              </div>
            </div>
            <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
              {[
                ['Staff ID', user.staffId], ['Email', user.email], ['Employment', titleCase(user.employmentType)],
                ['Date joined', fmtDate(user.dateJoined)], ['Status', titleCase(user.status)], ['Leave balance', `${user.leaveBalance} days`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><dt className="text-slate-500">{k}</dt><dd className="truncate font-medium">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-slate-500">Department, job title and employment details are managed by HR.</p>
          </Card>

          <EmailPrefs />
          <Card title="Change password">
            <form onSubmit={changePassword} className="space-y-3">
              <Field label="Current password"><PasswordInput required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
              <Field label="New password"><PasswordInput required minLength={6} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
              <Field label="Confirm new password"><PasswordInput required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
              <Button variant="secondary" className="w-full">Update password</Button>
            </form>
          </Card>
        </div>

        <form onSubmit={save} className="space-y-6 lg:col-span-2">
          <Card title="Personal information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name"><input className="input" required value={form.firstName} onChange={set('firstName')} /></Field>
              <Field label="Last name"><input className="input" required value={form.lastName} onChange={set('lastName')} /></Field>
              <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
              <Field label="Gender">
                <select className="input" value={form.gender} onChange={set('gender')}>
                  <option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                </select>
              </Field>
              <Field label="Date of birth"><input type="date" className="input" value={form.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
              <Field label="Address" className="sm:col-span-2"><input className="input" value={form.address} onChange={set('address')} /></Field>
              <Field label="Qualifications" className="sm:col-span-2" hint="E.g. BNSc, RN, RM; MBBS">
                <textarea rows={2} className="input" value={form.qualifications} onChange={set('qualifications')} />
              </Field>
              <Field label="Short bio" className="sm:col-span-2"><textarea rows={3} className="input" value={form.bio} onChange={set('bio')} /></Field>
            </div>
          </Card>
          <Card title="Skills" action={<span className="text-xs text-slate-500">Helps HR plan training and staffing</span>}>
            {form.skills.length === 0 && <p className="mb-3 text-sm text-slate-500">Add the clinical and professional skills you have.</p>}
            <ul className="space-y-2">
              {form.skills.map((s, i) => (
                <li key={i} className="flex animate-fade-up flex-wrap items-center gap-2">
                  <input className="input min-w-0 flex-1" aria-label="Skill" placeholder="e.g. IV cannulation" value={s.name} onChange={(e) => setSkill(i, { name: e.target.value })} />
                  <select className="input w-full sm:w-44" aria-label={`Level for ${s.name || 'skill'}`} value={s.level} onChange={(e) => setSkill(i, { level: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{l} · {LEVELS[l]}</option>)}
                  </select>
                  <IconButton icon={Trash2} tone="danger" label={`Remove ${s.name || 'skill'}`} onClick={() => setForm({ ...form, skills: form.skills.filter((_, j) => j !== i) })} />
                </li>
              ))}
            </ul>
            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setForm({ ...form, skills: [...form.skills, { name: '', level: 3 }] })}><Plus className="h-4 w-4" /> Add skill</Button>
          </Card>
          <Card title="Emergency contact">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Name"><input className="input" value={form.emergencyContact.name} onChange={setNested('emergencyContact', 'name')} /></Field>
              <Field label="Relationship"><input className="input" value={form.emergencyContact.relationship} onChange={setNested('emergencyContact', 'relationship')} /></Field>
              <Field label="Phone"><input className="input" value={form.emergencyContact.phone} onChange={setNested('emergencyContact', 'phone')} /></Field>
            </div>
          </Card>
          <Card title="Bank details" action={<span className="text-xs text-slate-500">Used for salary and approved loans</span>}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Bank"><input className="input" value={form.bankDetails.bankName} onChange={setNested('bankDetails', 'bankName')} /></Field>
              <Field label="Account name"><input className="input" value={form.bankDetails.accountName} onChange={setNested('bankDetails', 'accountName')} /></Field>
              <Field label="Account number"><input className="input" value={form.bankDetails.accountNumber} onChange={setNested('bankDetails', 'accountNumber')} /></Field>
            </div>
          </Card>
          <div className="flex justify-end"><Button size="lg" loading={busy}>Save profile</Button></div>
        </form>
      </div>
    </div>
  );
}
