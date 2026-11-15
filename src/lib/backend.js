// Runtime wiring for the demo-session routing (pure logic lives in backend.core.js).
// A demo session is remembered in localStorage so it survives reloads; every API,
// socket and avatar request then resolves against the /demo backend instead of live.
import { isDemoLogin, resolveBackend } from './backend.core.js';

export { isDemoLogin };

const LIVE_API = import.meta.env.VITE_API_URL || '/api';
const LIVE_ORIGIN = import.meta.env.VITE_API_ORIGIN || '';

export const inDemo = () => {
  try { return localStorage.getItem('demo') === '1'; } catch { return false; }
};

// Called at sign-in: a demo email turns demo mode on, any other email turns it off,
// so switching between a demo and a real account on the same browser just works.
export const setDemo = (on) => {
  try {
    if (on) localStorage.setItem('demo', '1');
    else localStorage.removeItem('demo');
  } catch { /* storage unavailable; stay on live */ }
};

const current = () => resolveBackend({ demo: inDemo(), liveApi: LIVE_API, liveOrigin: LIVE_ORIGIN });

export const apiBase = () => current().apiBase;
export const avatarOrigin = () => current().avatarOrigin;
export const socketPath = () => current().socketPath;
