import { userFacingError } from '../utils/userFacingErrors';
import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { View, StyleSheet, Alert, FlatList, ScrollView } from 'react-native';
import { Button, TextInput, Title, Text, Menu, Modal, Portal, IconButton, Card } from 'react-native-paper';
import * as Print from 'expo-print';
import BarcodeScannerComponent from '../BarcodeScannerComponent';
import { useIsFocused } from '@react-navigation/native';
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
import { getSaleLineItems, getSaleItemCount, getSaleDisplayName } from '../utils/sales';

const PERIOD_FILTERS = [
  { label: 'Today', value: 'daily' },
  { label: 'This week', value: 'weekly' },
  { label: 'This month', value: 'monthly' },
  { label: 'This year', value: 'yearly' },
];

export default function SalesScreen({ route, navigation }) {
  const { products = [], hydrated: productsHydrated } = useContext(ProductsContext);
  const { sales = [], recordSaleBatch, deleteSale } = useContext(SalesContext);
  const { currency } = useContext(CurrencyContext);
  const { user, activeWorkspace, personalDetails, businessProfile } = useContext(AuthContext);
  const { palette, isDark } = useContext(ThemeContext);
  const isFocused = useIsFocused();

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
  const [cartItems, setCartItems] = useState([]);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [productLookup, setProductLookup] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanQueue, setScanQueue] = useState([]);
  const [scannerProcessing, setScannerProcessing] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState('Point the camera at a product barcode.');
  const [filterPeriod, setFilterPeriod] = useState('daily');
  const [saleSearch, setSaleSearch] = useState('');
  const [cartFeedback, setCartFeedback] = useState('');
  const [manualItemSelected, setManualItemSelected] = useState(false);
  const scanLockRef = useRef(false);
  const cartItemsRef = useRef([]);

  useEffect(() => { setSaleCurrencyCode(currency?.code || 'UGX'); }, [currency?.code]);

  useEffect(() => {
    if (!isFocused && scanning) {
      setScanning(false);
      setSaleFormVisible(false);
      setScanQueue([]);
      setScannerProcessing(false);
      scanLockRef.current = false;
    }
  }, [isFocused, scanning]);

  useEffect(() => { cartItemsRef.current = cartItems; }, [cartItems]);

  const findProduct = (value) => {
    const clean = String(value || '').trim().toLowerCase();
    if (!clean) return null;
    return products.find((product) => String(product.barcode || '').trim().toLowerCase() === clean)
      || products.find((product) => String(product.name || '').trim().toLowerCase() === clean)
      || null;
  };

  const selectProduct = (product) => {
    setScannedProduct(product || null);
    setManualItemSelected(Boolean(product));
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
      setManualItemSelected(true);
      setScannedProduct(match);
      setManualPrice((current) => current && scannedProduct?.id === match.id ? current : String(match.price ?? ''));
    } else {
      setManualItemSelected(false);
      setScannedProduct(null);
      setManualPrice('');
      setAmountDue(null);
    }
  };

  useEffect(() => {
    let active = true;
    if (!scannedProduct) {
      setAmountDue(null);
      setAmountError('');
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

  const closeSaleScanner = () => {
    setScanning(false);
    setScanQueue([]);
    setScannerProcessing(false);
    scanLockRef.current = false;
  };

  const closeSaleForm = () => {
    closeSaleScanner();
    setProductPickerVisible(false);
    setSaleFormVisible(false);
  };

  const openSaleForm = () => {
    closeSaleScanner();
    setBarcode(''); setQuantity('1'); setDiscount(''); setManualPrice(''); setPaymentOption('Cash');
    setScannedProduct(null); setAmountDue(null); setAmountError('');
    cartItemsRef.current = [];
    setCartItems([]); setCartFeedback(''); setManualItemSelected(false);
    setSaleCurrencyCode(currency?.code || 'UGX'); setSaleFormVisible(true);
  };

  useEffect(() => {
    if (!route?.params?.openProcessSale) return;
    openSaleForm();
    navigation?.setParams?.({ openProcessSale: false });
  }, [route?.params?.openProcessSale]);

  const queueSalesBarcode = (rawValue) => {
    const value = String(rawValue || '').trim();
    if (!value) return;

    // The camera callback only queues a read. Inventory and cart work run in
    // the worker below, away from the native CameraView event.
    setScanQueue((current) => [...current, value]);
  };

  useEffect(() => {
    if (!scanning || scannerProcessing || !productsHydrated || !scanQueue.length) return;
    const [barcodeValue, ...remaining] = scanQueue;
    setScanQueue(remaining);
    setScannerProcessing(true);

    const addQueuedProduct = async () => {
      try {
        const product = findProduct(barcodeValue);
        if (!product) {
          setScannerFeedback(`No inventory product matches ${barcodeValue}.`);
          return;
        }
        const price = Number(product.price);
        if (!product.id || !Number.isFinite(price) || price <= 0) {
          setScannerFeedback(`${product.name} has no valid selling price.`);
          return;
        }
        const priceCurrencyCode = product.currencyCode || currency?.code || 'UGX';
        const currentCart = cartItemsRef.current;
        const inCart = currentCart.filter((line) => line.productId === product.id)
          .reduce((sum, line) => sum + Number(line.quantity || 0), 0);
        if (inCart >= Number(product.stock || 0)) {
          setScannerFeedback(`Cannot add ${product.name}: no remaining stock.`);
          return;
        }
        const matchingIndex = currentCart.findIndex((line) => line.productId === product.id
          && Number(line.unitPriceOverride) === price
          && Number(line.discount) === 0
          && line.priceCurrencyCode === priceCurrencyCode);
        if (matchingIndex >= 0) {
          const next = currentCart.map((line, index) => index === matchingIndex
            ? { ...line, quantity: Number(line.quantity || 0) + 1, previewAmount: Number(line.previewAmount || 0) + Number(line.previewUnitAmount || line.previewAmount || 0) }
            : line);
          cartItemsRef.current = next;
          setCartItems(next);
          setScannerFeedback(`${product.name}: quantity increased to ${next[matchingIndex].quantity}.`);
          return;
        }
        const conversion = await convertAmount(price, priceCurrencyCode, saleCurrencyCode);
        const previewUnitAmount = Number(conversion.amount);
        if (!Number.isFinite(previewUnitAmount)) throw new Error('The sale amount could not be calculated.');
        const latestCart = cartItemsRef.current;
        const latestInCart = latestCart.filter((line) => line.productId === product.id)
          .reduce((sum, line) => sum + Number(line.quantity || 0), 0);
        if (latestInCart >= Number(product.stock || 0)) {
          setScannerFeedback(`Cannot add ${product.name}: no remaining stock.`);
          return;
        }
        const next = [...latestCart, {
          cartId: `${product.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          productId: product.id,
          productName: product.name,
          quantity: 1,
          discount: 0,
          unitPriceOverride: price,
          priceCurrencyCode,
          previewUnitAmount,
          previewAmount: previewUnitAmount,
        }];
        cartItemsRef.current = next;
        setCartItems(next);
        setScannerFeedback(`${product.name} added to cart.`);
      } catch (error) {
        setScannerFeedback(userFacingError(error, 'Could not add this product. Check its price and currency, then scan again.'));
      } finally {
        setScannerProcessing(false);
      }
    };

    addQueuedProduct();
  }, [scanQueue, scanning, scannerProcessing, products, productsHydrated, saleCurrencyCode, currency?.code]);

  const handleScan = () => {
    if (!saleFormVisible || !isFocused) return;
    if (!productsHydrated) {
      Alert.alert('Inventory is loading', 'Wait for inventory to finish loading, then scan the product again.');
      return;
    }
    setProductPickerVisible(false);
    setScannerFeedback('Point the camera at a product barcode.');
    setScanQueue([]);
    setScanning(true);
  };

  const addCurrentItemToCart = () => {
    if (!scannedProduct) { Alert.alert('Select a product', 'Scan a barcode, enter an exact product name, or choose a product from the list.'); return; }
    const qty = Number(quantity);
    const price = Number(manualPrice);
    const disc = discount.trim() === '' ? 0 : Number(discount);
    if (!Number.isInteger(qty) || qty < 1) { Alert.alert('Invalid quantity', 'Enter a whole-number quantity of at least one.'); return; }
    if (!Number.isFinite(price) || price <= 0) { Alert.alert('Invalid selling price', 'Enter a unit selling price greater than zero.'); return; }
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) { Alert.alert('Invalid discount', 'Discount must be between 0% and 100%.'); return; }
    const alreadyInCart = cartItems.filter((line) => line.productId === scannedProduct.id).reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const available = Number(scannedProduct.stock || 0) - alreadyInCart;
    if (qty > available) { Alert.alert('Not enough stock', `Available to add: ${Math.max(0, available)}. This product is already in the cart ${alreadyInCart} time(s).`); return; }
    if (amountDue === null) { Alert.alert('Amount not ready', amountError || 'Wait for the item total to finish calculating.'); return; }

    const priceCurrencyCode = scannedProduct.currencyCode || currency?.code || 'UGX';
    const matchingIndex = cartItems.findIndex((line) => line.productId === scannedProduct.id
      && Number(line.unitPriceOverride) === price
      && Number(line.discount) === disc
      && line.priceCurrencyCode === priceCurrencyCode);
    const nextLine = {
      cartId: `${scannedProduct.id}_${Date.now()}_${cartItems.length}`,
      productId: scannedProduct.id,
      productName: scannedProduct.name,
      quantity: qty,
      discount: disc,
      unitPriceOverride: price,
      priceCurrencyCode,
      previewUnitAmount: Number(amountDue) / qty,
      previewAmount: Number(amountDue),
    };
    if (matchingIndex >= 0) {
      setCartItems((current) => current.map((line, index) => index === matchingIndex
        ? { ...line, quantity: line.quantity + qty, previewAmount: Number(line.previewAmount || 0) + Number(amountDue) }
        : line));
    } else {
      setCartItems((current) => [...current, nextLine]);
    }
    setBarcode(''); setQuantity('1'); setDiscount(''); setManualPrice(''); setScannedProduct(null); setManualItemSelected(false); setAmountDue(null);
    setCartFeedback(`${scannedProduct.name} added to cart.`);
    setAmountError('')
  };

  const updateCartItems = (updater) => {
    setCartItems((current) => {
      const next = updater(current);
      cartItemsRef.current = next;
      return next;
    });
  };

  const removeCartItem = (cartId) => updateCartItems((current) => current.filter((line) => line.cartId !== cartId));
  const clearCart = () => updateCartItems(() => []);

  const changeCartQuantity = (cartId, nextQuantity) => {
    const quantityValue = Number(nextQuantity);
    const line = cartItemsRef.current.find((item) => item.cartId === cartId);
    if (!line) return;
    if (!Number.isInteger(quantityValue) || quantityValue < 1) {
      removeCartItem(cartId);
      return;
    }
    const product = products.find((item) => item.id === line.productId);
    const otherQuantity = cartItemsRef.current
      .filter((item) => item.productId === line.productId && item.cartId !== cartId)
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (!product || quantityValue + otherQuantity > Number(product.stock || 0)) {
      setScannerFeedback(`Cannot set ${line.productName} above available stock.`);
      return;
    }
    const unitAmount = Number(line.previewUnitAmount || (Number(line.previewAmount || 0) / Math.max(1, Number(line.quantity || 1))));
    updateCartItems((current) => current.map((item) => item.cartId === cartId
      ? { ...item, quantity: quantityValue, previewUnitAmount: unitAmount, previewAmount: unitAmount * quantityValue }
      : item));
  };
  const cartTotal = cartItems.reduce((sum, line) => sum + Number(line.previewAmount || 0), 0);
  const cartQuantity = cartItems.reduce((sum, line) => sum + Number(line.quantity || 0), 0);

  const handleCompleteSale = async () => {
    if (!cartItems.length) { Alert.alert('Cart is empty', 'Add at least one product before completing the sale.'); return; }
    try {
      const sale = await recordSaleBatch({
        items: cartItems.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          discount: line.discount,
          unitPriceOverride: line.unitPriceOverride,
        })),
        paymentOption,
        currencyCode: saleCurrencyCode,
      });
      closeSaleForm();
      cartItemsRef.current = [];
      setBarcode(''); setQuantity('1'); setDiscount(''); setManualPrice(''); setScannedProduct(null); setManualItemSelected(false); setAmountDue(null); setCartItems([]); setCartFeedback('');
      Alert.alert(
        'Sale processed',
        `${sale.itemCount || sale.items?.length || 1} product line(s), ${sale.totalQuantity || sale.quantity} unit(s). Total: ${formatMoney(sale.finalAmount, currencyFromCode(sale.currencyCode))}.\nOne matching “From Trade” income entry was added to the active ledger.`,
        [
          { text: 'Done', style: 'cancel' },
          { text: 'Print receipt', onPress: () => handlePrintReceipt(sale) },
        ],
      );
    } catch (error) {
      Alert.alert('Sale failed', userFacingError(error, 'Unable to complete this sale. Please check the cart and try again.'));
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
    const saleCode = sale.currencyCode || sale.currency || currency?.code || 'UGX';
    const lines = getSaleLineItems(sale);
    const subtotal = Number(sale.subtotalAmount ?? lines.reduce((sum, line) => sum + Number(line.subtotalAmount || 0), 0));
    const discountAmount = Number(sale.discountAmount ?? lines.reduce((sum, line) => sum + Number(line.discountAmount || 0), 0));
    const units = getSaleItemCount(sale);
    const receiptItems = lines.map((line) => {
      const lineTotal = Number(line.finalAmount || 0);
      const unit = Number(line.convertedUnitPrice ?? line.saleUnitPrice ?? 0);
      const itemDiscount = Number(line.discount || 0);
      const itemDiscountAmount = Number(line.discountAmount || 0);
      return `<tr><td class="item-name">${escapeHtml(line.productName || 'Product')}${line.barcode ? `<div class="sku">SKU: ${escapeHtml(line.barcode)}</div>` : ''}${itemDiscount > 0 ? `<div class="sku">Discount ${itemDiscount}% (-${escapeHtml(formatMoney(itemDiscountAmount, currencyFromCode(saleCode)))})</div>` : ''}</td><td class="right qty">${Number(line.quantity || 1)}</td><td class="right unit">${escapeHtml(formatMoney(unit, currencyFromCode(saleCode)))}</td><td class="right total">${escapeHtml(formatMoney(lineTotal, currencyFromCode(saleCode)))}</td></tr>`;
    }).join('');
    const currenciesUsed = [...new Set(lines.map((line) => line.priceCurrencyCode).filter((code) => code && code !== saleCode))];
    const conversionNote = currenciesUsed.length ? `Item prices converted to ${saleCode} from ${currenciesUsed.join(', ')}.` : '';
    const exchangeNote = sale.exchangeRateStale || lines.some((line) => line.priceExchangeRateStale || line.exchangeRateStale)
      ? 'One or more exchange rates were cached and may be estimates.' : '';
    const receiptNumber = String(sale.id || '').slice(-10).toUpperCase();
    const dateLabel = new Date(sale.timestamp || Date.now()).toLocaleString();
    const receiptHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
      @page { size: 3in 5in; margin: 0.12in; }
      * { box-sizing: border-box; }
      html, body { width: 2.76in; max-width: 2.76in; margin: 0; padding: 0; color: #151a16; font-family: Arial, Helvetica, sans-serif; font-size: 8.2pt; }
      body { padding: 0; }
      .receipt { width: 100%; margin: 0 auto; }
      .center { text-align: center; }
      .company { font-weight: 800; font-size: 12pt; line-height: 1.12; margin: 0 0 3px; letter-spacing: .1px; }
      .muted { color: #3f4b42; font-size: 7pt; line-height: 1.3; }
      .rule { border-top: 1px dashed #667168; margin: 5px 0; }
      .title { font-size: 10pt; font-weight: 800; letter-spacing: 1px; margin: 3px 0; }
      .meta { font-size: 7.2pt; line-height: 1.35; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { padding: 2px 1px; vertical-align: top; overflow-wrap: anywhere; }
      th { font-size: 7pt; border-bottom: 1px solid #28352c; text-align: left; }
      .item-name { width: 42%; font-weight: 600; }
      .qty { width: 9%; }
      .unit { width: 23%; }
      .total { width: 26%; }
      .sku { font-size: 6pt; color: #566158; font-weight: 400; margin-top: 1px; }
      .right { text-align: right; white-space: nowrap; }
      .totals td { padding: 2px 1px; }
      .grand { font-size: 10pt; font-weight: 800; border-top: 1px solid #1d2820; }
      .footer { text-align: center; margin-top: 7px; font-size: 7pt; line-height: 1.35; }
      .thanks { font-weight: 700; margin-top: 6px; }
      tr { page-break-inside: avoid; }
      @media print { html, body { width: 2.76in; max-width: 2.76in; } }
    </style></head><body><main class="receipt">
      <header class="center"><h1 class="company">${escapeHtml(companyName)}</h1><div class="muted">${companyLines}</div><div class="rule"></div><div class="title">SALES RECEIPT</div><div class="meta">Receipt #: ${escapeHtml(receiptNumber || 'N/A')}<br>Date: ${escapeHtml(dateLabel)}<br>Payment: ${escapeHtml(sale.paymentOption || sale.paymentMethod || 'Not recorded')}<br>Items: ${lines.length} line(s) · ${units} unit(s)</div></header>
      <div class="rule"></div><table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Total</th></tr></thead><tbody>${receiptItems}</tbody></table>
      <div class="rule"></div><table class="totals"><tr><td>Subtotal</td><td class="right">${escapeHtml(formatMoney(subtotal, currencyFromCode(saleCode)))}</td></tr><tr><td>Discount</td><td class="right">-${escapeHtml(formatMoney(discountAmount, currencyFromCode(saleCode)))}</td></tr><tr class="grand"><td>TOTAL (${escapeHtml(saleCode)})</td><td class="right">${escapeHtml(formatMoney(sale.finalAmount, currencyFromCode(saleCode)))}</td></tr></table>
      ${conversionNote ? `<div class="muted">${escapeHtml(conversionNote)}</div>` : ''}${exchangeNote ? `<div class="muted">${escapeHtml(exchangeNote)}</div>` : ''}
      <div class="rule"></div><div class="thanks center">Thank you for your purchase.</div><div class="footer">${escapeHtml(companyName)}${workspaceDetails.paymentMethod ? `<br>${escapeHtml(workspaceDetails.paymentMethod)}` : ''}<br>Generated by FinanceTracker</div>
    </main></body></html>`;
    try {
      // Width and height are pixels at 72 PPI, requesting a 3 x 5 inch index card by default.
      // Long carts keep one receipt number and may flow onto a second 3 x 5 page if necessary.
      // Android's native print service may still require the printer to support this media size.
      await Print.printAsync({ html: receiptHtml, width: 216, height: 360 });
    } catch (error) {
      Alert.alert('Printing unavailable', userFacingError(error, 'Could not prepare the 3 × 5 inch receipt.'));
    }
  };

  const filteredSales = useMemo(() => sales
    .filter((sale) => inPeriod(sale.timestamp, filterPeriod)
      && `${sale.productName || ''} ${sale.barcode || ''} ${getSaleLineItems(sale).map((line) => `${line.productName || ''} ${line.barcode || ''}`).join(' ')} ${sale.paymentOption || ''} ${sale.paymentMethod || ''} ${sale.id || ''}`.toLowerCase().includes(saleSearch.trim().toLowerCase()))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), [sales, filterPeriod, saleSearch]);
  const { amounts: reportingSalesAmounts, loading: salesConverting, error: salesConversionError } = useReportingAmounts(filteredSales, currency?.code, 'finalAmount');
  const filteredTotalSales = filteredSales.reduce((sum, sale) => sum + (reportingSalesAmounts[sale.id] || 0), 0);
  const productChoices = useMemo(() => products.filter((product) => `${product.name || ''} ${product.barcode || ''} ${product.category || ''}`.toLowerCase().includes(productLookup.trim().toLowerCase())), [products, productLookup]);

  const confirmDeleteSale = (sale) => Alert.alert(
    'Remove sale?',
    `This will remove the ${sale.items?.length || 1}-line sale for ${getSaleDisplayName(sale)}, restore ${getSaleItemCount(sale)} unit(s) to inventory, and remove its linked From Trade income when present.`,
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
          <Text numberOfLines={2} style={[styles.transactionText, { color: palette.text }]} >{getSaleDisplayName(item)} · {getSaleItemCount(item)} unit(s) · {formatMoney(item.finalAmount, currencyFromCode(item.currencyCode || item.currency || currency?.code))}</Text>
          <Text style={[styles.transactionDate, { color: palette.textMuted }]} >{new Date(item.timestamp).toLocaleString()} · {item.paymentOption || item.paymentMethod || 'Payment not recorded'}</Text>
        </View>
        <IconButton icon="printer-outline" accessibilityLabel="Print detailed receipt" onPress={() => handlePrintReceipt(item)} size={21} />
        <IconButton icon="delete-outline" iconColor="#b3261e" accessibilityLabel="Remove sale and restore stock" onPress={() => confirmDeleteSale(item)} size={21} />
      </Card.Content>
    </Card>
  );

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
        <Modal visible={saleFormVisible && !scanning} onDismiss={() => { if (!scanning) closeSaleForm(); }} contentContainerStyle={[styles.modal, { backgroundColor: palette.surface }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeading}><Title style={{ color: palette.text }}>Build sale</Title><IconButton icon="close" onPress={closeSaleForm} accessibilityLabel="Close sale form" /></View>
            <View style={styles.entryRow}>
              <TextInput label="Barcode or exact product name" value={barcode} onChangeText={changeProductInput} style={[styles.input, { flex: 1, backgroundColor: palette.input }]} autoCapitalize="none" autoCorrect={false} />
              <IconButton icon="magnify" size={25} onPress={() => setProductPickerVisible(true)} accessibilityLabel="Browse products" style={styles.entryIcon} />
              <IconButton icon="barcode-scan" size={25} onPress={handleScan} disabled={!productsHydrated} accessibilityLabel="Scan barcode" style={styles.entryIcon} />
            </View>
            {scannedProduct ? (
              <View style={[styles.selectedProduct, { backgroundColor: palette.surfaceAlt }]}><Text style={[styles.selectedProductName, { color: palette.text }]}>{scannedProduct.name}</Text><Text style={[styles.selectedProductMeta, { color: palette.textMuted }]}>Available {Math.max(0, Number(scannedProduct.stock || 0) - cartItems.filter((line) => line.productId === scannedProduct.id).reduce((sum, line) => sum + Number(line.quantity || 0), 0))} · List price {formatMoney(scannedProduct.price, currencyFromCode(scannedProduct.currencyCode || currency?.code))}{scannedProduct.barcode ? ` · ${scannedProduct.barcode}` : ' · No barcode'}</Text></View>
            ) : null}
            <View style={styles.entryRow}>
              <TextInput label="Unit selling price" value={manualPrice} onChangeText={setManualPrice} keyboardType="decimal-pad" style={[styles.input, { flex: 1, backgroundColor: palette.input }]} disabled={!scannedProduct} />
              <View style={styles.priceCurrency}><Text style={[styles.currencyLabel, { color: palette.textMuted }]}>{scannedProduct?.currencyCode || currency?.code || 'UGX'}</Text></View>
            </View>
            <View style={styles.entryRow}>
              <TextInput label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" style={[styles.input, { flex: 0.65, backgroundColor: palette.input }]} />
              <Menu visible={paymentMenuVisible} onDismiss={() => setPaymentMenuVisible(false)} anchor={<Button compact mode="outlined" onPress={() => setPaymentMenuVisible(true)} style={styles.paymentButton} contentStyle={{ minHeight: 48 }}>{paymentOption}</Button>}>
                {['Cash', 'Card', 'Mobile Money', 'Bank Transfer', 'Credit'].map((option) => <Menu.Item key={option} title={option} onPress={() => { setPaymentOption(option); setPaymentMenuVisible(false); }} />)}
              </Menu>
            </View>
            <TextInput label="Discount (%)" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" style={[styles.input, { backgroundColor: palette.input }]} />
            {cartItems.length ? <Text style={[styles.currencyLabel, { color: palette.textMuted, marginBottom: 8 }]}>Currency: {saleCurrencyCode}</Text> : <CurrencyPicker value={saleCurrencyCode} onChange={setSaleCurrencyCode} label="Customer pays in" />}
            <View style={[styles.amountPanel, { backgroundColor: palette.surfaceAlt }]}>
              <Text style={[styles.amountLabel, { color: palette.textMuted }]}>Current item estimate</Text>
              <Text style={[styles.amountValue, { color: palette.text }]}>{amountDue === null ? '—' : formatMoney(amountDue, currencyFromCode(saleCurrencyCode))}</Text>
              {!!amountError && <Text style={[styles.helper, { color: palette.textMuted }]}>{amountError}</Text>}
            </View>
            {manualItemSelected && scannedProduct && <Button mode="outlined" icon="cart-plus" disabled={amountDue === null} onPress={addCurrentItemToCart} style={styles.addCartButton}>Add selected product</Button>}

            <View style={[styles.cartPanel, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
              <View style={styles.cartHeader}><View style={{ flex: 1 }}><Text style={[styles.cartTitle, { color: palette.text }]}>Sale items ({cartItems.length})</Text>{!!cartFeedback && <Text style={[styles.cartFeedback, { color: palette.income }]}>{cartFeedback}</Text>}</View><Text style={[styles.cartCount, { color: palette.textMuted }]}>{cartQuantity} unit(s)</Text></View>
              {cartItems.length ? cartItems.map((line) => (
                <View key={line.cartId} style={[styles.cartRow, { borderBottomColor: palette.border }]}>
                  <View style={styles.cartLineInfo}>
                    <Text numberOfLines={2} style={[styles.cartProduct, { color: palette.text }]}>{line.productName}</Text>
                    <Text style={[styles.cartMeta, { color: palette.textMuted }]}>{line.quantity} × {formatMoney(line.unitPriceOverride, currencyFromCode(line.priceCurrencyCode))}{line.discount > 0 ? ` · ${line.discount}% discount` : ''}</Text>
                  </View>
                  <Text style={[styles.cartLineAmount, { color: palette.text }]}>{formatMoney(line.previewAmount, currencyFromCode(saleCurrencyCode))}</Text>
                  <IconButton icon="close-circle-outline" size={19} onPress={() => removeCartItem(line.cartId)} accessibilityLabel={`Remove ${line.productName} from cart`} />
                </View>
              )) : <Text style={[styles.helper, { color: palette.textMuted }]}>Cart empty.</Text>}
              <View style={[styles.cartTotalRow, { borderTopColor: palette.border }]}><Text style={[styles.cartTitle, { color: palette.text }]}>Total due</Text><Text style={[styles.cartTotal, { color: palette.primaryStrong }]}>{formatMoney(cartTotal, currencyFromCode(saleCurrencyCode))}</Text></View>
              {cartItems.length > 0 && <Button compact mode="text" textColor={palette.danger} onPress={clearCart}>Clear cart</Button>}
            </View>
            <Button mode="contained" icon="check-circle-outline" disabled={!cartItems.length} onPress={handleCompleteSale} style={styles.submitButton}>Complete sale and print one receipt</Button>
            <Button mode="text" onPress={closeSaleForm}>Cancel</Button>
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
            ListEmptyComponent={<Text style={[styles.helper, { color: palette.textMuted }]} >No products found.</Text>}
          />
          <Button onPress={() => setProductPickerVisible(false)}>Close</Button>
        </Modal>
        <Modal
          visible={scanning && isFocused}
          onDismiss={closeSaleScanner}
          contentContainerStyle={[styles.scannerModal, { backgroundColor: palette.surface }]}
        >
          <View style={styles.modalHeading}>
            <Title style={{ color: palette.text }}>Scan barcode</Title>
            <IconButton icon="close" onPress={closeSaleScanner} accessibilityLabel="Close barcode scanner" />
          </View>
          <View style={styles.scannerPreview}>
            {scanning && isFocused ? (
              <BarcodeScannerComponent
                onScanned={queueSalesBarcode}
                continuous
                scanCooldownMs={900}
              />
            ) : null}
          </View>
          <Text style={[styles.scannerFeedback, { color: palette.textMuted }]}>{scannerProcessing ? 'Adding scanned product…' : scannerFeedback}</Text>
          <View style={[styles.scannerCart, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
            <View style={styles.cartHeader}>
              <Text style={[styles.cartTitle, { color: palette.text }]}>Current sale ({cartQuantity} unit(s))</Text>
              <Text style={[styles.cartTotal, { color: palette.primaryStrong }]}>{formatMoney(cartTotal, currencyFromCode(saleCurrencyCode))}</Text>
            </View>
            <ScrollView style={styles.scannerCartList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {cartItems.length ? cartItems.map((line) => (
                <View key={line.cartId} style={[styles.scannerCartRow, { borderBottomColor: palette.border }]}>
                  <View style={styles.cartLineInfo}>
                    <Text numberOfLines={1} style={[styles.cartProduct, { color: palette.text }]}>{line.productName}</Text>
                    <Text style={[styles.cartMeta, { color: palette.textMuted }]}>{formatMoney(line.previewAmount, currencyFromCode(saleCurrencyCode))}</Text>
                  </View>
                  <IconButton icon="minus-circle-outline" size={22} onPress={() => changeCartQuantity(line.cartId, Number(line.quantity || 1) - 1)} accessibilityLabel={`Subtract one ${line.productName}`} />
                  <Text style={[styles.scannerQuantity, { color: palette.text }]}>{line.quantity}</Text>
                  <IconButton icon="plus-circle-outline" size={22} onPress={() => changeCartQuantity(line.cartId, Number(line.quantity || 0) + 1)} accessibilityLabel={`Add one ${line.productName}`} />
                  <IconButton icon="trash-can-outline" size={20} onPress={() => removeCartItem(line.cartId)} accessibilityLabel={`Remove ${line.productName}`} />
                </View>
              )) : <Text style={[styles.helper, { color: palette.textMuted }]}>No products scanned yet.</Text>}
            </ScrollView>
          </View>
          <Button mode="contained" icon="check" disabled={scannerProcessing || scanQueue.length > 0} onPress={closeSaleScanner} style={styles.finishScanButton}>Finish scanning & review sale</Button>
          <Button mode="text" onPress={closeSaleScanner}>Cancel scanning</Button>
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
  modal: { backgroundColor: '#f7f9f6', margin: 12, borderRadius: 20, maxHeight: '94%', overflow: 'hidden' }, modalContent: { padding: 16, paddingBottom: 20 }, modalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }, input: { marginBottom: 8, backgroundColor: '#fff' }, entryIcon: { margin: 0 },
  selectedProduct: { backgroundColor: '#e7f1e8', padding: 10, borderRadius: 10, marginBottom: 10 }, selectedProductName: { color: '#24432b', fontWeight: '800' }, selectedProductMeta: { color: '#5f7163', fontSize: 11, marginTop: 3 }, helper: { color: '#6d796f', fontSize: 11, marginVertical: 5 },
  priceCurrency: { minWidth: 58, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, currencyLabel: { color: '#5f6f63', fontWeight: '700', fontSize: 12 },
  paymentButton: { height: 48, justifyContent: 'center', marginBottom: 8 }, amountPanel: { alignItems: 'center', padding: 12, backgroundColor: '#e8efe8', borderRadius: 12, marginTop: 4 }, amountLabel: { color: '#617165', fontSize: 12 }, amountValue: { color: '#24432b', fontSize: 22, fontWeight: '800', marginTop: 3 }, submitButton: { marginTop: 12, borderRadius: 20 },
  addCartButton: { marginTop: 4, marginBottom: 10, borderRadius: 18 },
  cartPanel: { borderWidth: StyleSheet.hairlineWidth, padding: 10, borderRadius: 13, marginTop: 9 },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  cartTitle: { fontSize: 13, fontWeight: '800' }, cartCount: { fontSize: 10 }, cartFeedback: { fontSize: 10, marginTop: 2 },
  cartRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 5, gap: 4 },
  cartLineInfo: { flex: 1, minWidth: 0 }, cartProduct: { fontSize: 12, fontWeight: '700' }, cartMeta: { fontSize: 10, marginTop: 2 }, cartLineAmount: { fontSize: 11, fontWeight: '700', textAlign: 'right' },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 6, paddingTop: 9 }, cartTotal: { fontSize: 17, fontWeight: '800' },
  pickerModal: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 18, maxHeight: '85%' },
  scannerModal: { margin: 12, padding: 16, borderRadius: 20, maxHeight: '88%' },
  scannerPreview: { height: 250, minHeight: 220, overflow: 'hidden', borderRadius: 14, marginVertical: 8 },
  scannerFeedback: { fontSize: 12, textAlign: 'center', marginBottom: 8, minHeight: 18 },
  scannerCart: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 8, maxHeight: 190 },
  scannerCartList: { maxHeight: 135 },
  scannerCartRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  scannerQuantity: { minWidth: 20, textAlign: 'center', fontWeight: '800' },
  finishScanButton: { marginTop: 10, borderRadius: 20 },
});
