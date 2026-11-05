import { useState } from 'react';
import { Award, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, Field, IconButton, Modal, PageHeader, Spinner } from '../../components/ui';
import { useUndoDelete } from '../../lib/undo';
import { fmtDate, ymd } from '../../lib/format';
import { CertFilesInput, CertStatus, CertThumb, ExpiryCell, KIND_LABEL, appendFiles, itemsFromCert } from '../../components/CertificateFile';
import { Term } from '../../components/InfoTip';

const blank = { kind: 'certificate', title: '', issuer: '', certificateNumber: '', issueDate: '', expiryDate: '', request: '' };

const KIND_HINT = {
  certificate: 'Qualifications and training, e.g. a degree or BLS course. Certificates don’t expire.',
  licence: 'Permission to practise, e.g. your nursing or pharmacy licence. Licences expire and HR will remind you to renew.',
};

export default function Certificates() {
  const undo = useUndoDelete();
  const { data: allCerts, loading, reload } = useFetch('/certificates/mine', { initial: [] });
  const certs = undo.visible(allCerts);
  const { data: requests, reload: reloadReqs } = useFetch('/certificates/requests/mine', { initial: [] });
  const [modal, setModal] = useState(null); // { mode: 'new'|'edit', id? }
  const [form, setForm] = useState(blank);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const openNew = (request) => {
    setForm({ ...blank, title: request?.title || '', request: request?._id || '' });
    setItems([]);
    setModal({ mode: 'new' });
  };
  const openEdit = (c) => {
    setForm({ ...blank, ...c, kind: c.kind || 'certificate', issueDate: c.issueDate ? ymd(c.issueDate) : '', expiryDate: c.expiryDate ? ymd(c.expiryDate) : '' });
    setItems(itemsFromCert(c));
    setModal({ mode: 'edit', id: c._id, cert: c });
  };

  const isLicence = form.kind === 'licence';
  const noun = isLicence ? 'licence' : 'certificate';

  const submit = async (e) => {
    e.preventDefault();
    if (!items.length) return toast.error(`Take a photo or attach the ${noun} file`);
    setBusy(true);
    try {
      const fd = new FormData();
      ['kind', 'title', 'issuer', 'certificateNumber', 'issueDate', 'request'].forEach((k) => form[k] && fd.append(k, form[k]));
      if (isLicence) fd.append('expiryDate', form.expiryDate);
      appendFiles(fd, items, modal.cert);
      if (modal.mode === 'new') await api.post('/certificates', fd);
      else await api.put(`/certificates/${modal.id}`, fd);
      toast.success(`Sent to HR for approval. It will count on your record once approved.`);
      setModal(null);
      reload(); reloadReqs();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = (c) => undo.remove({ id: c._id, url: `/certificates/${c._id}`, message: `"${c.title}" deleted` });

  const openRequests = requests.filter((r) => r.status === 'open');
  const awaiting = certs.filter((c) => c.verification === 'pending').length;

  return (
    <div>
      <PageHeader title="My certificates & licences" subtitle="Upload your licences and certificates. HR checks each one before it counts on your record."
        actions={<Button onClick={() => openNew()}><Plus className="h-4 w-4" /> Add certificate or licence</Button>} />

      {openRequests.length > 0 && (
        <Card title="Requested by HR" className="mb-6 border-amber-200" bodyClass="divide-y divide-slate-100">
          {openRequests.map((r) => (
            <div key={r._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-slate-500">{r.message}{r.dueDate && <> · Due <b>{fmtDate(r.dueDate)}</b></>}</p>
              </div>
              <Button size="sm" onClick={() => openNew(r)}><Upload className="h-4 w-4" /> Upload now</Button>
            </div>
          ))}
        </Card>
      )}

      {awaiting > 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {awaiting} upload{awaiting > 1 ? 's are' : ' is'} waiting for HR to approve. You'll get a notification when {awaiting > 1 ? 'they are' : 'it is'} checked.
        </p>
      )}

      <Card bodyClass="p-0">
        {loading ? <Spinner /> : certs.length === 0 ? <Empty icon={Award} title="Nothing uploaded yet">Add your practising licence, BLS and other certificates.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Name</th><th><Term>Type</Term></th><th><Term>Issued</Term></th><th><Term>Expires</Term></th><th><Term>Status</Term></th><th /></tr></thead>
              <tbody>
                {certs.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <CertThumb cert={c} />
                        <div>
                          <p className="font-medium">{c.title}</p>
                          <p className="text-xs text-slate-500">{[c.issuer, c.certificateNumber].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                    </td>
                    <td><Badge color={c.kind === 'licence' ? 'blue' : 'slate'}>{KIND_LABEL[c.kind] || 'Certificate'}</Badge></td>
                    <td>{fmtDate(c.issueDate)}</td>
                    <td><ExpiryCell cert={c} /></td>
                    <td><CertStatus cert={c} /></td>
                    <td className="whitespace-nowrap text-right">
                      <IconButton icon={Pencil} label={`Edit ${c.title}`} onClick={() => openEdit(c)} />
                      <IconButton icon={Trash2} tone="danger" label={`Delete ${c.title}`} onClick={() => remove(c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? `Update ${noun}` : 'Add a certificate or licence'}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button form="cert-form" loading={busy}>Send to HR</Button></>}>
        <form id="cert-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="label">What are you adding?</span>
            <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-2">
              {['certificate', 'licence'].map((k) => (
                <button key={k} type="button" role="radio" aria-checked={form.kind === k} onClick={() => setForm({ ...form, kind: k })}
                  className={`rounded-xl border p-3 text-left transition ${form.kind === k ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-300 hover:bg-slate-50'}`}>
                  <span className="block font-semibold text-slate-900">{KIND_LABEL[k]}</span>
                  <span className="block text-xs text-slate-500">{k === 'licence' ? 'Expires; needs renewing' : 'Never expires'}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">{KIND_HINT[form.kind]}</p>
          </div>
          <Field label={isLicence ? 'Licence name' : 'Certificate name'} className="sm:col-span-2"><input className="input" required value={form.title} placeholder={isLicence ? 'e.g. NMCN Practising Licence' : 'e.g. Basic Life Support (BLS)'} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Issuing body"><input className="input" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} /></Field>
          <Field label={isLicence ? 'Licence number' : 'Certificate number'}><input className="input" value={form.certificateNumber} onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })} /></Field>
          <Field label="Issue date"><input type="date" className="input" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} /></Field>
          {isLicence && <Field label="Expiry date"><input type="date" className="input" required value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></Field>}
          <div className="sm:col-span-2">
            <span className="label">Photos or files (front, back, extra pages)</span>
            <CertFilesInput value={items} onChange={setItems} certId={modal?.id} />
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">
            {modal?.mode === 'edit' ? `Changing a ${noun} sends it back to HR for approval.` : `HR will check it before it counts on your record.`}
          </p>
        </form>
      </Modal>
    </div>
  );
}
