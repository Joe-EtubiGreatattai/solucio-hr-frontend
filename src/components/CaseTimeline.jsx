import { Eye, Lock } from 'lucide-react';
import { fmtDateTime, fullName } from '../lib/format';
import { EVENT_LABEL } from '../lib/relations';

// The case record, newest first. showPrivacy marks which entries the employee can see.
export default function CaseTimeline({ events, showPrivacy }) {
  if (!events.length) return <p className="text-sm text-slate-500">Nothing recorded yet.</p>;
  return (
    <ol className="stagger relative space-y-4 border-l-2 border-slate-200 pl-5">
      {[...events].reverse().map((e) => (
        <li key={e._id} className="relative">
          <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white ${e.kind === 'outcome' || e.kind === 'appeal' ? 'bg-amber-500' : e.kind === 'statement' ? 'bg-sky-500' : 'bg-brand-600'}`} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wide text-slate-600">{EVENT_LABEL[e.kind] || e.kind}</span>
            <span>{fmtDateTime(e.at)}</span>{e.by && <span>· {fullName(e.by)}</span>}
            {showPrivacy && (e.visibleToEmployee ? <span className="inline-flex items-center gap-1 text-sky-700"><Eye className="h-3 w-3" />Shared with employee</span> : <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />HR only</span>)}
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{e.text}</p>
        </li>
      ))}
    </ol>
  );
}
