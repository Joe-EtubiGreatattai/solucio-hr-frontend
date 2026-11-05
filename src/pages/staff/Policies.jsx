import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, FileText } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { Badge, Card, Empty, PageHeader, Spinner } from '../../components/ui';
import { fmtDate } from '../../lib/format';
import { POLICY_CATEGORIES } from '../admin/AdminPolicies';

function PolicyItem({ p }) {
  return (
    <li>
      <Link to={`/policies/${p._id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${p.acknowledged ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          {p.acknowledged ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{p.title} <span className="text-xs font-normal text-slate-500">v{p.version}</span></span>
          <span className="block truncate text-sm text-slate-500">{p.summary || POLICY_CATEGORIES[p.category]}</span>
        </span>
        <span className="hidden shrink-0 text-right text-xs text-slate-500 sm:block">{p.acknowledged ? `Read ${fmtDate(p.acknowledgedAt)}` : `Since ${fmtDate(p.publishedAt)}`}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </Link>
    </li>
  );
}

export default function Policies() {
  const { data: policies, loading } = useFetch('/policies/mine', { initial: [] });
  const todo = policies.filter((p) => p.requiresAcknowledgement && !p.acknowledged);
  const rest = policies.filter((p) => !(p.requiresAcknowledgement && !p.acknowledged));
  return (
    <div>
      <PageHeader title="Policies" subtitle="The rules and procedures that apply to your role." />
      {loading ? <Spinner /> : policies.length === 0 ? <Card><Empty icon={FileText} title="No policies published yet" /></Card> : (
        <div className="space-y-6">
          {todo.length > 0 && (
            <Card title={<span className="flex items-center gap-2">Needs your acknowledgement <Badge color="amber">{todo.length}</Badge></span>} bodyClass="p-0" className="border-amber-200">
              <ul className="stagger divide-y divide-slate-100">{todo.map((p) => <PolicyItem key={p._id} p={p} />)}</ul>
            </Card>
          )}
          {rest.length > 0 && <Card title="All policies" bodyClass="p-0"><ul className="stagger divide-y divide-slate-100">{rest.map((p) => <PolicyItem key={p._id} p={p} />)}</ul></Card>}
        </div>
      )}
    </div>
  );
}
