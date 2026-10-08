import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { firestore } from '../firebase';

const collectionPath = (uid, name) => collection(firestore, 'users', uid, name);
const workspacePath = (workspaceId, name) => collection(firestore, 'organizations', workspaceId, name);
const cloudEnabled = async (uid) => (await AsyncStorage.getItem(`expenseTracker.cloudSync.${uid}`)) === 'true';
// Keep record cloud sync off in release builds until deletes, offline edits,
// and concurrent-device conflicts have server-backed resolution semantics.
// The switch below is the single release gate: setting it true makes every
// record subscription and write in this module live again, so it must not be
// flipped until offline edit queues, tombstone-based deletions, conflict
// resolution, and two-device QA exist and are reviewed.
export const CLOUD_SYNC_RELEASE_BLOCKED = true;
export const CLOUD_SYNC_BLOCK_REASON = 'Cloud sync is paused until offline edits and deletions can be reconciled safely. Your data remains saved on this device.';

const readLocalRecords = async (uid, name, workspaceId) => {
  const candidates = workspaceId === 'personal'
    ? [`expenseTracker.${uid}.${name}`, `expenseTracker.${uid}.personal.${name}`]
    : [`expenseTracker.${uid}.${workspaceId}.${name}`];
  for (const key of candidates) {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      try { const records = JSON.parse(raw); if (Array.isArray(records) && records.length) return records; } catch { /* Try the alternate legacy key. */ }
    }
  }
  return [];
};

const resolveCollection = async (uid, name, workspaceId = 'personal') => {
  if (workspaceId === 'personal') return collectionPath(uid, name);
  const membership = await getDoc(doc(firestore, 'users', uid, 'memberships', workspaceId));
  if (!membership.exists() || membership.data().status !== 'active') throw new Error('You no longer have access to this organisation.');
  return workspacePath(workspaceId, name);
};

export const subscribeToCollection = (uid, name, onData, onError, workspaceId = 'personal') => {
  if (!uid || !firestore || CLOUD_SYNC_RELEASE_BLOCKED) return () => {};
  let unsubscribe = () => {};
  let active = true;
  cloudEnabled(uid).then(async (enabled) => {
    if (!enabled || !active) return;
    const path = await resolveCollection(uid, name, workspaceId);
    if (!active) return;
    const baselineKey = `expenseTracker.${uid}.cloudBaseline.${workspaceId}.${name}`;
    let baselineEstablished = false;
    unsubscribe = onSnapshot(path, async (snapshot) => {
      const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (!baselineEstablished) {
        baselineEstablished = true;
        const alreadyMerged = await AsyncStorage.getItem(baselineKey);
        if (!alreadyMerged && records.length === 0) {
          // Empty new cloud collection: upload the current device copy before
          // declaring the baseline complete.
          const localRecords = await readLocalRecords(uid, name, workspaceId);
          for (const record of localRecords) await setDoc(doc(path, record.id), { ...record, createdBy: record.createdBy || uid }, { merge: true });
          await AsyncStorage.setItem(baselineKey, 'true');
          if (localRecords.length) return;
        }
        await AsyncStorage.setItem(baselineKey, 'true');
        if (!alreadyMerged && records.length) {
          const localRecords = await readLocalRecords(uid, name, workspaceId);
          const cloudIds = new Set(records.map((item) => item.id));
          for (const record of localRecords.filter((item) => !cloudIds.has(item.id))) await setDoc(doc(path, record.id), { ...record, createdBy: record.createdBy || uid }, { merge: true });
          onData([...records, ...localRecords.filter((item) => !cloudIds.has(item.id))]);
          return;
        }
      }
      onData(records);
    }, (error) => {
      console.warn(`Cloud sync failed for ${name}:`, error?.message || error);
      onError?.(error);
    });
  }).catch((error) => { if (active) onError?.(error); });
  return () => { active = false; unsubscribe(); };
};

export const writeRecord = async (uid, collectionName, record, workspaceId = 'personal') => {
  if (!uid || !firestore || CLOUD_SYNC_RELEASE_BLOCKED || !(await cloudEnabled(uid))) return;
  if (!record?.id) throw new Error(`Cannot sync ${collectionName}: record ID is missing.`);
  const { id, ...data } = record;
  await setDoc(doc(await resolveCollection(uid, collectionName, workspaceId), id), { ...data, createdBy: data.createdBy || uid }, { merge: true });
};

export const deleteRecord = async (uid, collectionName, id, workspaceId = 'personal') => {
  if (!uid || !firestore || CLOUD_SYNC_RELEASE_BLOCKED || !(await cloudEnabled(uid))) return;
  await deleteDoc(doc(await resolveCollection(uid, collectionName, workspaceId), id));
};

// Upsert an entire local snapshot into its matching scope. This intentionally
// does not delete remote documents; only explicit delete operations may do so.
export const replaceCollection = async (uid, collectionName, records, workspaceId = 'personal') => {
  if (!uid || !firestore || CLOUD_SYNC_RELEASE_BLOCKED || !(await cloudEnabled(uid))) return;
  const path = await resolveCollection(uid, collectionName, workspaceId);
  await Promise.all(records.map((record) => {
    if (!record?.id) return Promise.reject(new Error(`Cannot sync ${collectionName}: record ID is missing.`));
    const { id, ...data } = record;
    return setDoc(doc(path, id), { ...data, createdBy: data.createdBy || uid }, { merge: true });
  }));
};
