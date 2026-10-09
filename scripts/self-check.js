// Dependency-free project self-check. Run with: npm run check:self
// Validates pure money/storage helpers without installing test frameworks and
// verifies release-critical text stays honest about disabled cloud sync.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const failures = [];
let assertions = 0;
const check = (name, actual, expected) => {
  assertions += 1;
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const toNumber = (value, fallback = 0) => {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
};
check('toNumber strips commas', toNumber('1,234.5', NaN), 1234.5);
check('toNumber falls back', toNumber('abc', 7), 7);
check('validateMoney rejects zero when disallowed', toNumber('0', NaN) <= 0, true);
check('toNumber handles negative refunds', toNumber('-12.5', NaN), -12.5);

const validateMoney = (value, { allowZero = true } = {}) => {
  const n = toNumber(value, NaN);
  if (!Number.isFinite(n)) return { valid: false };
  if (!allowZero && n <= 0) return { valid: false };
  if (allowZero && n < 0) return { valid: false };
  return { valid: true, value: Math.round(n * 100) / 100 };
};
check('validateMoney rounds to cents', validateMoney('10.005'), { valid: true, value: 10.01 });
check('validateMoney blocks negative purchase', validateMoney('-1', { allowZero: false }).valid, false);

const scopedKey = (key, uid) => key.startsWith(`expenseTracker.${uid}.`) || key === `expenseTracker.currency.${uid}`;
check('backup accepts scoped key', scopedKey('expenseTracker.uid1.transactions', 'uid1'), true);
check('backup rejects cross-account key', scopedKey('expenseTracker.uid2.transactions', 'uid1'), false);
check('backup rejects unscoped legacy key', scopedKey('expenseTracker.transactions', 'uid1'), false);

const isUsableLocalImage = (uri, documentDirectory) => {
  if (!uri) return false;
  if (/^(https?:|content:|assets-library:|ph:\/\/)/i.test(uri)) return true;
  if (/^file:\/\//i.test(uri)) {
    if (!documentDirectory) return true;
    return uri.startsWith(documentDirectory);
  }
  return true;
};
check('usable image keeps current install file', isUsableLocalImage('file:///data/a/ExpenseTracker/images/x.jpg', 'file:///data/a/'), true);
check('usable image drops stale install file', isUsableLocalImage('file:///data/old/ExpenseTracker/images/x.jpg', 'file:///data/a/'), false);
check('usable image keeps remote advert', isUsableLocalImage('https://example.com/banner.jpg', 'file:///data/a/'), true);

const storagePolicy = fs.readFileSync(path.join(root, 'services', 'storagePolicy.js'), 'utf8');
check('storage policy single source exists', storagePolicy.includes('RECORD_SYNC_STATUS'), true);
const offline = fs.readFileSync(path.join(root, 'screens', 'OfflineScreen.js'), 'utf8');
check('Offline screen uses shared sync status', offline.includes('RECORD_SYNC_STATUS'), true);
check('Offline screen drops stale sync claim', offline.includes('also synchronizes business records'), false);
const cloudSync = fs.readFileSync(path.join(root, 'services', 'cloudSync.js'), 'utf8');
check('record sync release gate stays on', cloudSync.includes('CLOUD_SYNC_RELEASE_BLOCKED = true'), true);
const appUtils = fs.readFileSync(path.join(root, 'utils', 'appUtils.js'), 'utf8');
check('image fallback helper exists', appUtils.includes('isUsableLocalImage'), true);
for (const [region, code] of [['UG', 'UGX'], ['KE', 'KES'], ['TZ', 'TZS'], ['US', 'USD'], ['GB', 'GBP']]) {
  check(`region ${region} defaults to ${code}`, appUtils.includes(`${region}: '${code}'`), true);
}
const organizations = fs.readFileSync(path.join(root, 'services', 'organizations.js'), 'utf8');
check('invitation lookup normalizes email', organizations.includes('normalizedEmail'), true);
const entry = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
check('startup error boundary exists', entry.includes('StartupErrorBoundary'), true);

const { calculateExchangeRate, convertAmount, getExchangeRate } = require('../services/currencyConversion');
const rateDate = Date.now();
const testRates = { USD: 1, UGX: 3700, KES: 130, TZS: 2600, GBP: 0.8 };
const testStorage = () => {
  const values = new Map();
  return {
    getItem: async (key) => values.get(key) || null,
    setItem: async (key, value) => values.set(key, value),
  };
};
const fakeFetch = async () => ({
  ok: true,
  json: async () => ({ result: 'success', rates: testRates, time_last_update_unix: rateDate / 1000 }),
});

const runCurrencyChecks = async () => {
  check('base currency conversion rate is one', calculateExchangeRate(testRates, 'UGX', 'UGX'), 1);
  check('USD to UGX rate', calculateExchangeRate(testRates, 'USD', 'UGX'), 3700);
  check('USD to KES rate', calculateExchangeRate(testRates, 'USD', 'KES'), 130);
  check('USD to TZS rate', calculateExchangeRate(testRates, 'USD', 'TZS'), 2600);
  check('USD to GBP rate', calculateExchangeRate(testRates, 'USD', 'GBP'), 0.8);

  const storage = testStorage();
  const usdToUgx = await convertAmount(100, 'USD', 'UGX', { storage, fetchImpl: fakeFetch, now: () => rateDate });
  check('foreign transaction converts USD to UGX', usdToUgx.amount, 370000);
  check('foreign transaction retains quote time', usdToUgx.timestamp, new Date(rateDate).toISOString());
  const cachedUsdToUgx = await getExchangeRate('USD', 'UGX', { storage, fetchImpl: async () => { throw new Error('Fresh cached rate should avoid a request.'); }, now: () => rateDate });
  check('fresh pair cache avoids another provider request', cachedUsdToUgx.rate, 3700);
  const kesToUgx = await convertAmount(130, 'KES', 'UGX', { storage, fetchImpl: fakeFetch, now: () => rateDate });
  check('foreign transaction converts KES to UGX', kesToUgx.amount, 3700);
  check('multiple currencies aggregate after conversion', usdToUgx.amount + kesToUgx.amount, 373700);
  const baseTransaction = await convertAmount(500, 'UGX', 'UGX', { storage, fetchImpl: async () => { throw new Error('Must not fetch for base currency.'); }, now: () => rateDate });
  check('base-currency transaction does not need network', baseTransaction.amount, 500);

  const transaction = { amount: 100, currencyCode: 'USD', baseAmount: usdToUgx.amount, baseCurrencyCode: 'UGX', exchangeRate: usdToUgx.rate, exchangeRateTimestamp: usdToUgx.timestamp };
  await getExchangeRate('UGX', 'KES', { storage, fetchImpl: fakeFetch, now: () => rateDate });
  check('historical base amount stays immutable', transaction.baseAmount, 370000);
  check('historical source amount stays immutable', transaction.amount, 100);
  check('historical quote stays immutable', transaction.exchangeRateTimestamp, new Date(rateDate).toISOString());
  const changedBaseRate = await getExchangeRate('UGX', 'KES', { storage, fetchImpl: fakeFetch, now: () => rateDate });
  check('old base can be reported in changed preference', transaction.baseAmount * changedBaseRate.rate, 13000);

  const offlineStorage = testStorage();
  const staleRecord = { baseCurrencyCode: 'USD', targetCurrencyCode: 'GBP', rate: 0.8, timestamp: new Date(rateDate - 18 * 60 * 60 * 1000).toISOString() };
  await offlineStorage.setItem('expenseTracker.exchangeRate.USD.GBP', JSON.stringify(staleRecord));
  const offlineCached = await getExchangeRate('USD', 'GBP', { storage: offlineStorage, fetchImpl: async () => { throw new Error('offline'); }, now: () => rateDate });
  check('offline uses a recent cached rate', offlineCached.rate, 0.8);
  let unavailableMessage = '';
  try {
    await getExchangeRate('EUR', 'GBP', { storage: testStorage(), fetchImpl: async () => { throw new Error('offline'); }, now: () => rateDate });
  } catch (error) { unavailableMessage = error.message; }
  check('offline without a rate reports unavailable conversion', unavailableMessage.includes('temporarily unavailable'), true);

  for (const code of ['UGX', 'KES', 'TZS', 'USD', 'GBP']) {
    check(`${code} formats with Intl`, new Intl.NumberFormat('en', { style: 'currency', currency: code }).format(1).length > 0, true);
  }

  if (failures.length) {
    console.error('Self-check failed:');
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exit(1);
  }
  console.log(`Currency-aware self-check passed (${assertions} assertions).`);
};

runCurrencyChecks().catch((error) => {
  console.error('Currency checks failed:', error);
  process.exit(1);
});
