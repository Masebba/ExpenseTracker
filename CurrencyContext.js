import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './AuthContext';
import { CURRENCY_CODES, currencyForRegion, currencyFromCode, detectDeviceRegion } from './utils/appUtils';
import usePersistedState from './utils/usePersistedState';

export const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  const authState = useContext(AuthContext);
  const region = detectDeviceRegion() || authState?.countryCode || 'UG';
  const detectedCurrency = useMemo(() => currencyForRegion(region), [region]);
  const preferenceKey = authState?.user?.uid
    ? `expenseTracker.currency.${authState.user.uid}`
    : 'expenseTracker.currency.guest';
  const [preferredCode, setPreferredCode] = usePersistedState(preferenceKey, detectedCurrency.code, authState?.storageRevision || 0);
  const manualPreferenceKey = `expenseTracker.currency.manual.${authState?.user?.uid || 'guest'}`;
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(manualPreferenceKey).then((manual) => {
      if (active && manual !== 'true') setPreferredCode(detectedCurrency.code);
    }).catch(() => { if (active) setPreferredCode(detectedCurrency.code); });
    return () => { active = false; };
  }, [manualPreferenceKey, detectedCurrency.code, setPreferredCode]);
  const validPreference = CURRENCY_CODES.includes(preferredCode) ? preferredCode : detectedCurrency.code;
  const currency = useMemo(() => currencyFromCode(validPreference), [validPreference]);
  const setCurrencyCode = useCallback(async (code) => {
    const normalized = String(code || '').toUpperCase();
    if (!CURRENCY_CODES.includes(normalized)) throw new Error('Choose a supported currency.');
    try {
      // Persist the manual-choice flag first so the device-region effect cannot
      // overwrite a user's selection while the currency itself is being saved.
      await AsyncStorage.setItem(manualPreferenceKey, 'true');
      const saved = await setPreferredCode(normalized);
      if (!saved) {
        await AsyncStorage.removeItem(manualPreferenceKey).catch(() => {});
        throw new Error('Currency preference could not be saved to this device.');
      }
    } catch (error) {
      throw new Error(error?.message || 'Currency preference could not be saved. Check device storage and try again.');
    }
  }, [manualPreferenceKey, setPreferredCode]);
  const value = useMemo(() => ({
    currency,
    baseCurrencyCode: currency.code,
    detectedCurrency,
    setCurrencyCode,
  }), [currency, detectedCurrency, setCurrencyCode]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};
