import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ClipboardList, Lock } from 'lucide-react';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, PageHeader, Spinner, SuccessCheck } from '../../components/ui';
import { fmtDate } from '../../lib/format';

const AGREE = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

function Choice({ selected, onClick, children, className = '' }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}
      className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition active:scale-95 ${selected ? 'border-brand-700 bg-brand-700 text-white shadow-sm' : 'border-slate-200 bg-white hover:border-brand-300'} ${className}`}>{children}</button>
  );
}

function Question({ q, n, value, onChange }) {
  return (
    <fieldset className="card animate-fade-up p-5">
      <legend className="sr-only">{q.text}</legend>
      <p className="mb-4 font-medium"><span className="mr-2 text-brand-700">{n}.</span>{q.text}{!q.required && <span className="ml-2 text-xs font-normal text-slate-500">optional</span>}</p>
      {q.type === 'scale' && <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">{AGREE.map((l, i) => <Choice key={l} selected={value === i + 1} onClick={() => onChange(i + 1)}>{l}</Choice>)}</div>}
      {q.type === 'enps' && (
        <div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">{[...Array(11)].map((_, i) => <Choice key={i} selected={value === i} onClick={() => onChange(i)} className="px-0">{i}</Choice>)}</div>
          <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Not at all likely</span><span>Extremely likely</span></div>
        </div>
      )}
      {q.type === 'yesno' && <div className="flex gap-2">{['yes', 'no'].map((v) => <Choice key={v} selected={value === v} onClick={() => onChange(v)} className="w-24">{v === 'yes' ? 'Yes' : 'No'}</Choice>)}</div>}
      {q.type === 'choice' && <div className="flex flex-wrap gap-2">{q.options.map((o) => <Choice key={o} selected={value === o} onClick={() => onChange(o)}>{o}</Choice>)}</div>}
      {q.type === 'text' && <textarea rows={3} className="input" aria-label={q.text} value={value || ''} onChange={(e) => onChange(e.target.value)} />}
    </fieldset>
  );
}

function TakeSurvey({ id }) {
  const navigate = useNavigate();
  const { data: s, loading } = useFetch(`/engagement/surveys/${id}/take`, { live: false });
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (loading && !s) return <Spinner />;
  if (!s) return <Empty title="Survey not found" />;
  const required = s.questions.filter((q) => q.required);
  const answered = required.filter((q) => answers[q._id] !== undefined && answers[q._id] !== '').length;
  const submit = async () => {
    setBusy(true);
    try { await api.post(`/engagement/surveys/${id}/respond`, { answers }); setDone(true); } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  if (done || s.respondedOn) return (
    <Card className="mx-auto max-w-lg text-center"><div className="flex flex-col items-center gap-3 py-6"><SuccessCheck />
      <h1 className="text-xl font-semibold">Thank you{done ? '' : ', you already answered this one'}</h1>
      <p className="text-sm text-slate-600">{s.anonymous ? 'Your answers are anonymous. HR only sees combined results for groups of three or more people.' : 'HR will review your answers.'}</p>
      <Button variant="secondary" onClick={() => navigate('/surveys')}>Back to surveys</Button></div></Card>
  );
  if (s.status !== 'open') return <Empty title="This survey has closed" />;
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/surveys" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Surveys</Link>
      <h1 className="text-3xl font-semibold tracking-tight">{s.title}</h1>
      <p className="mt-1 text-slate-600">{s.description}</p>
      {s.anonymous && <p className="mt-3 flex items-start gap-2 rounded-2xl bg-brand-50 p-3 text-sm text-brand-900"><Lock className="mt-0.5 h-4 w-4 shrink-0" />Anonymous: your name is never stored with your answers, and results are only shown for groups of {s.minGroupSize || 3}+ people.</p>}
      <div className="stagger mt-6 space-y-4">{s.questions.map((q, i) => <Question key={q._id} q={q} n={i + 1} value={answers[q._id]} onChange={(v) => setAnswers({ ...answers, [q._id]: v })} />)}</div>
      <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <span className="text-sm text-slate-600">{answered} of {required.length} answered</span>
        <Button loading={busy} disabled={answered < required.length} onClick={submit}>Submit answers</Button>
      </div>
    </div>
  );
}

export default function Surveys() {
  const { id } = useParams();
  const { data: list, loading } = useFetch('/engagement/surveys/mine', { initial: [] });
  if (id) return <TakeSurvey id={id} />;
  const open = list.filter((s) => s.status === 'open' && !s.respondedOn);
  const past = list.filter((s) => !(s.status === 'open' && !s.respondedOn));
  return (
    <div>
      <PageHeader title="Surveys" subtitle="Tell us how work really is. Most surveys are anonymous." />
      {loading ? <Spinner /> : list.length === 0 ? <Card><Empty icon={ClipboardList} title="No surveys yet" /></Card> : (
        <div className="space-y-8">
          <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
            {open.length === 0 ? <Card className="md:col-span-2"><p className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="h-5 w-5 text-emerald-600" />You're all caught up.</p></Card> : open.map((s) => (
              <Link key={s._id} to={`/surveys/${s._id}`} className="card lift block p-5">
                <div className="flex items-center gap-2"><Badge color="blue">Open</Badge>{s.anonymous && <Badge color="teal">Anonymous</Badge>}</div>
                <h2 className="mt-2 text-lg font-semibold">{s.title}</h2><p className="text-sm text-slate-600">{s.description}</p>
                <p className="mt-3 text-xs text-slate-500">{s.questionCount} questions · closes {fmtDate(s.closesAt)}</p>
                <span className="mt-4 inline-flex rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Start</span>
              </Link>
            ))}
          </div>
          {past.length > 0 && <Card title="Earlier" bodyClass="p-0"><ul className="divide-y divide-slate-100">{past.map((s) => (
            <li key={s._id} className="flex flex-wrap items-center gap-3 px-5 py-3"><span className="flex-1 font-medium">{s.title}</span>
              {s.respondedOn ? <Badge color="green">Answered</Badge> : <Badge color="slate">Missed</Badge>}<span className="text-xs text-slate-500">{s.status === 'open' ? 'closes' : 'closed'} {fmtDate(s.closesAt)}</span></li>
          ))}</ul></Card>}
        </div>
      )}
    </div>
  );
}
