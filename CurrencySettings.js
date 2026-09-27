// CurrencySettings.js
import React, { useContext, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Title, Button, Menu, Text } from 'react-native-paper';
import { CurrencyContext } from './CurrencyContext';

export default function CurrencySettings() {
    const { currency, changeCurrency } = useContext(CurrencyContext);
    const [menuVisible, setMenuVisible] = useState(false);

    // Array of currency options. Add more as needed.
    const currencyOptions = [
        { country: 'United States', code: 'USD', symbol: '$' },
        { country: 'Uganda', code: 'UGX', symbol: 'USh' },
        { country: 'United Kingdom', code: 'GBP', symbol: '£' },
        { country: 'Kenya', code: 'KES', symbol: 'KSh' },
        { country: 'Tanzania', code: 'TZS', symbol: 'TSh' },
        { country: 'Rwanda', code: 'RWF', symbol: 'RWF' },
        { country: 'Burundi', code: 'BIF', symbol: 'FBu' },
        { country: 'Ethiopia', code: 'ETB', symbol: 'Br' },
        { country: 'European Union', code: 'EUR', symbol: '€' },
        { country: 'Japan', code: 'JPY', symbol: '¥' },
        // Add more currency options here.
    ];

    return (
        <View style={styles.container}>
            <Title style={styles.title}>Currency Settings</Title>
            <Text style={styles.currentCurrency}>
                Current Currency: {currency.code} ({currency.symbol})
            </Text>
            <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                    <Button mode="contained" onPress={() => setMenuVisible(true)} style={styles.button}>
                        Change Currency
                    </Button>
                }
            >
                {currencyOptions.map((option) => (
                    <Menu.Item
                        key={option.code}
                        onPress={() => {
                            changeCurrency(option);
                            setMenuVisible(false);
                        }}
                        title={`${option.country} (${option.symbol})`} style={styles.listcountry}
                    />
                ))}
            </Menu>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20, alignItems: 'center' },
    title: { marginBottom: 15 },
    currentCurrency: { fontSize: 16, marginBottom: 10, },
    button: { marginVertical: 10 },
    listcountry: { backgroundColor: '#f1f1f1', }
});
