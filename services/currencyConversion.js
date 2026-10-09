const RATE_API_URL = 'https://open.er-api.com/v6/latest/USD';
const FRESH_RATE_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
const pendingRates = new Map();

const cacheKey = (baseCurrencyCode, targetCurrencyCode) =>
  `expenseTracker.exchangeRate.${baseCurrencyCode}.${targetCurrencyCode}`;

const validRate = (record, baseCurrencyCode, targetCurrencyCode) =>
  record?.baseCurrencyCode === baseCurrencyCode
  && record?.targetCurrencyCode === targetCurrencyCode
  && Number.isFinite(record.rate)
  && record.rate > 0
  && Number.isFinite(Date.parse(record.timestamp));

const readCachedRate = async (baseCurrencyCode, targetCurrencyCode, storage) => {
  try {
    const raw = await storage.getItem(cacheKey(baseCurrencyCode, targetCurrencyCode));
    const record = raw ? JSON.parse(raw) : null;
    return validRate(record, baseCurrencyCode, targetCurrencyCode) ? record : null;
  } catch (error) {
    console.warn('Exchange-rate cache read failed:', error?.message || error);
    return null;
  }
};

const writeCachedRate = async (record, storage) => {
  try {
    await storage.setItem(cacheKey(record.baseCurrencyCode, record.targetCurrencyCode), JSON.stringify(record));
  } catch (error) {
    console.warn('Exchange-rate cache write failed:', error?.message || error);
  }
};

const calculateExchangeRate = (rates, baseCurrencyCode, targetCurrencyCode) => {
  if (baseCurrencyCode === targetCurrencyCode) return 1;
  const basePerUsd = Number(rates?.[baseCurrencyCode]);
  const targetPerUsd = Number(rates?.[targetCurrencyCode]);
  if (!Number.isFinite(basePerUsd) || basePerUsd <= 0 || !Number.isFinite(targetPerUsd) || targetPerUsd <= 0) {
    throw new Error(`An exchange rate for ${baseCurrencyCode} to ${targetCurrencyCode} is not available.`);
  }
  return targetPerUsd / basePerUsd;
};

const fetchUsdRates = async (fetchImpl) => {
  const response = await fetchImpl(RATE_API_URL);
  if (!response.ok) throw new Error(`Exchange-rate service returned ${response.status}.`);
  const data = await response.json();
  if (data?.result !== 'success' || !data.rates || !Number.isFinite(Number(data.time_last_update_unix))) {
    throw new Error('Exchange-rate service returned an invalid response.');
  }
  return {
    rates: data.rates,
    timestamp: new Date(Number(data.time_last_update_unix) * 1000).toISOString(),
  };
};

const getExchangeRate = async (baseCurrencyCode, targetCurrencyCode, options = {}) => {
  const base = String(baseCurrencyCode || '').toUpperCase();
  const target = String(targetCurrencyCode || '').toUpperCase();
  if (!base || !target) throw new Error('Both currencies are required for conversion.');
  if (base === target) return { baseCurrencyCode: base, targetCurrencyCode: target, rate: 1, timestamp: new Date(options.now ? options.now() : Date.now()).toISOString() };

  const storage = options.storage || require('@react-native-async-storage/async-storage').default;
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  const key = `${base}:${target}`;
  if (pendingRates.has(key)) return pendingRates.get(key);
  const request = (async () => {
    const cached = await readCachedRate(base, target, storage);
    const cachedAge = cached ? now() - Date.parse(cached.cachedAt || cached.timestamp) : Infinity;
    const cachedQuoteAge = cached ? now() - Date.parse(cached.timestamp) : Infinity;
    const quoteWithinLimit = cachedQuoteAge >= 0 && cachedQuoteAge <= MAX_RATE_AGE_MS;
    if (cached && cachedAge >= 0 && cachedAge <= FRESH_RATE_AGE_MS && quoteWithinLimit) return cached;

    try {
      const quote = await fetchUsdRates(fetchImpl);
      const record = {
        baseCurrencyCode: base,
        targetCurrencyCode: target,
        rate: calculateExchangeRate(quote.rates, base, target),
        timestamp: quote.timestamp,
        cachedAt: new Date(now()).toISOString(),
      };
      const quoteAge = now() - Date.parse(record.timestamp);
      if (!Number.isFinite(quoteAge) || quoteAge < 0 || quoteAge > MAX_RATE_AGE_MS) {
        throw new Error('Exchange-rate service returned an outdated quote.');
      }
      await writeCachedRate(record, storage);
      return record;
    } catch (error) {
      if (cached && cachedAge >= 0 && cachedAge <= MAX_RATE_AGE_MS && quoteWithinLimit) return cached;
      throw new Error(`Currency conversion is temporarily unavailable for ${base} to ${target}. Connect to the internet and try again. ${error?.message || ''}`.trim());
    }
  })();
  pendingRates.set(key, request);
  try {
    return await request;
  } finally {
    pendingRates.delete(key);
  }
};

const convertAmount = async (amount, baseCurrencyCode, targetCurrencyCode, options) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) throw new Error('A valid amount is required for conversion.');
  const exchange = await getExchangeRate(baseCurrencyCode, targetCurrencyCode, options);
  return { amount: value * exchange.rate, ...exchange };
};

module.exports = { calculateExchangeRate, getExchangeRate, convertAmount };
