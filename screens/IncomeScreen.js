// screens/IncomeScreen.js
import React, { useState, useContext, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { TextInput, Button, Title, Text, Modal, Portal, Card, IconButton } from 'react-native-paper';
import { TransactionsContext } from '../TransactionsContext';
import { CurrencyContext } from '../CurrencyContext';
import { currencyFromCode, formatMoney } from '../utils/appUtils';
import CurrencyPicker from '../components/CurrencyPicker';

export default function IncomeScreen() {
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

    // State for adding new income
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories.income[0]);
    const [transactionCurrencyCode, setTransactionCurrencyCode] = useState(currency?.code || 'UGX');
    const [newCategory, setNewCategory] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    // State for editing an existing income transaction
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editIncome, setEditIncome] = useState(null); // store the transaction being edited
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!editIncome) setTransactionCurrencyCode(currency?.code || 'UGX');
    }, [currency?.code, editIncome]);

    // Handler to add new income
    const handleAddIncome = () => {
        if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            alert('Enter an amount greater than zero');
            return;
        }
        addTransaction({ type: 'income', amount, description, category: selectedCategory, currencyCode: transactionCurrencyCode }).then(() => { setAmount(''); setDescription(''); }).catch((error) => Alert.alert('Could not save income', error.message));
    };

    // Handler to update an existing income transaction
    const handleUpdateIncome = () => {
        if (!editIncome) return;
        if (!editIncome.amount || !Number.isFinite(Number(editIncome.amount)) || Number(editIncome.amount) <= 0) {
            alert('Enter an amount greater than zero');
            return;
        }
        updateTransaction(editIncome.id, {
            amount: editIncome.amount,
            description: editIncome.description,
            category: editIncome.category,
            currencyCode: transactionCurrencyCode,
        }).then(() => { setEditModalVisible(false); setEditIncome(null); }).catch((error) => Alert.alert('Could not update income', error.message));
    };

    // Handler to delete a transaction
    const handleDeleteIncome = (id) => {
        Alert.alert("Confirm Delete", "Are you sure you want to delete this income?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", onPress: () => deleteTransaction(id), style: "destructive" },
        ]);
    };

    // Handler for long-press on category button to edit or delete a category
    const handleCategoryLongPress = (cat) => {
        Alert.alert(
            "Category Options",
            `What do you want to do with category "${cat}"?`,
            [
                {
                    text: "Close",
                    onPress: () => {},
                },
                {
                    text: "Delete",
                    onPress: () => {
                        // Confirm deletion
                        Alert.alert("Confirm Delete", "Are you sure you want to delete this category?", [
                            { text: "Cancel", style: "cancel" },
                            {
                                text: "Delete", onPress: () => {
                                    deleteCategory('income', cat);
                                    // Reset selected category if it was deleted
                                    if (selectedCategory === cat) {
                                        setSelectedCategory(categories.income[0] || '');
                                    }
                                }, style: "destructive"
                            }
                        ]);
                    },
                    style: "destructive"
                },
                { text: "Cancel", style: "cancel" },
            ]
        );
    };

    // Filter for income transactions
    const incomeTransactions = transactions.filter((t) => t.type === 'income' && `${t.description || ''} ${t.category || ''} ${t.amount || ''}`.toLowerCase().includes(search.trim().toLowerCase()));

    return (
        <View style={styles.container}>
            <Title style={styles.title}>Add Income</Title>
            <TextInput
                label="Amount"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                style={styles.input}
            />
            <CurrencyPicker value={transactionCurrencyCode} onChange={setTransactionCurrencyCode} label="Transaction currency" />
            <TextInput
                label="Description"
                value={description}
                onChangeText={setDescription}
                style={styles.input}
            />
            <View style={styles.categoryRow}>
                <Text style={styles.label}>Category: {selectedCategory}</Text>
                <TouchableOpacity onLongPress={() => handleCategoryLongPress(selectedCategory)}>
                    <Text style={styles.editCategoryHint}>(Long-press to edit/delete)</Text>
                </TouchableOpacity>
            </View>
            <Button mode="outlined" onPress={() => setModalVisible(true)} style={styles.button}>
                Change/Add Category
            </Button>
            <Button mode="contained" onPress={handleAddIncome} style={styles.button}>
                Add Income
            </Button>

            {/* Category Modal */}
            <Portal>
                <Modal
                    visible={modalVisible}
                    onDismiss={() => setModalVisible(false)}
                    contentContainerStyle={styles.modal}
                >
                    <Title>Select or Add Category</Title>
                    {categories.income.map((cat) => (
                        <Button
                            key={cat}
                            onPress={() => { setSelectedCategory(cat); setModalVisible(false); }}
                            onLongPress={() => handleCategoryLongPress(cat)}
                        >
                            {cat}
                        </Button>
                    ))}
                    <TextInput
                        label="New Category"
                        value={newCategory}
                        onChangeText={setNewCategory}
                        style={styles.input}
                    />
                    <Button
                        mode="contained"
                        onPress={() => {
                            if (newCategory.trim() !== '') {
                                addCategory('income', newCategory.trim());
                                setSelectedCategory(newCategory.trim());
                                setNewCategory('');
                                setModalVisible(false);
                            }
                        }}
                        style={styles.button}
                    >
                        Add New Category
                    </Button>
                    <Button onPress={() => setModalVisible(false)}>Cancel</Button>
                </Modal>
            </Portal>

            {/* Edit Income Modal */}
            <Portal>
                <Modal
                    visible={editModalVisible}
                    onDismiss={() => { setEditModalVisible(false); setEditIncome(null); }}
                    contentContainerStyle={styles.modal}
                >
                    <Title>Edit Income</Title>
                    <TextInput
                        label="Amount"
                        value={editIncome ? editIncome.amount.toString() : ''}
                        onChangeText={(text) =>
                            setEditIncome({ ...editIncome, amount: parseFloat(text) || 0 })
                        }
                        keyboardType="decimal-pad"
                        style={styles.input}
                    />
                    <CurrencyPicker value={transactionCurrencyCode} onChange={setTransactionCurrencyCode} label="Transaction currency" />
                    <TextInput
                        label="Description"
                        value={editIncome ? editIncome.description : ''}
                        onChangeText={(text) =>
                            setEditIncome({ ...editIncome, description: text })
                        }
                        style={styles.input}
                    />
                    <Text style={styles.label}>Category: {editIncome ? editIncome.category : ''}</Text>
                    <Button
                        mode="outlined"
                        onPress={() => {
                            // Allow changing category via similar modal as before:
                            setModalVisible(true);
                        }}
                        style={styles.button}
                    >
                        Change Category
                    </Button>
                    <Button mode="contained" onPress={handleUpdateIncome} style={styles.button}>
                        Save Changes
                    </Button>
                    <Button onPress={() => { setEditModalVisible(false); setEditIncome(null); }}>
                        Cancel
                    </Button>
                </Modal>
            </Portal>

            {/* Income Transaction List */}
            <TextInput dense label="Search income" value={search} onChangeText={setSearch} style={styles.input} />
            <FlatList
                data={incomeTransactions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <Card style={styles.card}>
                        <Card.Content>
                            <View style={styles.transactionTop}><View style={styles.transactionCopy}><Text style={styles.amount}>
                                {/* ${item.amount.toFixed(2)} */}
                                {item.type === 'income' ? '+' : '-'}{formatMoney(item.amount, currencyFromCode(item.currencyCode || item.currency, currency))}
                            </Text>
                            <Text numberOfLines={1}>{item.description || 'Income'}</Text>
                            <Text style={styles.meta}>Category: {item.category} · {new Date(item.timestamp).toLocaleDateString()}</Text></View><View style={styles.inlineActions}>
                            <IconButton icon="pencil-outline" size={19} onPress={() => { setEditIncome(item); setTransactionCurrencyCode(item.currencyCode || item.currency || currency?.code || 'UGX'); setEditModalVisible(true); }} /><IconButton icon="delete-outline" iconColor="#b3261e" size={19} onPress={() => handleDeleteIncome(item.id)} /></View></View>
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
    transactionTop: { flexDirection:'row', alignItems:'center' }, transactionCopy:{flex:1}, inlineActions:{flexDirection:'row', alignItems:'center'}, meta:{fontSize:11,color:'#748078'},
    categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    editCategoryHint: { fontSize: 12, color: 'gray', marginLeft: 5 },
});
