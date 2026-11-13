import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { Button } from './ui';

const MAX_WIDTH = 480; // selfies are sent and stored small (~40KB)

// Front-camera selfie. Calls onCapture({ blob }); the server finds the face and checks it.
// Only a live camera frame can be used (no gallery upload), so it has to be taken there and then.
export default function FaceCapture({ onCapture, onUnavailable, busy }) {
  const videoRef = useRef();
  const [phase, setPhase] = useState(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia ? 'unsupported' : 'loading');

  useEffect(() => {
    if (phase === 'unsupported') return undefined;
    let stream;
    let stopped = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
      .then(async (s) => {
        // The page may have closed while the camera was starting; don't leave it running.
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
        setPhase('live');
      })
      .catch((e) => { if (!stopped) setPhase(e?.name === 'NotAllowedError' ? 'denied' : 'failed'); });
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [phase === 'unsupported']); // eslint-disable-line react-hooks/exhaustive-deps

  const take = async () => {
    const video = videoRef.current;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    await onCapture({ blob });
  };

  if (phase === 'unsupported' || phase === 'denied' || phase === 'failed') {
    return (
      <div className="rounded-xl bg-slate-50 p-5 text-center">
        <CameraOff className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-2 font-semibold">{phase === 'denied' ? 'Camera is blocked' : "The camera isn't available"}</p>
        <p className="mt-1 text-sm text-slate-500">
          {phase === 'denied' ? 'Allow the camera for this site in your browser settings, then try again.' : 'This phone or browser couldn’t start the camera.'}
          {' '}You can still check in; HR will review it.
        </p>
        <Button variant="secondary" className="mt-4" loading={busy} onClick={onUnavailable}>Check in without a photo</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative aspect-square w-full max-w-72 overflow-hidden rounded-full ring-4 ring-brand-200">
        {/* Mirrored so it behaves like a mirror; the saved photo isn't mirrored. */}
        <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        {/* Where to put your face */}
        <div className="pointer-events-none absolute inset-[14%_22%] rounded-[50%] border-2 border-dashed border-white/80" />
        {phase === 'loading' && <div className="absolute inset-0 flex items-center justify-center bg-slate-100"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>}
      </div>
      <p className="mt-3 text-sm text-slate-600">Fit your face in the oval, in good light.</p>
      <Button className="mt-3" size="lg" disabled={phase !== 'live' || busy} loading={busy} onClick={take}>
        <Camera className="h-5 w-5" /> {busy ? 'Checking…' : 'Take photo and check in'}
      </Button>
    </div>
  );
}
