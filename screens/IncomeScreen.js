// screens/IncomeScreen.js
import React, { useState, useContext } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { TextInput, Button, Title, Text, Modal, Portal, Card } from 'react-native-paper';
import { TransactionsContext } from '../TransactionsContext';
import { CurrencyContext } from '../CurrencyContext';
import { currencyFromCode } from '../utils/appUtils';

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
    // log the currency for debugging:
    console.log("Currency value:", currency);

    // State for adding new income
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories.income[0]);
    const [newCategory, setNewCategory] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    // State for editing an existing income transaction
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editIncome, setEditIncome] = useState(null); // store the transaction being edited

    // Handler to add new income
    const handleAddIncome = () => {
        if (!amount) {
            alert('Enter an amount');
            return;
        }
        addTransaction({ type: 'income', amount, description, category: selectedCategory });
        setAmount('');
        setDescription('');
    };

    // Handler to update an existing income transaction
    const handleUpdateIncome = () => {
        if (!editIncome) return;
        if (!editIncome.amount) {
            alert('Enter an amount');
            return;
        }
        updateTransaction(editIncome.id, {
            amount: editIncome.amount,
            description: editIncome.description,
            category: editIncome.category,
        });
        setEditModalVisible(false);
        setEditIncome(null);
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
    const incomeTransactions = transactions.filter((t) => t.type === 'income');

    return (
        <View style={styles.container}>
            <Title style={styles.title}>Add Income</Title>
            <TextInput
                label="Amount"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                style={styles.input}
            />
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
                        keyboardType="numeric"
                        style={styles.input}
                    />
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
            <FlatList
                data={incomeTransactions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text style={styles.amount}>
                                {/* ${item.amount.toFixed(2)} */}
                                {item.type === 'income' ? '+' : '-'}{currencyFromCode(item.currency, currency).symbol} {item.amount.toFixed(2)}
                            </Text>
                            <Text>{item.description}</Text>
                            <Text>Category: {item.category}</Text>
                            <Text style={styles.timestamp}>
                                {new Date(item.timestamp).toLocaleString()}
                            </Text>
                        </Card.Content>
                        <Card.Actions style={styles.cardActions}>
                            <Button onPress={() => {
                                // Set the current transaction for editing and show the edit modal
                                setEditIncome(item);
                                setEditModalVisible(true);
                            }}>Edit</Button>
                            <Button onPress={() => handleDeleteIncome(item.id)}>Delete</Button>
                        </Card.Actions>
                    </Card>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 18, paddingTop: 26, paddingBottom: 112, backgroundColor: '#f4f6f3' },
    title: { marginBottom: 10, fontSize: 24, color: '#24432b' },
    input: { marginBottom: 10, backgroundColor: '#fff', borderRadius: 14 },
    label: { marginBottom: 5 },
    button: { marginVertical: 5, borderRadius: 24 },
    modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 20 },
    card: { marginVertical: 6, backgroundColor: '#fff', borderRadius: 16, elevation: 1 },
    amount: { fontWeight: 'bold' },
    timestamp: { fontSize: 12, color: 'gray' },
    cardActions: { justifyContent: 'space-between' },
    categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    editCategoryHint: { fontSize: 12, color: 'gray', marginLeft: 5 },
});
