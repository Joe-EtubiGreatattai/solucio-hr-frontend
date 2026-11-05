import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Circle, Mail, Phone, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Badge, Card, Empty, PageHeader, ProgressBar, Spinner, SuccessCheck } from '../../components/ui';
import { fmtDate, fullName, titleCase } from '../../lib/format';

const OWNER = { employee: 'You', hr: 'HR', manager: 'Your manager' };

function TaskRow({ t, canTick, onTick, now }) {
  const overdue = !t.done && t.dueDate && new Date(t.dueDate) < now;
  const body = (
    <span className="min-w-0 flex-1">
      <span className={`block font-medium ${t.done ? 'text-slate-500 line-through' : ''}`}>{t.title}</span>
      <span className={`block text-xs ${overdue ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>{t.autoCheck ? 'Ticks itself when done' : `${OWNER[t.owner]}`}{t.dueDate && ` · due ${fmtDate(t.dueDate)}`}</span>
    </span>
  );
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {canTick && !t.autoCheck ? (
        <button type="button" onClick={() => onTick(t)} aria-pressed={t.done} aria-label={`${t.done ? 'Untick' : 'Tick'} ${t.title}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100">
          {t.done ? <CheckCircle2 className="h-6 w-6 animate-pop-in text-emerald-500" /> : <Circle className="h-6 w-6 text-slate-300" />}
        </button>
      ) : <span className="flex h-10 w-10 shrink-0 items-center justify-center">{t.done ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <Circle className="h-6 w-6 text-slate-300" />}</span>}
      {body}
      {t.link && !t.done && <Link to={t.link} aria-label={`Go to ${t.title}`} className="flex h-10 w-10 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50"><ArrowUpRight className="h-4 w-4" /></Link>}
    </li>
  );
}

export default function MyOnboarding() {
  const { user } = useAuth();
  const { data: plan, loading, reload } = useFetch('/onboarding/mine');
  if (loading && !plan) return <Spinner />;
  if (!plan) return <div><PageHeader title="My onboarding" /><Card><Empty icon={Sparkles} title="No onboarding plan">You'll see your checklist here when you join or change role.</Empty></Card></div>;

  const tick = async (t) => {
    try { await api.put(`/onboarding/${plan._id}/tasks/${t._id}`, { done: !t.done }); if (!t.done) toast.success('Nice, one more done'); reload(); } catch (e) { toastError(e); }
  };
  const mine = plan.tasks.filter((t) => t.owner === 'employee');
  const others = plan.tasks.filter((t) => t.owner !== 'employee');
  const now = new Date();

  return (
    <div>
      <PageHeader title={plan.status === 'completed' ? "You're all set" : `Welcome, ${user.firstName}`} subtitle={plan.template?.name ? `${plan.template.name} · started ${fmtDate(plan.startDate)}` : undefined} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            {plan.status === 'completed' ? (
              <div className="flex animate-fade-up items-center gap-4"><SuccessCheck className="h-14 w-14 shrink-0" /><p><b>Onboarding complete.</b><br /><span className="text-sm text-slate-500">Every task is done. Welcome to the team.</span></p></div>
            ) : (
              <>
                <div className="flex items-baseline justify-between"><p className="font-semibold">Your progress</p><span className="text-3xl font-light">{plan.progress.percent}%</span></div>
                <div className="mt-3"><ProgressBar value={plan.progress.percent} tone="bg-brand-600" /></div>
                <p className="mt-2 text-sm text-slate-500">{plan.progress.done} of {plan.progress.total} tasks done</p>
              </>
            )}
          </Card>
          <Card title="Your tasks" bodyClass="p-0"><ul className="stagger divide-y divide-slate-100">{mine.map((t) => <TaskRow key={t._id} t={t} canTick onTick={tick} now={now} />)}</ul></Card>
          {others.length > 0 && <Card title="Being done for you" bodyClass="p-0"><ul className="divide-y divide-slate-100">{others.map((t) => <TaskRow key={t._id} t={t} now={now} />)}</ul></Card>}
        </div>
        <div className="space-y-6">
          {plan.buddy && (
            <Card title="Your buddy">
              <div className="flex items-center gap-3"><Avatar user={plan.buddy} size="lg" /><div><p className="font-semibold">{fullName(plan.buddy)}</p><p className="text-sm text-slate-500">{plan.buddy.jobTitle}</p></div></div>
              <p className="mt-3 text-sm text-slate-600">Your go-to person for questions in your first weeks.</p>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                {plan.buddy.email && <a href={`mailto:${plan.buddy.email}`} className="flex min-h-10 items-center gap-2 text-brand-700"><Mail className="h-4 w-4" />{plan.buddy.email}</a>}
                {plan.buddy.phone && <a href={`tel:${plan.buddy.phone}`} className="flex min-h-10 items-center gap-2 text-brand-700"><Phone className="h-4 w-4" />{plan.buddy.phone}</a>}
              </div>
            </Card>
          )}
          {plan.probation?.endDate && (
            <Card title="Probation">
              <p className="text-sm text-slate-600">{plan.probation.outcome === 'pending' ? `Your probation runs until ${fmtDate(plan.probation.endDate)}. Your manager will review it with you before then.` : 'Your probation has been reviewed.'}</p>
              <div className="mt-3"><Badge status={plan.probation.outcome === 'confirmed' ? 'approved' : plan.probation.outcome === 'pending' ? 'pending' : 'rejected'}>{titleCase(plan.probation.outcome)}</Badge></div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
