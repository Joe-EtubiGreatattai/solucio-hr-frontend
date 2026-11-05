import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLiveNotifications } from '../context/LiveContext';
import api from '../lib/api';
import { timeAgo } from '../lib/format';
import { isSoundOn, playNotificationSound, setSoundOn } from '../lib/sound';
import { useExit } from '../lib/motion';

// Round bell button with the notification panel. Shared by the staff and admin layouts.
export default function NotificationBell({ className = '' }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const [soundOn, setSoundOnState] = useState(isSoundOn);
  const ref = useRef();
  const navigate = useNavigate();
  const panel = useExit(open, 150);
  const [ring, setRing] = useState(0); // bumps to replay the bell wiggle

  const load = () => api.get('/notifications').then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  // New notifications arrive over the socket; show them straight away.
  useLiveNotifications((n) => {
    load();
    if (n) {
      setRing((r) => r + 1);
      toast(n.title, { icon: '🔔', duration: 5000 });
      playNotificationSound();
    }
  });

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  const openItem = async (n) => {
    if (!n.read) await api.put(`/notifications/${n._id}/read`);
    setOpen(false);
    load();
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 ${className}`}>
        <Bell key={ring} className={`h-5 w-5 origin-top ${ring ? 'animate-wiggle' : ''}`} />
        {data.unread > 0 && (
          <span key={data.unread} className="absolute -right-1 -top-1 flex h-5 min-w-5 animate-pop-in items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white ring-2 ring-white">
            {data.unread > 99 ? '99+' : data.unread}
          </span>
        )}
      </button>
      {panel.mounted && (
        <div className={`card fixed inset-x-3 top-20 z-40 origin-top overflow-hidden shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem] sm:origin-top-right ${panel.closing ? 'animate-scale-out' : 'animate-scale-in'}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-semibold">Notifications</span>
            <button type="button" aria-label={soundOn ? 'Mute notification sound' : 'Turn notification sound on'} title={soundOn ? 'Mute notification sound' : 'Turn notification sound on'}
              className="ml-auto mr-2 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 desk:h-8 desk:w-8"
              onClick={() => { setSoundOn(!soundOn); setSoundOnState(!soundOn); if (!soundOn) playNotificationSound(); }}>
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            {data.unread > 0 && (
              <button type="button" className="min-h-10 text-xs font-semibold text-brand-700 hover:underline desk:min-h-0" onClick={() => api.put('/notifications/read-all').then(load)}>Mark all read</button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto overscroll-contain sm:max-h-96">
            {data.items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">You're all caught up</p>}
            {data.items.map((n) => (
              <button type="button" key={n._id} onClick={() => openItem(n)}
                className={`block w-full border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/50'}`}>
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                    {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>}
                    <p className="mt-1 text-xs text-slate-500">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
