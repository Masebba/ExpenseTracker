import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { firestore } from '../firebase';

const collectionPath = (uid, name) => collection(firestore, 'users', uid, name);
const workspacePath = (workspaceId, name) => collection(firestore, 'organizations', workspaceId, name);
const cloudEnabled = async (uid) => (await AsyncStorage.getItem(`expenseTracker.cloudSync.${uid}`)) === 'true';
const resolveCollection = async (uid, name, workspaceId = 'personal') => {
  if (workspaceId === 'personal') return collectionPath(uid, name);
  const membership = await getDoc(doc(firestore, 'users', uid, 'memberships', workspaceId));
  if (!membership.exists() || membership.data().status !== 'active') throw new Error('You no longer have access to this organisation.');
  return workspacePath(workspaceId, name);
};

export const subscribeToCollection = (uid, name, onData, onError, workspaceId = 'personal') => {
  if (!uid || !firestore) return () => {};
  let unsubscribe = () => {};
  let active = true;
  cloudEnabled(uid).then((enabled) => {
    if (!enabled || !active) return;
    return resolveCollection(uid, name, workspaceId).then((path) => {
      if (!active) return;
      unsubscribe = onSnapshot(path, (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (error) => {
        console.warn(`Cloud sync disabled for ${name}:`, error?.message || error); onError?.(error);
      });
    });
  }).catch((error) => { if (active) onError?.(error); });
  return () => { active = false; unsubscribe(); };
};

export const writeRecord = async (uid, collectionName, record, workspaceId = 'personal') => {
  if (!uid || !firestore) return;
  if (!(await cloudEnabled(uid))) return;
  const { id, ...data } = record;
  await setDoc(doc(await resolveCollection(uid, collectionName, workspaceId), id), { ...data, createdBy: data.createdBy || uid }, { merge: true });
};

export const deleteRecord = async (uid, collectionName, id, workspaceId = 'personal') => {
  if (!uid || !firestore) return;
  if (!(await cloudEnabled(uid))) return;
  await deleteDoc(doc(await resolveCollection(uid, collectionName, workspaceId), id));
};

export const replaceCollection = async (uid, collectionName, records) => {
  if (!uid || !firestore) return;
  await Promise.all(records.map((record) => writeRecord(uid, collectionName, record)));
};
