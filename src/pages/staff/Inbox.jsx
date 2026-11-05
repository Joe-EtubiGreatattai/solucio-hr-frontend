import { useState } from 'react';
import { Mail } from 'lucide-react';
import api from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Card, Empty, PageHeader, Spinner } from '../../components/ui';
import { fmtDateTime, fullName } from '../../lib/format';

export default function Inbox() {
  const { data: items, setData, loading } = useFetch('/announcements/mine', { initial: [] });
  const [selected, setSelected] = useState(null);

  const open = (a) => {
    setSelected(a);
    if (!a.read) {
      api.post(`/announcements/${a._id}/read`);
      setData(items.map((x) => (x._id === a._id ? { ...x, read: true } : x)));
    }
  };

  return (
    <div>
      <PageHeader title="Inbox" subtitle="Announcements and messages from management" />
      {loading ? <Spinner /> : items.length === 0 ? <Card><Empty icon={Mail} title="No messages yet" /></Card> : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card bodyClass="p-0" className="lg:col-span-2">
            <ul className="stagger max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {items.map((a) => (
                <li key={a._id}>
                  <button onClick={() => open(a)} className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${selected?._id === a._id ? 'bg-brand-50' : ''}`}>
                    <div className="flex items-center gap-2">
                      {!a.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                      <p className={`truncate ${a.read ? 'text-slate-700' : 'font-semibold'}`}>{a.title}</p>
                      {a.priority !== 'normal' && <Badge status={a.priority} />}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{a.body}</p>
                    <p className="mt-1 text-xs text-slate-500">{fmtDateTime(a.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="lg:col-span-3">
            {selected ? (
              <article key={selected._id} className="animate-fade-up">
                <div className="flex items-center gap-2">{selected.priority !== 'normal' && <Badge status={selected.priority} />}</div>
                <h2 className="mt-2 text-xl font-bold">{selected.title}</h2>
                <p className="mt-1 text-sm text-slate-500">From {fullName(selected.createdBy)} · {fmtDateTime(selected.createdAt)}</p>
                <div className="mt-5 whitespace-pre-wrap leading-relaxed text-slate-700">{selected.body}</div>
              </article>
            ) : <Empty icon={Mail} title="Select a message to read" />}
          </Card>
        </div>
      )}
    </div>
  );
}
