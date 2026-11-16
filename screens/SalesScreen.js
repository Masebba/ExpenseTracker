import { userFacingError } from '../utils/userFacingErrors';
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { View, StyleSheet, Alert, FlatList, ScrollView } from 'react-native';
import { Button, TextInput, Title, Text, Menu, Modal, Portal, IconButton, Card } from 'react-native-paper';
import * as Print from 'expo-print';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ProductsContext } from '../ProductsContext';
import { SalesContext } from '../SalesContext';
import { CurrencyContext } from '../CurrencyContext';
import { AuthContext } from '../AuthContext';
import { currencyFromCode, escapeHtml, formatMoney, inPeriod } from '../utils/appUtils';
import { convertAmount } from '../services/currencyConversion';
import useReportingAmounts from '../hooks/useReportingAmounts';
import CurrencyPicker from '../components/CurrencyPicker';
import CompactFilterMenu from '../components/CompactFilterMenu';
import CompactSearch from '../components/CompactSearch';
import { ThemeContext } from '../ThemeContext';

const PERIOD_FILTERS = [
  { label: 'Today', value: 'daily' },
  { label: 'This week', value: 'weekly' },
  { label: 'This month', value: 'monthly' },
  { label: 'This year', value: 'yearly' },
];

export default function SalesScreen({ route, navigation }) {
  const { products = [] } = useContext(ProductsContext);
  const { sales = [], recordSale, deleteSale } = useContext(SalesContext);
  const { currency } = useContext(CurrencyContext);
  const { user, activeWorkspace, personalDetails, businessProfile } = useContext(AuthContext);
  const { palette, isDark } = useContext(ThemeContext);

  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [paymentOption, setPaymentOption] = useState('Cash');
  const [amountDue, setAmountDue] = useState(null);
  const [amountError, setAmountError] = useState('');
  const [saleCurrencyCode, setSaleCurrencyCode] = useState(currency?.code || 'UGX');
  const [paymentMenuVisible, setPaymentMenuVisible] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [saleFormVisible, setSaleFormVisible] = useState(false);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [productLookup, setProductLookup] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [filterPeriod, setFilterPeriod] = useState('daily');
  const [saleSearch, setSaleSearch] = useState('');

  useEffect(() => { setSaleCurrencyCode(currency?.code || 'UGX'); }, [currency?.code]);

  const findProduct = (value) => {
    const clean = String(value || '').trim().toLowerCase();
    if (!clean) return null;
    return products.find((product) => String(product.barcode || '').trim().toLowerCase() === clean)
      || products.find((product) => String(product.name || '').trim().toLowerCase() === clean)
      || null;
  };

  const selectProduct = (product) => {
    setScannedProduct(product || null);
    setBarcode(product ? (product.barcode || product.name || '') : '');
    setManualPrice(product ? String(product.price ?? '') : '');
    setAmountError('');
    setProductPickerVisible(false);
    setProductLookup('');
  };

  const changeProductInput = (value) => {
    setBarcode(value);
    const match = findProduct(value);
    if (match) {
      setScannedProduct(match);
      setManualPrice((current) => current && scannedProduct?.id === match.id ? current : String(match.price ?? ''));
    } else {
      setScannedProduct(null);
      setManualPrice('');
      setAmountDue(null);
    }
  };

  useEffect(() => {
    let active = true;
    if (!scannedProduct) {
      setAmountDue(null);
      setAmountError('Select a product to calculate the amount due.');
      return () => { active = false; };
    }
    const price = Number(manualPrice);
    const qty = Number(quantity);
    const disc = discount.trim() === '' ? 0 : Number(discount);
    if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(qty) || qty < 1 || !Number.isFinite(disc) || disc < 0 || disc > 100) {
      setAmountDue(null);
      setAmountError('Enter a valid unit price, quantity and discount (0-100%).');
      return () => { active = false; };
    }
    setAmountDue(null);
    setAmountError('Calculating total…');
    const sourceCode = scannedProduct.currencyCode || currency?.code || 'UGX';
    convertAmount(price * (1 - disc / 100) * qty, sourceCode, saleCurrencyCode)
      .then(({ amount, isStale }) => {
        if (!active) return;
        setAmountDue(amount);
        setAmountError(isStale ? 'Estimated total uses a cached exchange rate.' : '');
      })
      .catch((error) => {
        if (active) { setAmountDue(null); setAmountError(userFacingError(error, 'Currency conversion is temporarily unavailable.')); }
      });
    return () => { active = false; };
  }, [discount, quantity, manualPrice, scannedProduct, saleCurrencyCode, currency?.code]);

  const openSaleForm = () => {
    setBarcode(''); setQuantity('1'); setDiscount(''); setManualPrice(''); setPaymentOption('Cash');
    setScannedProduct(null); setAmountDue(null); setAmountError('Select a product to calculate the amount due.');
    setSaleCurrencyCode(currency?.code || 'UGX'); setSaleFormVisible(true);
  };

  useEffect(() => {
    if (!route?.params?.openProcessSale) return;
    openSaleForm();
    navigation?.setParams?.({ openProcessSale: false });
  }, [route?.params?.openProcessSale]);

  const handleBarCodeScanned = ({ data }) => {
    if (!data) return;
    setScanning(false);
    setCameraReady(false);
    const match = findProduct(data);
    if (match) selectProduct(match);
    else {
      setBarcode(data);
      setScannedProduct(null);
      setManualPrice('');
      Alert.alert('Product not found', 'This code is not in inventory. Browse products, select a product manually, or add the product to inventory first.');
    }
  };

  const handleScan = async () => {
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) { Alert.alert('Camera access denied', 'Enable camera access in device settings, or select a product manually.'); return; }
      }
      setCameraReady(false);
      setScanning(true);
    } catch (error) {
      Alert.alert('Camera unavailable', userFacingError(error, 'The camera could not be opened. You can select or enter a product manually.'));
    }
  };

  const handleSale = async () => {
    if (!scannedProduct) { Alert.alert('Select a product', 'Scan a barcode, enter an exact product name, or choose a product from the list.'); return; }
    const qty = Number(quantity);
    const price = Number(manualPrice);
    const disc = discount.trim() === '' ? 0 : Number(discount);
    if (!Number.isInteger(qty) || qty < 1) { Alert.alert('Invalid quantity', 'Enter a whole-number quantity of at least one.'); return; }
    if (qty > Number(scannedProduct.stock || 0)) { Alert.alert('Not enough stock', `Available stock: ${scannedProduct.stock || 0}.`); return; }
    if (!Number.isFinite(price) || price <= 0) { Alert.alert('Invalid selling price', 'Enter a unit selling price greater than zero.'); return; }
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) { Alert.alert('Invalid discount', 'Discount must be between 0% and 100%.'); return; }
    try {
      const sale = await recordSale({ productId: scannedProduct.id, quantity: qty, discount: disc, unitPriceOverride: price, paymentOption, currencyCode: saleCurrencyCode });
      Alert.alert('Sale processed', `Sold ${qty} × ${sale.productName} for ${formatMoney(sale.finalAmount, currencyFromCode(sale.currencyCode))}.\nA matching “From Trade” income entry was added to the active workspace ledger.`);
      setSaleFormVisible(false);
      setBarcode(''); setQuantity('1'); setDiscount(''); setManualPrice(''); setScannedProduct(null); setAmountDue(null);
    } catch (error) {
      Alert.alert('Sale failed', userFacingError(error, 'Unable to process this sale. Please check the details and try again.'));
    }
  };

  const handlePrintReceipt = async (sale) => {
    const isOrganizationWorkspace = Boolean(activeWorkspace && activeWorkspace.type !== 'personal' && activeWorkspace.id !== 'personal');
    const workspaceDetails = isOrganizationWorkspace
      ? { ...(activeWorkspace?.details || {}), legalName: activeWorkspace?.details?.legalName || activeWorkspace?.name }
      : { ...(personalDetails || {}), ...(businessProfile || {}) };
    const companyName = workspaceDetails.legalName || workspaceDetails.businessName || workspaceDetails.name || personalDetails?.businessName || activeWorkspace?.name || user?.displayName || 'FinanceTracker';
    const companyLines = [
      workspaceDetails.address || workspaceDetails.businessAddress || workspaceDetails.postalAddress,
      [workspaceDetails.city, workspaceDetails.country].filter(Boolean).join(', '),
      workspaceDetails.contactName ? `Contact: ${workspaceDetails.contactName}${workspaceDetails.contactTitle ? ` (${workspaceDetails.contactTitle})` : ''}` : '',
      workspaceDetails.phone || workspaceDetails.phoneNumber || workspaceDetails.alternatePhone,
      workspaceDetails.email || workspaceDetails.businessEmail || user?.email,
      workspaceDetails.taxId || workspaceDetails.tin ? `Tax ID: ${workspaceDetails.taxId || workspaceDetails.tin}` : '',
      workspaceDetails.registrationNumber || workspaceDetails.registrationId ? `Registration: ${workspaceDetails.registrationNumber || workspaceDetails.registrationId}` : '',
      workspaceDetails.website,
    ].filter(Boolean).map((line) => `<div>${escapeHtml(line)}</div>`).join('');
    const product = products.find((item) => item.id === sale.productId);
    const priceCode = sale.priceCurrencyCode || product?.currencyCode || currency?.code || 'UGX';
    const saleCode = sale.currencyCode || sale.currency || currency?.code || 'UGX';
    const unitPrice = sale.saleUnitPrice ?? sale.originalPrice ?? product?.price ?? 0;
    const subtotal = unitPrice * Number(sale.quantity || 1);
    const discountAmount = subtotal * (Number(sale.discount || 0) / 100);
    const unitConversionRate = Number.isFinite(Number(sale.priceExchangeRate)) ? Number(sale.priceExchangeRate) : null;
    const conversionNote = priceCode !== saleCode
      ? (unitConversionRate && Number.isFinite(unitConversionRate) ? `1 ${priceCode} = ${unitConversionRate.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${saleCode}` : `Converted from ${priceCode} to ${saleCode}`)
      : '';
    const exchangeNote = sale.priceExchangeRateStale || sale.exchangeRateStale ? 'One or more exchange rates were cached and may be estimates.' : ''; 
    const receiptNumber = String(sale.id || '').slice(-10).toUpperCase();
    const dateLabel = new Date(sale.timestamp || Date.now()).toLocaleString();
    const receiptHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
      @page { size: 80mm auto; margin: 3mm; }
      * { box-sizing: border-box; }
      body { width: 74mm; max-width: 100%; margin: 0 auto; padding: 0; color: #111; font-family: 'Courier New', monospace; font-size: 10px; }
      .center { text-align: center; } .company { font-family: Arial, sans-serif; font-weight: 800; font-size: 16px; margin: 0 0 5px; }
      .muted { color: #444; line-height: 1.4; } .rule { border-top: 1px dashed #444; margin: 8px 0; }
      .title { font-size: 13px; font-weight: 700; letter-spacing: 1px; } table { width: 100%; border-collapse: collapse; }
      th, td { padding: 3px 0; vertical-align: top; } th { border-bottom: 1px solid #222; text-align: left; }
      .right { text-align: right; white-space: nowrap; } .totals td { padding: 3px 0; } .grand { font-size: 13px; font-weight: 800; border-top: 1px solid #111; }
      .footer { text-align: center; margin-top: 12px; font-size: 9px; line-height: 1.4; }
      @media print { body { width: 74mm; } }
    </style></head><body>
      <header class="center"><h1 class="company">${escapeHtml(companyName)}</h1><div class="muted">${companyLines}</div><div class="rule"></div><div class="title">SALES RECEIPT</div><div>Receipt #: ${escapeHtml(receiptNumber || 'N/A')}</div><div>Date: ${escapeHtml(dateLabel)}</div><div>Payment: ${escapeHtml(sale.paymentOption || sale.paymentMethod || 'Not recorded')}</div></header>
      <div class="rule"></div><table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Unit</th></tr></thead><tbody><tr><td>${escapeHtml(sale.productName || product?.name || 'Product')}</td><td class="right">${Number(sale.quantity || 1)}</td><td class="right">${escapeHtml(formatMoney(unitPrice, currencyFromCode(priceCode)))}</td></tr></tbody></table>
      <div class="rule"></div><table class="totals"><tr><td>Subtotal (${escapeHtml(priceCode)})</td><td class="right">${escapeHtml(formatMoney(subtotal, currencyFromCode(priceCode)))}</td></tr><tr><td>Discount (${Number(sale.discount || 0)}%)</td><td class="right">-${escapeHtml(formatMoney(discountAmount, currencyFromCode(priceCode)))}</td></tr><tr class="grand"><td>TOTAL (${escapeHtml(saleCode)})</td><td class="right">${escapeHtml(formatMoney(sale.finalAmount, currencyFromCode(saleCode)))}</td></tr></table>${conversionNote ? `<div class="muted">Currency conversion: ${escapeHtml(conversionNote)}</div>` : ''}${exchangeNote ? `<div class="muted">${escapeHtml(exchangeNote)}</div>` : ''}
      <div class="rule"></div><div>Barcode / SKU: ${escapeHtml(product?.barcode || sale.barcode || 'No barcode')}</div><div>Units sold: ${Number(sale.quantity || 1)}</div><div>Thank you for your purchase.</div><div class="footer">${escapeHtml(companyName)}${workspaceDetails.paymentMethod ? `<br>${escapeHtml(workspaceDetails.paymentMethod)}` : ''}<br>Generated by FinanceTracker</div>
    </body></html>`;
    try { await Print.printAsync({ html: receiptHtml }); }
    catch (error) { Alert.alert('Printing unavailable', userFacingError(error, 'Could not prepare the receipt for printing.')); }
  };

  const filteredSales = useMemo(() => sales
    .filter((sale) => inPeriod(sale.timestamp, filterPeriod)
      && `${sale.productName || ''} ${sale.barcode || ''} ${sale.paymentOption || ''} ${sale.paymentMethod || ''} ${sale.id || ''}`.toLowerCase().includes(saleSearch.trim().toLowerCase()))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), [sales, filterPeriod, saleSearch]);
  const { amounts: reportingSalesAmounts, loading: salesConverting, error: salesConversionError } = useReportingAmounts(filteredSales, currency?.code, 'finalAmount');
  const filteredTotalSales = filteredSales.reduce((sum, sale) => sum + (reportingSalesAmounts[sale.id] || 0), 0);
  const productChoices = useMemo(() => products.filter((product) => `${product.name || ''} ${product.barcode || ''} ${product.category || ''}`.toLowerCase().includes(productLookup.trim().toLowerCase())), [products, productLookup]);

  const confirmDeleteSale = (sale) => Alert.alert(
    'Remove sale?',
    `This will remove the sale for ${sale.productName || 'this product'}, restore ${sale.quantity} unit(s) to inventory, and remove its linked From Trade income when present.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove sale', style: 'destructive', onPress: async () => {
        try { await deleteSale(sale.id); }
        catch (error) { Alert.alert('Could not remove sale', userFacingError(error, 'The sale was not removed. Please try again.')); }
      } },
    ],
  );

  const renderTransactionItem = ({ item }) => (
    <Card style={[styles.transactionCard, { backgroundColor: palette.surface }]} >
      <Card.Content style={styles.transactionItem}>
        <View style={styles.transactionInfo}>
          <Text numberOfLines={2} style={[styles.transactionText, { color: palette.text }]} >{item.productName || 'Product'} · Qty {item.quantity} · {formatMoney(item.finalAmount, currencyFromCode(item.currencyCode || item.currency || currency?.code))}</Text>
          <Text style={[styles.transactionDate, { color: palette.textMuted }]} >{new Date(item.timestamp).toLocaleString()} · {item.paymentOption || item.paymentMethod || 'Payment not recorded'}</Text>
        </View>
        <IconButton icon="printer-outline" accessibilityLabel="Print detailed receipt" onPress={() => handlePrintReceipt(item)} size={21} />
        <IconButton icon="delete-outline" iconColor="#b3261e" accessibilityLabel="Remove sale and restore stock" onPress={() => confirmDeleteSale(item)} size={21} />
      </Card.Content>
    </Card>
  );

  if (scanning) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={styles.cameraPreview}
          facing="back"
          active={scanning}
          onCameraReady={() => setCameraReady(true)}
          onMountError={(event) => { setScanning(false); Alert.alert('Camera could not start', userFacingError(event, 'Close other apps using the camera, then retry or select a product manually.')); }}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'codabar', 'itf14', 'qr'] }}
          onBarcodeScanned={handleBarCodeScanned}
        />
        {!cameraReady && <View style={styles.cameraLoading}><Text style={styles.scannerText}>Opening camera…</Text></View>}
        <View pointerEvents="none" style={styles.scanFrame}><Text style={styles.scannerText}>Align barcode in the frame</Text></View>
        <Button mode="contained" onPress={() => { setScanning(false); setCameraReady(false); }} style={styles.cancelScan}>Cancel scanning</Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]} >
      <View style={styles.headingRow}><Title style={[styles.pageTitle, { color: palette.text }]}>Sales & Transactions</Title><Text style={[styles.countText, { color: palette.textMuted }]}>{sales.length} sales</Text></View>
      <View style={styles.toolbar}>
        <Button mode="contained" icon="cash-register" compact onPress={openSaleForm} style={styles.primaryAction}>Process sale</Button>
        <CompactFilterMenu value={filterPeriod} options={PERIOD_FILTERS} onChange={setFilterPeriod} label="Period" />
        <CompactSearch value={saleSearch} onChangeText={setSaleSearch} placeholder="Product, barcode, payment" accessibilityLabel="Search sales" />
      </View>
      <View style={[styles.summaryContainer, { backgroundColor: palette.surfaceAlt }]} >
        <View style={{ flex: 1 }}>
          <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Sales total · {PERIOD_FILTERS.find((item) => item.value === filterPeriod)?.label}</Text>
          <Text style={[styles.summaryText, { color: palette.text }]} >{salesConverting || salesConversionError ? '—' : formatMoney(filteredTotalSales, currency)}</Text>
        </View>
        {!!salesConversionError && <Text style={[styles.warningText, { color: palette.danger }]} >{salesConversionError}</Text>}
        {salesConverting && <Text style={[styles.transactionDate, { color: palette.textMuted }]} >Converting…</Text>}
      </View>
      <FlatList
        style={styles.salesList}
        data={filteredSales}
        keyExtractor={(item) => item.id}
        renderItem={renderTransactionItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={filteredSales.length ? styles.listContent : styles.emptyContent}
        ListEmptyComponent={<View style={styles.emptyState}><Text style={[styles.emptyTitle, { color: palette.text }]} >{sales.length ? 'No matching sales' : 'No sales recorded yet'}</Text><Text style={[styles.emptyText, { color: palette.textMuted }]} >{sales.length ? 'Try another period or search.' : 'Tap Process sale to record a sale. You can scan a barcode, enter a product name or choose a product manually.'}</Text><Button mode="outlined" icon="cash-register" onPress={openSaleForm}>Process first sale</Button></View>}
      />

      <Portal>
        <Modal visible={saleFormVisible} onDismiss={() => { setSaleFormVisible(false); setScanning(false); }} contentContainerStyle={[styles.modal, { backgroundColor: palette.surface }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeading}><Title style={{ color: palette.text }}>Process sale</Title><IconButton icon="close" onPress={() => setSaleFormVisible(false)} accessibilityLabel="Close sale form" /></View>
            <Text style={styles.modalHint}>Scan a code or select a product. The unit selling price can be changed for this sale without changing the product's standard price.</Text>
            <View style={styles.entryRow}>
              <TextInput label="Barcode or exact product name" value={barcode} onChangeText={changeProductInput} style={[styles.input, { flex: 1, backgroundColor: palette.input }]} autoCapitalize="none" autoCorrect={false} />
              <IconButton icon="magnify" size={25} onPress={() => setProductPickerVisible(true)} accessibilityLabel="Browse products" style={styles.entryIcon} />
              <IconButton icon="barcode-scan" size={25} onPress={handleScan} accessibilityLabel="Scan barcode" style={styles.entryIcon} />
            </View>
            {scannedProduct ? (
              <View style={[styles.selectedProduct, { backgroundColor: palette.surfaceAlt }]} ><Text style={[styles.selectedProductName, { color: palette.text }]} >{scannedProduct.name}</Text><Text style={[styles.selectedProductMeta, { color: palette.textMuted }]} >Stock {scannedProduct.stock} · List price {formatMoney(scannedProduct.price, currencyFromCode(scannedProduct.currencyCode || currency?.code))}{scannedProduct.barcode ? ` · ${scannedProduct.barcode}` : ' · No barcode'}</Text></View>
            ) : <Text style={[styles.helper, { color: palette.textMuted }]} >Products without barcodes can be selected from the product list or entered by exact name.</Text>}
            <View style={styles.entryRow}>
              <TextInput label="Unit selling price" value={manualPrice} onChangeText={setManualPrice} keyboardType="decimal-pad" style={[styles.input, { flex: 1, backgroundColor: palette.input }]} disabled={!scannedProduct} />
              <View style={styles.priceCurrency}><Text style={[styles.currencyLabel, { color: palette.textMuted }]} >{scannedProduct?.currencyCode || currency?.code || 'UGX'}</Text></View>
            </View>
            <View style={styles.entryRow}>
              <TextInput label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" style={[styles.input, { flex: 0.65, backgroundColor: palette.input }]} />
              <Menu visible={paymentMenuVisible} onDismiss={() => setPaymentMenuVisible(false)} anchor={<Button compact mode="outlined" onPress={() => setPaymentMenuVisible(true)} style={styles.paymentButton} contentStyle={{ minHeight: 48 }}>{paymentOption}</Button>}>
                {['Cash', 'Card', 'Mobile Money', 'Bank Transfer', 'Credit'].map((option) => <Menu.Item key={option} title={option} onPress={() => { setPaymentOption(option); setPaymentMenuVisible(false); }} />)}
              </Menu>
            </View>
            <TextInput label="Discount (%)" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" style={[styles.input, { backgroundColor: palette.input }]} />
            <CurrencyPicker value={saleCurrencyCode} onChange={setSaleCurrencyCode} label="Customer pays in" />
            <View style={[styles.amountPanel, { backgroundColor: palette.surfaceAlt }]} >
              <Text style={[styles.amountLabel, { color: palette.textMuted }]} >Amount due</Text>
              <Text style={[styles.amountValue, { color: palette.text }]} >{amountDue === null ? '—' : formatMoney(amountDue, currencyFromCode(saleCurrencyCode))}</Text>
              {!!amountError && <Text style={[styles.helper, { color: palette.textMuted }]} >{amountError}</Text>}
            </View>
            <Button mode="contained" icon="check-circle-outline" disabled={!scannedProduct || amountDue === null} onPress={handleSale} style={styles.submitButton}>Complete sale</Button>
            <Button mode="text" onPress={() => setSaleFormVisible(false)}>Cancel</Button>
          </ScrollView>
        </Modal>
        <Modal visible={productPickerVisible} onDismiss={() => setProductPickerVisible(false)} contentContainerStyle={[styles.pickerModal, { backgroundColor: palette.surface }]}>
          <Title style={{ color: palette.text }}>Select a product</Title>
          <TextInput dense mode="outlined" label="Search name, category or barcode" value={productLookup} onChangeText={setProductLookup} style={styles.input} autoCorrect={false} />
          <FlatList
            data={productChoices}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 420 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <Button mode="text" contentStyle={{ justifyContent: 'flex-start' }} onPress={() => { selectProduct(item); setSaleFormVisible(true); }}>{`${item.name} · ${formatMoney(item.price, currencyFromCode(item.currencyCode || currency?.code))} · Stock ${item.stock}${item.barcode ? ` · ${item.barcode}` : ' · No barcode'}`}</Button>}
            ListEmptyComponent={<Text style={[styles.helper, { color: palette.textMuted }]} >No matching products. Add the product to Inventory first.</Text>}
          />
          <Button onPress={() => setProductPickerVisible(false)}>Close</Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2, backgroundColor: '#f4f6f3' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pageTitle: { color: '#24432b', fontSize: 21 }, countText: { color: '#66756a', fontSize: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  primaryAction: { flexShrink: 1, borderRadius: 18 },
  summaryContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 5, borderRadius: 12, backgroundColor: '#e8efe8' },
  summaryLabel: { color: '#5e7162', fontSize: 11 }, summaryText: { fontSize: 17, fontWeight: '800', color: '#24432b' }, warningText: { fontSize: 10, color: '#8a5c12', flexShrink: 1 },
  salesList: { flex: 1 }, listContent: { paddingBottom: 10 }, emptyContent: { flexGrow: 1, justifyContent: 'center' },
  transactionCard: { marginVertical: 3, borderRadius: 12, backgroundColor: '#fff', elevation: 1 },
  transactionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 8 }, transactionInfo: { flex: 1 },
  transactionText: { color: '#253c2b', fontSize: 13, fontWeight: '700' }, transactionDate: { color: '#758177', fontSize: 10, marginTop: 3 },
  emptyState: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 30, gap: 8 }, emptyTitle: { fontSize: 16, fontWeight: '700', color: '#24432b' }, emptyText: { color: '#728075', textAlign: 'center', lineHeight: 20 },
  modal: { backgroundColor: '#f7f9f6', margin: 12, borderRadius: 20, maxHeight: '94%', overflow: 'hidden' }, modalContent: { padding: 16, paddingBottom: 20 }, modalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalHint: { color: '#66756a', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }, input: { marginBottom: 8, backgroundColor: '#fff' }, entryIcon: { margin: 0 },
  selectedProduct: { backgroundColor: '#e7f1e8', padding: 10, borderRadius: 10, marginBottom: 10 }, selectedProductName: { color: '#24432b', fontWeight: '800' }, selectedProductMeta: { color: '#5f7163', fontSize: 11, marginTop: 3 }, helper: { color: '#6d796f', fontSize: 11, marginVertical: 5 },
  priceCurrency: { minWidth: 58, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, currencyLabel: { color: '#5f6f63', fontWeight: '700', fontSize: 12 },
  paymentButton: { height: 48, justifyContent: 'center', marginBottom: 8 }, amountPanel: { alignItems: 'center', padding: 12, backgroundColor: '#e8efe8', borderRadius: 12, marginTop: 4 }, amountLabel: { color: '#617165', fontSize: 12 }, amountValue: { color: '#24432b', fontSize: 22, fontWeight: '800', marginTop: 3 }, submitButton: { marginTop: 12, borderRadius: 20 },
  pickerModal: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 18, maxHeight: '85%' },
  scannerContainer: { flex: 1, backgroundColor: '#000', position: 'relative' }, cameraPreview: { flex: 1, width: '100%' }, cameraLoading: { position: 'absolute', top: '45%', left: 0, right: 0, alignItems: 'center' },
  scanFrame: { position: 'absolute', top: '32%', left: 26, right: 26, height: 160, borderWidth: 2, borderColor: '#fff', borderRadius: 14, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10, backgroundColor: 'transparent' },
  scannerText: { color: '#fff', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }, cancelScan: { position: 'absolute', bottom: 24, alignSelf: 'center' },
});
