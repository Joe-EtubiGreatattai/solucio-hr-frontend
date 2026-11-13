import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, MapPin, ScanFace, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api, { errMsg } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Button, Card, PageHeader, Spinner, SuccessCheck } from '../../components/ui';
import QrScanner from '../../components/QrScanner';
import FaceCapture from '../../components/FaceCapture';
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

function verifiedText(open) {
  if (open.checkInMethod === 'manual') return open.confirmedBy ? `checked in by ${open.confirmedBy.firstName} ${open.confirmedBy.lastName}` : 'checked in by HR';
  if (open.faceReview === 'pending') return 'HR will review your photo';
  if (open.confirmedBy) return `approved by ${open.confirmedBy.firstName} ${open.confirmedBy.lastName}`;
  if (open.checkInMethod === 'face') return 'face verified';
  return '';
}

export default function CheckIn() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data: status, loading, reload } = useFetch('/attendance/status');
  const { data: latest } = useFetch('/attendance/check-in-requests/mine');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(null); // { token, until } once the code and location are accepted
  const [result, setResult] = useState(null); // { matched, reason } right after checking in
  const autoSent = useRef(false);

  // Step 1: the desk code (and location). The server hands back a few minutes to take the selfie.
  const submitCode = async (code) => {
    if (!code) return setError("That isn't a Solucio check-in code. Scan the QR on the check-in screen.");
    setBusy(true);
    setError('');
    try {
      const where = status?.locationRequired ? await currentPosition() : {};
      const { data } = await api.post('/attendance/scan', { code, ...where });
      setScan({ token: data.token, until: Date.now() + data.expiresIn * 1000 });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  // Step 2: the selfie (or none, if the camera can't be used). The server decides if it matches.
  const checkIn = async (photo) => {
    if (Date.now() > scan.until) {
      setScan(null);
      return setError('That took too long. Scan the QR code again.');
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('token', scan.token);
      if (photo) fd.append('selfie', photo.blob, 'selfie.jpg');
      const { data } = await api.post('/attendance/check-in', fd);
      setResult({ matched: data.matched, reason: data.reason });
      setScan(null);
      reload();
    } catch (e) {
      setError(errMsg(e));
      if (/scan/i.test(errMsg(e))) setScan(null);
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
    submitCode(k);
  }, [params, loading, status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !status) return <Spinner />;
  const open = status?.open;
  const rejected = !open && latest?.status === 'rejected' && Date.now() - new Date(latest.handledAt) < 12 * 3600000;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Check in" subtitle="Scan the QR code on the check-in screen, then take a quick selfie to confirm it's you." />

      {open ? (
        <Card>
          <div className="animate-fade-up py-4 text-center">
            <SuccessCheck className="h-16 w-16" />
            <p className="mt-3 text-xl font-bold">You're checked in</p>
            <p className="mt-1 text-slate-500">
              Since {fmtTime(open.clockIn)}{open.status === 'late' && ` · ${open.lateMinutes} min late`}
              {verifiedText(open) && ` · ${verifiedText(open)}`}
            </p>
            {result && !result.matched && (
              <p className="mx-auto mt-4 max-w-sm rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                <b>{result.reason}.</b> HR will compare your selfie with your profile photo.
                {!user.avatar && <> <Link to="/profile" className="font-semibold underline">Add a profile photo</Link> so you're verified straight away next time.</>}
              </p>
            )}
            <Link to="/"><Button variant="secondary" className="mt-5">Back to dashboard</Button></Link>
          </div>
        </Card>
      ) : scan ? (
        <Card>
          <div className="mb-4 flex items-center justify-center gap-2 text-center">
            <ScanFace className="h-5 w-5 text-brand-600" />
            <p className="font-semibold">Code accepted. Now a quick selfie.</p>
          </div>
          <FaceCapture busy={busy} onCapture={checkIn} onUnavailable={() => checkIn(null)} />
          {error && <p key={error} role="alert" className="mt-4 animate-shake rounded-lg bg-rose-50 p-3 text-center text-sm text-rose-700">{error}</p>}
          <p className="mt-5 flex gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Your selfie is compared with your profile photo to confirm it's you. HR can see it, and it's deleted after 60 days.
          </p>
          <div className="mt-2 text-center"><Button variant="ghost" size="sm" onClick={() => setScan(null)}>Cancel</Button></div>
        </Card>
      ) : (
        <Card>
          {rejected && (
            <div className="mb-4 flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              <XCircle className="h-5 w-5 shrink-0" />
              <span><b>Your last check-in was rejected.</b> {latest.rejectReason || 'Please speak to HR.'}</span>
            </div>
          )}
          {!user.avatar && (
            <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              You don't have a profile photo yet. Your selfie is checked against it, so <Link to="/profile" className="font-semibold underline">add a clear photo of your face</Link>.
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
            : <QrScanner onResult={(text) => submitCode(codeFrom(text))} />}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="label text-center">Or enter the code on the screen</p>
            <form className="flex justify-center gap-2" onSubmit={(e) => { e.preventDefault(); submitCode(typed); }}>
              <input className="input max-w-40 text-center font-mono text-lg tracking-[0.3em]" inputMode="numeric" maxLength={6} placeholder="000000"
                value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))} />
              <Button loading={busy} disabled={typed.length !== 6}>Next</Button>
            </form>
          </div>
          {error && <p key={error} role="alert" className="mt-4 animate-shake rounded-lg bg-rose-50 p-3 text-center text-sm text-rose-700">{error}</p>}
        </Card>
      )}
    </div>
  );
}
