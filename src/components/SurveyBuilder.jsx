import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../lib/api';
import useFetch from '../lib/useFetch';
import { Button, Field, IconButton, Modal } from './ui';
import { titleCase, ymd } from '../lib/format';
import { QUESTION_TYPE_LABEL, THEMES } from '../lib/engagement';

// Create or edit a survey. `initial` is a template (no _id) or an existing draft.
export default function SurveyBuilder({ initial, onClose, onSaved }) {
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] }, live: false });
  const [s, setS] = useState({
    title: initial.title || '', description: initial.description || '', kind: initial.kind || 'pulse', anonymous: initial.anonymous ?? true,
    audience: initial.audience || { scope: 'all', departments: [] }, closesAt: initial.closesAt ? ymd(new Date(initial.closesAt)) : ymd(new Date(Date.now() + 14 * 86400000)),
    questions: (initial.questions || []).map((q) => ({ ...q, options: q.options || [], required: q.required !== false })),
  });
  const [busy, setBusy] = useState(false);
  const setQ = (i, patch) => setS({ ...s, questions: s.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const move = (i, d) => { const qs = [...s.questions]; [qs[i], qs[i + d]] = [qs[i + d], qs[i]]; setS({ ...s, questions: qs }); };
  const depts = s.audience.departments || [];
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const { data } = initial._id ? await api.put(`/engagement/surveys/${initial._id}`, s) : await api.post('/engagement/surveys', s);
      toast.success('Survey saved as a draft'); onSaved(data);
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={initial._id ? 'Edit survey' : 'New survey'} size="xl" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="survey-form" loading={busy}>Save draft</Button></>}>
      <form id="survey-form" onSubmit={save} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2"><input className="input" required value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} /></Field>
          <Field label="Intro shown to staff" className="sm:col-span-2"><input className="input" value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} /></Field>
          <Field label="Closes on"><input type="date" className="input" value={s.closesAt} onChange={(e) => setS({ ...s, closesAt: e.target.value })} /></Field>
          <Field label="Who is asked"><select className="input" value={s.audience.scope} onChange={(e) => setS({ ...s, audience: { ...s.audience, scope: e.target.value } })}><option value="all">Everyone</option><option value="departments">Selected departments</option></select></Field>
          {s.audience.scope === 'departments' && <div className="flex flex-wrap gap-2 sm:col-span-2">{meta.departments.map((d) => (
            <button key={d} type="button" aria-pressed={depts.includes(d)} onClick={() => setS({ ...s, audience: { ...s.audience, departments: depts.includes(d) ? depts.filter((x) => x !== d) : [...depts, d] } })}
              className={`rounded-full border px-3 py-1.5 text-sm ${depts.includes(d) ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200'}`}>{d}</button>
          ))}</div>}
          <label className="flex items-start gap-3 text-sm sm:col-span-2"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-700" checked={s.anonymous} onChange={(e) => setS({ ...s, anonymous: e.target.checked })} />
            <span><b>Anonymous</b> (recommended): names are never stored with answers and results only show for groups of 3 or more.</span></label>
        </div>
        <div>
          <p className="label">Questions</p>
          <ol className="space-y-3">{s.questions.map((q, i) => (
            <li key={q._id || i} className="rounded-2xl border border-slate-200 p-3">
              <div className="flex gap-2">
                <span className="pt-2.5 text-sm font-semibold text-brand-700">{i + 1}.</span>
                <input className="input flex-1" aria-label={`Question ${i + 1}`} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
                <IconButton icon={ArrowUp} label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
                <IconButton icon={ArrowDown} label="Move down" disabled={i === s.questions.length - 1} onClick={() => move(i, 1)} />
                <IconButton icon={Trash2} tone="danger" label="Remove question" onClick={() => setS({ ...s, questions: s.questions.filter((_, j) => j !== i) })} />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 pl-6 sm:grid-cols-3">
                <select className="input" aria-label="Answer type" value={q.type} onChange={(e) => setQ(i, { type: e.target.value })}>{Object.entries(QUESTION_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select className="input" aria-label="Theme" value={q.theme} onChange={(e) => setQ(i, { theme: e.target.value })}>{THEMES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-700" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} /> Required</label>
                {q.type === 'choice' && <input className="input sm:col-span-3" aria-label="Options" placeholder="Options, separated by commas" value={q.options.join(', ')} onChange={(e) => setQ(i, { options: e.target.value.split(',').map((o) => o.trimStart()) })} />}
              </div>
            </li>
          ))}</ol>
          <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => setS({ ...s, questions: [...s.questions, { text: '', type: 'scale', theme: 'engagement', options: [], required: true }] })}><Plus className="h-4 w-4" /> Add question</Button>
        </div>
      </form>
    </Modal>
  );
}
