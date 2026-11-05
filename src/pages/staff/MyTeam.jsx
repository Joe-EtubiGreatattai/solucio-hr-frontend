import { Link } from 'react-router-dom';
import { Mail, Phone, Users } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import TeamRequests from '../../components/TeamRequests';
import { Avatar, Badge, Card, Empty, PageHeader, Spinner } from '../../components/ui';
import { fmtDate, fullName } from '../../lib/format';

// For line managers: the people who report to them.
export default function MyTeam() {
  const { data: team, loading } = useFetch('/users/my-team', { initial: [] });
  return (
    <div>
      <PageHeader title="My team" subtitle="People who report to you." />
      <TeamRequests />
      {loading ? <Spinner /> : team.length === 0 ? <Card><Empty icon={Users} title="Nobody reports to you" /></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {team.map((m) => (
            <Card key={m._id}>
              <div className="flex items-center gap-3"><Avatar user={m} size="lg" />
                <div className="min-w-0"><p className="truncate text-lg font-semibold">{fullName(m)}</p><p className="truncate text-sm text-slate-500">{m.jobTitle || '—'} · {m.department || '—'}</p></div></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge status={m.status} />
                {m.probationEndDate && new Date(m.probationEndDate) > new Date() && <Badge color="amber">{`On probation until ${fmtDate(m.probationEndDate)}`}</Badge>}
              </div>
              <div className="mt-4 flex flex-col gap-2 text-sm">
                {m.email && <a href={`mailto:${m.email}`} className="flex min-h-10 items-center gap-2 text-slate-600 hover:text-brand-700"><Mail className="h-4 w-4" />{m.email}</a>}
                {m.phone && <a href={`tel:${m.phone}`} className="flex min-h-10 items-center gap-2 text-slate-600 hover:text-brand-700"><Phone className="h-4 w-4" />{m.phone}</a>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/performance?tab=team" className="inline-flex min-h-10 items-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">Team goals & reviews</Link>
      </div>
    </div>
  );
}
