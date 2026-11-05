import { useState } from 'react';
import { History } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, PageHeader, Spinner } from '../../components/ui';
import { fmtDateTime, titleCase } from '../../lib/format';
import { Term } from '../../components/InfoTip';

const METHOD = { POST: ['Created', 'green'], PUT: ['Updated', 'blue'], PATCH: ['Updated', 'blue'], DELETE: ['Deleted', 'red'] };

// Read-only record of every change made through the system: who, when, what, which fields.
export default function AuditTrail() {
  const [resource, setResource] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading } = useFetch('/audit', { params: { resource, page } });
  const resources = ['users', 'org', 'policies', 'rosters', 'attendance', 'certificates', 'requests', 'announcements', 'notes', 'settings'];

  return (
    <div>
      <PageHeader title="Audit trail" subtitle="Every change made in Solucio HR: who did it and when. Values like passwords and bank numbers are never recorded." />
      <Card bodyClass="p-0" title={data ? `${data.total} changes` : 'Changes'} action={
        <select className="input w-full sm:w-52" aria-label="Area" value={resource} onChange={(e) => { setResource(e.target.value); setPage(1); }}>
          <option value="">All areas</option>{resources.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
        </select>}>
        {loading && !data ? <Spinner /> : !data?.items.length ? <Empty icon={History} title="No changes recorded yet" /> : (
          <>
            <div className="overflow-x-auto"><table className="table">
              <thead><tr><th><Term>When</Term></th><th><Term>Who</Term></th><th><Term>Action</Term></th><th><Term>Where</Term></th><th><Term>Fields</Term></th></tr></thead>
              <tbody>{data.items.map((a) => {
                const [label, color] = METHOD[a.method] || [a.method, 'slate'];
                return (
                  <tr key={a._id}>
                    <td className="whitespace-nowrap">{fmtDateTime(a.at)}</td>
                    <td>{a.actorName} <span className="text-xs text-slate-500">({a.role})</span></td>
                    <td><Badge color={color}>{label}</Badge></td>
                    <td className="font-mono text-xs">{a.path}</td>
                    <td className="max-w-xs text-xs text-slate-500">{a.fields?.join(', ') || '—'}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
            {data.pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</Button>
                <span className="text-slate-500">Page {data.page} of {data.pages}</span>
                <Button size="sm" variant="secondary" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Older</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
