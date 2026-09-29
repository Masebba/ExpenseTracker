// screens/HomeScreen.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeDashboard from './HomeDashboard';
import IncomeScreen from './IncomeScreen';
import ExpenseScreen from './ExpenseScreen';
import PoSNavigator from './PoSNavigator';
import MyAccountScreen from './MyAccountScreen';
import ToolsScreen from './ToolsScreen';
import BusinessRecordsScreen from './BusinessRecordsScreen';
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
          headerStyle: { backgroundColor: '#2f7040', elevation: 0, shadowOpacity: 0, height: 112 },
          headerLeft: () => null,
        }}
      />
      <HomeStack.Screen name="PoSNavigator" component={PoSNavigator} options={{ headerShown: false }} />
      <HomeStack.Screen name="Income" component={IncomeScreen} options={greenHeader('Income')} />
      <HomeStack.Screen name="Expense" component={ExpenseScreen} options={greenHeader('Expense')} />
      <HomeStack.Screen name="MyAccount" component={MyAccountScreen} options={greenHeader('My Account')} />
      <HomeStack.Screen name="Converter" component={ToolsScreen} initialParams={{ mode: 'converter' }} options={greenHeader('Currency converter')} />
      <HomeStack.Screen name="Budget" component={ToolsScreen} initialParams={{ mode: 'budget' }} options={greenHeader('Spending targets')} />
      <HomeStack.Screen name="Customers" component={BusinessRecordsScreen} initialParams={{ mode: 'customers' }} options={greenHeader('Customers')} />
      <HomeStack.Screen name="Suppliers" component={BusinessRecordsScreen} initialParams={{ mode: 'suppliers' }} options={greenHeader('Suppliers')} />
      <HomeStack.Screen name="Invoices" component={BusinessRecordsScreen} initialParams={{ mode: 'invoices' }} options={greenHeader('Invoices')} />
    </HomeStack.Navigator>
  );
}

const greenHeader = (title) => ({ headerTitle:title, headerStyle:{backgroundColor:'#2f7040'}, headerTintColor:'#ffffff', headerTitleStyle:{color:'#ffffff',fontWeight:'700'} });
