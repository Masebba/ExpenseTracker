import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Menu, Text, TextInput, Title } from 'react-native-paper';
import { AuthContext } from '../AuthContext';
import { TransactionsContext } from '../TransactionsContext';
import { CurrencyContext } from '../CurrencyContext';
import { CURRENCY_SYMBOLS, inPeriod, toNumber } from '../utils/appUtils';
import usePersistedState from '../utils/usePersistedState';

const currencies = Object.keys(CURRENCY_SYMBOLS);

export default function ToolsScreen({ route }) {
  const mode = route?.params?.mode || (route?.name === 'Budget' ? 'budget' : 'converter');
  const { user, activeWorkspace } = useContext(AuthContext);
  const { transactions } = useContext(TransactionsContext);
  const { currency } = useContext(CurrencyContext);
  const [amount, setAmount] = useState('1');
  const [from, setFrom] = useState(currency?.code || 'UGX');
  const [to, setTo] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState('');
  const [rateStatus, setRateStatus] = useState('');
  const [menu, setMenu] = useState(null);
  const budgetKey = `expenseTracker.${user?.uid || 'guest'}.${activeWorkspace?.id || 'personal'}.monthlyBudget`;
  const [savedBudget, setSavedBudget, budgetHydrated] = usePersistedState(budgetKey, 0);
  const [budgetInput, setBudgetInput] = useState('');
  const monthlyExpenses = useMemo(() => transactions.filter((item) => item.type === 'expense' && inPeriod(item.timestamp, 'monthly')).reduce((sum, item) => sum + Number(item.amount || 0), 0), [transactions]);
  const rate = toNumber(exchangeRate, 0);
  const converted = toNumber(amount, 0) * rate;

  useEffect(() => { if (budgetHydrated) setBudgetInput(savedBudget ? String(savedBudget) : ''); }, [budgetHydrated, savedBudget]);
  useEffect(() => {
    if (mode !== 'converter') return undefined;
    let active = true;
    setRateStatus('Updating exchange rate…');
    fetch(`https://open.er-api.com/v6/latest/${from}`)
      .then((response) => { if (!response.ok) throw new Error('Rate service unavailable.'); return response.json(); })
      .then((data) => {
        const latest = data?.rates?.[to];
        if (!latest) throw new Error('Rate unavailable for this currency pair.');
        if (active) { setExchangeRate(String(latest)); setRateStatus(`Rate updated ${data.time_last_update_utc ? new Date(data.time_last_update_utc).toLocaleDateString() : 'today'}`); }
      })
      .catch(() => { if (active) setRateStatus('Offline? Enter the exchange rate manually.'); });
    return () => { active = false; };
  }, [from, to, mode]);

  const saveBudget = () => {
    const value = toNumber(budgetInput, NaN);
    if (!Number.isFinite(value) || value < 0) { Alert.alert('Check budget', 'Enter a valid non-negative monthly budget.'); return; }
    setSavedBudget(value);
  };

  const remaining = Math.max(0, Number(savedBudget || 0) - monthlyExpenses);
  const progress = savedBudget > 0 ? Math.min(100, monthlyExpenses / savedBudget * 100) : 0;

  return <ScrollView contentContainerStyle={styles.container}>
    <Title style={styles.title}>{mode === 'budget' ? 'Monthly budget' : 'Currency converter'}</Title>
    {mode === 'converter' && <Card style={styles.card}>
      <Card.Title title="Currency converter" subtitle="Live rate when online; you can also enter a rate manually." />
      <Card.Content>
        <TextInput label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.input} />
        <View style={styles.currencyRow}>
          <Menu visible={menu === 'from'} onDismiss={() => setMenu(null)} anchor={<Button mode="outlined" onPress={() => setMenu('from')}>{from}  ▾</Button>}>
            {currencies.map((code) => <Menu.Item key={code} title={`${CURRENCY_SYMBOLS[code]}  ${code}`} onPress={() => { setFrom(code); setMenu(null); }} />)}
          </Menu>
          <Text style={styles.arrow}>→</Text>
          <Menu visible={menu === 'to'} onDismiss={() => setMenu(null)} anchor={<Button mode="outlined" onPress={() => setMenu('to')}>{to}  ▾</Button>}>
            {currencies.map((code) => <Menu.Item key={code} title={`${CURRENCY_SYMBOLS[code]}  ${code}`} onPress={() => { setTo(code); setMenu(null); }} />)}
          </Menu>
        </View>
        <TextInput label={`1 ${from} = ? ${to}`} value={exchangeRate} onChangeText={setExchangeRate} keyboardType="decimal-pad" style={styles.input} />
        <Text style={styles.rateStatus}>{rateStatus}</Text>
        <View style={styles.result}><Text style={styles.resultLabel}>Converted amount</Text><Text style={styles.resultAmount}>{CURRENCY_SYMBOLS[to]} {converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text></View>
      </Card.Content>
    </Card>}

    {mode === 'budget' && <Card style={styles.card}>
      <Card.Title title="Monthly spending plan" subtitle="Compare this month’s expenses with your target." />
      <Card.Content>
        <TextInput label={`Monthly budget (${currency?.code || 'UGX'})`} value={budgetInput} onChangeText={setBudgetInput} keyboardType="decimal-pad" style={styles.input} />
        <Button mode="contained" onPress={saveBudget} style={styles.button}>Save budget</Button>
        <View style={styles.budgetRow}><Text>This month</Text><Text style={styles.spent}>{currency?.symbol} {monthlyExpenses.toLocaleString()}</Text></View>
        {savedBudget > 0 && <>
          <View style={styles.track}><View style={[styles.fill, { width: `${progress}%`, backgroundColor: progress >= 100 ? '#c34c3a' : '#3d8050' }]} /></View>
          <View style={styles.budgetRow}><Text>Remaining</Text><Text style={styles.remaining}>{currency?.symbol} {remaining.toLocaleString()}</Text></View>
        </>}
      </Card.Content>
    </Card>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingTop: 38, paddingBottom: 120, backgroundColor: '#f4f6f3' },
  title: { color: '#24432b', fontSize: 25, marginBottom: 14 },
  card: { borderRadius: 18, backgroundColor: '#fff', marginBottom: 14, elevation: 1 },
  input: { backgroundColor: '#f7f9f6', marginVertical: 7 }, currencyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginVertical: 7 }, arrow: { fontSize: 20, color: '#59715d' }, rateStatus: { fontSize: 11, color: '#768178', marginVertical: 3 },
  result: { borderRadius: 14, backgroundColor: '#edf4ed', padding: 15, marginTop: 8 }, resultLabel: { color: '#637369', fontSize: 12 }, resultAmount: { color: '#24432b', fontSize: 24, fontWeight: '800', marginTop: 4 },
  button: { marginVertical: 8, borderRadius: 24 }, budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, spent: { color: '#bd4936', fontWeight: '700' }, remaining: { color: '#267a46', fontWeight: '700' }, track: { height: 8, backgroundColor: '#e7ece7', borderRadius: 5, marginTop: 10, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 5 },
});
