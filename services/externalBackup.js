import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageAccessFramework, writeAsStringAsync } from 'expo-file-system/legacy';

const directoryKey = (uid) => `expenseTracker.externalBackup.${uid}.directory`;
const fileKey = (uid) => `expenseTracker.externalBackup.${uid}.file`;
const statusKey = (uid) => `expenseTracker.externalBackup.${uid}.status`;
const debounceTimers = new Map();
let pendingWrite = Promise.resolve();
const statusListeners = new Map();

async function saveStatus(uid, status) {
  await AsyncStorage.setItem(statusKey(uid), status);
  statusListeners.get(uid)?.forEach((listener) => listener(status));
}

export function subscribeExternalBackupStatus(uid, listener) {
  if (!uid || typeof listener !== 'function') return () => {};
  const listeners = statusListeners.get(uid) || new Set();
  listeners.add(listener);
  statusListeners.set(uid, listeners);
  getExternalBackupStatus(uid).then(listener).catch(() => {});
  return () => {
    listeners.delete(listener);
    if (!listeners.size) statusListeners.delete(uid);
  };
}

export async function selectExternalBackupFolder(uid) {
  if (!uid) throw new Error('Open a local session before choosing a backup folder.');
  const result = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!result.granted) return null;
  await AsyncStorage.setItem(directoryKey(uid), result.directoryUri);
  await AsyncStorage.removeItem(fileKey(uid));
  await writeExternalBackup(uid);
  return result.directoryUri;
}

export async function getExternalBackupFolder(uid) {
  return uid ? AsyncStorage.getItem(directoryKey(uid)) : null;
}

export async function getExternalBackupStatus(uid) {
  return uid ? AsyncStorage.getItem(statusKey(uid)) : null;
}

export async function clearExternalBackupFolder(uid) {
  if (!uid) return;
  await AsyncStorage.multiRemove([directoryKey(uid), fileKey(uid)]);
  await AsyncStorage.removeItem(statusKey(uid));
  const timer = debounceTimers.get(uid);
  if (timer) clearTimeout(timer);
  debounceTimers.delete(uid);
}

export function scheduleExternalBackup(uid) {
  if (!uid) return;
  const existingTimer = debounceTimers.get(uid);
  if (existingTimer) clearTimeout(existingTimer);
  const timer = setTimeout(() => {
    debounceTimers.delete(uid);
    pendingWrite = pendingWrite.then(() => writeExternalBackup(uid)).catch((error) => {
      saveStatus(uid, `Backup needs attention: ${error?.message || 'retry the backup'}`).catch(() => {});
      console.warn('External backup could not be updated:', error?.message || error);
    });
  }, 1200);
  debounceTimers.set(uid, timer);
}

export async function writeExternalBackup(uid) {
  const directoryUri = await getExternalBackupFolder(uid);
  if (!directoryUri) return false;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => (key.startsWith(`expenseTracker.${uid}.`) || key === `expenseTracker.currency.${uid}`) && !key.startsWith(`expenseTracker.externalBackup.${uid}.`));
    const data = Object.fromEntries(await AsyncStorage.multiGet(keys));
    const snapshot = JSON.stringify({ format: 'ExpenseTracker backup', version: 1, updatedAt: new Date().toISOString(), data }, null, 2);
    let backupUri = await AsyncStorage.getItem(fileKey(uid));
    if (!backupUri) {
      backupUri = await StorageAccessFramework.createFileAsync(directoryUri, 'ExpenseTracker-backup.json', 'application/json');
      await AsyncStorage.setItem(fileKey(uid), backupUri);
    }
    await writeAsStringAsync(backupUri, snapshot);
    await saveStatus(uid, `Last backup: ${new Date().toLocaleString()}`);
    return true;
  } catch (error) {
    await saveStatus(uid, `Backup needs attention: ${error?.message || 'Choose the folder again or retry the backup.'}`).catch(() => {});
    throw error;
  }
}
