// screens/HomeScreen.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeDashboard from './HomeDashboard';
import IncomeScreen from './IncomeScreen';
import ExpenseScreen from './ExpenseScreen';
import PoSNavigator from './PoSNavigator';
import MyAccountScreen from './MyAccountScreen';
import ToolsScreen from './ToolsScreen';
import CustomHeader from '../components/CustomHeader'; // Import the custom header

const HomeStack = createStackNavigator();

export default function HomeScreen() {
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
          headerStyle: { backgroundColor: '#2f7040', elevation: 0, shadowOpacity: 0, height: 104, marginHorizontal: 0, marginTop: 0 },
          headerLeft: () => null,
        }}
      />
      <HomeStack.Screen name="PoSNavigator" component={PoSNavigator} options={{ headerTitle: 'Point of Sale' }} />
      <HomeStack.Screen name="Income" component={IncomeScreen} options={{ headerTitle: 'Income' }} />
      <HomeStack.Screen name="Expense" component={ExpenseScreen} options={{ headerTitle: 'Expense' }} />
      <HomeStack.Screen name="MyAccount" component={MyAccountScreen} options={{ headerTitle: 'My Account' }} />
      <HomeStack.Screen name="Converter" component={ToolsScreen} initialParams={{ mode: 'converter' }} options={{ headerTitle: 'Currency converter' }} />
      <HomeStack.Screen name="Budget" component={ToolsScreen} initialParams={{ mode: 'budget' }} options={{ headerTitle: 'Monthly budget' }} />
    </HomeStack.Navigator>
  );
}
