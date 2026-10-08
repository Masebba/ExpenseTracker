import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export const STORAGE_KEYS = {
  currency: 'expenseTracker.currency',
  profile: 'expenseTracker.profile',
  preferences: 'expenseTracker.preferences',
  appPin: 'expenseTracker.appPin',
};

export const nowIso = () => new Date().toISOString();

// Screens cap their content width so text and cards stay readable on tablets
// and in landscape instead of stretching across the full display.
export const CONTENT_MAX_WIDTH = 720;
export const contentWidthStyle = { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' };

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

export const CURRENCY_SYMBOLS = {
  UGX: 'USh', USD: '$', EUR: '€', GBP: '£', KES: 'KSh', TZS: 'TSh',
  RWF: 'RWF', BIF: 'FBu', ETB: 'Br', JPY: '¥', AED: 'د.إ',
  AUD: 'A$', BRL: 'R$', CAD: 'C$', CHF: 'CHF', CNY: '¥',
  GHS: 'GH₵', INR: '₹', IDR: 'Rp', KRW: '₩', MXN: 'MX$',
  NGN: '₦', NPR: 'रू', PHP: '₱', PKR: 'Rs', SAR: 'ر.س',
  SGD: 'S$', ZAR: 'R', TRY: '₺', VND: '₫', EGP: 'E£',
  XAF: 'FCFA', XOF: 'CFA', NOK: 'kr', SEK: 'kr', DKK: 'kr',
  PLN: 'zł', CZK: 'Kč', RUB: '₽', UAH: '₴', RON: 'lei',
  HUF: 'Ft', ILS: '₪', THB: '฿', MYR: 'RM', BDT: '৳',
  LKR: 'Rs', HKD: 'HK$', TWD: 'NT$', NZD: 'NZ$', ARS: 'AR$',
  CLP: 'CL$', COP: 'CO$', PEN: 'S/', MAD: 'د.م.', DZD: 'دج',
  TND: 'د.ت.', ZMW: 'ZK', MWK: 'MK', BWP: 'P', NAD: 'N$',
  MZN: 'MT', AOA: 'Kz', ISK: 'kr', RSD: 'дин.', BGN: 'лв',
  BAM: 'KM', MKD: 'ден', ALL: 'L', MDL: 'L', GEL: '₾',
  AMD: '֏', AZN: '₼', KZT: '₸', UZS: 'soʻm', KHR: '៛',
  LAK: '₭', MMK: 'K', MNT: '₮', AFN: '؋', IQD: 'ع.د',
  JOD: 'د.ا', LBP: 'ل.ل', KWD: 'د.ك', BHD: 'د.ب',
  OMR: 'ر.ع.', QAR: 'ر.ق', YER: 'ر.ي', BOB: 'Bs.',
  CRC: '₡', DOP: 'RD$', GTQ: 'Q', HNL: 'L', NIO: 'C$',
  PAB: 'B/.', PYG: '₲', UYU: '$U', VES: 'Bs.',
  XCD: 'EC$', BMD: 'BD$', KYD: 'CI$', CUP: '₱', ANG: 'ƒ',
  MOP: 'MOP$', FJD: 'FJ$', PGK: 'K', WST: 'WS$', TOP: 'T$',
  VUV: 'VT', SBD: 'SI$', SLE: 'Le',
  KMF: 'CF', DJF: 'Fdj', ERN: 'Nfk', SZL: 'E', GMD: 'D',
  GNF: 'FG', LSL: 'L', LRD: 'L$', LYD: 'ل.د', MRU: 'UM',
  MUR: '₨', MGA: 'Ar', SOS: 'Sh', SSP: '£', SDG: 'ج.س.',
  STN: 'Db', SCR: '₨', CDF: 'FC', BYN: 'Br', TJS: 'SM',
  TMT: 'm', KGS: 'сом', IRR: '﷼', SYP: '£', BND: 'B$',
  BTN: 'Nu.', MVR: 'ރ.', KPW: '₩', BZD: 'BZ$', JMD: 'J$',
  TTD: 'TT$', BBD: 'Bds$', BSD: 'B$', HTG: 'G', SRD: 'SR$',
  GYD: 'G$', CVE: 'Esc',
};

const REGION_CURRENCIES = {
  UG: 'UGX', KE: 'KES', TZ: 'TZS', RW: 'RWF', BI: 'BIF', ET: 'ETB',
  US: 'USD', GB: 'GBP', JP: 'JPY', CN: 'CNY', IN: 'INR', AU: 'AUD',
  CA: 'CAD', BR: 'BRL', CH: 'CHF', GH: 'GHS', NG: 'NGN', ZA: 'ZAR',
  AE: 'AED', ID: 'IDR', KR: 'KRW', MX: 'MXN', NP: 'NPR', PH: 'PHP',
  PK: 'PKR', SA: 'SAR', SG: 'SGD', TR: 'TRY', VN: 'VND', EG: 'EGP',
  CM: 'XAF', SN: 'XOF', CI: 'XOF', BF: 'XOF', BJ: 'XOF', ML: 'XOF',
  NE: 'XOF', TG: 'XOF', CF: 'XAF', TD: 'XAF', CG: 'XAF', GA: 'XAF',
  GQ: 'XAF', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', PT: 'EUR',
  NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR',
  CY: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', LU: 'EUR', MT: 'EUR',
  SK: 'EUR', SI: 'EUR', HR: 'EUR',
  NO: 'NOK', SE: 'SEK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', RU: 'RUB',
  UA: 'UAH', RO: 'RON', HU: 'HUF', IL: 'ILS', TH: 'THB', MY: 'MYR',
  BD: 'BDT', LK: 'LKR', HK: 'HKD', TW: 'TWD', NZ: 'NZD', AR: 'ARS',
  CL: 'CLP', CO: 'COP', PE: 'PEN', MA: 'MAD', DZ: 'DZD', TN: 'TND',
  ZM: 'ZMW', MW: 'MWK', BW: 'BWP', NA: 'NAD', MZ: 'MZN', AO: 'AOA',
  IS: 'ISK', RS: 'RSD', BG: 'EUR', BA: 'BAM', MK: 'MKD', AL: 'ALL',
  MD: 'MDL', GE: 'GEL', AM: 'AMD', AZ: 'AZN', KZ: 'KZT', UZ: 'UZS',
  KH: 'KHR', LA: 'LAK', MM: 'MMK', MN: 'MNT', AF: 'AFN', IQ: 'IQD',
  JO: 'JOD', LB: 'LBP', KW: 'KWD', BH: 'BHD', OM: 'OMR', QA: 'QAR',
  YE: 'YER', BO: 'BOB', CR: 'CRC', DO: 'DOP', GT: 'GTQ', HN: 'HNL',
  NI: 'NIO', PY: 'PYG', UY: 'UYU', VE: 'VES',
  CV: 'CVE', KM: 'KMF', DJ: 'DJF', ER: 'ERN', SZ: 'SZL', SL: 'SLE',
  GM: 'GMD', GN: 'GNF', LS: 'LSL', LR: 'LRD', LY: 'LYD',
  MR: 'MRU', MU: 'MUR', MG: 'MGA', SO: 'SOS', SS: 'SSP',
  SD: 'SDG', ST: 'STN', SC: 'SCR', CD: 'CDF',
  BY: 'BYN', TJ: 'TJS', TM: 'TMT', KG: 'KGS', IR: 'IRR',
  SY: 'SYP', BN: 'BND', BT: 'BTN', MV: 'MVR', KP: 'KPW',
  BZ: 'BZD', JM: 'JMD', TT: 'TTD', BB: 'BBD', BS: 'BSD',
  HT: 'HTG', SR: 'SRD', GY: 'GYD', EC: 'USD', SV: 'USD',
  PA: 'PAB', ZW: 'USD', BM: 'BMD', KY: 'KYD', CU: 'CUP',
  CW: 'ANG', SX: 'ANG', AG: 'XCD', DM: 'XCD', GD: 'XCD',
  KN: 'XCD', LC: 'XCD', VC: 'XCD', MS: 'XCD',
  FJ: 'FJD', PG: 'PGK', WS: 'WST', TO: 'TOP', VU: 'VUV',
  SB: 'SBD', KI: 'AUD', FM: 'USD', PW: 'USD', MH: 'USD',
  NR: 'AUD', TV: 'AUD', TL: 'USD', MO: 'MOP',
  AD: 'EUR', MC: 'EUR', SM: 'EUR',
  VA: 'EUR', XK: 'EUR', GI: 'GBP',
};

const TIME_ZONE_REGIONS = {
  'Africa/Kampala': 'UG', 'Africa/Nairobi': 'KE', 'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Kigali': 'RW', 'Africa/Bujumbura': 'BI', 'Africa/Addis_Ababa': 'ET',
  'Africa/Accra': 'GH', 'Africa/Lagos': 'NG', 'Africa/Johannesburg': 'ZA',
  'Africa/Douala': 'CM', 'Africa/Abidjan': 'CI', 'Africa/Dakar': 'SN',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA',
  'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
  'Europe/London': 'GB', 'Europe/Zurich': 'CH', 'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE', 'Europe/Rome': 'IT', 'Europe/Madrid': 'ES',
  'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Vienna': 'AT',
  'Europe/Dublin': 'IE', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ',
  'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR', 'Europe/Moscow': 'RU',
  'Asia/Tokyo': 'JP',
  'Asia/Shanghai': 'CN', 'Asia/Kolkata': 'IN', 'Asia/Dubai': 'AE',
  'Asia/Seoul': 'KR', 'Asia/Jakarta': 'ID', 'Asia/Kathmandu': 'NP',
  'Asia/Manila': 'PH', 'Asia/Karachi': 'PK', 'Asia/Riyadh': 'SA',
  'Asia/Singapore': 'SG', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Bangkok': 'TH',
  'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK', 'Asia/Kuala_Lumpur': 'MY',
  'Asia/Taipei': 'TW', 'Asia/Hong_Kong': 'HK', 'Australia/Sydney': 'AU',
  'Australia/Perth': 'AU', 'Pacific/Auckland': 'NZ',
};

export const detectDeviceRegion = () => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
  const localeParts = locale.replace(/_/g, '-').split('-');
  const region = localeParts.slice(1).find((part) => /^[A-Za-z]{2}$/.test(part));
  if (region) return region.toUpperCase();

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return TIME_ZONE_REGIONS[timeZone] || null;
};

export const currencyForRegion = (region) =>
  currencyFromCode(REGION_CURRENCIES[String(region || '').toUpperCase()] || 'UGX');

export const isValidHttpUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && Boolean(url.hostname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
};

export const currencyFromCode = (code, fallback = { symbol: 'USh', code: 'UGX' }) => {
  const normalized = code || fallback.code;
  let symbol = CURRENCY_SYMBOLS[normalized] || normalized;
  try {
    symbol = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalized,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0).find((part) => part.type === 'currency')?.value || symbol;
  } catch {
    // Use the known symbol or currency code if this runtime lacks the currency.
  }
  return { code: normalized, symbol, name: normalized };
};

// Local images imported with the system picker are copied into private app
// storage, but their absolute file:// URIs can become stale after a reinstall,
// a data clear, or a backup restore on another device. Treat only values that
// still live under this install's document directory as usable; every other
// file:// value should fall back to the placeholder avatar instead of showing
// a broken image tile.
export const isUsableLocalImage = (uri, documentDirectory) => {
  if (!uri) return false;
  if (/^(https?:|content:|assets-library:|ph:\/\/)/i.test(uri)) return true;
  if (/^file:\/\//i.test(uri)) {
    if (!documentDirectory) return true;
    return uri.startsWith(documentDirectory);
  }
  return true;
};

export const formatMoney = (amount, currency = { symbol: 'Ush', code: 'UGX' }) => {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const symbol = currency?.symbol || currency?.code || 'UGX';
  let digits = ['UGX', 'JPY', 'RWF', 'BIF', 'KRW', 'VND', 'XAF', 'XOF'].includes(currency?.code) ? 0 : 2;
  try {
    digits = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency?.code || 'UGX',
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    // Retain the known fraction digits when the runtime lacks this currency.
  }
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
    const currencyOwner = key.match(/^expenseTracker\.currency\.([^.]+)$/)?.[1];
    const scopedOwner = key.match(/^expenseTracker\.([^.]+)\./)?.[1];
    const ownerId = currencyOwner || scopedOwner;
    if (ownerId && !['cloudSync', 'externalBackup'].includes(ownerId)) {
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
