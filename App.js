// App.js
import React, { useContext, useMemo } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
  DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  Provider as PaperProvider,
  DefaultTheme as PaperDefaultTheme,
  DarkTheme as PaperDarkTheme,
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
            Budget: 'wallet-percent-outline',
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
    const base = isDark ? NavigationDarkTheme : NavigationDefaultTheme;
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
  const { isDark, palette } = useContext(ThemeContext);
  const paperTheme = useMemo(() => {
    const base = isDark ? PaperDarkTheme : PaperDefaultTheme;
    return {
      ...base,
      dark: isDark,
      roundness: 14,
      colors: {
        ...base.colors,
        primary: palette.primary,
        accent: isDark ? '#e4ba72' : '#d99b41',
        background: palette.background,
        surface: palette.surface,
        text: palette.text,
        onSurface: palette.text,
        disabled: palette.textMuted,
        placeholder: palette.textMuted,
        outline: palette.border,
        outlineVariant: palette.border,
        elevation: { ...base.colors.elevation, level1: palette.surface, level2: palette.surfaceAlt },
      },
    };
  }, [isDark, palette]);
  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={palette.background} />
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

export default function App() {
  return <ThemeProvider><AppContent /></ThemeProvider>;
}
