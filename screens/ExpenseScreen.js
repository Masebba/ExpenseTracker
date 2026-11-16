import { userFacingError } from '../utils/userFacingErrors';
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { TextInput, Button, Title, Text, Modal, Portal, Card, IconButton } from 'react-native-paper';
import { TransactionsContext } from '../TransactionsContext';
import { AuthContext } from '../AuthContext';
import { CurrencyContext } from '../CurrencyContext';
import { currencyFromCode, formatMoney } from '../utils/appUtils';
import CurrencyPicker from '../components/CurrencyPicker';
import CompactSearch from '../components/CompactSearch';
import { ThemeContext } from '../ThemeContext';

export default function ExpenseScreen() {
  const { addTransaction, updateTransaction, deleteTransaction, categories, addCategory, deleteCategory, transactions = [] } = useContext(TransactionsContext);
  const { currency } = useContext(CurrencyContext);
  const { palette, isDark } = useContext(ThemeContext);
  const { activeWorkspace } = useContext(AuthContext);
  const expenseCategories = categories?.expense || ['Food', 'Transport', 'Bills'];
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(expenseCategories[0] || 'Uncategorized');
  const [transactionCurrencyCode, setTransactionCurrencyCode] = useState(currency?.code || 'UGX');
  const [newCategory, setNewCategory] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => { if (!editingExpense) setTransactionCurrencyCode(currency?.code || 'UGX'); }, [currency?.code, editingExpense]);
  useEffect(() => { if (!expenseCategories.includes(selectedCategory)) setSelectedCategory(expenseCategories[0] || 'Uncategorized'); }, [expenseCategories.join('|')]);

  const openAddForm = () => {
    setEditingExpense(null); setAmount(''); setDescription(''); setSelectedCategory(expenseCategories[0] || 'Uncategorized');
    setTransactionCurrencyCode(currency?.code || 'UGX'); setFormVisible(true);
  };
  const openEditForm = (item) => {
    setEditingExpense(item); setAmount(String(item.amount)); setDescription(item.description || ''); setSelectedCategory(item.category || 'Uncategorized');
    setTransactionCurrencyCode(item.currencyCode || item.currency || currency?.code || 'UGX'); setFormVisible(true);
  };
  const closeForm = () => { setFormVisible(false); setEditingExpense(null); };

  const saveExpense = async () => {
    if (!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) { Alert.alert('Check the amount', 'Enter an amount greater than zero.'); return; }
    try {
      if (editingExpense) await updateTransaction(editingExpense.id, { amount, description, category: selectedCategory, currencyCode: transactionCurrencyCode });
      else await addTransaction({ type: 'expense', amount, description, category: selectedCategory, currencyCode: transactionCurrencyCode });
      setAmount(''); setDescription(''); closeForm();
    } catch (error) { Alert.alert('Could not save expense', userFacingError(error, 'Please check the details and try again.')); }
  };

  const removeExpense = (item) => Alert.alert('Delete expense', 'Are you sure you want to delete this expense entry?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(item.id).catch((error) => Alert.alert('Could not delete expense', userFacingError(error, 'Please try again.'))) },
  ]);

  const manageCategory = (category) => Alert.alert('Category options', `Manage "${category}"?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete category', style: 'destructive', onPress: () => Alert.alert('Delete category', `Existing expenses using "${category}" will be moved to Uncategorized.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteCategory('expense', category); if (selectedCategory === category) setSelectedCategory('Uncategorized'); }
        catch (error) { Alert.alert('Could not delete category', userFacingError(error, 'Please try again.')); }
      } },
    ]) },
  ]);

  const handleAddCategory = async () => {
    const value = newCategory.trim(); if (!value) return;
    try { await addCategory('expense', value); setSelectedCategory(value); setNewCategory(''); setCategoryModalVisible(false); }
    catch (error) { Alert.alert('Could not save category', userFacingError(error, 'Please try again.')); }
  };

  const expenseTransactions = useMemo(() => transactions
    .filter((item) => item.type === 'expense' && `${item.description || ''} ${item.category || ''} ${item.amount || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), [transactions, search]);

  const renderExpense = ({ item }) => <Card style={[styles.card, { backgroundColor: palette.surface }]}><Card.Content style={styles.cardContent}>
    <View style={styles.transactionTop}><View style={styles.transactionCopy}>
      <Text style={[styles.amount, { color: palette.expense }]}>−{formatMoney(item.amount, currencyFromCode(item.currencyCode || item.currency, currency))}</Text>
      <Text numberOfLines={2} style={[styles.description, { color: palette.text }]} >{item.description || 'Expense'}</Text>
      <Text style={[styles.meta, { color: palette.textMuted }]}>{item.category || 'Uncategorized'} · {new Date(item.timestamp).toLocaleDateString()}</Text>
    </View><View style={styles.inlineActions}>
      <IconButton icon="pencil-outline" size={19} onPress={() => openEditForm(item)} accessibilityLabel="Edit expense" />
      <IconButton icon="delete-outline" iconColor={palette.danger} size={19} onPress={() => removeExpense(item)} accessibilityLabel="Delete expense" />
    </View></View>
  </Card.Content></Card>;

  const workspaceLabel = activeWorkspace?.id === 'personal' ? 'Personal account' : (activeWorkspace?.name || 'Business workspace');

  return <View style={[styles.container, { backgroundColor: palette.background }]}>
    <View style={styles.headingRow}><View style={{ flex: 1 }}><Title style={[styles.title, { color: palette.text }]}>Expenses</Title><Text style={[styles.scopeText, { color: palette.textMuted }]}>{workspaceLabel}</Text></View><Text style={[styles.countText, { color: palette.textMuted }]}>{expenseTransactions.length} entries</Text></View>
    <View style={styles.toolbar}><Button compact mode="contained" icon="plus" onPress={openAddForm} style={styles.addButton}>Add expense</Button><CompactSearch value={search} onChangeText={setSearch} placeholder="Description, category or amount" accessibilityLabel="Search expenses" /></View>
    <FlatList style={styles.list} contentContainerStyle={expenseTransactions.length ? styles.listContent : styles.emptyContent} data={expenseTransactions} keyExtractor={(item) => item.id} renderItem={renderExpense} keyboardShouldPersistTaps="handled" ListEmptyComponent={<View style={styles.emptyState}><Text style={[styles.emptyTitle, { color: palette.text }]}>{transactions.some((item) => item.type === 'expense') ? 'No matching expenses' : 'No expenses recorded yet'}</Text><Text style={[styles.emptyText, { color: palette.textMuted }]}>{transactions.some((item) => item.type === 'expense') ? 'Try a different search.' : 'Tap Add expense to record money spent.'}</Text><Button mode="outlined" onPress={openAddForm}>Record expense</Button></View>} />
    <Portal>
      <Modal visible={formVisible} onDismiss={closeForm} contentContainerStyle={[styles.formModal, { backgroundColor: palette.surface }]}>
        <View style={styles.modalHeading}><Title style={{ color: palette.text }}>{editingExpense ? 'Edit expense' : 'Add expense'}</Title><IconButton icon="close" onPress={closeForm} accessibilityLabel="Close expense form" /></View>
        <TextInput label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={[styles.input, { backgroundColor: palette.input }]} />
        <CurrencyPicker value={transactionCurrencyCode} onChange={setTransactionCurrencyCode} label="Transaction currency" />
        <TextInput label="Description (optional)" value={description} onChangeText={setDescription} style={[styles.input, { backgroundColor: palette.input }]} />
        <View style={styles.categoryLine}><Text style={[styles.categoryLabel, { color: palette.text }]}>Category: {selectedCategory}</Text><Button compact onPress={() => setCategoryModalVisible(true)}>Change / add</Button></View>
        <Button mode="contained" icon="check" onPress={saveExpense} style={styles.submitButton}>{editingExpense ? 'Save changes' : 'Add expense'}</Button><Button onPress={closeForm}>Cancel</Button>
      </Modal>
      <Modal visible={categoryModalVisible} onDismiss={() => setCategoryModalVisible(false)} contentContainerStyle={[styles.categoryModal, { backgroundColor: palette.surface }]}>
        <Title style={{ color: palette.text }}>Select or add category</Title>
        <FlatList data={expenseCategories} keyExtractor={(item) => item} style={{ maxHeight: 270 }} renderItem={({ item }) => <View style={styles.categoryOption}><Button style={{ flex: 1, alignItems: 'flex-start' }} onPress={() => { setSelectedCategory(item); setCategoryModalVisible(false); }}>{item}</Button><IconButton icon="dots-vertical" size={18} onPress={() => manageCategory(item)} accessibilityLabel={`Manage ${item}`} /></View>} />
        <TextInput label="New category" value={newCategory} onChangeText={setNewCategory} style={[styles.input, { backgroundColor: palette.input }]} /><Button mode="contained" onPress={handleAddCategory} disabled={!newCategory.trim()}>Add category</Button><Button onPress={() => setCategoryModalVisible(false)}>Cancel</Button>
      </Modal>
    </Portal>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2, backgroundColor: '#f4f6f3' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }, title: { fontSize: 22, color: '#24432b' }, scopeText: { color: '#718076', fontSize: 10, marginTop: -2 }, countText: { color: '#66756a', fontSize: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }, addButton: { borderRadius: 18, flexShrink: 1 },
  list: { flex: 1 }, listContent: { paddingBottom: 8 }, emptyContent: { flexGrow: 1, justifyContent: 'center' },
  card: { marginVertical: 3, backgroundColor: '#fff', borderRadius: 12, elevation: 1 }, cardContent: { paddingVertical: 8 }, amount: { fontWeight: '800', fontSize: 14, color: '#b54534' }, description: { color: '#293d2f', marginTop: 2 }, meta: { fontSize: 11, color: '#748078', marginTop: 3 },
  transactionTop: { flexDirection: 'row', alignItems: 'center' }, transactionCopy: { flex: 1 }, inlineActions: { flexDirection: 'row', alignItems: 'center' },
  formModal: { backgroundColor: '#f8faf7', padding: 18, margin: 14, borderRadius: 18 }, categoryModal: { backgroundColor: '#fff', padding: 18, margin: 18, borderRadius: 18 }, modalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  input: { marginBottom: 8, backgroundColor: '#fff' }, categoryLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 5 }, categoryLabel: { color: '#314836', fontWeight: '600', flex: 1 }, submitButton: { marginTop: 8, borderRadius: 20 }, categoryOption: { flexDirection: 'row', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 30, gap: 8 }, emptyTitle: { color: '#24432b', fontSize: 16, fontWeight: '700' }, emptyText: { color: '#728075', textAlign: 'center', lineHeight: 20 },
});
