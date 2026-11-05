import { createContext, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

// Socket.IO connection shared by the whole app.
// The server sends `sync` {resource} after data changes and `notification` with new notifications.
const LiveContext = createContext(null);

export function LiveProvider({ children }) {
  const { user } = useAuth();
  const listeners = useRef(new Set());
  const userId = user?._id;

  useEffect(() => {
    if (!userId) return;
    const socket = io(import.meta.env.VITE_API_ORIGIN || undefined, {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket', 'polling'],
    });
    const fire = (event, payload) => listeners.current.forEach((l) => l(event, payload));
    socket.on('connect', () => fire('reconnect'));
    socket.on('sync', (p) => fire('sync', p));
    socket.on('notification', (n) => fire('notification', n));
    return () => socket.disconnect();
  }, [userId]);

  const subscribe = (fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  };

  return <LiveContext.Provider value={{ subscribe }}>{children}</LiveContext.Provider>;
}

// Run `onChange` when any of `resources` changes ('*' = any change). Also fires after a reconnect,
// so anything missed while offline is picked up.
export function useLive(resources, onChange) {
  const ctx = useContext(LiveContext);
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = [].concat(resources || []).join(',');

  useEffect(() => {
    if (!ctx || !key) return;
    const list = key.split(',');
    let timer;
    return ctx.subscribe((event, payload) => {
      if (event === 'notification') return;
      if (event === 'sync' && !list.includes('*') && !list.includes(payload.resource)) return;
      clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 250); // collapse bursts of changes into one refetch
    });
  }, [ctx, key]);
}

// Run `onNotification(n)` for every pushed notification.
export function useLiveNotifications(onNotification) {
  const ctx = useContext(LiveContext);
  const cb = useRef(onNotification);
  cb.current = onNotification;
  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((event, payload) => {
      if (event === 'notification') cb.current(payload);
      if (event === 'sync' && payload.resource === 'notifications') cb.current(null);
    });
  }, [ctx]);
}
