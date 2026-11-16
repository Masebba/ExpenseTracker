import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { withLocalOwnerWriteLock } from '../utils/appUtils';

const isInternalKey = (key) => key.endsWith('.pendingLocalTransaction') || key.includes('.cloudBaseline.');
const scopedKey = (key, uid) => !isInternalKey(key) && (
  key.startsWith(`expenseTracker.${uid}.`)
  || key === `expenseTracker.currency.${uid}`
  || key === `expenseTracker.currency.manual.${uid}`
);

const parseStoredValue = (value, key) => {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); }
  catch {
    // Most legacy records are JSON. Permit simple non-JSON strings only for
    // known scalar preference keys; reject malformed ledger datasets.
    if (key === key.match(/^expenseTracker\.currency\.[^.]+$/)?.[0] || /\.profileImage$/.test(key) || /\.workspaceImage\.[^.]+$/.test(key)) return value;
    throw new Error(`The backup contains invalid data for ${key.split('.').slice(-1)[0]}.`);
  }
};

const ARRAY_DATASETS = new Set([
  'transactions', 'products', 'sales', 'orders', 'productCategories',
  'customers', 'suppliers', 'invoices', 'purchases', 'ads', 'notifications',
]);
const OBJECT_DATASETS = new Set(['spendingTargets', 'activeWorkspace', 'preferences', 'profile', 'personalDetails', 'businessProfile', 'categories']);
const REQUIRED_FIELDS = {
  transactions: ['type', 'amount'],
  products: ['name', 'price', 'stock'],
  sales: ['productId', 'quantity', 'finalAmount'],
  orders: ['customerName', 'productName', 'total'],
  customers: ['name'],
  suppliers: ['name'],
  invoices: ['customerName', 'total', 'items'],
  purchases: ['description', 'amount'],
};
const isPlainObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const lastKeySegment = (key) => key.split('.').at(-1);

function validateDataset(key, value) {
  const name = lastKeySegment(key);
  if (value == null) return;
  if (ARRAY_DATASETS.has(name)) {
    if (!Array.isArray(value)) throw new Error(`The backup's ${name} data must be a list. Nothing was imported.`);
    if (!value.every((item) => isPlainObject(item) || (['categories', 'productCategories'].includes(name) && typeof item === 'string'))) {
      throw new Error(`The backup's ${name} list contains an invalid record. Nothing was imported.`);
    }
    const required = REQUIRED_FIELDS[name] || [];
    value.forEach((item, index) => {
      if (!isPlainObject(item)) return;
      if (required.some((field) => item[field] === undefined || item[field] === null)) {
        throw new Error(`The backup's ${name} record ${index + 1} is incomplete. Nothing was imported.`);
      }
      if (item.id != null && (typeof item.id !== 'string' || !item.id.trim())) {
        throw new Error(`The backup's ${name} list contains an invalid record ID. Nothing was imported.`);
      }
    });
    if (name === 'invoices') {
      const numbers = value.map((item) => String(item.number || '').trim().toUpperCase()).filter(Boolean);
      if (new Set(numbers).size !== numbers.length) throw new Error('The backup contains duplicate invoice numbers. Resolve the duplicates before restoring it.');
    }
    return;
  }
  if (OBJECT_DATASETS.has(name) && !isPlainObject(value)) {
    throw new Error(`The backup's ${name} data must be an object. Nothing was imported.`);
  }
  if (name === 'spendingTargets' && Object.values(value).some((amount) => !Number.isFinite(Number(amount)) || Number(amount) < 0)) {
    throw new Error('The backup contains an invalid spending target. Nothing was imported.');
  }
  if (name === 'currency' && (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value))) {
    throw new Error('The backup contains an invalid currency preference. Nothing was imported.');
  }
  if (/\.profileImage$/.test(key) || /\.workspaceImage\.[^.]+$/.test(key)) {
    if (typeof value !== 'string') throw new Error('The backup contains an invalid image reference. Nothing was imported.');
  }
}

function collectEntries(uid, backup) {
  if (backup?.version !== 1 || !['FinanceTracker export', 'FinanceTracker backup', 'ExpenseTracker export', 'ExpenseTracker backup'].includes(backup?.format)) {
    throw new Error('This is not a supported FinanceTracker backup file.');
  }
  if (['FinanceTracker export', 'ExpenseTracker export'].includes(backup.format) && backup.uid !== uid) {
    throw new Error('This export belongs to a different account. Sign in to the matching account before restoring it.');
  }
  const localData = ['FinanceTracker export', 'ExpenseTracker export'].includes(backup.format) ? backup.localData : backup.data;
  if (!localData || typeof localData !== 'object' || Array.isArray(localData)) throw new Error('The backup does not contain valid local records.');
  const entries = Object.entries(localData);
  if (!entries.length) throw new Error('This backup contains no local records to restore.');
  const safeEntries = entries.filter(([key]) => scopedKey(key, uid));
  if (!safeEntries.length || safeEntries.length !== entries.length) throw new Error('The backup contains data outside the signed-in account. Import was stopped to protect other data.');
  const validated = safeEntries.map(([key, rawValue]) => {
    const isParsedExport = ['FinanceTracker export', 'ExpenseTracker export'].includes(backup.format);
    const value = parseStoredValue(rawValue, key);
    validateDataset(key, value);
    // Export files contain parsed JavaScript values, while folder backups hold
    // the original AsyncStorage strings. Re-serialize export values as JSON,
    // except legacy image URI keys whose values are intentionally plain paths.
    const isImageUri = /\.profileImage$/.test(key) || /\.workspaceImage\.[^.]+$/.test(key);
    const serialized = rawValue == null ? null : (
      isParsedExport
        ? (isImageUri && typeof value === 'string' ? value : JSON.stringify(value))
        : (typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue))
    );
    return [key, serialized];
  });
  return validated;
}

export async function restoreBackup(uid, backupText) {
  if (!uid) throw new Error('Sign in before restoring a backup.');
  let backup;
  try { backup = JSON.parse(backupText); } catch { throw new Error('The selected file is not valid JSON.'); }
  // Validate every key and every dataset before the first write. An invalid
  // record therefore cannot leave a half-imported ledger.
  const entries = collectEntries(uid, backup);
  return withLocalOwnerWriteLock(uid, async () => {
  const previousEntries = await AsyncStorage.multiGet(entries.map(([key]) => key));
  const previouslyPresent = new Set(previousEntries.filter(([, value]) => value != null).map(([key]) => key));
  const valuesToWrite = entries.filter(([, value]) => value != null);
  const keysToRemove = entries.filter(([, value]) => value == null).map(([key]) => key);
  try {
    if (valuesToWrite.length) await AsyncStorage.multiSet(valuesToWrite);
    if (keysToRemove.length) await AsyncStorage.multiRemove(keysToRemove);
  } catch (restoreError) {
    try {
      const recoveries = previousEntries.filter(([, value]) => value != null);
      if (recoveries.length) await AsyncStorage.multiSet(recoveries);
      const newKeys = entries.map(([key]) => key).filter((key) => !previouslyPresent.has(key));
      if (newKeys.length) await AsyncStorage.multiRemove(newKeys);
    } catch (rollbackError) {
      console.error('[Backup] Restore rollback was incomplete.', { restoreError, rollbackError });
      throw new Error('The backup could not be restored and automatic recovery was incomplete. Keep your backup file and contact support before making more changes.');
    }
    console.warn('[Backup] Restore failed and previous records were rolled back:', restoreError?.message || restoreError);
    throw new Error('The backup could not be restored. Your previous data has been kept. Check available storage and try again.');
  }

  const directory = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}ExpenseTracker/` : null;
  if (directory) {
    try {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      for (const [key, value] of entries) {
        const name = `${encodeURIComponent(key).replace(/%/g, '_')}.json`;
        const file = `${directory}${name}`;
        if (value == null) await FileSystem.deleteAsync(file, { idempotent: true });
        else await FileSystem.writeAsStringAsync(file, value);
      }
    } catch (error) {
      console.warn('[Backup] Recovery mirror could not be refreshed:', error?.message || error);
      // The primary restore succeeded. Report the backup as usable, but record
      // that the private recovery copy may be stale for a later diagnostics UI.
    }
  }
  import('./externalBackup').then(({ scheduleExternalBackup }) => scheduleExternalBackup(uid)).catch(() => {});
  return { restoredKeys: entries.length };
  });
}
