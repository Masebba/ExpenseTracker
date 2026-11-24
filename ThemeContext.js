import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'expenseTracker.uiTheme';

export const lightPalette = {
  mode: 'light', dark: false,
  // Brighter emerald-green identity with enough depth for white header text.
  primary: '#32A060', primaryStrong: '#279257',
  background: '#F3F9F4', surface: '#FFFFFF', surfaceAlt: '#DDEFE3',
  text: '#20372A', textMuted: '#65796B', border: '#BFD7C6',
  input: '#F7FBF8', header: '#2B965B', headerText: '#FFFFFF',
  tabBar: '#FFFFFF', icon: '#268451', danger: '#B94F46',
  income: '#23834D', expense: '#C05B50', shadow: '#10261A',
};

export const darkPalette = {
  mode: 'dark', dark: true,
  primary: '#9CCBAE', primaryStrong: '#B4DCC1',
  background: '#101914', surface: '#1B2620', surfaceAlt: '#25332B',
  text: '#E8F0EA', textMuted: '#A7B4AA', border: '#39483E',
  input: '#202D25', header: '#1D3A2A', headerText: '#F2F8F3',
  tabBar: '#17221B', icon: '#B1D9BD', danger: '#EF9486',
  income: '#9CCBAE', expense: '#EF9486', shadow: '#000000',
};

export const ThemeContext = createContext({
  isDark: false,
  palette: lightPalette,
  ready: false,
  setDarkMode: async () => {},
  toggleDarkMode: async () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (mounted && (saved === 'dark' || saved === 'light')) setMode(saved);
      })
      .catch((error) => console.warn('[Theme] Could not restore theme preference:', error?.message || error))
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  const setDarkMode = useCallback(async (enabled) => {
    const nextMode = enabled === true || enabled === 'dark' ? 'dark' : 'light';
    setMode(nextMode);
    try {
      await AsyncStorage.setItem(THEME_KEY, nextMode);
      return true;
    } catch (error) {
      console.warn('[Theme] Could not save theme preference:', error?.message || error);
      return false;
    }
  }, []);

  const toggleDarkMode = useCallback(() => setDarkMode(mode !== 'dark'), [mode, setDarkMode]);
  const value = useMemo(() => ({
    isDark: mode === 'dark',
    palette: mode === 'dark' ? darkPalette : lightPalette,
    ready,
    setDarkMode,
    toggleDarkMode,
  }), [mode, ready, setDarkMode, toggleDarkMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
