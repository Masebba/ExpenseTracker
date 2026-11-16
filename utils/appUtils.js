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
  // Time zone is a better regional signal than language alone. For example,
  // an English-UG locale can remain set while a device is configured for Nairobi.
  let timeZone = null;
  let locale = '';
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    timeZone = resolved.timeZone || null;
    locale = resolved.locale || '';
  } catch { /* Fall through to the available locale or safe default. */ }
  if (timeZone && TIME_ZONE_REGIONS[timeZone]) return TIME_ZONE_REGIONS[timeZone];
  const localeParts = locale.replace(/_/g, '-').split('-');
  const region = localeParts.slice(1).find((part) => /^[A-Za-z]{2}$/.test(part));
  return region ? region.toUpperCase() : null;
};

export const normalizeAdvertImageUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  const cleaned = value.trim().replace(/[\u200B\uFEFF\r\n\t]/g, '');
  try {
    const url = new URL(cleaned);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    const host = url.hostname.toLowerCase();
    // Convert common sharing-page links into image/content endpoints when possible.
    if (host === 'drive.google.com' || host === 'docs.google.com') {
      const match = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const fileId = match?.[1] || url.searchParams.get('id');
      if (fileId) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
    }
    if (host === 'www.dropbox.com' || host === 'dropbox.com') {
      url.hostname = 'www.dropbox.com';
      if (url.searchParams.has('dl')) url.searchParams.delete('dl');
      url.searchParams.set('raw', '1');
    }
    return url.toString();
  } catch { return ''; }
};

export const isValidHttpsUrl = (value) => {
  const normalized = normalizeAdvertImageUrl(value);
  if (!normalized) return false;
  try { const url = new URL(normalized); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
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
  const normalized = String(code || fallback.code).toUpperCase();
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

export const CURRENCY_CODES = Object.keys(CURRENCY_SYMBOLS).sort();

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

export const formatCurrency = (amount, currencyCode = 'UGX', locale) => {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: String(currencyCode || 'UGX').toUpperCase(),
    }).format(safeAmount);
  } catch {
    const code = String(currencyCode || 'UGX').toUpperCase();
    return `${code} ${safeAmount.toLocaleString(locale)}`;
  }
};

export const formatMoney = (amount, currency = { code: 'UGX' }, locale) =>
  formatCurrency(amount, typeof currency === 'string' ? currency : currency?.code, locale);

const localeWeekStart = () => {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof Intl.Locale === 'function') {
      const localeObject = new Intl.Locale(locale);
      const info = typeof localeObject.getWeekInfo === 'function'
        ? localeObject.getWeekInfo()
        : localeObject.weekInfo;
      if (Number.isInteger(info?.firstDay) && info.firstDay >= 1 && info.firstDay <= 7) return info.firstDay % 7;
    }
  } catch { /* Devices without Intl.Locale use Sunday as the safe fallback. */ }
  return 0;
};

export const periodStartEnd = (period, now = new Date(), weekStartsOn = localeWeekStart()) => {
  const d = new Date(now);
  if (period === 'daily') return [new Date(d.getFullYear(), d.getMonth(), d.getDate()), new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)];
  if (period === 'weekly') {
    const normalizedFirstDay = ((Number(weekStartsOn) || 0) % 7 + 7) % 7;
    const daysSinceWeekStart = (d.getDay() - normalizedFirstDay + 7) % 7;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceWeekStart);
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

const mirrorFileForKey = (key) => {
  const root = FileSystem.documentDirectory;
  if (!root) return null;
  return `${root}ExpenseTracker/${encodeURIComponent(key).replace(/%/g, '_')}.json`;
};

const writeMirrorValue = async (key, value) => {
  const file = mirrorFileForKey(key);
  if (!file) return false;
  try {
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}ExpenseTracker/`, { intermediates: true });
    if (value == null) {
      await FileSystem.deleteAsync(file, { idempotent: true });
    } else {
      const json = typeof value === 'string' ? value : JSON.stringify(value);
      await FileSystem.writeAsStringAsync(file, json);
    }
    return true;
  } catch (error) {
    console.warn('[Storage] Private recovery mirror could not be updated:', error?.message || error);
    return false;
  }
};

const ownerFromStorageKey = (key) => {
  // The manual override key is nested under `manual` and must never be
  // mistaken for an account named `currency`.
  if (key.startsWith('expenseTracker.currency.manual.')) return null;
  const currencyOwner = key.match(/^expenseTracker\.currency\.([^.]+)$/)?.[1];
  const scopedOwner = key.match(/^expenseTracker\.([^.]+)\./)?.[1];
  const owner = currencyOwner || scopedOwner;
  return owner && !['cloudSync', 'externalBackup'].includes(owner) ? owner : null;
};

const localOwnerWriteQueues = new Map();
const enqueueLocalOwnerWork = async (ownerId, work) => {
  if (!ownerId) return work();
  const prior = localOwnerWriteQueues.get(ownerId) || Promise.resolve();
  const current = prior.catch(() => undefined).then(work);
  localOwnerWriteQueues.set(ownerId, current);
  try { return await current; }
  finally { if (localOwnerWriteQueues.get(ownerId) === current) localOwnerWriteQueues.delete(ownerId); }
};

// Call before reading a scoped ledger or producing a folder backup, so readers
// cannot observe only one side of a multi-key transaction.
export const waitForLocalOwnerWrites = async (ownerId) => {
  const pending = ownerId ? localOwnerWriteQueues.get(ownerId) : null;
  if (pending) { try { await pending; } catch { /* Recovery below checks the journal. */ } }
};

export const withLocalOwnerWriteLock = async (ownerId, operation) =>
  enqueueLocalOwnerWork(ownerId, operation);

const recoveredTransactionOwners = new Set();
const pendingTransactionKey = (ownerId) => `expenseTracker.${ownerId}.pendingLocalTransaction`;

// If the app was stopped between writes to related ledger keys, roll back to
// the transaction's before-image before any affected dataset is hydrated.
export const recoverPendingLocalTransaction = async (ownerId) => {
  if (!ownerId || recoveredTransactionOwners.has(ownerId)) return;
  const journalKey = pendingTransactionKey(ownerId);
  try {
    const raw = await AsyncStorage.getItem(journalKey);
    if (!raw) {
      recoveredTransactionOwners.add(ownerId);
      return;
    }
    const journal = JSON.parse(raw);
    if (!Array.isArray(journal?.before) || !journal.before.every((entry) => Array.isArray(entry) && typeof entry[0] === 'string')) {
      throw new Error('Local transaction recovery information is invalid.');
    }
    const restore = journal.before;
    const toSet = restore.filter(([, value]) => value != null).map(([key, value]) => [key, String(value)]);
    const toRemove = restore.filter(([, value]) => value == null).map(([key]) => key);
    if (toSet.length) await AsyncStorage.multiSet(toSet);
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
    for (const [key, value] of restore) await writeMirrorValue(key, value);
    await AsyncStorage.removeItem(journalKey);
    recoveredTransactionOwners.add(ownerId);
    console.warn('[Storage] Recovered an interrupted local finance transaction.');
  } catch (error) {
    console.error('[Storage] Could not recover an interrupted local finance transaction:', error?.message || error);
    throw new Error('Finance records need recovery. Close and reopen the app, then restore a backup if this message continues.');
  }
};

// Persist related local datasets as a single recoverable operation. AsyncStorage
// has no multi-key transaction API, so a before-image journal makes interrupted
// or partially failed writes recoverable on the next data hydration.
const commitLocalJsonTransactionNow = async (ownerId, updates) => {
  if (!ownerId || !Array.isArray(updates) || updates.length < 2) throw new Error('A valid local ledger transaction is required.');
  await recoverPendingLocalTransaction(ownerId);
  const keys = updates.map((item) => item?.key);
  if (keys.some((key) => typeof key !== 'string' || (!key.startsWith(`expenseTracker.${ownerId}.`) && key !== `expenseTracker.currency.${ownerId}`))) {
    throw new Error('The local transaction contains data outside the current account.');
  }
  if (new Set(keys).size !== keys.length || keys.includes(pendingTransactionKey(ownerId))) {
    throw new Error('The local transaction contains duplicate or reserved keys.');
  }
  let serialized;
  try {
    serialized = updates.map(({ key, value }) => [key, value == null ? null : JSON.stringify(value)]);
    if (serialized.some(([, value]) => value === undefined)) throw new Error('A finance record could not be serialized.');
  } catch {
    throw new Error('Finance records could not be prepared for saving. Check the data and try again.');
  }
  const before = await AsyncStorage.multiGet(keys);
  const journal = JSON.stringify({ version: 1, startedAt: new Date().toISOString(), before });
  await AsyncStorage.setItem(pendingTransactionKey(ownerId), journal);
  try {
    const toSet = serialized.filter(([, value]) => value != null);
    const toRemove = serialized.filter(([, value]) => value == null).map(([key]) => key);
    if (toSet.length) await AsyncStorage.multiSet(toSet);
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
    for (const [key, value] of serialized) await writeMirrorValue(key, value);
    await AsyncStorage.removeItem(pendingTransactionKey(ownerId));
    recoveredTransactionOwners.add(ownerId);
    try { const { scheduleExternalBackup } = await import('../services/externalBackup'); scheduleExternalBackup(ownerId); } catch { /* The primary local transaction is already durable. */ }
    return true;
  } catch (error) {
    try {
      const oldValues = before.filter(([, value]) => value != null).map(([key, value]) => [key, value]);
      const oldKeys = before.filter(([, value]) => value == null).map(([key]) => key);
      if (oldValues.length) await AsyncStorage.multiSet(oldValues);
      if (oldKeys.length) await AsyncStorage.multiRemove(oldKeys);
      for (const [key, value] of before) await writeMirrorValue(key, value);
      await AsyncStorage.removeItem(pendingTransactionKey(ownerId));
    } catch (rollbackError) {
      recoveredTransactionOwners.delete(ownerId);
      console.error('[Storage] Local finance transaction rollback needs recovery:', rollbackError?.message || rollbackError);
      throw new Error('The change could not be saved safely. Reopen the app to recover the previous records, then retry.');
    }
    throw new Error('The change could not be saved. Your previous records have been restored. Try again.');
  }
};

export const commitLocalJsonTransaction = async (ownerId, updates) =>
  enqueueLocalOwnerWork(ownerId, () => commitLocalJsonTransactionNow(ownerId, updates));

export const loadJson = async (key, fallback) => {
  const ownerId = ownerFromStorageKey(key);
  await waitForLocalOwnerWrites(ownerId);
  // Never fall back to empty state if an interrupted finance write cannot be
  // recovered. Doing so would let the next save overwrite data that still
  // needs recovery.
  if (ownerId && !key.endsWith('.pendingLocalTransaction')) {
    await recoverPendingLocalTransaction(ownerId);
  }

  let raw = null;
  let primaryReadFailed = false;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch (error) {
    primaryReadFailed = true;
    console.warn('[Storage] Primary local read failed; checking recovery mirror:', error?.message || error);
  }
  if (raw != null) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('[Storage] Primary value is invalid; checking recovery mirror:', error?.message || error);
    }
  }

  const file = mirrorFileForKey(key);
  if (file) {
    try {
      const info = await FileSystem.getInfoAsync(file);
      if (info.exists) {
        const contents = await FileSystem.readAsStringAsync(file);
        let recovered;
        try { recovered = JSON.parse(contents); }
        catch {
          throw new Error('Finance records need recovery. The private recovery copy is invalid. Keep your backup and contact support before making more changes.');
        }
        try { await AsyncStorage.setItem(key, contents); }
        catch (error) { console.warn('[Storage] Recovered data could not be copied to primary storage:', error?.message || error); }
        return recovered;
      }
    } catch (error) {
      if (String(error?.message || '').includes('Finance records need recovery')) throw error;
      console.warn('[Storage] Recovery mirror read failed:', error?.message || error);
      if (primaryReadFailed || raw != null) {
        throw new Error('Finance records need recovery. Neither local copy could be read safely. Keep your backup and contact support before making more changes.');
      }
    }
  }
  if (primaryReadFailed) {
    throw new Error('Finance records need recovery. Local storage could not be read safely. Close and reopen the app, then restore a backup if this message continues.');
  }
  if (raw != null) {
    throw new Error('Finance records need recovery. The saved value is invalid and no valid recovery copy was found. Keep your backup and contact support before making more changes.');
  }
  return fallback;
};

export const saveJson = async (key, value) => {
  const ownerId = ownerFromStorageKey(key);
  return enqueueLocalOwnerWork(ownerId, async () => {
    let json;
    try { json = JSON.stringify(value); }
    catch { return false; }
    let primarySaved = false;
    try {
      await AsyncStorage.setItem(key, json);
      primarySaved = true;
    } catch (error) {
      console.warn('[Storage] Primary local save failed:', error?.message || error);
    }
    // Always attempt the private mirror, including when AsyncStorage fails, so
    // a later recovery can still retrieve the latest serialized value.
    await writeMirrorValue(key, json);
    if (primarySaved && ownerId) {
      try { const { scheduleExternalBackup } = await import('../services/externalBackup'); scheduleExternalBackup(ownerId); } catch { /* The primary local transaction is already durable. */ }
    }
    // A mirror-only write is not reported as a successful normal save because
    // an older AsyncStorage value may still take precedence on the next launch.
    return primarySaved;
  });
};

// Remove only records/images belonging to a deleted workspace on this device.
// This is a local cleanup; remote workspace deletion is performed by a callable
// function after checking that the current user is the active owner.
export const clearLocalWorkspaceArtifacts = async (uid, workspaceId) => {
  if (!uid || !workspaceId || workspaceId === 'personal') return { complete: true };
  return withLocalOwnerWriteLock(uid, async () => {
  let complete = true;
  const prefix = `expenseTracker.${uid}.${workspaceId}.`;
  const imageKey = `expenseTracker.${uid}.workspaceImage.${workspaceId}`;
  let keys = [];
  try { keys = await AsyncStorage.getAllKeys(); }
  catch (error) { complete = false; console.warn('[Workspace] Could not enumerate local storage keys:', error?.message || error); }
  const ownedKeys = keys.filter((key) => key.startsWith(prefix) || key === imageKey);
  if (ownedKeys.length) {
    try { await AsyncStorage.multiRemove(ownedKeys); }
    catch (error) { complete = false; console.warn('[Workspace] Some local storage keys remain:', error?.message || error); }
  }

  // Also scan the mirror directory itself. This catches stale mirror files left
  // behind when a primary AsyncStorage key had already disappeared.
  const mirrorDirectory = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}ExpenseTracker/` : null;
  if (mirrorDirectory) {
    try {
      const info = await FileSystem.getInfoAsync(mirrorDirectory);
      if (info.exists) {
        const mirrorPrefix = `${encodeURIComponent(prefix).replace(/%/g, '_')}`;
        const imageMirror = `${encodeURIComponent(imageKey).replace(/%/g, '_')}.json`;
        const names = await FileSystem.readDirectoryAsync(mirrorDirectory);
        const targets = names.filter((name) => name.startsWith(mirrorPrefix) || name === imageMirror);
        for (const name of new Set(targets)) {
          try { await FileSystem.deleteAsync(`${mirrorDirectory}${name}`, { idempotent: true }); }
          catch (error) { complete = false; console.warn('[Workspace] Could not remove a local recovery file:', error?.message || error); }
        }
      }
    } catch (error) {
      complete = false;
      console.warn('[Workspace] Could not scan private recovery files:', error?.message || error);
    }
  }

  const imagePath = `${FileSystem.documentDirectory || ''}ExpenseTracker/images/${uid}-${workspaceId}-workspace.jpg`;
  if (FileSystem.documentDirectory) {
    try { await FileSystem.deleteAsync(imagePath, { idempotent: true }); }
    catch (error) { complete = false; console.warn('[Workspace] Could not remove the workspace image:', error?.message || error); }
  }
  return { complete };
  });
};

// Remove every app-private artifact owned by a deleted account. External
// document-provider backup files remain under the user's control; this only
// clears the app's local reference to the selected folder.
export const clearLocalAccountArtifacts = async (uid) => {
  if (!uid) return { complete: true };
  return withLocalOwnerWriteLock(uid, async () => {
  let complete = true;
  let keys = [];
  try { keys = await AsyncStorage.getAllKeys(); }
  catch (error) { complete = false; console.warn('[Storage] Could not enumerate local keys during account deletion:', error?.message || error); }
  const ownedKeys = keys.filter((key) =>
    key.startsWith(`expenseTracker.${uid}.`)
    || key === `expenseTracker.currency.${uid}`
    || key === `expenseTracker.currency.manual.${uid}`
    || key.startsWith(`expenseTracker.externalBackup.${uid}.`),
  );
  const journalKey = pendingTransactionKey(uid);
  if (!ownedKeys.includes(journalKey)) ownedKeys.push(journalKey);
  if (ownedKeys.length) {
    try { await AsyncStorage.multiRemove(ownedKeys); }
    catch (error) { complete = false; console.warn('[Storage] Some local account keys could not be removed:', error?.message || error); }
  }

  const mirrorDirectory = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}ExpenseTracker/` : null;
  if (mirrorDirectory) {
    try {
      const info = await FileSystem.getInfoAsync(mirrorDirectory);
      if (info.exists) {
        const accountPrefix = `expenseTracker.${uid}.`;
        const currencyMirror = `${encodeURIComponent(`expenseTracker.currency.${uid}`).replace(/%/g, '_')}.json`;
        const manualCurrencyMirror = `${encodeURIComponent(`expenseTracker.currency.manual.${uid}`).replace(/%/g, '_')}.json`;
        const names = await FileSystem.readDirectoryAsync(mirrorDirectory);
        const targets = names.filter((name) =>
          name.startsWith(accountPrefix)
          || name === currencyMirror
          || name === manualCurrencyMirror,
        );
        for (const name of new Set(targets)) {
          try { await FileSystem.deleteAsync(`${mirrorDirectory}${name}`, { idempotent: true }); }
          catch (error) { complete = false; console.warn('[Storage] Could not remove a private recovery file:', error?.message || error); }
        }
      }
    } catch (error) {
      complete = false;
      console.warn('[Storage] Could not scan private recovery files:', error?.message || error);
    }
  }

  const imagesDirectory = `${FileSystem.documentDirectory || ''}ExpenseTracker/images/`;
  if (FileSystem.documentDirectory) {
    try {
      const info = await FileSystem.getInfoAsync(imagesDirectory);
      if (info.exists) {
        const names = await FileSystem.readDirectoryAsync(imagesDirectory);
        await Promise.all(names.filter((name) => name.startsWith(`${uid}-`)).map(async (name) => {
          try { await FileSystem.deleteAsync(`${imagesDirectory}${name}`, { idempotent: true }); }
          catch (error) { complete = false; console.warn('[Storage] Could not remove a private image:', error?.message || error); }
        }));
      }
    } catch (error) {
      complete = false;
      console.warn('[Storage] Could not scan private account images:', error?.message || error);
    }
  }
  try {
    const { clearExternalBackupFolder } = await import('../services/externalBackup');
    await clearExternalBackupFolder(uid);
  } catch (error) {
    complete = false;
    console.warn('[Backup] Local backup-folder reference could not be cleared:', error?.message || error);
  }
  return { complete };
  });
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
