import React, { useContext, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Text, Title, TextInput } from 'react-native-paper';
import { TransactionsContext } from '../TransactionsContext';
import { CurrencyContext } from '../CurrencyContext';
import { currencyFromCode, inPeriod } from '../utils/appUtils';
import { SafeAreaView } from 'react-native-safe-area-context';

const filters = ['daily', 'weekly', 'monthly', 'all'];

export default function TransactionsScreen() {
  const { transactions, clearTransactions } = useContext(TransactionsContext);
  const { currency } = useContext(CurrencyContext);
  const [filter, setFilter] = useState('daily');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => transactions.filter((item) => (filter === 'all' || inPeriod(item.timestamp, filter)) && `${item.description || ''} ${item.category || ''} ${item.type || ''} ${item.amount || ''}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), [transactions, filter, query]);

  const confirmClear = () => Alert.alert('Clear transactions?', 'This permanently deletes every transaction in the current workspace, including its cloud-synced copy when sync is enabled.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear all', style: 'destructive', onPress: clearTransactions },
  ]);

  const renderItem = ({ item }) => {
    const positive = item.type === 'income';
    return <Card style={styles.card}><Card.Content style={styles.item}>
      <View style={[styles.typeIcon, { backgroundColor: positive ? '#e5f2e9' : '#f9e9e5' }]}>
        <Text style={{ color: positive ? '#277746' : '#b54534', fontSize: 18 }}>{positive ? '↙' : '↗'}</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.description}>{item.description || item.category || (positive ? 'Income' : 'Expense')}</Text>
        <Text style={styles.meta}>{item.category || 'Uncategorized'} · {new Date(item.timestamp).toLocaleString()}</Text>
      </View>
      <Text style={[styles.amount, { color: positive ? '#267a46' : '#bd4936' }]}>{positive ? '+' : '−'}{currencyFromCode(item.currency, currency).symbol} {Number(item.amount).toFixed(2)}</Text>
    </Card.Content></Card>;
  };

  return <SafeAreaView edges={['top']} style={styles.safeArea}><View style={styles.container}>
    <View style={styles.header}><Title style={styles.title}>Transactions</Title><Button compact textColor="#ffffff" onPress={confirmClear} disabled={!transactions.length}>Clear</Button></View>
    <View style={styles.filters}>{filters.map((item) => <Button key={item} compact mode={filter === item ? 'contained' : 'text'} onPress={() => setFilter(item)} style={styles.filterButton}>{item[0].toUpperCase() + item.slice(1)}</Button>)}</View>
    <TextInput dense mode="outlined" placeholder="Search description, category or amount" value={query} onChangeText={setQuery} style={styles.search} accessibilityLabel="Search transactions" />
    <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={filtered.length ? styles.list : styles.emptyContainer} ListEmptyComponent={<Text style={styles.empty}>No transactions in this period.</Text>} />
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:'#2f7040'}, container: { flex: 1, paddingHorizontal: 18, paddingTop: 0, paddingBottom: 20, backgroundColor: '#f4f6f3' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal:-18, paddingHorizontal:18, paddingTop:10, paddingBottom:10, marginBottom:12, backgroundColor:'#2f7040' },
  title: { fontSize: 22, color: '#ffffff' }, filters: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#e9eee8', borderRadius: 16, padding: 4, marginBottom: 12 }, filterButton: { flex: 1, marginHorizontal: 1 },
  search: { marginBottom: 8, backgroundColor: '#fff' }, list: { paddingBottom: 16 }, card: { marginVertical: 5, borderRadius: 15, backgroundColor: '#fff', elevation: 1 }, item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12 },
  typeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, details: { flex: 1 }, description: { color: '#2c4031', fontWeight: '700', fontSize: 13 }, meta: { color: '#79847b', fontSize: 10, marginTop: 4 }, amount: { fontWeight: '700', fontSize: 12, marginLeft: 5 }, emptyContainer: { flexGrow: 1, justifyContent: 'center' }, empty: { color: '#78837a', textAlign: 'center', padding: 30 },
});
