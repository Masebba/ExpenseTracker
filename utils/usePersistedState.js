import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { loadJson, saveJson } from './appUtils';

// Values remain scoped by storage key while hydrating. Writes are serialized so
// an earlier save cannot overwrite a later snapshot. The setter resolves only
// after the local write is confirmed, including calls made before hydration.
export default function usePersistedState(key, initialValue, reloadToken = 0) {
  const [entry, setEntry] = useState({ key: null, value: initialValue, hydrated: false });
  const latest = useRef({ key, value: initialValue, hydrated: false });
  const durable = useRef({ key, value: initialValue });
  const generation = useRef(0);
  const pending = useRef({ key: null, updates: [], resolvers: [] });
  const writeQueue = useRef(Promise.resolve(true));
  const hasShownSaveError = useRef(false);
  const blockedByRecovery = useRef(null);

  const persistSnapshot = useCallback(async (storageKey, value) => {
    const nextWrite = writeQueue.current
      .catch(() => false)
      .then(() => saveJson(storageKey, value));
    writeQueue.current = nextWrite;
    let saved = false;
    try { saved = await nextWrite; } catch { saved = false; }
    if (!saved) {
      if (!hasShownSaveError.current) {
        hasShownSaveError.current = true;
        Alert.alert(
          'Could not save your changes',
          'FinanceTracker could not confirm that the latest change was saved to this device. Check available storage, export a backup if possible, and try again.',
        );
      }
      return false;
    }
    hasShownSaveError.current = false;
    return true;
  }, []);

  useEffect(() => {
    const currentGeneration = ++generation.current;
    const oldPending = pending.current;
    oldPending.resolvers?.forEach((resolve) => resolve(false));
    pending.current = { key, updates: [], resolvers: [] };
    latest.current = { key, value: initialValue, hydrated: false };
    blockedByRecovery.current = null;
    setEntry({ key, value: initialValue, hydrated: false });

    loadJson(key, initialValue).then(async (savedValue) => {
      if (generation.current !== currentGeneration) return;
      const work = pending.current.key === key ? pending.current : { updates: [], resolvers: [] };
      const value = work.updates.reduce(
        (current, update) => typeof update === 'function' ? update(current) : update,
        savedValue,
      );
      pending.current = { key, updates: [], resolvers: [] };
      durable.current = { key, value: savedValue };
      latest.current = { key, value, hydrated: true };
      setEntry(latest.current);

      if (!work.updates.length) {
        work.resolvers.forEach((resolve) => resolve(true));
        return;
      }
      const saved = await persistSnapshot(key, value);
      if (generation.current !== currentGeneration) {
        work.resolvers.forEach((resolve) => resolve(false));
        return;
      }
      if (saved) {
        durable.current = { key, value };
      } else if (latest.current.key === key && latest.current.value === value) {
        latest.current = { key, value: savedValue, hydrated: true };
        setEntry(latest.current);
      }
      work.resolvers.forEach((resolve) => resolve(saved));
    }).catch((error) => {
      if (generation.current !== currentGeneration) return;
      console.warn('[Storage] Hydration failed:', error?.message || error);
      const work = pending.current.key === key ? pending.current : { resolvers: [] };
      pending.current = { key, updates: [], resolvers: [] };
      const recoveryBlocked = String(error?.message || '').includes('Finance records need recovery');
      if (recoveryBlocked) {
        blockedByRecovery.current = key;
        latest.current = { key, value: initialValue, hydrated: false };
        setEntry({ key, value: initialValue, hydrated: false });
        Alert.alert(
          'Finance data needs recovery',
          `${error?.message || 'Saved records could not be read safely.'} Do not enter new records in this session until recovery succeeds.`,
        );
      } else {
        // Unexpected non-recovery errors also block hydration, to avoid
        // treating unreadable storage as an empty ledger.
        blockedByRecovery.current = key;
        latest.current = { key, value: initialValue, hydrated: false };
        setEntry({ key, value: initialValue, hydrated: false });
        Alert.alert(
          'Could not load saved data',
          'FinanceTracker could not safely load this data from the device. Close and reopen the app, then restore a backup if the problem continues.',
        );
      }
      work.resolvers?.forEach((resolve) => resolve(false));
    });

    return () => {
      generation.current += 1;
      const work = pending.current;
      work.resolvers?.forEach((resolve) => resolve(false));
      pending.current = { key: null, updates: [], resolvers: [] };
    };
  }, [key, reloadToken, persistSnapshot]);

  const setValue = useCallback((nextValue, options = {}) => {
    const current = latest.current;
    if (current.key !== key || blockedByRecovery.current === key) return Promise.resolve(false);
    if (!current.hydrated) {
      if (pending.current.key !== key) pending.current = { key, updates: [], resolvers: [] };
      return new Promise((resolve) => {
        pending.current.updates.push(nextValue);
        pending.current.resolvers.push(resolve);
      });
    }
    const value = typeof nextValue === 'function' ? nextValue(current.value) : nextValue;
    const next = { key, value, hydrated: true };
    latest.current = next;
    setEntry(next);
    if (options?.skipPersist === true) {
      durable.current = { key, value };
      return Promise.resolve(true);
    }
    return persistSnapshot(key, value).then((saved) => {
      if (saved) {
        durable.current = { key, value };
        return true;
      }
      // Do not leave a failed optimistic save visible as though it were durable.
      // If a newer state has already superseded it, let that newer write decide.
      if (latest.current.key === key && latest.current.value === value) {
        const previous = durable.current.key === key ? durable.current.value : current.value;
        latest.current = { key, value: previous, hydrated: true };
        setEntry(latest.current);
      }
      return false;
    });
  }, [key, persistSnapshot]);

  const isCurrent = entry.key === key;
  const getCurrentValue = useCallback(() => {
    if (latest.current.key !== key || !latest.current.hydrated || blockedByRecovery.current === key) return undefined;
    return latest.current.value;
  }, [key]);
  return [isCurrent ? entry.value : initialValue, setValue, isCurrent && entry.hydrated, getCurrentValue];
}
