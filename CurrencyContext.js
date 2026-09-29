import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { STORAGE_KEYS, loadJson, saveJson } from './utils/appUtils';
import usePersistedState from './utils/usePersistedState';

export const CurrencyContext = createContext();
const DEFAULT_CURRENCY = { symbol: 'USh', code: 'UGX', name: 'Ugandan Shilling' };

export const CurrencyProvider = ({ children }) => {
  // Keep currency storage on the guest key if this provider is ever mounted
  // outside AuthProvider (for example during an auth-tree transition or a
  // stale Fast Refresh render). Destructuring a missing context value crashes
  // before the application can recover.
  const authState = useContext(AuthContext);
  const user = authState?.user ?? null;
  const key = user ? `${STORAGE_KEYS.currency}.${user.uid}` : `${STORAGE_KEYS.currency}.guest`;
  const [currency, setCurrency] = usePersistedState(key, DEFAULT_CURRENCY);
  const changeCurrency = (next) => setCurrency({ symbol: next.symbol, code: next.code, name: next.name || next.code });
  const value = useMemo(() => ({ currency, changeCurrency }), [currency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};
