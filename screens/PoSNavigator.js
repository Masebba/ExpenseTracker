// screens/PoSNavigator.js
import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import ProductsScreen from './ProductsScreen';
import SalesScreen from './SalesScreen';
import OrdersScreen from './OrdersScreen';
import ReportsScreen from './ReportsScreen';
import OfflineScreen from './OfflineScreen';

const TopTab = createMaterialTopTabNavigator();

export default function PoSNavigator() {
    return (
        <TopTab.Navigator
            screenOptions={{
                tabBarLabelStyle: { fontSize: 12 },
                tabBarStyle: { backgroundColor: '#fff' },
                tabBarIndicatorStyle: { backgroundColor: '#367f39' },
            }}
        >
            <TopTab.Screen name="Products" component={ProductsScreen} />
            <TopTab.Screen name="Sales" component={SalesScreen} />
            <TopTab.Screen name="Orders" component={OrdersScreen} />
            <TopTab.Screen name="Reports" component={ReportsScreen} />
            <TopTab.Screen name="Offline" component={OfflineScreen} />
        </TopTab.Navigator>
    );
}
