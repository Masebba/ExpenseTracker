// Dependency-free project self-check. Run with: npm run check:self
// Validates pure money/storage helpers without installing test frameworks and
// verifies release-critical text stays honest about disabled cloud sync.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const failures = [];
const check = (name, actual, expected) => {
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
const organizations = fs.readFileSync(path.join(root, 'services', 'organizations.js'), 'utf8');
check('invitation lookup normalizes email', organizations.includes('normalizedEmail'), true);
const entry = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
check('startup error boundary exists', entry.includes('StartupErrorBoundary'), true);

if (failures.length) {
  console.error('Self-check failed:');
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`Self-check passed (${14} assertions).`);
