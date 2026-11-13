import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Crosshair, Expand, ImageOff, MapPin, RefreshCw, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useLive } from '../../context/LiveContext';
import { playNotificationSound } from '../../lib/sound';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader } from '../../components/ui';
import { fmtTime, fullName, timeAgo } from '../../lib/format';
import { Term } from '../../components/InfoTip';

function DeskQr() {
  const [state, setState] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [resetKey, setResetKey] = useState(0);
  useLive(['settings'], () => setResetKey((k) => k + 1));

  useEffect(() => {
    let timer;
    const load = async () => {
      try {
        const { data } = await api.get('/settings/desk-code');
        setState({ ...data, fetchedAt: Date.now() });
        timer = setTimeout(load, data.expiresIn * 1000 + 300);
      } catch {
        timer = setTimeout(load, 5000);
      }
    };
    load();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(timer); clearInterval(tick); };
  }, [resetKey]);

  const remaining = state ? Math.max(0, state.expiresIn - Math.floor((now - state.fetchedAt) / 1000)) : 0;
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {state ? <span key={state.code} className="block animate-fade-in"><QRCodeSVG value={`${window.location.origin}/check-in?k=${state.code}`} size={240} level="M" /></span>
          : <div className="h-60 w-60 animate-pulse rounded bg-slate-100" />}
      </div>
      <p key={state?.code} className="mt-4 animate-fade-up font-mono text-4xl font-bold tracking-[0.35em] text-slate-800">{state?.code || '······'}</p>
      <div className="mt-3 h-1.5 w-60 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-brand-500 transition-all duration-1000 ease-linear" style={{ width: `${state ? (remaining / state.period) * 100 : 0}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">New code in {remaining}s</p>
    </div>
  );
}

const RADII = [100, 200, 300, 500, 1000];

// The area staff must be inside to check in. The desk screen sits in the hospital,
// so its own position is the easiest way to set the centre.
function SiteLocation() {
  const { data, reload } = useFetch('/settings/geofence');
  const [form, setForm] = useState(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setForm({ enabled: false, name: '', lat: '', lng: '', radius: 200, ...data }); }, [data]);
  if (!form) return null;

  const hasPoint = form.lat !== '' && form.lat != null && form.lng !== '' && form.lng != null;
  const useHere = () => {
    if (!window.isSecureContext || !navigator.geolocation) return toast.error('Location needs the secure (https) address of the system.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((f) => ({ ...f, lat: +coords.latitude.toFixed(6), lng: +coords.longitude.toFixed(6) }));
        setLocating(false);
        toast.success(`Location found (accurate to ${Math.round(coords.accuracy)}m)`);
      },
      () => { setLocating(false); toast.error("Couldn't get this device's location. Allow location for this site and try again."); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  const save = async (changes = {}) => {
    const next = { ...form, ...changes };
    setBusy(true);
    try {
      await api.put('/settings/geofence', next);
      toast.success(next.enabled ? `Check-in limited to within ${next.radius}m of the hospital` : 'Location check turned off');
      reload();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };

  return (
    <Card title="Hospital location" action={<Badge color={data.enabled ? 'teal' : 'slate'}>{data.enabled ? `On · ${data.radius}m` : 'Off'}</Badge>}>
      <p className="mb-4 text-sm text-slate-500">
        When on, a scan only counts if the phone is inside this area, so a photo of the code can't be used from home.
      </p>
      <div className="space-y-3">
        <Field label="Site name"><input className="input" placeholder="e.g. Solucio Hospital, main campus" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude"><input className="input font-mono" inputMode="decimal" value={form.lat ?? ''} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></Field>
          <Field label="Longitude"><input className="input font-mono" inputMode="decimal" value={form.lng ?? ''} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button variant="secondary" size="sm" loading={locating} onClick={useHere}><Crosshair className="h-4 w-4" /> Use this device's location</Button>
          {hasPoint && <a className="text-sm font-medium text-brand-700 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${form.lat},${form.lng}`}><MapPin className="mr-0.5 inline h-3.5 w-3.5" />Check on map</a>}
        </div>
        <Field label="Allowed distance" hint="Covers the whole site, including car parks. Phones indoors can be 20–50m out.">
          <select className="input" value={form.radius} onChange={(e) => setForm({ ...form, radius: Number(e.target.value) })}>
            {[...new Set([...RADII, Number(form.radius)])].sort((a, b) => a - b).map((r) => <option key={r} value={r}>Within {r >= 1000 ? `${r / 1000}km` : `${r}m`}</option>)}
          </select>
        </Field>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {data.enabled
            ? <><Button variant="secondary" loading={busy} onClick={() => save({ enabled: false })}>Turn off</Button><Button loading={busy} onClick={() => save({ enabled: true })}>Save</Button></>
            : <Button loading={busy} disabled={!hasPoint} onClick={() => save({ enabled: true })}>Turn on location check</Button>}
        </div>
      </div>
    </Card>
  );
}

function ManualCheckIn({ open, onClose }) {
  const { data: staff } = useFetch('/users/directory', { initial: [] });
  const [user, setUser] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/attendance/check-in-requests/manual', { user, note });
      toast.success('Checked in');
      setUser(''); setNote('');
      onClose();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Check someone in manually" size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="manual-form" loading={busy} disabled={!user}>Check in</Button></>}>
      <form id="manual-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500"><Term>For staff without their phone or camera. Only do this once you've confirmed who they are in person.</Term></p>
        <Field label="Staff member">
          <select className="input" required value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">Select…</option>
            {staff.map((s) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} · {s.staffId}</option>)}
          </select>
        </Field>
        <Field label="Note (optional)"><input className="input" placeholder="e.g. phone battery dead" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}

// The check-in selfie, fetched with the admin's sign-in (it isn't public).
function Selfie({ request, className = '' }) {
  const [src, setSrc] = useState(null);
  const [missing, setMissing] = useState(!request.face?.selfie);
  useEffect(() => {
    if (!request.face?.selfie) return undefined;
    let url;
    api.get(`/attendance/check-in-requests/${request._id}/selfie`, { responseType: 'blob' })
      .then(({ data }) => { url = URL.createObjectURL(data); setSrc(url); })
      .catch(() => setMissing(true));
    return () => url && URL.revokeObjectURL(url);
  }, [request._id, request.face?.selfie]);
  if (missing) return <div className={`flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-100 text-center text-xs text-slate-500 ${className}`}><ImageOff className="h-5 w-5" />No selfie</div>;
  return src ? <img src={src} alt={`Check-in selfie of ${fullName(request.user)}`} className={`rounded-xl object-cover ${className}`} />
    : <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

const avatarSrc = (path) => (path?.startsWith('/uploads') ? `${import.meta.env.VITE_API_ORIGIN || ''}${path}` : path);

function ProfilePhoto({ user, className = '' }) {
  return user.avatar ? <img src={avatarSrc(user.avatar)} alt={`Profile photo of ${fullName(user)}`} className={`rounded-xl object-cover ${className}`} />
    : <div className={`flex flex-col items-center justify-center gap-1 rounded-xl bg-amber-50 text-center text-xs text-amber-800 ${className}`}><ImageOff className="h-5 w-5" />No profile photo</div>;
}

// How alike the two faces are, in words HR can act on.
function likeness(distance, threshold) {
  if (distance == null) return null;
  if (distance <= threshold) return { label: 'Same person', color: 'green' };
  if (distance <= 0.6) return { label: 'Possibly the same person', color: 'amber' };
  return { label: 'Looks like a different person', color: 'red' };
}

const RESULT = {
  face: (r) => (r.status === 'rejected' ? { label: 'Rejected', color: 'red' }
    : r.status === 'review' ? { label: 'To review', color: 'amber' }
      : r.face?.matched ? { label: 'Face match', color: 'green' } : { label: 'Approved', color: 'teal' }),
  manual: () => ({ label: 'Manual', color: 'slate' }),
};

export default function CheckInDesk() {
  const { can } = useAuth();
  const { data, reload } = useFetch('/attendance/check-in-requests', { initial: { review: [], recent: [], threshold: 0.5 } });
  const [busyId, setBusyId] = useState(null);
  const [manual, setManual] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const seen = useRef(null);

  // Chime when a new check-in needs review (not on first load).
  useEffect(() => {
    const ids = new Set(data.review.map((r) => r._id));
    if (seen.current && [...ids].some((id) => !seen.current.has(id))) playNotificationSound();
    seen.current = ids;
  }, [data]);

  const approve = async (r) => {
    setBusyId(r._id);
    try {
      await api.post(`/attendance/check-in-requests/${r._id}/approve`);
      toast.success(`${r.user.firstName}'s check-${r.direction === 'out' ? 'out' : 'in'} approved`);
      reload();
    } catch (e) { toastError(e); reload(); } finally { setBusyId(null); }
  };

  const reject = async () => {
    const r = rejecting;
    try {
      await api.post(`/attendance/check-in-requests/${r._id}/reject`, { reason });
      setRejecting(null); setReason('');
      toast.success(r.direction === 'out' ? `${r.user.firstName}'s check-out undone` : `${r.user.firstName}'s check-in removed`);
      reload();
    } catch (e) { toastError(e); }
  };

  return (
    <div>
      <PageHeader title="Check-in" subtitle="Staff scan the code and take a selfie, arriving and leaving. Faces that match their profile photo go through automatically; anything else comes here for you to review."
        actions={<>
          <Button variant="secondary" onClick={() => setManual(true)}><UserPlus className="h-4 w-4" /> Manual check-in</Button>
          <Button variant="secondary" onClick={() => document.documentElement.requestFullscreen?.()}><Expand className="h-4 w-4" /> Full screen</Button>
        </>} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Scan to check in"
            action={<Button variant="ghost" size="sm" title="Make all current codes stop working"
              onClick={() => api.post('/settings/desk-code/rotate').then(() => toast.success('Codes reset')).catch(toastError)}><RefreshCw className="h-4 w-4" /> Reset</Button>}>
            <DeskQr />
            <p className="mt-4 text-center text-xs text-slate-500">Put this on a screen at the entrance. Nobody needs to staff it.</p>
          </Card>
          {can('settings') && <SiteLocation />}
        </div>

        <div className="space-y-6 lg:col-span-3">
          <Card title={`To review (${data.review.length})`} bodyClass="p-0">
            {data.review.length === 0 ? <Empty title="Nothing to review">Check-ins and check-outs whose selfie didn't match the profile photo appear here. Everyone else goes through automatically.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {data.review.map((r) => {
                  const like = likeness(r.face?.distance, data.threshold);
                  return (
                    <li key={r._id} className="animate-fade-up p-4">
                      <div className="flex flex-wrap items-start gap-4">
                        <div className="flex gap-2">
                          <figure className="text-center"><Selfie request={r} className="h-28 w-28" /><figcaption className="mt-1 text-xs text-slate-500">Selfie</figcaption></figure>
                          <figure className="text-center"><ProfilePhoto user={r.user} className="h-28 w-28" /><figcaption className="mt-1 text-xs text-slate-500">Profile photo</figcaption></figure>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-lg font-bold">{fullName(r.user)}<Badge color={r.direction === 'out' ? 'purple' : 'blue'}>{r.direction === 'out' ? 'Check-out' : 'Check-in'}</Badge></p>
                          <p className="text-sm text-slate-500">{r.user.jobTitle || '—'} · {r.user.department || '—'} · <span className="font-mono">{r.user.staffId}</span></p>
                          <p className="mt-2 text-sm font-medium text-amber-800">{r.face?.reason || 'Needs a check'}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                            {like && <Badge color={like.color}>{like.label}</Badge>}
                            {r.location && <Badge color="teal">{`On site · ${r.location.distance}m away`}</Badge>}
                            <span className="text-slate-500">Checked {r.direction === 'out' ? 'out' : 'in'} {fmtTime(r.createdAt)} ({timeAgo(r.createdAt)})</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setRejecting(r)}><X className="h-4 w-4" /> Not them</Button>
                        <Button variant="success" loading={busyId === r._id} onClick={() => approve(r)}><Check className="h-4 w-4" /> It's them</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Today's check-ins and check-outs" bodyClass="p-0">
            {data.recent.length === 0 ? <Empty title="Nobody yet today" /> : (
              <ul className="divide-y divide-slate-100">
                {data.recent.map((r) => {
                  const res = (RESULT[r.method] || RESULT.face)(r);
                  return (
                    <li key={r._id} className="flex animate-fade-in flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                      <Avatar user={r.user} size="sm" />
                      <span className="flex-1 font-medium">{fullName(r.user)}</span>
                      <span className="text-xs text-slate-500">{r.direction === 'out' ? 'Out' : 'In'}</span>
                      <Badge color={res.color}>{res.label}</Badge>
                      <span className="text-xs text-slate-500">{fmtTime(r.createdAt)}{r.handledBy ? ` · ${r.handledBy.firstName}` : ''}</span>
                      {r.method === 'face' && r.status === 'confirmed' && (
                        <Button variant="ghost" size="sm" onClick={() => setRejecting(r)} aria-label={`Reject ${fullName(r.user)}'s check-${r.direction === 'out' ? 'out' : 'in'}`}>Reject</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ManualCheckIn open={manual} onClose={() => { setManual(false); reload(); }} />
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={`Reject ${rejecting ? fullName(rejecting.user) : ''}'s check-${rejecting?.direction === 'out' ? 'out' : 'in'}`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" onClick={reject}>{rejecting?.direction === 'out' ? 'Undo check-out' : 'Remove check-in'}</Button></>}>
        {rejecting && (
          <div className="mb-4 flex justify-center gap-2">
            <Selfie request={rejecting} className="h-24 w-24" /><ProfilePhoto user={rejecting.user} className="h-24 w-24" />
          </div>
        )}
        <p className="mb-3 text-sm text-slate-500">{rejecting?.direction === 'out'
          ? "Their check-out is undone, so the time doesn't count until they check out properly or you correct it on the Attendance page. They're notified."
          : "Their check-in is removed from attendance and they're notified."}</p>
        <Field label="Reason (shown to the staff member)">
          <textarea rows={3} className="input" placeholder="e.g. The selfie isn't you. Please see HR." value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
