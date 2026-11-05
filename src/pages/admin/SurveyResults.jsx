import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BellRing, Lock, Pencil, Rocket, Square, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useConfirm } from '../../components/Confirm';
import SurveyBuilder from '../../components/SurveyBuilder';
import { Badge, Button, Card, Empty, ProgressBar, Spinner } from '../../components/ui';
import { fmtDate, titleCase } from '../../lib/format';
import { enpsText, QUESTION_TYPE_LABEL, SURVEY_STATUS } from '../../lib/engagement';
import { Term } from '../../components/InfoTip';

const SCALE_COLORS = ['bg-rose-500', 'bg-rose-300', 'bg-slate-300', 'bg-brand-400', 'bg-brand-700'];

function Stacked({ parts, colors, labels }) {
  const total = parts.reduce((a, b) => a + b, 0) || 1;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">{parts.map((p, i) => p > 0 && <div key={i} className={`${colors[i]} origin-left animate-grow-x`} style={{ width: `${(p / total) * 100}%` }} title={`${labels[i]}: ${p}`} />)}</div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">{labels.map((l, i) => <span key={l} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${colors[i]}`} />{l} {Math.round((parts[i] / total) * 100)}%</span>)}</div>
    </div>
  );
}

function QuestionResult({ q, n }) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><p className="font-medium"><span className="mr-2 text-brand-700">{n}.</span>{q.text}</p><span className="text-xs text-slate-500">{titleCase(q.theme)} · {q.answered} answers</span></div>
      {q.type === 'scale' && <><p className="mb-2 text-sm"><b className="text-lg">{q.favourable ?? 0}%</b> favourable · average {q.average ?? '—'}/5</p><Stacked parts={q.distribution} colors={SCALE_COLORS} labels={['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']} /></>}
      {q.type === 'enps' && <><p className="mb-2 text-sm">eNPS <b className="text-lg">{enpsText(q.enps)}</b></p><Stacked parts={[q.detractors, q.passives, q.promoters]} colors={['bg-rose-500', 'bg-slate-300', 'bg-brand-700']} labels={['Detractors (0–6)', 'Passives (7–8)', 'Promoters (9–10)']} /></>}
      {q.type === 'yesno' && <><p className="mb-2 text-sm"><b className="text-lg">{q.yes ?? 0}%</b> said yes</p><ProgressBar value={q.yes} tone="bg-brand-600" /></>}
      {q.type === 'choice' && <ul className="space-y-2">{q.counts.map((c) => { const p = q.answered ? Math.round((c.count / q.answered) * 100) : 0; return <li key={c.option}><div className="mb-1 flex justify-between text-sm"><span>{c.option}</span><span className="text-slate-500">{c.count} · {p}%</span></div><ProgressBar value={p} tone="bg-brand-600" /></li>; })}</ul>}
      {q.type === 'text' && (q.comments.length ? <ul className="max-h-72 space-y-2 overflow-y-auto">{q.comments.map((c, i) => <li key={i} className="rounded-xl bg-slate-50 p-3 text-sm">“{c}”</li>)}</ul> : <p className="text-sm text-slate-500"><Term>Comments appear once at least 3 people have written one.</Term></p>)}
    </Card>
  );
}

function Breakdown({ title, rows, min }) {
  return (
    <Card title={title} bodyClass="p-0">
      <ul className="divide-y divide-slate-100">{rows.map((r) => (
        <li key={r.name} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
          <span className="font-medium">{r.name}</span>
          {r.hidden ? <span className="inline-flex items-center gap-1 text-xs text-slate-500" title={`Fewer than ${min} responses`}><Lock className="h-3 w-3" />Hidden</span>
            : <span className="text-right text-slate-600"><b className="text-slate-900">{r.favourable ?? '—'}%</b> fav · eNPS {enpsText(r.enps)} <span className="text-xs text-slate-500">({r.responses})</span></span>}
        </li>
      ))}</ul>
      <p className="px-5 pb-3 text-xs text-slate-500">Groups under {min} responses are hidden.</p>
    </Card>
  );
}

const themeTone = (v) => (v >= 70 ? 'bg-emerald-500' : v >= 50 ? 'bg-amber-500' : 'bg-rose-500');

export default function SurveyResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ask = useConfirm();
  const [dept, setDept] = useState('');
  const { data: r, loading, reload } = useFetch(`/engagement/surveys/${id}/results`, { params: { department: dept || undefined } });
  const [editing, setEditing] = useState(false);
  if (loading && !r) return <Spinner />;
  if (!r) return <Empty title="Survey not found" />;
  const s = r.survey;
  const act = async (path, confirm, msg) => {
    if (confirm && !(await ask(confirm))) return;
    try {
      if (path === 'delete') { await api.delete(`/engagement/surveys/${id}`); toast.success('Draft deleted'); return navigate('/admin/engagement'); }
      const { data } = await api.post(`/engagement/surveys/${id}/${path}`); toast.success(typeof msg === 'function' ? msg(data) : msg); reload();
    } catch (e) { toastError(e); }
  };

  return (
    <div>
      <Link to="/admin/engagement" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Engagement</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><div className="flex gap-2"><Badge color={SURVEY_STATUS[s.status][1]}>{SURVEY_STATUS[s.status][0]}</Badge>{s.anonymous && <Badge color="teal">Anonymous</Badge>}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{s.title}</h1>
          <p className="text-sm text-slate-500">{s.questions.length} questions{s.opensAt && ` · opened ${fmtDate(s.opensAt)}`}{s.closesAt && ` · ${s.status === 'closed' ? 'closed' : 'closes'} ${fmtDate(s.closesAt)}`}</p></div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {s.status === 'draft' && <>
            <Button variant="ghost" onClick={() => act('delete', { title: 'Delete this draft?', confirmLabel: 'Delete', tone: 'danger' })}><Trash2 className="h-4 w-4" /> Delete</Button>
            <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button onClick={() => act('launch', { title: 'Launch this survey?', message: 'Everyone in the audience is notified. Questions can no longer be changed.', confirmLabel: 'Launch' }, (d) => `Sent to ${d.invited} staff`)}><Rocket className="h-4 w-4" /> Launch</Button>
          </>}
          {s.status === 'open' && <>
            <Button variant="secondary" onClick={() => act('remind', null, (d) => `Reminded ${d.reminded} people`)}><BellRing className="h-4 w-4" /> Remind non-responders</Button>
            <Button variant="ghost" onClick={() => act('close', { title: 'Close the survey now?', confirmLabel: 'Close survey' }, 'Survey closed')}><Square className="h-4 w-4" /> Close</Button>
          </>}
        </div>
      </div>

      {s.status === 'draft' ? (
        <Card title="Questions"><ol className="space-y-2">{s.questions.map((q, i) => <li key={q._id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm"><span><b className="mr-2 text-brand-700">{i + 1}.</b>{q.text}</span><span className="text-xs text-slate-500">{QUESTION_TYPE_LABEL[q.type]} · {titleCase(q.theme)}</span></li>)}</ol></Card>
      ) : (
        <>
          <div className="stagger mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-5 text-white shadow-sm"><p className="text-sm text-brand-100"><Term>Response rate</Term></p><p className="mt-1 text-3xl font-semibold">{r.participation ?? 0}%</p><p className="text-xs text-brand-100">{r.responded} of {r.invited} staff</p></div>
            <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500"><Term>eNPS</Term></p><p className="mt-1 text-3xl font-semibold">{enpsText(r.overall?.enps)}</p><p className="text-xs text-slate-500">−100 to +100; above 0 is healthy</p></div>
            <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500"><Term>Favourable answers</Term></p><p className="mt-1 text-3xl font-semibold">{r.overall?.favourable ?? '—'}%</p><p className="text-xs text-slate-500"><Term>Agree or strongly agree</Term></p></div>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600" htmlFor="dept">Show</label>
            <select id="dept" className="input w-auto" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">Everyone</option>{(r.byDepartment || []).filter((d) => !d.hidden).map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}</select>
          </div>
          {r.hidden ? <Card><Empty icon={Lock} title="Not enough responses to show yet">{`To protect anonymity, results appear after ${r.needed} more response(s).`}</Empty></Card> : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="stagger space-y-4 lg:col-span-2">{r.questions.map((q, i) => <QuestionResult key={q._id} q={q} n={i + 1} />)}</div>
              <div className="space-y-6">
                {r.themes.length > 0 && <Card title="By theme"><ul className="space-y-3">{[...r.themes].sort((a, b) => a.favourable - b.favourable).map((t) => <li key={t.theme}><div className="mb-1 flex justify-between text-sm"><span>{titleCase(t.theme)}</span><span className="font-semibold">{t.favourable}%</span></div><ProgressBar value={t.favourable} tone={themeTone(t.favourable)} /></li>)}</ul></Card>}
                {!dept && <Breakdown title="By department" rows={r.byDepartment} min={s.minGroupSize} />}
                {!dept && <Breakdown title="By length of service" rows={r.byTenure} min={s.minGroupSize} />}
              </div>
            </div>
          )}
        </>
      )}
      {editing && <SurveyBuilder initial={s} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </div>
  );
}
