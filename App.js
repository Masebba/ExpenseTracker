// App.js
import React, { useContext } from "react";
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import {
  Provider as PaperProvider,
  DefaultTheme as PaperDefaultTheme,
} from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { TransactionsProvider } from "./TransactionsContext";
import { AuthProvider, AuthContext } from "./AuthContext";
import { ProductsProvider } from "./ProductsContext";
import { OrdersProvider } from "./OrdersContext";
import { SalesProvider } from "./SalesContext";
import { CurrencyProvider } from "./CurrencyContext";
import { AppFeaturesProvider } from "./AppFeaturesContext";

import HomeScreen from "./screens/HomeScreen";
import TransactionsScreen from "./screens/TransactionsScreen";
import ReportsScreen from "./screens/ReportsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import WorkspacesScreen from "./screens/WorkspacesScreen";
import DeveloperStudioScreen from "./screens/DeveloperStudioScreen";
import AuthNavigator from "./AuthNavigator";

const BottomTab = createBottomTabNavigator();
const RootStack = createStackNavigator();

// Create your custom theme for Paper
const customPaperTheme = {
  ...PaperDefaultTheme,
  roundness: 14,
  colors: {
    ...PaperDefaultTheme.colors,
    primary: "#2f7040",
    accent: "#d99b41",
    background: "#f4f6f3",
    surface: "#ffffff",
    text: "#26372b",
    disabled: "#9ba59d",
    placeholder: "#78837a",
    icon: "#42664a",
  },
};

// Optionally, combine with Navigation theme for consistency
const combinedTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: customPaperTheme.colors.primary,
    background: customPaperTheme.colors.background,
    card: customPaperTheme.colors.surface,
    text: customPaperTheme.colors.text,
    border: "lightgray",
  },
};

function AppTabs() {
  return (
    <BottomTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, // Using custom headers via stack navigators
        tabBarStyle: { height: 64, marginBottom: 44, marginHorizontal: 16, borderRadius: 22, backgroundColor: '#ffffff', elevation: 8, paddingBottom: 9, paddingTop: 9, borderTopWidth: 0 },
        tabBarLabelStyle: { fontSize: 10, marginTop: -2, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === "Home") {
            iconName = "home";
          } else if (route.name === "Transactions") {
            iconName = "format-list-bulleted";
          } else if (route.name === "Report") {
            iconName = "chart-bar";
          } else if (route.name === "Settings") {
            iconName = "cog";
          }
          return (
            <MaterialCommunityIcons name={iconName} color={color} size={20} />
          );
        },
        tabBarActiveTintColor: "#367f39",
        tabBarInactiveTintColor: "#1f4121",
      })}
    >
      <BottomTab.Screen name="Home" component={HomeScreen} />
      <BottomTab.Screen name="Transactions" component={TransactionsScreen} />
      <BottomTab.Screen name="Report" component={ReportsScreen} />
      <BottomTab.Screen name="Settings" component={SettingsScreen} />
      <BottomTab.Screen name="Workspaces" component={WorkspacesScreen} options={{ tabBarLabel: 'Workspaces', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="domain" color={color} size={size} /> }} />
    </BottomTab.Navigator>
  );
}

function AppNavigator() {
  const { user, isDeveloper } = useContext(AuthContext);
  const linking = { prefixes: [], config: { screens: { Main: '', DeveloperStudio: 'internal/campaigns' } } };
  return (
    <NavigationContainer theme={combinedTheme} linking={user ? linking : undefined}>
      {user ? <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Main" component={AppTabs} />
        {isDeveloper && <RootStack.Screen name="DeveloperStudio" component={DeveloperStudioScreen} options={{ headerShown: true, title: 'Developer Studio' }} />}
      </RootStack.Navigator> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <PaperProvider theme={customPaperTheme}>
      <AuthProvider>
        <AppFeaturesProvider>
          <CurrencyProvider>
            <ProductsProvider>
              <SalesProvider>
                <OrdersProvider>
                  <TransactionsProvider>
                    <AppNavigator />
                  </TransactionsProvider>
                </OrdersProvider>
              </SalesProvider>
            </ProductsProvider>
          </CurrencyProvider>
        </AppFeaturesProvider>
      </AuthProvider>
    </PaperProvider>
  );
}

//#ee9600
// {/* customPaperTheme.colors.primary */}
