import AsyncStorage from '@react-native-async-storage/async-storage';

const scopedKey = (key, uid) => key.startsWith(`expenseTracker.${uid}.`) || key === `expenseTracker.currency.${uid}`;

function collectEntries(uid, backup) {
  if (backup?.version !== 1 || !['ExpenseTracker export', 'ExpenseTracker backup'].includes(backup?.format)) {
    throw new Error('This is not a supported ExpenseTracker backup file.');
  }
  if (backup.format === 'ExpenseTracker export' && backup.uid !== uid) {
    throw new Error('This export belongs to a different account. Sign in to the matching account before restoring it.');
  }
  const localData = backup.format === 'ExpenseTracker export' ? backup.localData : backup.data;
  if (!localData || typeof localData !== 'object' || Array.isArray(localData)) throw new Error('The backup does not contain valid local records.');
  const entries = Object.entries(localData);
  if (!entries.length) throw new Error('This backup contains no local records to restore.');
  const safeEntries = entries.filter(([key]) => scopedKey(key, uid));
  if (!safeEntries.length || safeEntries.length !== entries.length) throw new Error('The backup contains data outside the signed-in account. Import was stopped to protect other data.');
  return safeEntries.map(([key, value]) => [key, typeof value === 'string' || value == null ? value : JSON.stringify(value)]);
}

export async function restoreBackup(uid, backupText) {
  if (!uid) throw new Error('Sign in before restoring a backup.');
  let backup;
  try { backup = JSON.parse(backupText); } catch { throw new Error('The selected file is not valid JSON.'); }
  const entries = collectEntries(uid, backup);
  const previousEntries = await AsyncStorage.multiGet(entries.map(([key]) => key));
  const previouslyPresent = new Set(previousEntries.filter(([, value]) => value != null).map(([key]) => key));
  try {
    await AsyncStorage.multiSet(entries);
  } catch (restoreError) {
    try {
      const recoveries = previousEntries.filter(([, value]) => value != null);
      if (recoveries.length) await AsyncStorage.multiSet(recoveries);
      const newKeys = entries.map(([key]) => key).filter((key) => !previouslyPresent.has(key));
      if (newKeys.length) await AsyncStorage.multiRemove(newKeys);
    } catch (rollbackError) {
      throw new Error(`Restore failed and automatic recovery was incomplete. Keep the selected file and contact support. Restore error: ${restoreError.message || 'unknown'}; recovery error: ${rollbackError.message || 'unknown'}`);
    }
    throw new Error(`Restore failed. Your previous records were recovered: ${restoreError.message || 'storage error'}`);
  }
}
