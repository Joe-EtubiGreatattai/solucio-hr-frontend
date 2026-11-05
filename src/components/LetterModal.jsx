import { useState } from 'react';
import { FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../lib/api';
import useFetch from '../lib/useFetch';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Modal, Spinner } from './ui';
import { fmtDate } from '../lib/format';
import { downloadLetterPdf, LETTER_LABEL, letterTemplate } from '../lib/letters';

// Write, issue and download an HR letter for one staff member. Earlier letters can be downloaded again.
export default function LetterModal({ userId, initialType = 'employment_confirmation', onClose }) {
  const { user: me } = useAuth();
  const { data, loading, reload } = useFetch(`/users/${userId}/letters`, { live: false });
  const [type, setType] = useState(initialType);
  const [includeSalary, setIncludeSalary] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Modal open onClose={onClose} title="Letter"><Spinner /></Modal>;
  const f = data.facts;
  const letter = draft || { ...letterTemplate(type, f, { includeSalary }), signatory: { name: `${me.firstName} ${me.lastName}`, role: 'Human Resources' } };
  const set = (patch) => setDraft({ ...letter, ...patch });
  const pick = (t, salary = includeSalary) => { setType(t); setIncludeSalary(salary); setDraft(null); };

  const issue = async () => {
    setBusy(true);
    try {
      const { data: saved } = await api.post(`/users/${userId}/letters`, { type, ...letter });
      await downloadLetterPdf(saved, f);
      toast.success(`Letter ${saved.reference} issued`);
      setDraft(null); reload();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Letter for ${f.firstName} ${f.lastName}`} size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button loading={busy} onClick={issue}><FileDown className="h-4 w-4" /> Issue and download PDF</Button></>}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap gap-2">{Object.entries(LETTER_LABEL).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={type === k} onClick={() => pick(k)} className={`min-h-10 rounded-full border px-4 text-sm font-medium ${type === k ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 bg-white hover:border-brand-300'}`}>{l}</button>
          ))}</div>
          {type === 'employment_confirmation' && f.basicSalary && <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={includeSalary} onChange={(e) => pick(type, e.target.checked)} /> Include basic salary (e.g. for a bank or visa application)</label>}
          {type === 'service_certificate' && !f.exitDate && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{f.firstName} has no leaving date yet. Fill in the last day in the text.</p>}
          <Field label="Addressed to"><input className="input" value={letter.addressee} onChange={(e) => set({ addressee: e.target.value })} /></Field>
          <Field label="Heading"><input className="input" value={letter.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Letter" hint="Leave a blank line between paragraphs. Replace anything in [brackets]."><textarea rows={12} className="input leading-relaxed" value={letter.body} onChange={(e) => set({ body: e.target.value })} /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Signed by"><input className="input" value={letter.signatory.name} onChange={(e) => set({ signatory: { ...letter.signatory, name: e.target.value } })} /></Field>
            <Field label="Their role"><input className="input" value={letter.signatory.role} onChange={(e) => set({ signatory: { ...letter.signatory, role: e.target.value } })} /></Field>
          </div>
          {/\[.+?\]/.test(letter.body) && <p className="text-sm text-amber-700">There's still text in [brackets] to replace.</p>}
        </div>
        <div>
          <p className="label">Issued before</p>
          {data.letters.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
            <ul className="space-y-2">{data.letters.map((l) => (
              <li key={l._id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-medium">{LETTER_LABEL[l.type]}</p>
                <p className="text-xs text-slate-500">{l.reference} · {fmtDate(l.createdAt)}{l.issuedBy && ` · ${l.issuedBy.firstName}`}</p>
                <button type="button" className="mt-1 text-xs font-semibold text-brand-700 hover:underline" onClick={() => downloadLetterPdf(l, f)}>Download again</button>
              </li>
            ))}</ul>
          )}
          <p className="mt-4 text-xs text-slate-500">Every letter gets a reference number and is kept here, so anyone can check it with HR.</p>
        </div>
      </div>
    </Modal>
  );
}
