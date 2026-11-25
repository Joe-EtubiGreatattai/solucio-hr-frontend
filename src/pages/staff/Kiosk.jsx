import { LogOut, QrCode } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import DeskQr from '../../components/DeskQr';

// The front-desk kiosk: a shared screen that shows only the rotating check-in QR code. Staff scan it
// (or type the code into their app) to clock in. A front-desk account signs in and lands straight here.
export default function Kiosk() {
  const { logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <span className="flex items-center gap-2 font-semibold tracking-tight text-slate-700">
          <QrCode className="h-5 w-5 text-brand-600" /> Staff check-in
        </span>
        <button type="button" onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-200 hover:text-slate-800">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-12 text-center">
        <h1 className="mb-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Scan to clock in</h1>
        <p className="mb-8 max-w-sm text-slate-500">Open the Solucio HR app, tap <span className="font-semibold text-slate-700">Check in</span>, and scan this code — or enter the number below.</p>
        <DeskQr size={300} />
        <p className="mt-10 text-xs text-slate-400">You must be inside the hospital for check-in to count.</p>
      </main>
    </div>
  );
}
