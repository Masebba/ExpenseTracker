import { userFacingError } from '../utils/userFacingErrors';
// screens/ProductsScreen.js
import React, { useState, useContext, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Card, Button, Text, TextInput, Title, Modal, Portal } from 'react-native-paper';
import BarcodeScannerComponent from '../BarcodeScannerComponent';
import { ProductsContext } from '../ProductsContext'; // Global context for products
import { CurrencyContext } from '../CurrencyContext';
import { formatMoney } from '../utils/appUtils';
import CompactFilterMenu from '../components/CompactFilterMenu';
import CompactSearch from '../components/CompactSearch';
import { ThemeContext } from '../ThemeContext';

export default function ProductsScreen() {
    // If using a global context, get products and updater from it.
    // For a local version, you can continue using local state.
    const { products, setProducts, categories: categoriesList, addCategory, updateCategory, deleteCategory } = useContext(ProductsContext);
    const { palette, isDark } = useContext(ThemeContext);
    const isFocused = useIsFocused();

    const { currency, detectedCurrency } = useContext(CurrencyContext);
    // Local state for adding/editing product
    const [editingProduct, setEditingProduct] = useState(null);
    const [barcode, setBarcode] = useState('');
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [buyingPrice, setBuyingPrice] = useState('');
    const [stock, setStock] = useState('');
    const [category, setCategory] = useState('');

    const [newCategoryInput, setNewCategoryInput] = useState('');
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('__all__');

    // Modal visibility for product add/edit and barcode scanning
    const [productModalVisible, setProductModalVisible] = useState(false);
    const [scannerModalVisible, setScannerModalVisible] = useState(false);

    useEffect(() => {
        if (!isFocused && scannerModalVisible) setScannerModalVisible(false);
    }, [isFocused, scannerModalVisible]);

    const handleScanBarcode = () => {
        setScannerModalVisible(true);
    };

    const onBarcodeScanned = (scannedData) => {
        setBarcode(scannedData);
        setScannerModalVisible(false);
    };

    const resetForm = () => {
        setBarcode('');
        setName('');
        setPrice('');
        setBuyingPrice('');
        setStock('');
        setCategory('');
        setEditingProduct(null);
    };

    const handleAddOrEdit = async () => {
        const numericPrice = Number(price);
        const numericBuyingPrice = Number(buyingPrice);
        const numericStock = Number(stock);
        if (!name.trim() || !Number.isFinite(numericPrice) || numericPrice <= 0 || !Number.isFinite(numericBuyingPrice) || numericBuyingPrice < 0 || !Number.isInteger(numericStock) || numericStock < 0 || !category.trim()) {
            Alert.alert('Invalid product', 'Enter a name, valid prices, a whole-number stock value of 0 or more, and a category.');
            return;
        }
        try {
        if (editingProduct) {
            await setProducts(products.map(prod => prod.id === editingProduct.id ? { ...prod, barcode: barcode.trim(), name: name.trim(), price: numericPrice, buyingPrice: numericBuyingPrice, stock: numericStock, category: category.trim(), currencyCode: prod.currencyCode || detectedCurrency?.code || currency?.code || 'UGX', updatedAt: new Date().toISOString() } : prod));
        } else {
            const duplicateBarcode = barcode.trim() && products.some((prod) => prod.barcode === barcode.trim());
            if (duplicateBarcode) { Alert.alert('Duplicate barcode', 'A product with this barcode already exists.'); return; }
            await setProducts([...products, { id: `prod_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, barcode: barcode.trim(), name: name.trim(), price: numericPrice, buyingPrice: numericBuyingPrice, stock: numericStock, category: category.trim(), currencyCode: currency?.code || 'UGX', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
        }
        resetForm();
        setProductModalVisible(false);
        } catch (error) { Alert.alert('Could not save product', userFacingError(error, 'Please try again.')); }
    };

    const handleDelete = (id) => {
        const product = products.find((p) => p.id === id);
        Alert.alert('Delete product', `Delete ${product?.name || 'this product'}? Historical sales are retained.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => setProducts(products.filter(prod => prod.id !== id)).catch((error) => Alert.alert('Could not delete product', userFacingError(error, 'Please try again.'))) }]);
    };

    const renderProduct = ({ item }) => (
        <Card style={[styles.card, { backgroundColor: palette.surface }]} >
            <Card.Content>
                <View style={styles.productRow}>
                    <View style={styles.productDetails}>
                        <Text style={styles.productName}>{item.name}</Text>
                        <Text>Barcode: {item.barcode || 'Not assigned'}</Text>
                        <Text>Selling Price: {formatMoney(item.price, { code: item.currencyCode || detectedCurrency?.code || currency?.code })}</Text>
                        <Text>Buying Price: {formatMoney(item.buyingPrice, { code: item.currencyCode || detectedCurrency?.code || currency?.code })}</Text>
                        <Text>Stock: {item.stock}</Text>
                        <Text>Category: {item.category}</Text>
                    </View>
                    <View style={styles.productActions}>
                        <Button
                            onPress={() => {
                                // Prepopulate fields for editing
                                setEditingProduct(item);
                                setBarcode(item.barcode);
                                setName(item.name);
                                setPrice(item.price.toString());
                                setBuyingPrice(item.buyingPrice.toString());
                                setStock(item.stock.toString());
                                setCategory(item.category);
                                setProductModalVisible(true);
                            }}
                        >
                            Edit
                        </Button>
                        <Button onPress={() => handleDelete(item.id)}>Delete</Button>
                    </View>
                </View>
            </Card.Content>
        </Card>
    );

    const renderCategoryModal = () => (
        <Portal>
            <Modal
                visible={categoryModalVisible}
                onDismiss={() => setCategoryModalVisible(false)}
                contentContainerStyle={[styles.modal, { zIndex: 999, elevation: 999 }]}
            >
                <Title>Select or Manage Category</Title>
                {categoriesList.map((cat) => (
                    <TouchableOpacity
                        key={cat}
                        onPress={() => { setCategory(cat); setCategoryModalVisible(false); }}
                        onLongPress={() => {
                            Alert.alert(
                                "Manage Category",
                                `Would you like to edit or delete "${cat}"?`,
                                [
                                    {
                                        text: "Keep",
                                        onPress: () => {},
                                    },
                                    {
                                        text: "Delete",
                                        onPress: () => {
                                            Alert.alert(
                                                "Confirm Delete",
                                                `Are you sure you want to delete "${cat}"?`,
                                                [
                                                    { text: "Cancel", style: "cancel" },
                                                    {
                                                        text: "Delete",
                                                        style: "destructive",
                                                        onPress: () => {
                                                            deleteCategory(cat);
                                                            if (category === cat) setCategory('');
                                                        }
                                                    }
                                                ]
                                            );
                                        },
                                        style: "destructive"
                                    },
                                    { text: "Cancel", style: "cancel" }
                                ]
                            );
                        }}
                        style={styles.categoryItem}
                    >
                        <Text style={styles.categoryItemText}>{cat}</Text>
                    </TouchableOpacity>
                ))}
                <TextInput
                    label="New Category"
                    value={newCategoryInput}
                    onChangeText={setNewCategoryInput}
                    style={[styles.input, { backgroundColor: palette.input }]}
                />
                <Button
                    mode="contained"
                    onPress={() => {
                        if (newCategoryInput.trim() !== '') {
                            addCategory(newCategoryInput.trim());
                            setCategory(newCategoryInput.trim());
                            setNewCategoryInput('');
                            setCategoryModalVisible(false);
                        }
                    }}
                    style={styles.button}
                >
                    Add Category
                </Button>
                <Button onPress={() => setCategoryModalVisible(false)}>Cancel</Button>
            </Modal>
        </Portal>
    );

    const renderProductModal = () => {
        if (categoryModalVisible) return null;
        return (
            <Portal>
                <Modal
                    visible={productModalVisible}
                    onDismiss={() => { setProductModalVisible(false); resetForm(); }}
                    contentContainerStyle={[styles.modal, { backgroundColor: palette.surface }]}
                >
                    <Title>{editingProduct ? 'Edit Product' : 'Add Product'}</Title>
                    <View style={styles.row}>
                        <TextInput
                            label="Barcode"
                            value={barcode}
                            onChangeText={setBarcode}
                            style={[styles.input, styles.halfInput]}
                        />
                        <Button
                            mode="outlined"
                            onPress={handleScanBarcode}
                            style={[styles.button, styles.halfButton]}
                        >
                            Scan
                        </Button>
                    </View>
                    <View style={styles.row}>
                        <TextInput
                            label="Name"
                            value={name}
                            onChangeText={setName}
                            style={[styles.input, styles.halfInput]}
                        />
                        <TouchableOpacity
                            style={[styles.input, styles.halfInput, styles.categoryButton]}
                            onPress={() => setCategoryModalVisible(true)}
                        >
                            <Text style={styles.categoryText}>{category || 'Select Category'}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.row}>
                        <TextInput
                            label="Selling Price"
                            value={price}
                            onChangeText={setPrice}
                            keyboardType="numeric"
                            style={[styles.input, styles.halfInput]}
                        />
                        <TextInput
                            label="Stock"
                            value={stock}
                            onChangeText={setStock}
                            keyboardType="numeric"
                            style={[styles.input, styles.halfInput]}
                        />
                    </View>
                    <TextInput
                        label="Buying Price"
                        value={buyingPrice}
                        onChangeText={setBuyingPrice}
                        keyboardType="numeric"
                        style={[styles.input, { backgroundColor: palette.input }]}
                    />
                    <Button mode="contained" onPress={handleAddOrEdit} style={styles.button}>
                        {editingProduct ? 'Update Product' : 'Add Product'}
                    </Button>
                    <Button onPress={() => { setProductModalVisible(false); resetForm(); }}>
                        Cancel
                    </Button>
                </Modal>
            </Portal>
        );
    };

    const renderScannerModal = () => (
        <Portal>
            <Modal
                visible={scannerModalVisible && isFocused}
                onDismiss={() => setScannerModalVisible(false)}
                contentContainerStyle={styles.fullScreenModal}
            >
                <Title style={styles.scannerTitle}>Scan Barcode</Title>
                {scannerModalVisible && isFocused ? <BarcodeScannerComponent onScanned={onBarcodeScanned} /> : null}
                <Button onPress={() => setScannerModalVisible(false)} style={styles.button}>
                    Cancel
                </Button>
            </Modal>
        </Portal>
    );

    return (
        <View style={[styles.container, { backgroundColor: palette.background }]} >
            <View style={styles.headingRow}><Title style={styles.pageTitle}>Products & Inventory</Title><Text style={[styles.countText, { color: palette.textMuted }]} >{products.length} products</Text></View>
            <View style={styles.toolbar}>
                <Button compact icon="plus" mode="contained" onPress={() => { resetForm(); setProductModalVisible(true); }} style={styles.addButton}>Add product</Button>
                <CompactFilterMenu value={categoryFilter} label="Category" onChange={setCategoryFilter} options={[{ value: '__all__', label: 'All categories' }, ...categoriesList.map((cat) => ({ value: cat, label: cat }))]} />
                <CompactSearch value={search} onChangeText={setSearch} placeholder="Product, barcode or category" accessibilityLabel="Search products" />
            </View>
            {renderCategoryModal()}
            {renderProductModal()}
            {renderScannerModal()}
            <FlatList
                data={products.filter((product) => (categoryFilter === '__all__' || product.category === categoryFilter) && `${product.name} ${product.barcode || ''} ${product.category || ''}`.toLowerCase().includes(search.trim().toLowerCase()))}
                keyExtractor={(item) => item.id}
                renderItem={renderProduct}
                style={styles.productsList}
                contentContainerStyle={styles.productsContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={[styles.empty, { color: palette.textMuted }]} >No products match this filter. Add a product, even if it has no barcode.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2, backgroundColor: '#f4f6f3'
    },
    headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    pageTitle: { fontSize: 21, color: '#24432b' },
    countText: { fontSize: 12, color: '#66756a' },
    toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
    addButton: { borderRadius: 18, flexShrink: 1 },
    productsList: { flex: 1 },
    productsContent: { paddingBottom: 8 },
    empty: { color: '#68776c', textAlign: 'center', marginTop: 35, paddingHorizontal: 22, lineHeight: 20 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    input: { marginBottom: 10, backgroundColor: '#fff', borderRadius: 14 },
    halfInput: { width: '48%' },
    button: { marginVertical: 5, borderRadius: 24 },
    halfButton: { width: '48%' },
    card: { marginVertical: 6, backgroundColor: '#fff', borderRadius: 16, elevation: 1 },
    modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 20 },
    fullScreenModal: {
        flex: 1,
        backgroundColor: 'white',
        padding: 0,
        margin: 0,
        justifyContent: 'center',
    },
    productRow: { flexDirection: 'row', justifyContent: 'space-between' },
    productDetails: { flex: 1 },
    productActions: { justifyContent: 'center' },
    productName: { fontWeight: 'bold', marginBottom: 2 },
    categoryButton: {
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#ccc',
        paddingHorizontal: 10,
    },
    categoryText: { color: '#268451' },
    scannerTitle: { textAlign: 'center', marginVertical: 10 },
    categoryItem: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: '#eee' },
    categoryItemText: { fontSize: 16 },
});
