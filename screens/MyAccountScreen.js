// screens/MyAccountScreen.js
import React, { useContext, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Title, Text, Button } from 'react-native-paper';
import { TransactionsContext } from '../TransactionsContext';
import { CurrencyContext } from '../CurrencyContext';
import { inPeriod } from '../utils/appUtils';

export default function MyAccountScreen() {
    const { transactions } = useContext(TransactionsContext);
    const [filter, setFilter] = useState('daily');
    const now = new Date();

    const { currency } = useContext(CurrencyContext); // Destructure 'currency'

    const filteredTransactions = filter === 'all' ? transactions : transactions.filter((transaction) => inPeriod(transaction.timestamp, filter));


    const incomeTotal = filteredTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = filteredTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    // Calculate net total (income minus expense)
    const netTotal = incomeTotal - expenseTotal;
    const totalStyle = netTotal >= 0 ? styles.totalPositive : styles.totalNegative;

    return (
        <View style={styles.container}>
            <Title style={styles.title}>Account summary</Title>

            {/* Filter Buttons Container */}
            <View style={styles.filterContainer}>
                {['daily', 'weekly', 'monthly', 'yearly'].map((f) => (
                    <Button
                        key={f}
                        mode={filter === f ? "contained" : "outlined"}
                        onPress={() => setFilter(f)}
                        style={styles.filterButton}
                        compact
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                ))}
                <Button
                    mode="text"
                    onPress={() => setFilter('all')}
                    style={styles.filterButton}
                    compact
                >
                    All time
                </Button>
            </View>

            <View style={styles.summaryCard}>
                <Text style={styles.label}>Income</Text><Text style={[styles.summary, styles.income]}>{currency.symbol} {incomeTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryCard}>
                <Text style={styles.label}>Expenses</Text><Text style={[styles.summary, styles.expense]}>{currency.symbol} {expenseTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryCard}>
                <Text style={styles.label}>Net total</Text><Text style={[styles.summary, totalStyle]}>{currency.symbol} {netTotal.toFixed(2)}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 18, paddingTop: 26, paddingBottom: 112, backgroundColor: '#f4f6f3' },
    title: { fontSize: 24, color: '#24432b', marginBottom: 12 },
    pageTitle: {
        textAlign: 'center',
        backgroundColor: '#fff',
        padding: 10,
        margin: 0,
        paddingTop: 35,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    filterContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 10,
        // Ensure it doesn't wrap:
        flexWrap: 'nowrap',

    },
    filterButton: {
        marginHorizontal: 2,
        paddingHorizontal: 4,
    },
    summary: {
        fontSize: 20,
        marginTop: 5,
        fontWeight: '700',
    },
    summaryCard: { padding: 16, backgroundColor: '#fff', borderRadius: 16, marginVertical: 6, elevation: 1 },
    label: { color: '#738076', fontSize: 12 },
    income: { color: '#267a46' },
    expense: { color: '#bd4936' },
    totalPositive: { color: 'green' },
    totalNegative: { color: 'red' },
});
