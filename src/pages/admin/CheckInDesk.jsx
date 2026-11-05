import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Crosshair, Expand, MapPin, RefreshCw, Undo2, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { useLive } from '../../context/LiveContext';
import { playNotificationSound } from '../../lib/sound';
import { toastWithAction } from '../../lib/undo';
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader } from '../../components/ui';
import { fmtTime, fullName, timeAgo, titleCase } from '../../lib/format';
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
        <p className="text-sm text-slate-500"><Term>For staff without their phone. Only do this once you've confirmed who they are in person.</Term></p>
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

export default function CheckInDesk() {
  const { data, reload } = useFetch('/attendance/check-in-requests', { initial: { pending: [], recent: [] } });
  const [busyId, setBusyId] = useState(null);
  const [manual, setManual] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const seen = useRef(null);
  const mine = useRef(new Set()); // requests this admin handled, so we don't report them as "someone else"

  // Chime when someone new joins the queue (not on first load), and explain people who leave it
  // because another admin handled them.
  useEffect(() => {
    const ids = new Set(data.pending.map((p) => p._id));
    if (seen.current) {
      if ([...ids].some((id) => !seen.current.has(id))) playNotificationSound();
      for (const id of seen.current) {
        if (ids.has(id) || mine.current.has(id)) continue;
        const handled = data.recent.find((r) => r._id === id);
        if (handled) toast(`${handled.user.firstName} was ${handled.status} by ${handled.handledBy?.firstName || 'another admin'}`, { icon: 'ℹ️' });
      }
    }
    seen.current = ids;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const undo = async (r) => {
    try {
      await api.post(`/attendance/check-in-requests/${r._id}/undo`);
      toast.success(r.method === 'manual' ? `${r.user.firstName}'s manual check-in undone` : `${r.user.firstName} is back in the queue`);
      reload();
    } catch (e) { toastError(e); }
  };

  const confirm = async (r) => {
    setBusyId(r._id);
    mine.current.add(r._id);
    try {
      const { data: rec } = await api.post(`/attendance/check-in-requests/${r._id}/confirm`);
      toastWithAction(`${r.user.firstName} checked in${rec.status === 'late' ? ` (${rec.lateMinutes} min late)` : ''}`, 'Undo', () => undo(r));
      reload();
    } catch (e) { toastError(e); reload(); } finally { setBusyId(null); }
  };

  const reject = async () => {
    const r = rejecting;
    mine.current.add(r._id);
    try {
      await api.post(`/attendance/check-in-requests/${r._id}/reject`, { reason });
      setRejecting(null); setReason('');
      toastWithAction(`${r.user.firstName}'s check-in rejected`, 'Undo', () => undo(r));
      reload();
    } catch (e) { toastError(e); }
  };

  // Shortcut for a busy desk: Enter confirms the person who has waited longest,
  // unless the admin is typing or a dialog is open.
  const first = data.pending[0];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' || !first || busyId || rejecting || manual) return;
      if (e.target.closest('input, textarea, select, button, [role="dialog"]')) return;
      e.preventDefault();
      confirm(first);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // re-bind each render so it always targets the current first person

  return (
    <div>
      <PageHeader title="Check-in desk" subtitle="Staff scan the code with their portal. Check each person against their photo, then confirm."
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
          </Card>
          <SiteLocation />
        </div>

        <div className="space-y-6 lg:col-span-3">
          <Card title={`Waiting for confirmation (${data.pending.length})`} bodyClass="p-0"
            action={first && <span className="hidden text-xs text-slate-500 sm:inline">Press <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs">Enter</kbd> to confirm {first.user.firstName}</span>}>
            {data.pending.length === 0 ? <Empty title="Nobody waiting">People appear here as soon as they scan the code.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {data.pending.map((r) => (
                  // New arrivals slide in with a brief highlight.
                  <li key={r._id} className="flex animate-[fade-up_0.4s_ease-out_both,flash_1.6s_ease-out_both] flex-wrap items-center gap-4 p-4">
                    <Avatar user={r.user} size="xl" />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold">{fullName(r.user)}</p>
                      <p className="text-sm text-slate-500">{r.user.jobTitle || '—'} · {r.user.department || '—'} · <span className="font-mono">{r.user.staffId}</span></p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        {r.shift
                          ? <Badge color="teal">{`${titleCase(r.shift.shiftType)} ${r.shift.startTime}–${r.shift.endTime}`}</Badge>
                          : <Badge color="purple">No shift right now</Badge>}
                        {!r.user.avatar && <Badge color="amber">No profile photo · check ID badge</Badge>}
                        {r.location && <Badge color="teal">{`On site · ${r.location.distance}m away`}</Badge>}
                        <span className="text-slate-500">Scanned {fmtTime(r.createdAt)} ({timeAgo(r.createdAt)})</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setRejecting(r)}><X className="h-4 w-4" /> Reject</Button>
                      <Button variant="success" loading={busyId === r._id} onClick={() => confirm(r)}><Check className="h-4 w-4" /> Confirm</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recently handled" bodyClass="p-0">
            {data.recent.length === 0 ? <Empty title="Nothing yet today" /> : (
              <ul className="divide-y divide-slate-100">
                {data.recent.map((r) => (
                  <li key={r._id} className="flex animate-fade-in items-center gap-3 px-4 py-2.5 text-sm">
                    <Avatar user={r.user} size="sm" />
                    <span className="flex-1 font-medium">{fullName(r.user)}</span>
                    {r.method === 'manual' && <Badge color="slate">Manual</Badge>}
                    <Badge status={r.status} />
                    <span className="text-xs text-slate-500">{fmtTime(r.handledAt)} · {r.handledBy?.firstName}</span>
                    <Button variant="ghost" size="sm" onClick={() => undo(r)} aria-label={`Undo ${r.status} for ${fullName(r.user)}`}><Undo2 className="h-3.5 w-3.5" /> Undo</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ManualCheckIn open={manual} onClose={() => { setManual(false); reload(); }} />
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={`Reject ${rejecting ? fullName(rejecting.user) : ''}`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" onClick={reject}>Reject check-in</Button></>}>
        <Field label="Reason (shown to the staff member)">
          <textarea rows={3} className="input" placeholder="e.g. Person at the desk didn't match the profile photo" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
