import { useEffect, useState } from 'react';
import { loadJson, saveJson } from './appUtils';

export default function usePersistedState(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadJson(key, initialValue).then((saved) => {
      if (!mounted) return;
      setValue(saved);
      setHydrated(true);
    });
    return () => { mounted = false; };
  }, [key]);

  useEffect(() => {
    if (hydrated) saveJson(key, value);
  }, [key, value, hydrated]);

  return [value, setValue, hydrated];
}
