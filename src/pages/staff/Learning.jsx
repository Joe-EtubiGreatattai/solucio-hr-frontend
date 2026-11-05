import { useState } from 'react';
import { BookOpen, CalendarClock, GraduationCap, Plus, Star, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, Spinner, Tabs } from '../../components/ui';
import { fmtDate, fmtDateTime, titleCase, ymd } from '../../lib/format';
import { Term } from '../../components/InfoTip';

const OPEN = ['requested', 'assigned', 'registered'];

function StatusPill({ e }) {
  if (e.status === 'completed') {
    const expiring = e.expiresAt && new Date(e.expiresAt) - Date.now() < 60 * 86400000;
    return <Badge color={expiring ? 'amber' : 'green'}>{e.expiresAt ? `${expiring ? 'Renew by' : 'Valid to'} ${fmtDate(e.expiresAt)}` : 'Completed'}</Badge>;
  }
  if (e.status === 'registered') return <Badge color="blue">Booked</Badge>;
  if (e.status === 'requested') return <Badge color="amber">Awaiting HR</Badge>;
  if (e.status === 'assigned') return <Badge color={e.dueDate && new Date(e.dueDate) < new Date() ? 'red' : 'slate'}>{e.dueDate ? `Due ${fmtDate(e.dueDate)}` : 'To do'}</Badge>;
  return <Badge status={e.status} />;
}

function DevPlan({ plan, courses, onSaved }) {
  const [f, setF] = useState(() => ({ careerGoal: plan?.careerGoal || '', strengths: plan?.strengths || '', areasToDevelop: plan?.areasToDevelop || '',
    actions: (plan?.actions || []).map((a) => ({ ...a, course: a.course?._id || a.course || '', targetDate: a.targetDate ? ymd(a.targetDate) : '' })) }));
  const [busy, setBusy] = useState(false);
  const setAction = (i, patch) => setF({ ...f, actions: f.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const save = async (e) => { e.preventDefault(); setBusy(true); try { await api.put('/training/plan', f); toast.success('Development plan saved'); onSaved(); } catch (err) { toastError(err); } finally { setBusy(false); } };
  return (
    <Card title="My development plan" action={<span className="text-xs text-slate-500">Shared with your manager and HR</span>}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Where do you want to be in 2–3 years?"><input className="input" value={f.careerGoal} onChange={(e) => setF({ ...f, careerGoal: e.target.value })} /></Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Strengths to build on"><textarea rows={2} className="input" value={f.strengths} onChange={(e) => setF({ ...f, strengths: e.target.value })} /></Field>
          <Field label="Areas to develop"><textarea rows={2} className="input" value={f.areasToDevelop} onChange={(e) => setF({ ...f, areasToDevelop: e.target.value })} /></Field>
        </div>
        <div><span className="label">Actions</span>
          <ul className="space-y-2">{f.actions.map((a, i) => (
            <li key={i} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <Field label="Action" className="col-span-2 md:col-span-1"><input className="input" value={a.title} onChange={(e) => setAction(i, { title: e.target.value })} /></Field>
              <Field label="Type"><select className="input" value={a.type} onChange={(e) => setAction(i, { type: e.target.value })}>{['course', 'mentoring', 'project', 'shadowing', 'reading', 'other'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></Field>
              <Field label="By"><input type="date" className="input" value={a.targetDate} onChange={(e) => setAction(i, { targetDate: e.target.value })} /></Field>
              <Field label="Status"><select className="input" value={a.status} onChange={(e) => setAction(i, { status: e.target.value })}>{['planned', 'in_progress', 'done'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></Field>
              <IconButton icon={Trash2} tone="danger" label="Remove action" onClick={() => setF({ ...f, actions: f.actions.filter((_, j) => j !== i) })} />
              {a.type === 'course' && <Field label="Course" className="col-span-2 md:col-span-5"><select className="input" value={a.course} onChange={(e) => setAction(i, { course: e.target.value })}><option value="">—</option>{courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}</select></Field>}
            </li>
          ))}</ul>
          <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => setF({ ...f, actions: [...f.actions, { title: '', type: 'course', status: 'planned', targetDate: '', course: '' }] })}><Plus className="h-4 w-4" /> Add action</Button>
        </div>
        <Button loading={busy}>Save plan</Button>
      </form>
    </Card>
  );
}

export default function Learning() {
  const [tab, setTab] = useState('todo');
  const { data, loading, reload } = useFetch('/training/mine', { initial: { enrollments: [], upcomingSessions: [], plan: null } });
  const { data: catalogue, reload: reloadCatalogue } = useFetch('/training/catalogue', { initial: [] });
  const [booking, setBooking] = useState(null);
  const [rating, setRating] = useState(null);
  const todo = data.enrollments.filter((e) => OPEN.includes(e.status));
  const history = data.enrollments.filter((e) => ['completed', 'failed'].includes(e.status));
  const mandatoryOk = catalogue.filter((c) => c.mandatoryForMe).filter((c) => history.some((e) => e.course._id === c._id && e.status === 'completed' && (!e.expiresAt || new Date(e.expiresAt) > new Date()))).length;
  const mandatoryTotal = catalogue.filter((c) => c.mandatoryForMe).length;

  const book = async (sessionId) => {
    try { await api.post(`/training/enrollments/${booking._id}/book`, { session: sessionId }); toast.success("You're booked in"); setBooking(null); reload(); reloadCatalogue(); } catch (e) { toastError(e); }
  };
  const request = async (c) => { try { await api.post(`/training/courses/${c._id}/request`, { reason: '' }); toast.success('Request sent to HR'); reload(); } catch (e) { toastError(e); } };

  if (loading && !data.enrollments.length) return <Spinner />;
  return (
    <div>
      <PageHeader title="My learning" subtitle="Mandatory training, courses you're booked on, and your development." />
      <div className="stagger mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-5 text-white shadow-sm"><p className="text-sm text-brand-100"><Term>Mandatory training</Term></p><p className="mt-2 text-4xl font-semibold">{mandatoryOk}/{mandatoryTotal}</p><p className="text-xs text-brand-100">up to date</p></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500"><Term>To do</Term></p><p className="mt-2 text-4xl font-semibold">{todo.length}</p></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500"><Term>Completed</Term></p><p className="mt-2 text-4xl font-semibold">{history.filter((e) => e.status === 'completed').length}</p></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500"><Term>Next session</Term></p><p className="mt-2 text-lg font-semibold">{(() => { const n = data.enrollments.filter((e) => e.status === 'registered' && e.session).sort((a, b) => new Date(a.session.startsAt) - new Date(b.session.startsAt))[0]; return n ? fmtDate(n.session.startsAt) : '—'; })()}</p></div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'todo', label: 'To do', count: todo.length }, { value: 'history', label: 'History' }, { value: 'catalogue', label: 'Course catalogue' }, { value: 'plan', label: 'Development plan' }]} />

      {tab === 'todo' && (todo.length === 0 ? <Card><Empty icon={GraduationCap} title="You're up to date" /></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">{todo.map((e) => (
          <Card key={e._id}>
            <div className="flex flex-wrap items-center gap-2">{e.mandatory && <Badge color="red">Mandatory</Badge>}<StatusPill e={e} /></div>
            <h3 className="mt-2 text-lg font-semibold">{e.course.title}</h3>
            <p className="text-sm text-slate-500">{titleCase(e.course.delivery)} · {e.course.durationHours || '?'} hours{e.course.provider && ` · ${e.course.provider}`}</p>
            {e.session && <p className="mt-2 flex items-center gap-1.5 text-sm text-sky-800"><CalendarClock className="h-4 w-4" />{fmtDateTime(e.session.startsAt)}{e.session.location && ` · ${e.session.location}`}</p>}
            {e.notes && <p className="mt-2 text-sm text-amber-700">{e.notes}</p>}
            {['assigned', 'registered'].includes(e.status) && <Button size="sm" variant={e.session ? 'secondary' : 'primary'} className="mt-4" onClick={() => setBooking(e)}>{e.session ? 'Change session' : 'Book a session'}</Button>}
          </Card>
        ))}</div>
      ))}

      {tab === 'history' && (
        <Card bodyClass="p-0">{history.length === 0 ? <Empty title="No completed training yet" /> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th><Term>Course</Term></th><th><Term>Completed</Term></th><th><Term>Score</Term></th><th><Term>Status</Term></th><th><Term>Your rating</Term></th></tr></thead>
            <tbody>{history.map((e) => (
              <tr key={e._id}>
                <td><p className="font-medium">{e.course.title}</p>{e.certificate && <p className="text-xs text-emerald-700">Certificate added: {e.certificate.title}</p>}</td>
                <td>{fmtDate(e.completedAt)}</td><td>{e.score ?? '—'}</td><td><StatusPill e={e} /></td>
                <td>{e.feedback?.rating ? <span className="flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= e.feedback.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />)}</span>
                  : e.status === 'completed' && <Button size="sm" variant="ghost" onClick={() => setRating({ e, rating: 0, comment: '' })}>Rate course</Button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}</Card>
      )}

      {tab === 'catalogue' && (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{catalogue.map((c) => {
          const mine = data.enrollments.find((e) => e.course._id === c._id && (OPEN.includes(e.status) || (e.status === 'completed' && (!e.expiresAt || new Date(e.expiresAt) > new Date()))));
          return (
            <Card key={c._id}>
              <div className="flex flex-wrap gap-1.5"><Badge color="teal">{titleCase(c.category)}</Badge>{c.mandatoryForMe && <Badge color="red">Required for you</Badge>}</div>
              <h3 className="mt-2 font-semibold">{c.title}</h3>
              <p className="text-xs text-slate-500">{titleCase(c.delivery)} · {c.durationHours || '?'}h{c.validityMonths ? ` · valid ${c.validityMonths} months` : ''}</p>
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{c.description}</p>
              {c.sessions.length > 0 && <p className="mt-2 text-xs text-slate-500">Next session {fmtDate(c.sessions[0].startsAt)} · {c.sessions[0].capacity - c.sessions[0].booked} places left</p>}
              <div className="mt-3">{mine ? <StatusPill e={mine} /> : <Button size="sm" variant="secondary" onClick={() => request(c)}><BookOpen className="h-4 w-4" /> Request</Button>}</div>
            </Card>
          );
        })}</div>
      )}

      {tab === 'plan' && <DevPlan plan={data.plan} courses={catalogue} onSaved={reload} />}

      {booking && (() => {
        const sessions = catalogue.find((c) => c._id === booking.course._id)?.sessions || [];
        return (
          <Modal open onClose={() => setBooking(null)} title={`Book ${booking.course.title}`}>
            {sessions.length === 0 ? <Empty title="No sessions scheduled yet">You'll be notified when HR adds one.</Empty> : (
              <ul className="space-y-2">{sessions.map((s) => {
                const full = s.booked >= s.capacity;
                return (
                  <li key={s._id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-3">
                    <span className="min-w-0 flex-1"><span className="block font-medium">{fmtDateTime(s.startsAt)}</span><span className="text-sm text-slate-500">{s.location || 'Location TBC'}{s.facilitator && ` · ${s.facilitator}`} · {s.capacity - s.booked} places left</span></span>
                    <Button size="sm" disabled={full || booking.session?._id === s._id} onClick={() => book(s._id)}>{booking.session?._id === s._id ? 'Booked' : full ? 'Full' : 'Book'}</Button>
                  </li>
                );
              })}</ul>
            )}
          </Modal>
        );
      })()}
      {rating && (
        <Modal open onClose={() => setRating(null)} title={`Rate ${rating.e.course.title}`} footer={<Button disabled={!rating.rating} onClick={async () => { try { await api.post(`/training/enrollments/${rating.e._id}/feedback`, { rating: rating.rating, comment: rating.comment }); toast.success('Thanks for the feedback'); setRating(null); reload(); } catch (e) { toastError(e); } }}>Send</Button>}>
          <div className="mb-4 flex justify-center gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} stars`} className="p-1" onClick={() => setRating({ ...rating, rating: n })}><Star className={`h-9 w-9 ${n <= rating.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} /></button>)}</div>
          <Field label="Comments (optional)"><textarea rows={3} className="input" value={rating.comment} onChange={(e) => setRating({ ...rating, comment: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
}
