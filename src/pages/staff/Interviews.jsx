import { useState } from 'react';
import { CalendarClock, ClipboardCheck, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { openFile, toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner, Tabs } from '../../components/ui';
import { fmtDateTime, titleCase } from '../../lib/format';

const RECS = [['strong_yes', 'Strong yes'], ['yes', 'Yes'], ['no', 'No'], ['strong_no', 'Strong no']];

// For anyone on an interview panel: upcoming interviews and scorecards to complete.
export default function Interviews() {
  const { data, loading, reload } = useFetch('/recruitment/my-interviews', { initial: { criteria: [], interviews: [] } });
  const [tab, setTab] = useState('todo');
  const [scoring, setScoring] = useState(null);
  const [busy, setBusy] = useState(false);
  const todo = data.interviews.filter((i) => !i.myScorecard && i.interview.status !== 'cancelled');
  const done = data.interviews.filter((i) => i.myScorecard);
  const list = tab === 'todo' ? todo : done;

  const openScore = (row) => setScoring({ row, ratings: Object.fromEntries(data.criteria.map((c) => [c, row.myScorecard?.ratings.find((r) => r.criterion === c)?.score || 0])),
    recommendation: row.myScorecard?.recommendation || '', strengths: row.myScorecard?.strengths || '', concerns: row.myScorecard?.concerns || '' });

  const submit = async (e) => {
    e.preventDefault();
    if (Object.values(scoring.ratings).some((v) => !v)) return toast.error('Score every area');
    setBusy(true);
    try {
      await api.post(`/recruitment/applications/${scoring.row.application._id}/interviews/${scoring.row.interview._id}/scorecard`, {
        ratings: Object.entries(scoring.ratings).map(([criterion, score]) => ({ criterion, score })),
        recommendation: scoring.recommendation, strengths: scoring.strengths, concerns: scoring.concerns,
      });
      toast.success('Scorecard submitted'); setScoring(null); reload();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="My interviews" subtitle="Interviews you're on the panel for. Score each candidate after you meet them." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'todo', label: 'To score', count: todo.length }, { value: 'done', label: 'Submitted', count: done.length }]} />
      {loading ? <Spinner /> : list.length === 0 ? <Card><Empty icon={ClipboardCheck} title={tab === 'todo' ? 'Nothing to score' : 'No scorecards yet'} /></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((row) => (
            <Card key={row.interview._id}>
              <div className="flex flex-wrap items-center gap-2"><Badge color="teal">{row.application.opening?.title}</Badge>{row.myScorecard && <Badge color="green">{RECS.find((r) => r[0] === row.myScorecard.recommendation)?.[1]}</Badge>}</div>
              <h3 className="mt-2 text-lg font-semibold">{row.application.firstName} {row.application.lastName}</h3>
              <p className="flex items-center gap-1.5 text-sm text-slate-600"><CalendarClock className="h-4 w-4" />{fmtDateTime(row.interview.scheduledAt)} · {titleCase(row.interview.mode)}{row.interview.location && ` · ${row.interview.location}`}</p>
              <p className="mt-2 text-sm text-slate-500">{row.application.yearsExperience != null && `${row.application.yearsExperience} years' experience`}{row.application.currentEmployer && ` · ${row.application.currentEmployer}`}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {row.application.hasCv && <Button variant="secondary" size="sm" onClick={() => openFile(`/recruitment/applications/${row.application._id}/cv`)}><FileDown className="h-4 w-4" /> CV</Button>}
                <Button size="sm" onClick={() => openScore(row)}>{row.myScorecard ? 'Edit scorecard' : 'Score candidate'}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {scoring && (
        <Modal open onClose={() => setScoring(null)} title={`Scorecard: ${scoring.row.application.firstName} ${scoring.row.application.lastName}`} size="lg"
          footer={<><Button variant="secondary" onClick={() => setScoring(null)}>Cancel</Button><Button form="score-form" loading={busy} disabled={!scoring.recommendation}>Submit</Button></>}>
          <form id="score-form" onSubmit={submit} className="space-y-5">
            {scoring.row.application.coverLetter && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{scoring.row.application.coverLetter}</p>}
            {data.criteria.map((c) => (
              <fieldset key={c}>
                <legend className="mb-1.5 text-sm font-medium">{c}</legend>
                <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-pressed={scoring.ratings[c] === n} onClick={() => setScoring({ ...scoring, ratings: { ...scoring.ratings, [c]: n } })}
                    className={`h-11 flex-1 rounded-xl border text-sm font-semibold transition ${scoring.ratings[c] === n ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-300 hover:border-brand-400'}`}>{n}</button>
                ))}</div>
              </fieldset>
            ))}
            <p className="text-xs text-slate-500">1 = well below what the role needs · 3 = meets it · 5 = exceptional</p>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Overall recommendation</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{RECS.map(([v, l]) => (
                <button key={v} type="button" aria-pressed={scoring.recommendation === v} onClick={() => setScoring({ ...scoring, recommendation: v })}
                  className={`min-h-11 rounded-xl border text-sm font-semibold ${scoring.recommendation === v ? (v.includes('no') ? 'border-rose-600 bg-rose-600 text-white' : 'border-emerald-600 bg-emerald-600 text-white') : 'border-slate-300'}`}>{l}</button>
              ))}</div>
            </fieldset>
            <Field label="Strengths"><textarea rows={2} className="input" value={scoring.strengths} onChange={(e) => setScoring({ ...scoring, strengths: e.target.value })} /></Field>
            <Field label="Concerns"><textarea rows={2} className="input" value={scoring.concerns} onChange={(e) => setScoring({ ...scoring, concerns: e.target.value })} /></Field>
          </form>
        </Modal>
      )}
    </div>
  );
}
