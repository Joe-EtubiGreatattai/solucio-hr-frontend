import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NotebookPen } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner, Tabs } from '../../components/ui';
import { fmtDateTime, fullName, titleCase } from '../../lib/format';
import { KIND_COLOR, NOTE_KINDS } from '../staff/Notes';

export default function AdminNotes() {
  const navigate = useNavigate();
  const [f, setF] = useState({ kind: '', status: 'open' });
  const { data: notes, loading, reload } = useFetch('/notes', { params: f, initial: [] });
  const [sel, setSel] = useState(null);
  const [resp, setResp] = useState({ status: 'reviewed', adminResponse: '' });

  const save = async () => {
    try {
      await api.put(`/notes/${sel._id}/review`, resp);
      toast.success('Response saved and author notified');
      setSel(null);
      reload();
    } catch (e) { toastError(e); }
  };

  return (
    <div>
      <PageHeader title="Staff reports & observations" subtitle="Notes, observations, reports and incidents that staff have shared with management" />
      <Tabs value={f.status} onChange={(v) => setF({ ...f, status: v })} tabs={[
        { value: 'open', label: 'Open' }, { value: 'reviewed', label: 'Reviewed' }, { value: 'actioned', label: 'Actioned' }, { value: '', label: 'All' },
      ]} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ value: '', label: 'All kinds' }, ...NOTE_KINDS].map((k) => (
          <button key={k.value} onClick={() => setF({ ...f, kind: k.value })}
            className={`min-h-10 rounded-full px-3.5 py-1.5 text-sm font-semibold desk:min-h-0 desk:px-3 desk:py-1 desk:text-xs ${f.kind === k.value ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{k.label}</button>
        ))}
      </div>
      {loading ? <Spinner /> : notes.length === 0 ? <Card><Empty icon={NotebookPen} title="Nothing to review" /></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
          {notes.map((n) => (
            <Card key={n._id}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <Link to={`/admin/staff/${n.author?._id}`} className="flex items-center gap-2 hover:text-brand-700">
                  <Avatar user={n.author} size="sm" />
                  <span className="text-sm"><b>{fullName(n.author)}</b><span className="block text-xs text-slate-500">{n.author?.jobTitle} · {n.author?.department}</span></span>
                </Link>
                <div className="flex gap-1.5"><Badge color={KIND_COLOR[n.kind]}>{titleCase(n.kind)}</Badge><Badge status={n.status} /></div>
              </div>
              <h3 className="font-semibold">{n.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{n.body}</p>
              {n.subject && <p className="mt-2 text-xs text-slate-500">Concerning: <Link className="font-semibold text-brand-700" to={`/admin/staff/${n.subject._id}`}>{fullName(n.subject)}</Link></p>}
              {n.adminResponse && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm"><b>Response:</b> {n.adminResponse}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">{fmtDateTime(n.createdAt)}</span>
                <span className="flex flex-wrap justify-end gap-2">
                  {n.status !== 'actioned' && n.kind !== 'note' && <Button size="sm" variant="ghost" onClick={() => navigate('/admin/relations', { state: { newCase: { fromNote: n._id, type: n.subject ? 'disciplinary' : 'investigation', employee: n.subject?._id || '', category: n.kind === 'incident' ? 'safety' : 'conduct', title: n.title, description: n.body } } })}>Open case</Button>}
                  <Button size="sm" variant="secondary" onClick={() => { setSel(n); setResp({ status: n.status === 'open' ? 'reviewed' : n.status, adminResponse: n.adminResponse || '' }); }}>Respond</Button>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title={`Respond to ${sel?.kind}`}
        footer={<><Button variant="secondary" onClick={() => setSel(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        <div className="space-y-4">
          <Field label="Status"><select className="input" value={resp.status} onChange={(e) => setResp({ ...resp, status: e.target.value })}>
            <option value="open">Open</option><option value="reviewed">Reviewed</option><option value="actioned">Actioned</option>
          </select></Field>
          <Field label="Response to author"><textarea rows={4} className="input" value={resp.adminResponse} onChange={(e) => setResp({ ...resp, adminResponse: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
