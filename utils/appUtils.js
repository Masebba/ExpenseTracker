import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export const STORAGE_KEYS = {
  currency: 'expenseTracker.currency',
  profile: 'expenseTracker.profile',
  preferences: 'expenseTracker.preferences',
  appPin: 'expenseTracker.appPin',
};

export const nowIso = () => new Date().toISOString();

export const makeId = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const toNumber = (value, fallback = 0) => {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

export const toInteger = (value, fallback = 0) => Math.trunc(toNumber(value, fallback));

export const validateMoney = (value, { allowZero = true } = {}) => {
  const n = toNumber(value, NaN);
  if (!Number.isFinite(n)) return { valid: false, value: 0, message: 'Enter a valid amount.' };
  if (!allowZero && n <= 0) return { valid: false, value: n, message: 'Amount must be greater than zero.' };
  if (allowZero && n < 0) return { valid: false, value: n, message: 'Amount cannot be negative.' };
  return { valid: true, value: Math.round(n * 100) / 100 };
};

export const validatePercentage = (value) => {
  const n = toNumber(value, 0);
  if (!Number.isFinite(n) || n < 0 || n > 100) return { valid: false, value: 0, message: 'Discount must be between 0% and 100%.' };
  return { valid: true, value: Math.round(n * 100) / 100 };
};

export const CURRENCY_SYMBOLS = { UGX: 'USh', USD: '$', EUR: '€', GBP: '£', KES: 'KSh', TZS: 'TSh', RWF: 'RWF', BIF: 'FBu', ETB: 'Br', JPY: '¥' };
export const currencyFromCode = (code, fallback = { symbol: 'USh', code: 'UGX' }) => {
  const normalized = code || fallback.code;
  return { code: normalized, symbol: CURRENCY_SYMBOLS[normalized] || normalized };
};

export const formatMoney = (amount, currency = { symbol: 'Ush', code: 'UGX' }) => {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const symbol = currency?.symbol || currency?.code || 'UGX';
  const digits = ['UGX', 'JPY', 'RWF', 'BIF'].includes(currency?.code) ? 0 : 2;
  return `${symbol} ${safeAmount.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

export const periodStartEnd = (period, now = new Date()) => {
  const d = new Date(now);
  if (period === 'daily') return [new Date(d.getFullYear(), d.getMonth(), d.getDate()), new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)];
  if (period === 'weekly') {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
    return [start, new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)];
  }
  if (period === 'monthly') return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 1)];
  if (period === 'yearly') return [new Date(d.getFullYear(), 0, 1), new Date(d.getFullYear() + 1, 0, 1)];
  return [new Date(0), new Date(8640000000000000)];
};

export const inPeriod = (timestamp, period, now = new Date()) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  const [start, end] = periodStartEnd(period, now);
  return date >= start && date < end;
};

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const loadJson = async (key, fallback) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    const root = FileSystem.documentDirectory;
    if (root) {
      const file = `${root}ExpenseTracker/${encodeURIComponent(key).replace(/%/g, '_')}.json`;
      const info = await FileSystem.getInfoAsync(file);
      if (info.exists) {
        const contents = await FileSystem.readAsStringAsync(file);
        await AsyncStorage.setItem(key, contents);
        return JSON.parse(contents);
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
};

export const saveJson = async (key, value) => {
  try {
    const json = JSON.stringify(value);
    await AsyncStorage.setItem(key, json);
    const ownerId = key.startsWith('expenseTracker.') ? key.split('.')[1] : '';
    if (ownerId && !['guest', 'currency', 'cloudSync', 'externalBackup'].includes(ownerId)) {
      import('../services/externalBackup').then(({ scheduleExternalBackup }) => scheduleExternalBackup(ownerId)).catch(() => {});
    }
    const root = FileSystem.documentDirectory;
    if (root) {
      const directory = `${root}ExpenseTracker/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => {});
      const safeName = encodeURIComponent(key).replace(/%/g, '_');
      await FileSystem.writeAsStringAsync(`${directory}${safeName}.json`, json).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
};

export const saveImageLocally = async (sourceUri, fileName) => {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('Local app storage is unavailable on this device.');
  const directory = `${root}ExpenseTracker/images/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const safeName = String(fileName || 'image').replace(/[^a-zA-Z0-9_-]/g, '_');
  const destination = `${directory}${safeName}.jpg`;
  await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
};

export const removeKey = async (key) => {
  try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
};
