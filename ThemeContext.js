import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'expenseTracker.uiTheme';

export const lightPalette = {
  mode: 'light', dark: false,
  primary: '#2f7040', primaryStrong: '#245b33',
  background: '#f4f6f3', surface: '#ffffff', surfaceAlt: '#edf2ed',
  text: '#26372b', textMuted: '#758078', border: '#d9e2d9',
  input: '#f7f9f6', header: '#2f7040', headerText: '#f4fff5',
  tabBar: '#ffffff', icon: '#315d3b', danger: '#bd4936',
  income: '#267a46', expense: '#bd4936', shadow: '#0b2412',
};

export const darkPalette = {
  mode: 'dark', dark: true,
  primary: '#8fcca0', primaryStrong: '#b0e0ba',
  background: '#101712', surface: '#1b251e', surfaceAlt: '#253128',
  text: '#e8f0e9', textMuted: '#a3b0a6', border: '#344338',
  input: '#202b23', header: '#15271a', headerText: '#eff8f0',
  tabBar: '#172019', icon: '#b6dbbe', danger: '#ff9382',
  income: '#8fcca0', expense: '#ff9382', shadow: '#000000',
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
    const nextMode = enabled ? 'dark' : 'light';
    setMode(nextMode);
    try { await AsyncStorage.setItem(THEME_KEY, nextMode); }
    catch (error) { console.warn('[Theme] Could not save theme preference:', error?.message || error); }
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
