import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, MapPin, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api, { errMsg } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Avatar, Button, Card, PageHeader, Spinner, SuccessCheck } from '../../components/ui';
import QrScanner from '../../components/QrScanner';
import { fmtTime, titleCase } from '../../lib/format';

// The desk QR holds a link like https://host/check-in?k=123456; a typed code is just the 6 digits.
function codeFrom(text) {
  try { return new URL(text).searchParams.get('k') || ''; } catch { return /^\d{6}$/.test(text.trim()) ? text.trim() : ''; }
}

// The hospital checks you're on site, so the phone's position goes with the code.
function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject(new Error('Location only works on a secure (https) link. Ask HR for the right check-in address.'));
    if (!navigator.geolocation) return reject(new Error("This browser can't share your location. Try Chrome or Safari."));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED
        ? 'Location is blocked. Allow location for this site in your browser settings, then scan again.'
        : "We couldn't find your location. Check location is on for your phone and try again.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export default function CheckIn() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data: status, loading, reload } = useFetch('/attendance/status');
  const { data: latest, reload: reloadLatest } = useFetch('/attendance/check-in-requests/mine');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const autoSent = useRef(false);

  const submit = async (code) => {
    if (!code) return setError("That isn't a Solucio check-in code. Scan the QR on the desk screen.");
    setBusy(true);
    setError('');
    try {
      const where = status?.locationRequired ? await currentPosition() : {};
      await api.post('/attendance/check-in-requests', { code, ...where });
      reload(); reloadLatest();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  // Arrived by scanning the desk QR with the phone's camera app.
  useEffect(() => {
    const k = params.get('k');
    if (!k || autoSent.current || loading || status?.open) return;
    autoSent.current = true;
    setParams({}, { replace: true });
    submit(k);
  }, [params, loading, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async () => {
    await api.delete('/attendance/check-in-requests/mine');
    reload(); reloadLatest();
  };

  if (loading && !status) return <Spinner />;
  const open = status?.open;
  const pending = status?.pending;
  const rejected = !open && !pending && latest?.status === 'rejected' && Date.now() - new Date(latest.handledAt) < 3600000;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Check in" subtitle="Scan the QR code on the screen at the check-in desk. The admin will confirm it's you." />

      {open ? (
        <Card>
          <div className="animate-fade-up py-4 text-center">
            <SuccessCheck className="h-16 w-16" />
            <p className="mt-3 text-xl font-bold">You're checked in</p>
            <p className="mt-1 text-slate-500">
              Since {fmtTime(open.clockIn)}{open.status === 'late' && ` · ${open.lateMinutes} min late`}
              {open.confirmedBy && ` · confirmed by ${open.confirmedBy.firstName} ${open.confirmedBy.lastName}`}
            </p>
            <Link to="/"><Button variant="secondary" className="mt-5">Back to dashboard</Button></Link>
          </div>
        </Card>
      ) : pending ? (
        <Card>
          <div className="py-4 text-center">
            <div className="relative mx-auto w-fit">
              {/* Soft rings pulse while waiting for the admin */}
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-300" />
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-300 [animation-delay:0.9s]" />
              <span className="relative block"><Avatar user={user} size="xl" /></span>
              <Loader2 className="absolute -right-1 -top-1 h-7 w-7 animate-spin rounded-full bg-white p-1 text-brand-600" />
            </div>
            <p className="mt-4 text-xl font-bold">Waiting for the admin</p>
            <p className="mt-1 text-slate-500">Show yourself at the desk. The admin will check you against your profile photo and confirm.</p>
            <p className="mt-3 text-sm text-slate-500">Scanned at {fmtTime(pending.createdAt)} · this screen updates by itself</p>
            <Button variant="ghost" size="sm" className="mt-4" onClick={cancel}>Cancel</Button>
          </div>
        </Card>
      ) : (
        <Card>
          {rejected && (
            <div className="mb-4 flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              <XCircle className="h-5 w-5 shrink-0" />
              <span><b>Your last check-in wasn't confirmed.</b> {latest.rejectReason || 'Please speak to the admin at the desk.'}</span>
            </div>
          )}
          {!user.avatar && (
            <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              You don't have a profile photo yet. The admin uses it to confirm who you are, so <Link to="/profile" className="font-semibold underline">add one</Link>.
            </p>
          )}
          {status?.currentShift && (
            <p className="mb-4 text-center text-sm text-slate-600">
              {titleCase(status.currentShift.shiftType)} shift · {status.currentShift.startTime}–{status.currentShift.endTime}
            </p>
          )}
          {status?.locationRequired && (
            <p className="mb-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> You can only check in on site. Your location is checked when you scan.
            </p>
          )}
          {busy ? <div className="flex flex-col items-center justify-center gap-2 py-16"><Loader2 className="h-8 w-8 animate-spin text-brand-600" />{status?.locationRequired && <span className="text-sm text-slate-500">Checking your location…</span>}</div>
            : <QrScanner onResult={(text) => submit(codeFrom(text))} />}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="label text-center">Or enter the code on the screen</p>
            <form className="flex justify-center gap-2" onSubmit={(e) => { e.preventDefault(); submit(typed); }}>
              <input className="input max-w-40 text-center font-mono text-lg tracking-[0.3em]" inputMode="numeric" maxLength={6} placeholder="000000"
                value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))} />
              <Button loading={busy} disabled={typed.length !== 6}>Check in</Button>
            </form>
          </div>
          {error && <p key={error} role="alert" className="mt-4 animate-shake rounded-lg bg-rose-50 p-3 text-center text-sm text-rose-700">{error}</p>}
        </Card>
      )}
    </div>
  );
}
