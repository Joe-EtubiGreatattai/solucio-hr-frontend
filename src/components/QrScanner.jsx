import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraOff } from 'lucide-react';

// Live camera QR reader. Calls onResult(text) once for the first code it sees.
// Browsers only allow the camera on https (or localhost); otherwise shows a hint instead.
export default function QrScanner({ onResult }) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const done = useRef(false);
  const cb = useRef(onResult);
  cb.current = onResult;
  const [error, setError] = useState(
    !window.isSecureContext || !navigator.mediaDevices?.getUserMedia ? 'unsupported' : ''
  );

  useEffect(() => {
    if (error) return;
    let stream;
    let frame;
    let stopped = false;
    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (code?.data && !done.current) {
          done.current = true;
          cb.current(code.data);
          return;
        }
      }
      frame = requestAnimationFrame(scan);
    };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        // The camera can start after the scanner has already closed (page left, or React's
        // dev double-mount); stop it straight away or it stays on with nothing showing it.
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
        frame = requestAnimationFrame(scan);
      })
      .catch(() => { if (!stopped) setError('denied'); });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [error]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-100 p-6 text-center text-sm text-slate-600">
        <CameraOff className="h-8 w-8 text-slate-400" />
        {error === 'denied'
          ? 'Camera access was blocked. Allow the camera for this site, or use your phone camera app or the code below.'
          : "In-app scanning isn't available on this connection. Point your phone's camera app at the QR code instead, or type the code below."}
      </div>
    );
  }
  return (
    <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      <div className="pointer-events-none absolute inset-8 rounded-lg border-4 border-white/80" />
    </div>
  );
}
