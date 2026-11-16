// screens/MyAccountScreen.js
import React, { useContext, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Title, Text, Button } from 'react-native-paper';
import { TransactionsContext } from '../TransactionsContext';
import { CurrencyContext } from '../CurrencyContext';
import { formatMoney, inPeriod } from '../utils/appUtils';
import useReportingAmounts from '../hooks/useReportingAmounts';
import { ThemeContext } from '../ThemeContext';

export default function MyAccountScreen() {
    const { palette } = useContext(ThemeContext);
    const { transactions } = useContext(TransactionsContext);
    const [filter, setFilter] = useState('daily');
    const now = new Date();

    const { currency } = useContext(CurrencyContext); // Destructure 'currency'

    const filteredTransactions = useMemo(() => filter === 'all' ? transactions : transactions.filter((transaction) => inPeriod(transaction.timestamp, filter)), [transactions, filter]);
    const { amounts: reportingAmounts, loading: reportingLoading, error: reportingError } = useReportingAmounts(filteredTransactions, currency?.code, 'amount');

    const incomeTotal = filteredTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + (reportingAmounts[t.id] || 0), 0);
    const expenseTotal = filteredTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (reportingAmounts[t.id] || 0), 0);

    // Calculate net total (income minus expense)
    const netTotal = incomeTotal - expenseTotal;
    const totalStyle = { color: netTotal >= 0 ? palette.income : palette.expense };

    return (
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <Title style={[styles.title, { color: palette.text }]}>Account summary</Title>
            <Text style={[styles.period, { color: palette.textMuted }]}>Your cash flow · {filter === 'all' ? 'All time' : ({daily:'Today',weekly:'This week',monthly:'This month',yearly:'This year'}[filter])} · {currency?.code || 'UGX'}</Text>
            {!!reportingError && <Text style={[styles.period, { color: palette.textMuted }]}>{reportingError}</Text>}

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

            <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderLeftColor: palette.primary }]}>
                <Text style={[styles.label, { color: palette.textMuted }]}>Income</Text><Text style={[styles.summary, styles.income]}>{reportingLoading || reportingError ? '—' : formatMoney(incomeTotal, currency)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderLeftColor: palette.primary }]}>
                <Text style={[styles.label, { color: palette.textMuted }]}>Expenses</Text><Text style={[styles.summary, styles.expense]}>{reportingLoading || reportingError ? '—' : formatMoney(expenseTotal, currency)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderLeftColor: palette.primary }]}>
                <Text style={[styles.label, { color: palette.textMuted }]}>Net total</Text><Text style={[styles.summary, totalStyle]}>{reportingLoading || reportingError ? '—' : formatMoney(netTotal, currency)}</Text>
            </View>
            <View style={[styles.insight, { backgroundColor: palette.surfaceAlt }]}><Text style={[styles.insightTitle, { color: palette.text }]}>Cash flow</Text><Text style={[styles.insightText, { color: palette.textMuted }]}>{netTotal >= 0 ? 'Income is ahead of expenses' : 'Expenses are ahead of income'} by {formatMoney(Math.abs(netTotal), currency)} for this period.</Text></View>
        </ScrollView></KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 100, backgroundColor: '#f4f6f3' },
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
        marginVertical: 6,
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
    summaryCard: { padding: 14, backgroundColor: '#fff', borderRadius: 14, marginVertical: 4, elevation: 1, borderLeftWidth:4,borderLeftColor:'#6c9471' },
    label: { color: '#738076', fontSize: 12 },
    period:{color:'#748078',marginTop:-8,marginBottom:8},insight:{padding:14,backgroundColor:'#eaf1ea',borderRadius:14,marginTop:10},insightTitle:{fontWeight:'700',color:'#315d3b',marginBottom:4},insightText:{color:'#536158'},
    income: { color: '#267a46' },
    expense: { color: '#bd4936' },
    totalPositive: { color: 'green' },
    totalNegative: { color: 'red' },
});
