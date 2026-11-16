// screens/HomeScreen.js
import React, { useContext } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeDashboard from './HomeDashboard';
import IncomeScreen from './IncomeScreen';
import ExpenseScreen from './ExpenseScreen';
import PoSNavigator from './PoSNavigator';
import MyAccountScreen from './MyAccountScreen';
import ToolsScreen from './ToolsScreen';
import BusinessRecordsScreen from './BusinessRecordsScreen';
import CustomHeader from '../components/CustomHeader';
import { ThemeContext } from '../ThemeContext';

const HomeStack = createStackNavigator();

export default function HomeScreen() {
  const { palette } = useContext(ThemeContext);
  return (
    <HomeStack.Navigator initialRouteName="Dashboard">
      <HomeStack.Screen
        name="Dashboard"
        component={HomeDashboard}
        options={{
          headerTitle: () => <CustomHeader />,
          title: ' ',
          headerTitleAlign: 'left',
          headerTitleContainerStyle: { left: 0, right: 0, alignItems: 'stretch' },
          headerStyle: { backgroundColor: palette.header, elevation: 0, shadowOpacity: 0, height: 112 },
          headerLeft: () => null,
        }}
      />
      <HomeStack.Screen name="PoSNavigator" component={PoSNavigator} options={{ headerShown: false }} />
      <HomeStack.Screen name="Income" component={IncomeScreen} options={greenHeader('Income', palette)} />
      <HomeStack.Screen name="Expense" component={ExpenseScreen} options={greenHeader('Expense', palette)} />
      <HomeStack.Screen name="MyAccount" component={MyAccountScreen} options={greenHeader('My Account', palette)} />
      <HomeStack.Screen name="Converter" component={ToolsScreen} initialParams={{ mode: 'converter' }} options={greenHeader('Currency converter', palette)} />
      <HomeStack.Screen name="Budget" component={ToolsScreen} initialParams={{ mode: 'budget' }} options={greenHeader('Spending targets', palette)} />
      <HomeStack.Screen name="Customers" component={BusinessRecordsScreen} initialParams={{ mode: 'customers' }} options={greenHeader('Customers', palette)} />
      <HomeStack.Screen name="Suppliers" component={BusinessRecordsScreen} initialParams={{ mode: 'suppliers' }} options={greenHeader('Suppliers', palette)} />
      <HomeStack.Screen name="Invoices" component={BusinessRecordsScreen} initialParams={{ mode: 'invoices' }} options={greenHeader('Invoices', palette)} />
    </HomeStack.Navigator>
  );
}

const greenHeader = (title, palette) => ({ headerTitle: title, headerStyle: { backgroundColor: palette.header }, headerTintColor: palette.headerText, headerTitleStyle: { color: palette.headerText, fontWeight: '700' } });
