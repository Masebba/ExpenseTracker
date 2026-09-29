import { useCallback, useEffect, useRef, useState } from 'react';
import { loadJson, saveJson } from './appUtils';

// Keep values keyed by storage scope so switching accounts/workspaces never
// exposes the previous scope while the next one hydrates.
export default function usePersistedState(key, initialValue) {
  const [entry, setEntry] = useState({ key: null, value: initialValue, hydrated: false });
  const latest = useRef({ key, value: initialValue, hydrated: false });
  const generation = useRef(0);
  const pending = useRef({ key: null, updates: [] });

  useEffect(() => {
    const currentGeneration = ++generation.current;
    latest.current = { key, value: initialValue, hydrated: false };
    pending.current = { key, updates: [] };
    setEntry({ key, value: initialValue, hydrated: false });
    loadJson(key, initialValue).then((saved) => {
      if (generation.current !== currentGeneration) return;
      const updates = pending.current.key === key ? pending.current.updates : [];
      const value = updates.reduce((current, update) => typeof update === 'function' ? update(current) : update, saved);
      latest.current = { key, value, hydrated: true };
      pending.current = { key, updates: [] };
      setEntry(latest.current);
    });
    return () => { generation.current += 1; };
  }, [key]);

  useEffect(() => {
    if (entry.key !== key || !entry.hydrated) return;
    latest.current = entry;
    saveJson(key, entry.value);
  }, [entry, key]);

  const setValue = useCallback((nextValue) => {
    const current = latest.current;
    if (current.key !== key) return;
    if (!current.hydrated) {
      if (pending.current.key !== key) pending.current = { key, updates: [] };
      pending.current.updates.push(nextValue);
      return;
    }
    const value = typeof nextValue === 'function' ? nextValue(current.value) : nextValue;
    const next = { key, value, hydrated: true };
    latest.current = next;
    setEntry(next);
  }, [key]);

  const isCurrent = entry.key === key;
  return [isCurrent ? entry.value : initialValue, setValue, isCurrent && entry.hydrated];
}
