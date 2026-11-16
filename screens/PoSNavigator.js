// screens/PoSNavigator.js
import React, { useContext } from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import ProductsScreen from './ProductsScreen';
import SalesScreen from './SalesScreen';
import OrdersScreen from './OrdersScreen';
import ReportsScreen from './ReportsScreen';
import OfflineScreen from './OfflineScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeContext } from '../ThemeContext';

const TopTab = createMaterialTopTabNavigator();

export default function PoSNavigator() {
    const { palette } = useContext(ThemeContext);
    return (
        <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: palette.header }]}>
        <TopTab.Navigator
            screenOptions={{
                tabBarLabelStyle: { fontSize: 12 },
                tabBarStyle: { backgroundColor: palette.surface },
                tabBarIndicatorStyle: { backgroundColor: palette.primary },
                tabBarActiveTintColor: palette.primary,
                tabBarInactiveTintColor: palette.textMuted,
            }}
        >
            <TopTab.Screen name="Sales" component={SalesScreen} />
            <TopTab.Screen name="Orders" component={OrdersScreen} />
            <TopTab.Screen name="Products" component={ProductsScreen} />
            <TopTab.Screen name="Reports" component={ReportsScreen} />
            <TopTab.Screen name="Offline" component={OfflineScreen} />
        </TopTab.Navigator>
        </SafeAreaView>
    );
}

const styles = { safeArea: { flex: 1, backgroundColor: '#267F4D' } };
