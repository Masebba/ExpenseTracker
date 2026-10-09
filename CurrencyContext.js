import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { CURRENCY_CODES, currencyForRegion, currencyFromCode, detectDeviceRegion } from './utils/appUtils';
import usePersistedState from './utils/usePersistedState';

export const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  const authState = useContext(AuthContext);
  const region = authState?.countryCode || detectDeviceRegion() || 'UG';
  const detectedCurrency = useMemo(() => currencyForRegion(region), [region]);
  const preferenceKey = authState?.user?.uid
    ? `expenseTracker.currency.${authState.user.uid}`
    : 'expenseTracker.currency.guest';
  const [preferredCode, setPreferredCode] = usePersistedState(preferenceKey, detectedCurrency.code);
  const validPreference = CURRENCY_CODES.includes(preferredCode) ? preferredCode : detectedCurrency.code;
  const currency = useMemo(() => currencyFromCode(validPreference), [validPreference]);
  const setCurrencyCode = useCallback((code) => {
    const normalized = String(code || '').toUpperCase();
    if (!CURRENCY_CODES.includes(normalized)) throw new Error('Choose a supported currency.');
    setPreferredCode(normalized);
  }, [setPreferredCode]);
  const value = useMemo(() => ({
    currency,
    baseCurrencyCode: currency.code,
    detectedCurrency,
    setCurrencyCode,
  }), [currency, detectedCurrency, setCurrencyCode]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};
