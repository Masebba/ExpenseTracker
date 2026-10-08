// screens/ExpenseScreen.js
import React, { useState, useContext } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { TextInput, Button, Title, Text, Modal, Portal, Card, IconButton } from 'react-native-paper';
import { TransactionsContext } from '../TransactionsContext';
import { CurrencyContext } from '../CurrencyContext';
import { currencyFromCode, formatMoney } from '../utils/appUtils';

export default function ExpenseScreen() {
    const {
        addTransaction,
        updateTransaction,
        deleteTransaction,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        transactions,
    } = useContext(TransactionsContext);

    const { currency } = useContext(CurrencyContext); // Destructure 'currency'

    // Fields for expense form
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories.expense[0]);
    const [newCategory, setNewCategory] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    // For editing an existing expense
    const [editingExpense, setEditingExpense] = useState(null);
    const [search, setSearch] = useState('');

    const resetForm = () => {
        setAmount('');
        setDescription('');
        setSelectedCategory(categories.expense[0]);
        setEditingExpense(null);
    };

    const handleAddOrUpdateExpense = async () => {
        if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return alert('Enter an amount greater than zero');
        try {
        if (editingExpense) {
            await updateTransaction(editingExpense.id, {
                amount,
                description,
                category: selectedCategory,
            });
        } else {
            await addTransaction({ type: 'expense', amount, description, category: selectedCategory });
        }
        resetForm();
        } catch (error) { Alert.alert('Could not save expense', error.message || 'Try again.'); }
    };

    const handleEditExpense = (expense) => {
        setEditingExpense(expense);
        setAmount(expense.amount.toString());
        setDescription(expense.description);
        setSelectedCategory(expense.category);
    };

    const handleDeleteExpense = (id) => {
        Alert.alert("Delete Expense", "Are you sure you want to delete this expense?", [
            { text: "Cancel", style: 'cancel' },
            { text: "Delete", onPress: () => deleteTransaction(id), style: 'destructive' },
        ]);
    };

    // Filter only expense transactions
    const expenseTransactions = transactions.filter(t => t.type === 'expense' && `${t.description || ''} ${t.category || ''} ${t.amount || ''}`.toLowerCase().includes(search.trim().toLowerCase()));

    // For category editing/deletion, we'll add buttons in the modal list.
    const renderCategoryOption = (cat) => (
        <View key={cat} style={styles.categoryOption}>
            <Button onPress={() => { setSelectedCategory(cat); setModalVisible(false); }}>
                {cat}
            </Button>
            {/* Edit button for category */}

            {/* Delete button for category */}
            <IconButton
                icon="delete"
                size={18}
                onPress={() => {
                    Alert.alert("Delete Category", `Delete category "${cat}"?`, [
                        { text: "Cancel", style: 'cancel' },
                        {
                            text: "Delete", style: 'destructive', onPress: () => {
                                deleteCategory('expense', cat);
                                // If the deleted category is selected, set to default.
                                if (selectedCategory === cat) {
                                    setSelectedCategory(categories.expense[0] || 'Uncategorized');
                                }
                            }
                        },
                    ]);
                }}
            />
        </View>
    );

    return (
        <View style={styles.container}>
            <Title style={styles.title}>{editingExpense ? "Edit Expense" : "Add Expense"}</Title>
            <TextInput
                label="Amount"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                style={styles.input}
            />
            <TextInput
                label="Description"
                value={description}
                onChangeText={setDescription}
                style={styles.input}
            />
            <Text style={styles.label}>Category: {selectedCategory}</Text>
            <Button mode="outlined" onPress={() => setModalVisible(true)} style={styles.button}>
                Change/Add Category
            </Button>
            <Button mode="contained" onPress={handleAddOrUpdateExpense} style={styles.button}>
                {editingExpense ? "Update Expense" : "Add Expense"}
            </Button>
            {editingExpense && (
                <Button mode="text" onPress={resetForm} style={styles.button}>
                    Cancel Editing
                </Button>
            )}

            {/* Category Modal */}
            <Portal>
                <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
                    <Title>Select or Add Category</Title>
                    {categories.expense.map(cat => renderCategoryOption(cat))}
                    <TextInput
                        label="New Category"
                        value={newCategory}
                        onChangeText={setNewCategory}
                        style={styles.input}
                    />
                    <Button mode="contained" onPress={() => {
                        if (newCategory.trim() !== '') {
                            addCategory('expense', newCategory.trim());
                            setSelectedCategory(newCategory.trim());
                            setNewCategory('');
                            setModalVisible(false);
                        }
                    }} style={styles.button}>
                        Add New Category
                    </Button>
                    <Button onPress={() => setModalVisible(false)}>Cancel</Button>
                </Modal>
            </Portal>

            {/* Expense Transactions List */}
            <TextInput dense label="Search expenses" value={search} onChangeText={setSearch} style={styles.input} />
            <FlatList
                data={expenseTransactions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <Card style={styles.card}>
                        <Card.Content style={{paddingVertical:8}}>
                            <View style={{flexDirection:'row',alignItems:'center'}}><View style={{flex:1}}>
                            <Text style={styles.amount}> {/*- ${item.amount.toFixed(2)} */}
                                {item.type === 'expense' ? '-' : '+'}{formatMoney(item.amount, currencyFromCode(item.currency, currency))}
                            </Text>
                            <Text numberOfLines={1}>{item.description || 'Expense'}</Text>
                            <Text style={styles.timestamp}>{item.category} · {new Date(item.timestamp).toLocaleDateString()}</Text></View>
                            <View style={{flexDirection:'row'}}><IconButton icon="pencil-outline" size={19} onPress={() => handleEditExpense(item)} /><IconButton icon="delete-outline" iconColor="#b3261e" size={19} onPress={() => handleDeleteExpense(item.id)} /></View></View>
                        </Card.Content>
                    </Card>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 90, backgroundColor: '#f4f6f3' },
    title: { marginBottom: 10, fontSize: 24, color: '#24432b' },
    input: { marginBottom: 6, backgroundColor: '#fff', borderRadius: 10, height: 50 },
    label: { marginBottom: 5 },
    button: { marginVertical: 5, borderRadius: 24 },
    modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 20 },
    card: { marginVertical: 3, backgroundColor: '#fff', borderRadius: 12, elevation: 1 },
    amount: { fontWeight: 'bold' },
    timestamp: { fontSize: 12, color: 'gray' },
    categoryOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
});
