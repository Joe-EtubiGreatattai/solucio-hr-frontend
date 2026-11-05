import { useCallback, useEffect, useRef, useState } from 'react';
import api, { toastError } from './api';
import { useLive } from '../context/LiveContext';

// Which real-time resources each API area depends on. Defaults to the first URL segment.
const LIVE_DEPENDENCIES = {
  reports: ['*'],
  attendance: ['attendance', 'rosters', 'settings'],
  rosters: ['rosters', 'users'],
  certificates: ['certificates', 'users'],
  requests: ['requests', 'users'],
  notes: ['notes', 'users'],
};

function liveResourcesFor(url) {
  const segment = url?.split('?')[0].split('/')[1];
  return LIVE_DEPENDENCIES[segment] || (segment ? [segment] : []);
}

// Small data hook: const { data, loading, reload } = useFetch('/path', { params })
// Data refreshes itself when the server reports a change (pass `live: false` to opt out).
export default function useFetch(url, { params, initial = null, live } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  // After the first load, changing filters keeps showing the old results (refreshing) instead of a spinner.
  const [refreshing, setRefreshing] = useState(false);
  const loaded = useRef(false);
  const latest = useRef(0);
  const key = JSON.stringify(params || {});

  const load = useCallback(async (silent) => {
    if (!url) return;
    const call = ++latest.current; // ignore responses that arrive after a newer request
    if (!silent) (loaded.current ? setRefreshing : setLoading)(true);
    try {
      const res = await api.get(url, { params: JSON.parse(key) });
      if (call !== latest.current) return;
      setData(res.data);
      loaded.current = true;
    } catch (e) {
      if (!silent && call === latest.current) toastError(e);
    } finally {
      if (call === latest.current) { setLoading(false); setRefreshing(false); }
    }
  }, [url, key]);

  useEffect(() => { load(false); }, [load]);
  // Background refreshes are silent so the page doesn't flash a spinner.
  useLive(live === false ? null : live || liveResourcesFor(url), () => load(true));

  const reload = useCallback(() => load(false), [load]);
  return { data, setData, loading, refreshing, reload };
}
