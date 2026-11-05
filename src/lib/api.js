import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

// Stable per-browser id, used to spot one phone clocking in several people.
function deviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('');
    localStorage.setItem('deviceId', id);
  }
  return id;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && !config.anonymous) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers['X-Device-Id'] = deviceId();
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Don't reload the page on an expired session (that would lose unsaved work):
    // AuthContext shows a sign-in dialog over the current page instead.
    if (err.response?.status === 401 && !err.config.url.includes('/auth/')) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  }
);

// Server down or unreachable (no response, or the dev proxy's 502/503/504) gets a plain explanation.
export const errMsg = (e) => {
  if (e?.response?.data?.message) return e.response.data.message;
  if (!e?.response && e?.request) return "Can't reach the server. Check your connection, or ask IT if the system is down.";
  if ([502, 503, 504].includes(e?.response?.status)) return "The server isn't responding right now. Please try again in a minute, or ask IT if it keeps happening.";
  return e?.message || 'Something went wrong';
};
export const toastError = (e) => toast.error(errMsg(e));

// Fetch a protected file with the auth header and open it in a new tab.
export async function openFile(url) {
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(res.data);
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (e) {
    toastError(e);
  }
}

export default api;
