import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { toastError } from '../lib/api';
import { Button, Field, Modal } from './ui';
import StaffPicker from './StaffPicker';

// Ask one or more staff to obtain a certificate. Pass `users` to preselect and hide the picker.
// `initialTitle` pre-fills the certificate name (e.g. when requesting from everyone missing it).
export function CertRequestModal({ open, onClose, users: fixedUsers, onSaved, initialTitle = '' }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ title: '', message: '', dueDate: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm({ title: initialTitle, message: '', dueDate: '' });
  }, [open, initialTitle]);

  const submit = async (e) => {
    e.preventDefault();
    const targets = fixedUsers || users;
    if (!targets.length) return toast.error('Select at least one staff member');
    setBusy(true);
    try {
      await api.post('/certificates/requests', { ...form, users: targets });
      toast.success(`Request sent to ${targets.length} staff`);
      setForm({ title: '', message: '', dueDate: '' });
      setUsers([]);
      onSaved?.();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Request a certificate" size={fixedUsers ? 'md' : 'lg'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="certreq-form" loading={busy}>Send request</Button></>}>
      <form id="certreq-form" onSubmit={submit} className="space-y-4">
        <Field label="Certificate required"><input className="input" required placeholder="e.g. Basic Life Support (BLS)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Due date (optional)"><input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
        <Field label="Message (optional)"><textarea rows={3} className="input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
        {!fixedUsers && <div><span className="label">Staff</span><StaffPicker value={users} onChange={setUsers} /></div>}
        {fixedUsers?.length > 1 && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Sending to <b>{fixedUsers.length}</b> staff members. Each gets a notification and the request appears on their Certificates page.</p>}
      </form>
    </Modal>
  );
}

// Direct message to specific staff (delivered as an announcement to individuals).
export function MessageModal({ open, onClose, users, title: heading = 'Send message' }) {
  const [form, setForm] = useState({ title: '', body: '', priority: 'normal' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/announcements', { ...form, audience: { scope: 'individuals', users } });
      toast.success('Message sent');
      setForm({ title: '', body: '', priority: 'normal' });
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={heading}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="msg-form" loading={busy}>Send</Button></>}>
      <form id="msg-form" onSubmit={submit} className="space-y-4">
        <Field label="Subject"><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Priority">
          <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option>
          </select>
        </Field>
        <Field label="Message"><textarea rows={6} className="input" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
      </form>
    </Modal>
  );
}
