// screens/SalesScreen.js
import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, Alert, FlatList } from 'react-native';
import { Button, TextInput, Title, Text, Menu } from 'react-native-paper';
import * as Print from 'expo-print';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ProductsContext } from '../ProductsContext';
import { SalesContext } from '../SalesContext';
import { CurrencyContext } from '../CurrencyContext';
import { escapeHtml, formatMoney, inPeriod } from '../utils/appUtils';

export default function SalesScreen() {
    // Retrieve products and sales from their respective contexts.
    const { products } = useContext(ProductsContext);
    const { sales, recordSale } = useContext(SalesContext);
    const { currency } = useContext(CurrencyContext);

    // Local state for the sale form.
    const [barcode, setBarcode] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [discount, setDiscount] = useState('');
    const [paymentOption, setPaymentOption] = useState('Cash');
    const [amountDue, setAmountDue] = useState(0);
    const [menuVisible, setMenuVisible] = useState(false);
    const [scannedProduct, setScannedProduct] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    // Sales filter state.
    const filterOptions = ['daily', 'weekly', 'monthly', 'yearly'];
    const [filterPeriod, setFilterPeriod] = useState('daily');
    const [saleSearch, setSaleSearch] = useState('');

    // When the barcode changes, look up the product from inventory.
    useEffect(() => {
        const product = products.find(p => p.barcode === barcode);
        if (product) {
            setScannedProduct(product);
            setAmountDue(product.price); // default amountDue for one unit.
        } else {
            setScannedProduct(null);
            setAmountDue(0);
        }
    }, [barcode, products]);

    // Update final amount when discount, quantity, or scanned product changes.
    useEffect(() => {
        if (scannedProduct) {
            let unitPrice = scannedProduct.price;
            const disc = parseFloat(discount);
            if (!isNaN(disc) && disc > 0) {
                unitPrice = unitPrice - (unitPrice * disc) / 100;
            }
            const qty = parseInt(quantity) || 1;
            setAmountDue(unitPrice * qty);
        }
    }, [discount, quantity, scannedProduct]);

    const handleBarCodeScanned = ({ type, data }) => {
        setScanning(false);
        setBarcode(data);
        Alert.alert('Scanned!', `Barcode: ${data}`);
    };

    const handleScan = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) { Alert.alert('Camera access denied', 'Please enable camera access in your device settings.'); return; }
        }
        setScanning(true);
    };

    const handleSale = async () => {
        if (!scannedProduct) {
            Alert.alert('Error', 'No product found for this barcode.');
            return;
        }
        const qty = parseInt(quantity);
        if (isNaN(qty) || qty < 1) {
            Alert.alert('Error', 'Enter a valid quantity.');
            return;
        }
        if (scannedProduct.stock < qty) {
            Alert.alert('Error', `Not enough stock. Available: ${scannedProduct.stock}`);
            return;
        }

        const disc = discount === '' ? 0 : parseFloat(discount);
        if (!Number.isFinite(disc) || disc < 0 || disc > 100) { Alert.alert('Error', 'Discount must be between 0% and 100%.'); return; }
        const finalAmount = scannedProduct.price * (1 - disc / 100) * qty;
        setAmountDue(finalAmount);

        try {
            const saleTransaction = await recordSale({ productId: scannedProduct.id, quantity: qty, discount: disc || 0, paymentOption });
            Alert.alert('Sale Processed', `Sold ${qty} unit(s) for ${currency.symbol} ${saleTransaction.finalAmount.toFixed(2)} via ${paymentOption}`);
        } catch (error) {
            Alert.alert('Sale failed', error.message || 'Unable to process this sale.');
            return;
        }

        // Reset form fields.
        setBarcode('');
        setDiscount('');
        setQuantity('1');
        setScannedProduct(null);
    };

    // Updated print receipt handler using current currency.
    const handlePrintReceipt = async (sale) => {
        const receiptHtml = `
      <html>
      <body style="font-family: Arial, sans-serif; padding: 160px; text-align: left;">
        <h1>Receipt</h1>
        <p><strong>Barcode:</strong> ${escapeHtml(products.find(p => p.id === sale.productId)?.barcode || 'N/A')}</p>
        <p><strong>Quantity:</strong> ${sale.quantity}</p>
        <p><strong>Original Unit Price:</strong> ${formatMoney(sale.originalPrice, currency)}</p>
        <p><strong>Product:</strong> ${escapeHtml(sale.productName)}</p>
        <p><strong>Discount:</strong> ${sale.discount}%</p>
        <p><strong>Total Amount:</strong> ${formatMoney(sale.finalAmount, currency)}</p>
        <p><strong>Payment Option:</strong> ${sale.paymentOption}</p>
        <p><strong>Date:</strong> ${new Date(sale.timestamp).toLocaleString()}</p>
      </body>
      </html>
    `;
        try {
            await Print.printAsync({ html: receiptHtml });
        } catch (error) {
            Alert.alert("Printing error", error.message);
        }
    };

    const filteredSales = sales.filter((sale) => inPeriod(sale.timestamp, filterPeriod) && `${sale.productName || ''} ${sale.barcode || ''} ${sale.paymentMethod || ''}`.toLowerCase().includes(saleSearch.trim().toLowerCase()));

    const filteredTotalSales = filteredSales.reduce((sum, t) => sum + t.finalAmount, 0);

    // Render each sale transaction item.
    const renderTransactionItem = ({ item }) => {
        return (
            <View style={styles.transactionItem}>
                <View style={styles.transactionInfo}>
                    <Text style={styles.transactionText}>
                        {item.productName} | Qty: {item.quantity} | {currency.symbol}{item.finalAmount.toFixed(2)}
                    </Text>
                    <Text style={styles.transactionDate}>
                        {new Date(item.timestamp).toLocaleString()}
                    </Text>
                </View>
                <Button mode="outlined" onPress={() => handlePrintReceipt(item)} style={styles.printButton}>
                    Print Receipt
                </Button>
            </View>
        );
    };

    if (scanning) {
        return (
            <View style={styles.scannerContainer}>
                <CameraView
                    style={styles.cameraPreview}
                    facing="back"
                    active={scanning}
                    barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'codabar', 'itf14', 'qr'] }}
                    onBarcodeScanned={handleBarCodeScanned}
                />
                <View pointerEvents="none" style={styles.scanFrame}><Text style={styles.scannerText}>Align barcode in the frame</Text></View>
                <Button mode="contained" onPress={() => setScanning(false)} style={styles.cancelScan}>Cancel</Button>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Title style={styles.pageTitle}>Sales & Transactions</Title>

            {/* Sale Form */}
            <View style={styles.formContainer}>
                <View style={styles.row}>
                    <TextInput
                        label="Barcode (manual entry)"
                        value={barcode}
                        onChangeText={setBarcode}
                        style={[styles.input, styles.halfInput]}
                    />
                    <Button mode="outlined" onPress={handleScan} style={[styles.button, styles.halfButton]}>
                        Scan
                    </Button>
                </View>

                <View style={styles.row}>
                    <TextInput
                        label="Quantity"
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                        style={[styles.input, { flex: 0.6 }]}
                    />
                    <Menu
                        visible={menuVisible}
                        onDismiss={() => setMenuVisible(false)}
                        anchor={
                            <Button
                                mode="outlined"
                                onPress={() => setMenuVisible(true)}
                                style={[styles.button, { flex: 0.8, height: 50, justifyContent: 'center' }]}
                                contentStyle={{ height: 50 }}
                            >
                                {paymentOption}
                            </Button>
                        }
                    >
                        {['Cash', 'Card', 'Mobile Money'].map(option => (
                            <Menu.Item
                                key={option}
                                onPress={() => { setPaymentOption(option); setMenuVisible(false); }}
                                title={option}
                            />
                        ))}
                    </Menu>
                </View>

                <TextInput
                    label="Discount (%)"
                    value={discount}
                    onChangeText={setDiscount}
                    keyboardType="numeric"
                    style={styles.input}
                />
                <Text style={styles.info}>Amount Due: {currency.symbol}{amountDue.toFixed(2)}</Text>
                <Button mode="contained" onPress={handleSale} style={styles.button}>
                    Process Sale
                </Button>
            </View>

            {/* Filters & Summary */}
            <View style={styles.filterContainer}>
                {filterOptions.map(period => (
                    <Button
                        key={period}
                        mode={filterPeriod === period ? 'contained' : 'outlined'}
                        onPress={() => setFilterPeriod(period)}
                        style={styles.filterButton}
                    >
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                    </Button>
                ))}
            </View>
            <View style={styles.summaryContainer}>
                <Text style={styles.summaryText}>
                    Total Sales ({filterPeriod}): {currency.symbol}{filteredTotalSales.toFixed(2)}
                </Text>
            </View>

            {/* Sales Transactions List */}
            <View style={styles.transactionsContainer}>
                <Title>Sales Transactions</Title>
                <TextInput label="Search product or payment method" value={saleSearch} onChangeText={setSaleSearch} style={styles.input} />
                {filteredSales.length > 0 ? (
                    <FlatList
                        data={filteredSales}
                        keyExtractor={(item) => item.id}
                        renderItem={renderTransactionItem}
                    />
                ) : (
                    <Text style={styles.info}>No sales transactions for the selected period.</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 112, backgroundColor: '#f4f6f3' },
    pageTitle: { textAlign: 'left', marginBottom: 15, color: '#24432b', fontSize: 24 },
    formContainer: { marginBottom: 20 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    input: { flex: 1, marginBottom: 10, backgroundColor: '#fff', borderRadius: 14 },
    halfInput: { width: '48%' },
    button: { marginVertical: 5, borderRadius: 24 },
    info: { marginVertical: 10, fontWeight: 'bold', textAlign: 'center' },
    filterContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 10,
        paddingHorizontal: 10,
    },
    filterButton: { margin: 3 },
    summaryContainer: { alignItems: 'center', marginBottom: 15 },
    summaryText: { fontSize: 18, fontWeight: 'bold' },
    transactionsContainer: { flex: 1, marginTop: 10 },
    transactionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
    transactionInfo: { flex: 1 },
    transactionText: { fontSize: 16 },
    transactionDate: { fontSize: 12, color: 'gray' },
    printButton: { marginLeft: 10 },
    scannerContainer: { flex: 1, backgroundColor: '#111' },
    cameraPreview: { ...StyleSheet.absoluteFillObject },
    scanFrame:{position:'absolute',top:'35%',left:28,right:28,height:150,borderWidth:2,borderColor:'#fff',borderRadius:14,alignItems:'center',justifyContent:'flex-end',paddingBottom:10,backgroundColor:'transparent'},
    scannerText: { color: 'white', fontSize: 13, backgroundColor:'rgba(0,0,0,0.55)',paddingHorizontal:10,paddingVertical:5,borderRadius:12 },
    cancelScan:{position:'absolute',bottom:34,alignSelf:'center'},
});
