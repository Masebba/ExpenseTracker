import React, { createContext, useContext, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { currencyForRegion, detectDeviceRegion } from './utils/appUtils';

export const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  const authState = useContext(AuthContext);
  const region = authState?.countryCode || detectDeviceRegion() || 'UG';
  const currency = useMemo(() => currencyForRegion(region), [region]);
  const value = useMemo(() => ({ currency }), [currency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};
