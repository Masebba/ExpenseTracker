import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { STORAGE_KEYS, loadJson, saveJson } from './utils/appUtils';
import usePersistedState from './utils/usePersistedState';

export const CurrencyContext = createContext();
const DEFAULT_CURRENCY = { symbol: 'USh', code: 'UGX', name: 'Ugandan Shilling' };

export const CurrencyProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const key = user ? `${STORAGE_KEYS.currency}.${user.uid}` : `${STORAGE_KEYS.currency}.guest`;
  const [currency, setCurrency] = usePersistedState(key, DEFAULT_CURRENCY);
  const changeCurrency = (next) => setCurrency({ symbol: next.symbol, code: next.code, name: next.name || next.code });
  const value = useMemo(() => ({ currency, changeCurrency }), [currency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};
