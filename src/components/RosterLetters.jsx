import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api, { toastError } from '../lib/api';
import { rosterLetters } from '../lib/rosterPdf';
import { fullName } from '../lib/format';
import { Avatar, Button, Modal } from './ui';

// Choose the letter each person has on the printed roster (A=Grace, B=Mariam …).
export default function RosterLetters({ open, onClose, roster, shifts, onSaved }) {
  const people = useMemo(() => [...new Map(shifts.filter((s) => s.user).map((s) => [s.user._id, s.user])).values()]
    .sort((a, b) => fullName(a).localeCompare(fullName(b))), [shifts]);
  const current = useMemo(() => rosterLetters(roster, people), [roster, people]);
  const [form, setForm] = useState({});
  const [lastOpen, setLastOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setForm(Object.fromEntries(people.map((p) => [p._id, current.get(p._id)])));
  }

  const values = Object.values(form).map((v) => (v || '').trim().toUpperCase()).filter(Boolean);
  const dupes = new Set(values.filter((v, i) => values.indexOf(v) !== i));
  const invalid = Object.values(form).some((v) => v && !/^[A-Za-z]{1,3}$/.test(v.trim()));

  const save = async (letters) => {
    setBusy(true);
    try {
      const { data } = await api.put(`/rosters/${roster._id}/letters`, { letters });
      toast.success(letters.length ? 'Letters saved' : 'Letters set back to automatic');
      onSaved?.(data);
      onClose();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Staff letters on the printed roster"
      footer={<>
        <Button variant="ghost" className="mr-auto" disabled={busy} onClick={() => save([])}>Use automatic letters</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={busy} disabled={dupes.size > 0 || invalid} onClick={() => save(people.map((p) => ({ user: p._id, letter: (form[p._id] || '').trim().toUpperCase() })).filter((l) => l.letter))}>Save letters</Button>
      </>}>
      <p className="mb-4 text-sm text-slate-500">These show in the key and the table of the PDF (A=Grace, B=Mariam…). Leave one blank to give that person the next free letter.</p>
      {people.length === 0 ? <p className="text-sm text-slate-500">Assign shifts first.</p> : (
        <ul className="divide-y divide-slate-100">
          {people.map((p) => {
            const v = (form[p._id] || '').trim().toUpperCase();
            return (
              <li key={p._id} className="flex items-center gap-3 py-2">
                <Avatar user={p} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{fullName(p)}</span>
                <input className={`input w-20 text-center font-mono text-lg uppercase ${dupes.has(v) ? 'border-rose-400 ring-1 ring-rose-400' : ''}`}
                  aria-label={`Letter for ${fullName(p)}`} maxLength={3} value={form[p._id] || ''}
                  onChange={(e) => setForm({ ...form, [p._id]: e.target.value.replace(/[^A-Za-z]/g, '') })} />
              </li>
            );
          })}
        </ul>
      )}
      {dupes.size > 0 && <p role="alert" className="mt-3 text-sm text-rose-700">Each letter can only be used once: {[...dupes].join(', ')}.</p>}
    </Modal>
  );
}
