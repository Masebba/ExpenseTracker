import { useEffect, useState } from 'react';
import { getExchangeRate } from '../services/currencyConversion';

const recordAmountInCurrency = async (record, amount, currencyCode, targetCurrencyCode) => {
  const recordedBaseAmount = record.baseAmount === undefined || record.baseAmount === null ? NaN : Number(record.baseAmount);
  const recordedBaseCode = record.baseCurrencyCode;
  if (Number.isFinite(recordedBaseAmount) && recordedBaseCode) {
    if (recordedBaseCode === targetCurrencyCode) return recordedBaseAmount;
    const exchange = await getExchangeRate(recordedBaseCode, targetCurrencyCode);
    return recordedBaseAmount * exchange.rate;
  }
  const sourceCode = record.currencyCode || record.currency || currencyCode;
  if (!sourceCode || sourceCode === targetCurrencyCode) return Number(amount || 0);
  const exchange = await getExchangeRate(sourceCode, targetCurrencyCode);
  return Number(amount || 0) * exchange.rate;
};

export default function useReportingAmounts(records, targetCurrencyCode, amountField = 'amount') {
  const [state, setState] = useState({ amounts: {}, loading: false, error: '' });

  useEffect(() => {
    let active = true;
    if (!records.length) {
      setState({ amounts: {}, loading: false, error: '' });
      return undefined;
    }
    setState((current) => ({ ...current, loading: true, error: '' }));
    Promise.all(records.map(async (record) => {
      const amount = record[amountField];
      const converted = await recordAmountInCurrency(record, amount, record.currencyCode || record.currency, targetCurrencyCode);
      return [record.id, converted];
    })).then((entries) => {
      if (active) setState({ amounts: Object.fromEntries(entries), loading: false, error: '' });
    }).catch((error) => {
      if (active) setState({ amounts: {}, loading: false, error: error?.message || 'Some values could not be converted.' });
    });
    return () => { active = false; };
  }, [records, targetCurrencyCode, amountField]);

  return state;
}
