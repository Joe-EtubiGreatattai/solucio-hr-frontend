import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarRange, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, Spinner } from '../../components/ui';
import { useConfirm } from '../../components/Confirm';
import { useUndoDelete } from '../../lib/undo';
import { fmtDate, ymd } from '../../lib/format';
import { Term } from '../../components/InfoTip';
import StaffingRules from '../../components/StaffingRules';

export default function Rosters() {
  const { data: allRosters, loading } = useFetch('/rosters', { initial: [] });
  const undo = useUndoDelete();
  const rosters = undo.visible(allRosters);
  const ask = useConfirm();
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] } });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const today = new Date();
  const [form, setForm] = useState({ title: '', department: '', startDate: ymd(today), endDate: ymd(new Date(today.getTime() + 13 * 86400000)), notes: '' });
  const [busy, setBusy] = useState(false);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/rosters', form);
      toast.success('Roster created. Now assign shifts.');
      navigate(`/admin/rosters/${data._id}`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r) => {
    const ok = await ask({
      title: `Delete "${r.title}"?`,
      message: `This removes all ${r.shifts} shift(s) for ${r.staff} staff${r.status === 'published' ? ', and they will disappear from staff rosters' : ''}. You'll have a few seconds to undo.`,
      confirmLabel: 'Delete roster',
      tone: 'danger',
    });
    if (ok) undo.remove({ id: r._id, url: `/rosters/${r._id}`, message: `"${r.title}" deleted` });
  };

  return (
    <div>
      <PageHeader title="Rosters" subtitle="Create duty rosters, assign staff to shifts, then publish them to staff."
        actions={<><Button variant="secondary" onClick={() => setRulesOpen(true)}><ShieldCheck className="h-4 w-4" /> Minimum staffing</Button><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New roster</Button></>} />
      {rulesOpen && <StaffingRules onClose={() => setRulesOpen(false)} />}
      <Card bodyClass="p-0">
        {loading ? <Spinner /> : rosters.length === 0 ? <Empty icon={CalendarRange} title="No rosters yet" /> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th><Term>Roster</Term></th><th><Term>Period</Term></th><th><Term>Department</Term></th><th><Term>Staff</Term></th><th><Term>Shifts</Term></th><th><Term>Status</Term></th><th /></tr></thead>
            <tbody>{rosters.map((r) => (
              <tr key={r._id}>
                <td><Link to={`/admin/rosters/${r._id}`} className="font-semibold hover:text-brand-700">{r.title}</Link></td>
                <td>{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</td>
                <td>{r.department || 'All'}</td><td>{r.staff}</td><td>{r.shifts}</td>
                <td><Badge status={r.status} /></td>
                <td className="whitespace-nowrap text-right">
                  <Link to={`/admin/rosters/${r._id}`} className="mr-2 text-sm font-semibold text-brand-700 hover:underline">Open</Link>
                  <IconButton icon={Trash2} tone="danger" label={`Delete ${r.title}`} onClick={() => remove(r)} />
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New roster"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button form="roster-form" loading={busy}>Create</Button></>}>
        <form id="roster-form" onSubmit={create} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2"><input className="input" required placeholder="e.g. Nursing, November week 1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Start date"><input type="date" className="input" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="End date"><input type="date" className="input" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
          <Field label="Department (optional)" className="sm:col-span-2">
            <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">All departments</option>
              {meta.departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Notes" className="sm:col-span-2"><textarea rows={2} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </form>
      </Modal>
    </div>
  );
}
