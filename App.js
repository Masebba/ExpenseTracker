// App.js
import React, { useCallback, useContext, useMemo } from 'react';
import { Alert, StatusBar, StyleSheet, View } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  Provider as PaperProvider,
  DefaultTheme as PaperDefaultTheme,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { TransactionsProvider } from './TransactionsContext';
import { AuthProvider, AuthContext } from './AuthContext';
import { ProductsProvider } from './ProductsContext';
import { OrdersProvider } from './OrdersContext';
import { SalesProvider } from './SalesContext';
import { CurrencyProvider } from './CurrencyContext';
import { AppFeaturesProvider } from './AppFeaturesContext';
import { BusinessRecordsProvider } from './BusinessRecordsContext';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from './screens/HomeScreen';
import TransactionsScreen from './screens/TransactionsScreen';
import ReportsScreen from './screens/ReportsScreen';
import SettingsScreen from './screens/SettingsScreen';
import WorkspacesScreen from './screens/WorkspacesScreen';
import DeveloperStudioScreen from './screens/DeveloperStudioScreen';
import HelpCentreScreen from './screens/HelpCentreScreen';
import ToolsScreen from './screens/ToolsScreen';
import AuthNavigator from './AuthNavigator';
import { ThemeContext, ThemeProvider } from './ThemeContext';

const BottomTab = createBottomTabNavigator();
const RootStack = createStackNavigator();

function AppTabs() {
  const { guestMode } = useContext(AuthContext);
  const { isDark, palette } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  return (
    <BottomTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 6,
          backgroundColor: palette.tabBar,
          elevation: 8,
          borderTopWidth: isDark ? StyleSheet.hairlineWidth : 0,
          borderTopColor: palette.border,
        },
        tabBarLabelStyle: { fontSize: 10, marginTop: -2, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: 'home-variant-outline',
            Transactions: 'format-list-bulleted',
            Report: 'chart-box-outline',
            Budget: 'chart-donut',
            Workspaces: 'domain',
          };
          return <MaterialCommunityIcons name={icons[route.name] || 'circle-outline'} color={color} size={size || 20} />;
        },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted,
      })}
    >
      <BottomTab.Screen name="Home" component={HomeScreen} />
      <BottomTab.Screen name="Transactions" component={TransactionsScreen} />
      <BottomTab.Screen name="Report" component={ReportsScreen} />
      <BottomTab.Screen name="Budget" component={ToolsScreen} options={{ tabBarLabel: 'Budget' }} />
      {!guestMode && <BottomTab.Screen name="Workspaces" component={WorkspacesScreen} options={{ tabBarLabel: 'Workspaces' }} />}
    </BottomTab.Navigator>
  );
}

function AppNavigator() {
  const { user, guestMode, isDeveloper } = useContext(AuthContext);
  const { isDark, palette } = useContext(ThemeContext);
  const linking = {
    prefixes: [],
    config: { screens: { Main: '', DeveloperStudio: 'internal/campaigns' } },
  };
  const navigationTheme = useMemo(() => {
    // Keep one stable theme shape and vary only its semantic colors. This avoids
    // swapping theme object schemas during a live navigation render.
    const base = NavigationDefaultTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: palette.primary,
        background: palette.background,
        card: palette.surface,
        text: palette.text,
        border: palette.border,
        notification: palette.danger,
      },
    };
  }, [isDark, palette]);
  return (
    <NavigationContainer theme={navigationTheme} linking={user ? linking : undefined}>
      {user || guestMode ? (
        <RootStack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: palette.background } }}>
          <RootStack.Screen name="Main" component={AppTabs} />
          <RootStack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
          <RootStack.Screen name="HelpCentre" component={HelpCentreScreen} options={{ headerShown: false }} />
          {isDeveloper && <RootStack.Screen name="DeveloperStudio" component={DeveloperStudioScreen} options={{ headerShown: true, title: 'Developer Studio', headerStyle: { backgroundColor: palette.header }, headerTintColor: palette.headerText, headerTitleStyle: { color: palette.headerText, fontWeight: '700' } }} />}
        </RootStack.Navigator>
      ) : <AuthNavigator />}
    </NavigationContainer>
  );
}

function WorkspaceDataProviders({ children }) {
  const { user, guestMode, storageRevision } = useContext(AuthContext);
  const storageScope = user?.uid || (guestMode ? 'guest' : 'signed-out');
  return (
    <CurrencyProvider key={`${storageScope}:${storageRevision}`}>
      <ProductsProvider>
        <TransactionsProvider>
          <SalesProvider>
            <OrdersProvider>
              <BusinessRecordsProvider>{children}</BusinessRecordsProvider>
            </OrdersProvider>
          </SalesProvider>
        </TransactionsProvider>
      </ProductsProvider>
    </CurrencyProvider>
  );
}

function AppContent() {
  const { isDark, palette, ready } = useContext(ThemeContext);
  const paperTheme = useMemo(() => {
    // Build both appearances from the same React Native Paper base theme.
    // A stable color-role schema prevents components from receiving missing
    // MD3 roles during a live theme switch.
    const base = PaperDefaultTheme;
    return {
      ...base,
      dark: isDark,
      roundness: 14,
      colors: {
        ...base.colors,
        primary: palette.primary,
        onPrimary: isDark ? '#15231A' : '#FFFFFF',
        primaryContainer: isDark ? '#294533' : '#DDECE1',
        onPrimaryContainer: isDark ? '#E2F1E6' : '#1F4A31',
        secondary: isDark ? '#B5CDBB' : '#587B65',
        onSecondary: isDark ? '#1B2A20' : '#FFFFFF',
        secondaryContainer: isDark ? '#304137' : '#E5F0E8',
        onSecondaryContainer: isDark ? '#DCEAE0' : '#1B3A28',
        tertiary: isDark ? '#D7B77A' : '#846331',
        onTertiary: isDark ? '#33270E' : '#FFFFFF',
        tertiaryContainer: isDark ? '#5A4927' : '#F3E6C5',
        onTertiaryContainer: isDark ? '#F3E5BC' : '#3B2E12',
        inversePrimary: isDark ? '#357B51' : '#B6E3C4',
        accent: isDark ? '#D5B67A' : '#B77C32',
        error: palette.danger,
        onError: '#FFFFFF',
        errorContainer: isDark ? '#5A2B28' : '#F8DEDA',
        onErrorContainer: isDark ? '#FFDAD4' : '#410E0B',
        background: palette.background,
        onBackground: palette.text,
        surface: palette.surface,
        onSurface: palette.text,
        surfaceVariant: palette.surfaceAlt,
        onSurfaceVariant: palette.textMuted,
        text: palette.text,
        disabled: palette.textMuted,
        surfaceDisabled: isDark ? '#2B382F' : '#E9EFEB',
        onSurfaceDisabled: palette.textMuted,
        placeholder: palette.textMuted,
        outline: palette.border,
        outlineVariant: palette.border,
        shadow: palette.shadow,
        scrim: isDark ? '#000000' : '#14231A',
        backdrop: isDark ? 'rgba(0,0,0,0.68)' : 'rgba(17,34,23,0.32)',
        inverseSurface: isDark ? '#E8F0EA' : '#26372D',
        inverseOnSurface: isDark ? '#26372D' : '#F4F7F4',
        elevation: {
          ...(base.colors?.elevation || {}),
          level0: palette.surface,
          level1: palette.surface,
          level2: palette.surfaceAlt,
          level3: palette.surfaceAlt,
          level4: palette.surfaceAlt,
          level5: palette.surfaceAlt,
        },
      },
    };
  }, [isDark, palette]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.background }} />;

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={palette.header} />
      <SafeAreaProvider>
        <AuthProvider>
          <AppFeaturesProvider>
            <WorkspaceDataProviders><AppNavigator /></WorkspaceDataProviders>
          </AppFeaturesProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </PaperProvider>
  );
}

class ThemeRenderBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { this.props.onError?.(error); }
  render() {
    if (this.state.failed) return this.props.fallback || null;
    return this.props.children;
  }
}

function ThemeSafetyGuard({ children }) {
  const { isDark, setDarkMode, palette } = useContext(ThemeContext);
  const handleThemeRenderError = useCallback((error) => {
    console.error('[Theme] Appearance render failed:', error?.message || error);
    if (isDark) {
      // Never strand the user on the generic startup screen. If a device- or
      // component-specific dark rendering failure occurs, persist light mode
      // and remount the app with its safe appearance. The original error is
      // still logged for diagnosis.
      Promise.resolve(setDarkMode(false)).catch((saveError) => {
        console.warn('[Theme] Could not persist safe light appearance:', saveError?.message || saveError);
      });
      const detail = String(error?.message || 'Unspecified rendering error').slice(0, 180);
      try {
        Alert.alert('Dark mode was turned off', `FinanceTracker encountered a display problem and safely returned to light mode. Details: ${detail}`);
      } catch (alertError) {
        console.warn('[Theme] Could not show the recovery alert:', alertError?.message || alertError);
      }
    }
  }, [isDark, setDarkMode]);
  return (
    <ThemeRenderBoundary
      key={isDark ? 'dark-appearance' : 'light-appearance'}
      onError={handleThemeRenderError}
      fallback={<View style={{ flex: 1, backgroundColor: palette.background }} />}
    >
      {children}
    </ThemeRenderBoundary>
  );
}

export default function App() {
  return <ThemeProvider><ThemeSafetyGuard><AppContent /></ThemeSafetyGuard></ThemeProvider>;
}
