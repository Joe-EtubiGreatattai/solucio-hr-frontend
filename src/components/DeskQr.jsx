import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../lib/api';
import { useLive } from '../context/LiveContext';

// The rotating check-in QR code and its short numeric code. Staff scan it (or type the code) to clock in.
// Used on the admin/front-desk check-in screen and on the front-desk kiosk.
export default function DeskQr({ size = 240 }) {
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
        {state ? <span key={state.code} className="block animate-fade-in"><QRCodeSVG value={`${window.location.origin}/check-in?k=${state.code}`} size={size} level="M" /></span>
          : <div className="animate-pulse rounded bg-slate-100" style={{ height: size, width: size }} />}
      </div>
      <p key={state?.code} className="mt-4 animate-fade-up font-mono text-4xl font-bold tracking-[0.35em] text-slate-800">{state?.code || '······'}</p>
      <div className="mt-3 h-1.5 w-60 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-brand-500 transition-all duration-1000 ease-linear" style={{ width: `${state ? (remaining / state.period) * 100 : 0}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">New code in {remaining}s</p>
    </div>
  );
}
