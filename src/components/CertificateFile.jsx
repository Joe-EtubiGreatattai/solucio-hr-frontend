import { useEffect, useRef, useState } from 'react';
import { Camera, ExternalLink, FileText, Upload, X } from 'lucide-react';
import api, { openFile } from '../lib/api';
import { Badge, Button, Modal } from './ui';
import { fmtDate } from '../lib/format';

const DOC_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx';
const MAX_MB = 10;
export const MAX_FILES = 6;

const defaultLabel = (i) => (i === 0 ? 'Front' : i === 1 ? 'Back' : `Page ${i + 1}`);
const fileUrl = (certId, fileId) => `/certificates/${certId}/files/${fileId}`;
const isImage = (mimetype) => mimetype?.startsWith('image/');

// Object URL for a protected image, fetched with the auth header.
function useAuthImage(url) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!url) return;
    let objectUrl;
    let cancelled = false;
    api.get(url, { responseType: 'blob' })
      .then((r) => { if (!cancelled) { objectUrl = URL.createObjectURL(r.data); setSrc(objectUrl); } })
      .catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return src;
}

function useLocalPreview(file) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!isImage(file?.type)) return setSrc(null);
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return src;
}

function Tile({ item, certId, onLabel, onRemove }) {
  const local = useLocalPreview(item.file);
  const remote = useAuthImage(item.existing && isImage(item.existing.mimetype) ? fileUrl(certId, item.existing._id) : null);
  const src = local || remote;
  const name = item.file?.name || item.existing?.originalName;
  return (
    <div className="animate-pop-in overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="relative flex h-36 items-center justify-center bg-slate-50">
        {src ? <img src={src} alt={item.label} className="h-full w-full object-contain" /> : (
          <div className="flex flex-col items-center gap-1 px-2 text-center text-xs text-slate-500">
            <FileText className="h-8 w-8 text-slate-400" /><span className="line-clamp-2 break-all">{name}</span>
          </div>
        )}
        <button type="button" onClick={onRemove} title="Remove" aria-label={`Remove ${item.label || "page"}`}
          className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-slate-500 shadow hover:text-rose-600">
          <X className="h-4 w-4" />
        </button>
        {item.existing && <span className="absolute left-1.5 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-xs font-semibold text-slate-500 shadow">Saved</span>}
      </div>
      <input className="w-full border-t border-slate-200 px-2 py-1.5 text-sm outline-none focus:bg-brand-50" list="cert-page-labels"
        value={item.label} onChange={(e) => onLabel(e.target.value)} placeholder="Label (e.g. Front)" />
    </div>
  );
}

// Multi-page picker. `value` is a list of { key, label, file } (new) or { key, label, existing } (already saved).
export function CertFilesInput({ value, onChange, certId }) {
  const cameraRef = useRef();
  const fileRef = useRef();
  const [error, setError] = useState('');

  const add = (e) => {
    const picked = [...e.target.files];
    e.target.value = ''; // allow re-selecting the same file
    if (!picked.length) return;
    const tooBig = picked.filter((f) => f.size > MAX_MB * 1024 * 1024);
    const ok = picked.filter((f) => f.size <= MAX_MB * 1024 * 1024).slice(0, MAX_FILES - value.length);
    setError(tooBig.length ? `${tooBig.length} file(s) over ${MAX_MB} MB were skipped` : picked.length > ok.length ? `Only ${MAX_FILES} files allowed per certificate` : '');
    onChange([...value, ...ok.map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, label: defaultLabel(value.length + i) }))]);
  };

  const full = value.length >= MAX_FILES;
  return (
    <div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={add} />
      <input ref={fileRef} type="file" accept={DOC_ACCEPT} multiple className="hidden" onChange={add} />
      <datalist id="cert-page-labels">{['Front', 'Back', 'Page 2', 'Page 3', 'Transcript'].map((l) => <option key={l} value={l} />)}</datalist>

      {value.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((item, i) => (
            <Tile key={item.key} item={item} certId={certId}
              onLabel={(label) => onChange(value.map((v, j) => (j === i ? { ...v, label } : v)))}
              onRemove={() => onChange(value.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      <div className={`rounded-lg border-2 border-dashed border-slate-300 text-center ${value.length ? 'p-3' : 'p-5'}`}>
        {!value.length && <p className="mb-3 text-sm text-slate-500">Take clear photos of the front and back, or upload a scan or PDF.</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="secondary" disabled={full} onClick={() => cameraRef.current.click()}>
            <Camera className="h-4 w-4" /> {value.length ? `Take photo of ${defaultLabel(value.length).toLowerCase()}` : 'Take photo of front'}
          </Button>
          <Button type="button" variant="secondary" disabled={full} onClick={() => fileRef.current.click()}><Upload className="h-4 w-4" /> Choose files</Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Up to {MAX_FILES} files · JPG, PNG, WEBP, PDF or Word · max {MAX_MB} MB each</p>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

// Turn a saved certificate's files into picker items.
export const itemsFromCert = (cert) =>
  (cert?.files || []).map((f, i) => ({ key: f._id, existing: f, label: f.label || defaultLabel(i) }));

// Append picker items to FormData in the shape the API expects.
export function appendFiles(fd, items, cert) {
  const added = items.filter((i) => i.file);
  added.forEach((i) => fd.append('files', i.file));
  fd.append('labels', JSON.stringify(added.map((i) => i.label)));
  if (cert) {
    const kept = items.filter((i) => i.existing);
    const keptIds = new Set(kept.map((i) => i.existing._id));
    fd.append('removeFiles', JSON.stringify(cert.files.filter((f) => !keptIds.has(f._id)).map((f) => f._id)));
    fd.append('fileLabels', JSON.stringify(Object.fromEntries(kept.map((i) => [i.existing._id, i.label]))));
  }
}

function ViewerPage({ cert, file, index }) {
  const src = useAuthImage(isImage(file.mimetype) ? fileUrl(cert._id, file._id) : null);
  return (
    <figure className="overflow-hidden rounded-lg border border-slate-200">
      <figcaption className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm">
        <span className="font-semibold">{file.label || defaultLabel(index)}</span>
        <button className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline" onClick={() => openFile(fileUrl(cert._id, file._id))}>
          Open <ExternalLink className="h-3 w-3" />
        </button>
      </figcaption>
      {isImage(file.mimetype) ? (
        src ? <img src={src} alt={file.label} className="max-h-[60vh] w-full bg-slate-50 object-contain" /> : <div className="h-48 animate-pulse bg-slate-100" />
      ) : (
        <div className="flex items-center gap-3 p-4 text-sm"><FileText className="h-8 w-8 text-slate-400" />{file.originalName}</div>
      )}
    </figure>
  );
}

export function CertViewer({ cert, onClose }) {
  return (
    <Modal open={!!cert} onClose={onClose} title={cert?.title} size="lg">
      {cert && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cert.files.map((f, i) => <ViewerPage key={f._id} cert={cert} file={f} index={i} />)}
        </div>
      )}
    </Modal>
  );
}

// Thumbnail of the first page with a page-count badge; click opens the viewer.
export function CertThumb({ cert }) {
  const [open, setOpen] = useState(false);
  const files = cert.files || [];
  const first = files.find((f) => isImage(f.mimetype)) || files[0];
  const src = useAuthImage(first && isImage(first.mimetype) ? fileUrl(cert._id, first._id) : null);

  if (!first) return <div className="h-12 w-12 shrink-0 rounded-md bg-slate-100" />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="View certificate" aria-label={`View ${cert.title} (${files.length} page${files.length === 1 ? '' : 's'})`}
        className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 hover:ring-2 hover:ring-brand-300">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <FileText className="h-5 w-5 text-slate-400" />}
        {files.length > 1 && <span className="absolute bottom-0 right-0 rounded-tl bg-slate-900/75 px-1 text-xs font-bold text-white">{files.length}</span>}
      </button>
      <CertViewer cert={open ? cert : null} onClose={() => setOpen(false)} />
    </>
  );
}

// Licences expire and must be renewed; certificates are permanent.
export const KIND_LABEL = { certificate: 'Certificate', licence: 'Licence' };

// One status for a certificate or licence: HR approval comes first, then (for licences) whether it is in date.
export function CertStatus({ cert, showNote = true }) {
  if (cert.verification === 'pending') return <Badge status="pending">Awaiting HR approval</Badge>;
  if (cert.verification === 'rejected') {
    return <>
      <Badge status="rejected">Not approved</Badge>
      {showNote && cert.verificationNote && <p className="mt-1 max-w-56 text-xs text-slate-500">{cert.verificationNote}</p>}
    </>;
  }
  if (cert.kind !== 'licence') return <Badge status="verified">Approved</Badge>;
  return <Badge status={cert.expiryStatus}>{{ valid: 'Valid', expiring_soon: 'Expiring soon', expired: 'Expired' }[cert.expiryStatus]}</Badge>;
}

export function ExpiryCell({ cert }) {
  if (cert.kind !== 'licence') return <span className="text-sm text-slate-400">Doesn't expire</span>;
  const d = cert.daysToExpiry;
  return <>
    {fmtDate(cert.expiryDate)}
    {d != null && <p className={`text-xs ${d < 0 ? 'text-rose-600' : d <= 60 ? 'text-amber-600' : 'text-slate-500'}`}>{d < 0 ? `${-d}d ago` : `in ${d}d`}</p>}
  </>;
}
