import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageAccessFramework, writeAsStringAsync } from 'expo-file-system/legacy';

const directoryKey = (uid) => `expenseTracker.externalBackup.${uid}.directory`;
const fileKey = (uid) => `expenseTracker.externalBackup.${uid}.file`;
const statusKey = (uid) => `expenseTracker.externalBackup.${uid}.status`;
let debounceTimer;
let pendingWrite = Promise.resolve();

export async function selectExternalBackupFolder(uid) {
  if (!uid) throw new Error('Sign in before choosing a backup folder.');
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
  if (debounceTimer) clearTimeout(debounceTimer);
}

export function scheduleExternalBackup(uid) {
  if (!uid) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    pendingWrite = pendingWrite.then(() => writeExternalBackup(uid)).catch((error) => {
      AsyncStorage.setItem(statusKey(uid), `Backup needs attention: ${error?.message || 'retry the backup'}`).catch(() => {});
      console.warn('External backup could not be updated:', error?.message || error);
    });
  }, 1200);
}

export async function writeExternalBackup(uid) {
  const directoryUri = await getExternalBackupFolder(uid);
  if (!directoryUri) return false;
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => (key.startsWith(`expenseTracker.${uid}.`) || key === `expenseTracker.currency.${uid}`) && !key.startsWith(`expenseTracker.externalBackup.${uid}.`));
  const data = Object.fromEntries(await AsyncStorage.multiGet(keys));
  const snapshot = JSON.stringify({ format: 'ExpenseTracker backup', version: 1, updatedAt: new Date().toISOString(), data }, null, 2);
  let backupUri = await AsyncStorage.getItem(fileKey(uid));
  if (!backupUri) {
    backupUri = await StorageAccessFramework.createFileAsync(directoryUri, 'ExpenseTracker-backup.json', 'application/json');
    await AsyncStorage.setItem(fileKey(uid), backupUri);
  }
  await writeAsStringAsync(backupUri, snapshot);
  await AsyncStorage.setItem(statusKey(uid), `Last backup: ${new Date().toLocaleString()}`);
  return true;
}
