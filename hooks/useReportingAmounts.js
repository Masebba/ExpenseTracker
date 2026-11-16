import { useEffect, useState } from 'react';
import { getExchangeRate } from '../services/currencyConversion';

const recordAmountInCurrency = async (record, amount, currencyCode, targetCurrencyCode) => {
  const recordedBaseAmount = record.baseAmount === undefined || record.baseAmount === null ? NaN : Number(record.baseAmount);
  const recordedBaseCode = record.baseCurrencyCode;
  if (Number.isFinite(recordedBaseAmount) && recordedBaseCode) {
    if (recordedBaseCode === targetCurrencyCode) return { amount: recordedBaseAmount, isStale: false };
    const exchange = await getExchangeRate(recordedBaseCode, targetCurrencyCode);
    return { amount: recordedBaseAmount * exchange.rate, isStale: exchange.isStale === true };
  }
  const sourceCode = record.currencyCode || record.currency || currencyCode;
  if (!sourceCode || sourceCode === targetCurrencyCode) return { amount: Number(amount || 0), isStale: false };
  const exchange = await getExchangeRate(sourceCode, targetCurrencyCode);
  return { amount: Number(amount || 0) * exchange.rate, isStale: exchange.isStale === true };
};

export default function useReportingAmounts(records, targetCurrencyCode, amountField = 'amount') {
  const [state, setState] = useState({ amounts: {}, staleRateIds: [], loading: false, error: '' });

  useEffect(() => {
    let active = true;
    if (!records.length) {
      setState({ amounts: {}, staleRateIds: [], loading: false, error: '' });
      return undefined;
    }
    setState((current) => ({ ...current, loading: true, error: '' }));
    Promise.all(records.map(async (record) => {
      const amount = record[amountField];
      const converted = await recordAmountInCurrency(record, amount, record.currencyCode || record.currency, targetCurrencyCode);
      return [record.id, converted.amount, converted.isStale];
    })).then((entries) => {
      if (active) setState({
        amounts: Object.fromEntries(entries.map(([id, amount]) => [id, amount])),
        staleRateIds: entries.filter(([, , isStale]) => isStale).map(([id]) => id),
        loading: false,
        error: '',
      });
    }).catch((error) => {
      if (active) setState({ amounts: {}, staleRateIds: [], loading: false, error: error?.message || 'Some values could not be converted.' });
    });
    return () => { active = false; };
  }, [records, targetCurrencyCode, amountField]);

  return state;
}
