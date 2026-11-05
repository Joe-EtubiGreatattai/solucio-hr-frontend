import { useEffect, useState } from 'react';

// Value that only updates after it has stopped changing for `ms` (e.g. search-as-you-type).
export default function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
