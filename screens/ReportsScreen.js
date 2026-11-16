import React, { useContext, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions, FlatList, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import { Title, Text, Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { SalesContext } from '../SalesContext';
import { ProductsContext } from '../ProductsContext';
import { OrdersContext } from '../OrdersContext';
import { CurrencyContext } from '../CurrencyContext';
import { TransactionsContext } from '../TransactionsContext';
import { formatMoney, inPeriod, escapeHtml, CONTENT_MAX_WIDTH, contentWidthStyle } from '../utils/appUtils';
import { SafeAreaView } from 'react-native-safe-area-context';
import useReportingAmounts from '../hooks/useReportingAmounts';
import CompactFilterMenu from '../components/CompactFilterMenu';
import { shareExcelXmlWorkbook } from '../utils/excelExport';
import { ThemeContext } from '../ThemeContext';

const PERIOD_FILTERS = [
  { label: 'Today', value: 'daily' },
  { label: 'This week', value: 'weekly' },
  { label: 'This month', value: 'monthly' },
  { label: 'This year', value: 'yearly' },
];
const dateValue = (value) => value ? new Date(value).toLocaleString() : '';
const safeName = (value) => String(value || '').trim() || 'Unknown';

export default function ReportsScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, CONTENT_MAX_WIDTH);
  const { sales = [] } = useContext(SalesContext);
  const { products = [] } = useContext(ProductsContext);
  const { orders = [] } = useContext(OrdersContext);
  const { currency, detectedCurrency } = useContext(CurrencyContext);
  const { transactions = [] } = useContext(TransactionsContext);
  const { palette, isDark } = useContext(ThemeContext);
  const [filterPeriod, setFilterPeriod] = useState('daily');
  const [exporting, setExporting] = useState(false);

  const filteredSales = useMemo(() => sales.filter((sale) => inPeriod(sale.timestamp, filterPeriod)), [sales, filterPeriod]);
  const { amounts: salesInBase, loading: salesConverting, error: salesConversionError, staleRateIds: staleSalesRateIds } = useReportingAmounts(filteredSales, currency?.code, 'finalAmount');
  const saleCostRecords = useMemo(() => filteredSales.map((sale) => ({
    ...sale,
    amount: sale.costAtSaleBaseAmount ?? (sale.costAtSale ?? products.find((product) => product.id === sale.productId)?.buyingPrice ?? 0) * sale.quantity,
    baseAmount: sale.costAtSaleBaseAmount,
    baseCurrencyCode: sale.baseCurrencyCode,
    currencyCode: sale.costCurrencyCode || sale.currencyCode || sale.currency || detectedCurrency?.code,
  })), [filteredSales, products, detectedCurrency?.code]);
  const { amounts: costsInBase, loading: costsConverting, error: costConversionError, staleRateIds: staleCostRateIds } = useReportingAmounts(saleCostRecords, currency?.code, 'amount');

  const filteredTotalSales = filteredSales.reduce((sum, sale) => sum + (salesInBase[sale.id] || 0), 0);
  const costInBase = (sale) => costsInBase[sale.id] || 0;
  const filteredBuyingCost = filteredSales.reduce((sum, sale) => sum + costInBase(sale), 0);
  const salesReportAvailable = !salesConverting && !costsConverting && !salesConversionError && !costConversionError;
  const hasRecordedStaleRate = filteredSales.some((sale) => sale.exchangeRateStale || sale.priceExchangeRateStale)
    || saleCostRecords.some((sale) => sale.exchangeRateStale)
    || transactions.some((item) => item.exchangeRateStale);
  const reportUsesStaleRates = salesReportAvailable && (staleSalesRateIds.length > 0 || staleCostRateIds.length > 0 || hasRecordedStaleRate);
  const filteredProfit = filteredTotalSales - filteredBuyingCost;

  const productSalesCount = {};
  filteredSales.forEach((sale) => {
    const key = sale.productId || sale.productName || 'unknown';
    productSalesCount[key] = (productSalesCount[key] || 0) + Number(sale.quantity || 0);
  });
  const salesHistoryData = Object.keys(productSalesCount).map((id) => {
    const sale = filteredSales.find((item) => (item.productId || item.productName || 'unknown') === id);
    const product = products.find((item) => item.id === id);
    return { id, name: safeName(product?.name || sale?.productName), count: productSalesCount[id] };
  }).sort((a, b) => b.count - a.count);

  const bestSellingProductId = Object.keys(productSalesCount).reduce((best, id) => productSalesCount[id] > (productSalesCount[best] || 0) ? id : best, '');
  const bestSellingProduct = salesHistoryData.find((item) => item.id === bestSellingProductId);
  const productProfitMap = {};
  filteredSales.forEach((sale) => {
    const key = sale.productId || sale.productName || 'unknown';
    const product = products.find((item) => item.id === key);
    const profit = (salesInBase[sale.id] || 0) - costInBase(sale);
    if (!productProfitMap[key]) productProfitMap[key] = { id: key, name: sale.productName || product?.name || 'Unknown', profit: 0 };
    productProfitMap[key].profit += profit;
  });
  const topProfitProducts = Object.values(productProfitMap).sort((a, b) => b.profit - a.profit).slice(0, 3);
  const lowStockProducts = products.filter((product) => Number(product.stock) < 3);
  const pendingOrders = orders.filter((order) => order.status === 'Pending');
  const chartWidth = Math.max(width - 32, salesHistoryData.length * 72 + 28);
  const chartHeight = 228;
  const trackHeight = 162;
  const baseline = 188;
  const maxCount = Math.max(1, ...salesHistoryData.map((item) => item.count));
  const barWidth = 42;
  const barGap = 30;

  const handleDownloadReport = async () => {
    // Always export the underlying records, even when a live currency conversion is unavailable.
    // Summary totals are marked unavailable in that case rather than blocking the workbook.
    setExporting(true);
    try {
      const reportCurrency = currency?.code || detectedCurrency?.code || 'UGX';
      const salesRows = filteredSales.map((sale) => {
        const product = products.find((item) => item.id === sale.productId);
        return [
          dateValue(sale.timestamp), sale.id, sale.productId || '', sale.productName || product?.name || '', sale.productCategory || product?.category || '', sale.barcode || product?.barcode || '',
          Number(sale.quantity || 0), Number(sale.originalPrice || product?.price || 0), Number(sale.saleUnitPrice ?? sale.originalPrice ?? product?.price ?? 0),
          sale.priceCurrencyCode || product?.currencyCode || '', Number(sale.discount || 0), Number(sale.finalAmount || 0), sale.currencyCode || sale.currency || '',
          sale.priceExchangeRate ?? '', dateValue(sale.priceExchangeRateTimestamp), sale.priceExchangeRateStale ? 'Yes' : 'No',
          Number(sale.baseAmount || 0), sale.baseCurrencyCode || '', sale.paymentOption || sale.paymentMethod || '', sale.exchangeRate ?? '',
          dateValue(sale.exchangeRateTimestamp), sale.exchangeRateStale ? 'Yes' : 'No',
        ];
      });
      const transactionRows = [...transactions]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map((item) => [dateValue(item.timestamp), item.type, item.id, item.description || '', item.category || '', Number(item.amount || 0), item.currencyCode || item.currency || '', Number(item.baseAmount || 0), item.baseCurrencyCode || '', item.sourceType || 'Manual', item.sourceId || '', item.exchangeRate ?? '', dateValue(item.exchangeRateTimestamp), item.exchangeRateStale ? 'Yes' : 'No']);
      const inventoryRows = products.map((product) => [product.id, product.name || '', product.barcode || '', product.category || '', Number(product.stock || 0), Number(product.buyingPrice || 0), Number(product.price || 0), product.currencyCode || '', dateValue(product.updatedAt || product.createdAt)]);
      const orderRows = orders.map((order) => {
        const paid = (order.installments || []).reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
        return [order.id, dateValue(order.createdAt || order.timestamp), order.customerName || '', order.customerPhone || '', order.productName || '', Number(order.total || 0), Number(paid), Math.max(0, Number(order.total || 0) - paid), order.currencyCode || '', order.status || '', (order.installments || []).length];
      });
      const summaryRows = [
        ['Report generated', new Date().toLocaleString(), ''],
        ['Selected period', PERIOD_FILTERS.find((item) => item.value === filterPeriod)?.label || filterPeriod, ''],
        ['Reporting currency', reportCurrency, ''],
        ['Recorded sales in period', filteredSales.length, 'transactions'],
        ['Total sales', salesReportAvailable ? Number(filteredTotalSales.toFixed(2)) : 'Unavailable', reportCurrency],
        ['Estimated cost of goods sold', salesReportAvailable ? Number(filteredBuyingCost.toFixed(2)) : 'Unavailable', reportCurrency],
        ['Sales margin before other expenses', salesReportAvailable ? Number(filteredProfit.toFixed(2)) : 'Unavailable', reportCurrency],
        ['Products in inventory', products.length, 'products'],
        ['Low-stock products', lowStockProducts.length, 'products'],
        ['Pending orders', pendingOrders.length, 'orders'],
        ['Exchange-rate note', !salesReportAvailable ? 'Live conversion was unavailable at export time. Raw amounts and saved base values are included in the detail sheets; summary totals above are unavailable.' : reportUsesStaleRates ? 'At least one value uses a cached offline rate. Treat as an estimate.' : 'Converted amounts use saved base values where available and the current available rate where conversion is needed.', ''],
        ['Data scope note', 'Trade sales and ledger records are device-local in this release. Sales and Sales by Product sheets use the selected period; Income and Expenses, Inventory, and Orders contain all locally available records. Trade sales create linked From Trade income entries in the active workspace ledger.', ''],
      ];
      const productRows = salesHistoryData.map((item) => [item.name, item.count, reportCurrency]);
      const sheets = [
        { name: 'Summary', headers: ['Metric', 'Value', 'Units / Notes'], rows: summaryRows },
        { name: 'Sales', headers: ['Date', 'Sale ID', 'Product ID', 'Product', 'Product Category', 'Barcode / SKU', 'Quantity', 'Listed Unit Price', 'Actual Unit Price', 'Price Currency', 'Discount %', 'Sale Total', 'Sale Currency', 'Price-to-Sale FX Rate', 'Price FX Rate Updated', 'Price FX Stale', 'Base Amount', 'Base Currency', 'Payment Method', 'Sale-to-Base FX Rate', 'Base FX Rate Updated', 'Base FX Stale'], rows: salesRows },
        { name: 'Sales by Product', headers: ['Product', 'Units Sold', 'Report Currency'], rows: productRows },
        { name: 'Income and Expenses', headers: ['Date', 'Type', 'Transaction ID', 'Description', 'Category', 'Amount', 'Currency', 'Base Amount', 'Base Currency', 'Source', 'Source ID', 'Exchange Rate', 'Rate Updated', 'Stale Rate'], rows: transactionRows },
        { name: 'Inventory', headers: ['Product ID', 'Product', 'Barcode / SKU', 'Category', 'Stock', 'Buying Price', 'Selling Price', 'Currency', 'Last Updated'], rows: inventoryRows },
        { name: 'Orders', headers: ['Order ID', 'Date', 'Customer', 'Phone', 'Product', 'Order Total', 'Paid', 'Balance', 'Currency', 'Status', 'Installments'], rows: orderRows },
      ];
      await shareExcelXmlWorkbook({ filename: `FinanceTracker-${filterPeriod}-${new Date().toISOString().slice(0, 10)}`, sheets, dialogTitle: 'Share detailed Excel report' });
    } catch (error) {
      Alert.alert('Could not export report', `${error?.message || 'The Excel report could not be created.'}\n\nCheck that the app has a working storage and sharing service, then try again.`);
    } finally { setExporting(false); }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: palette.header }]} >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.fixedHeader, { backgroundColor: palette.header }]} ><Title style={[styles.dashboardTitle, { color: palette.headerText }]}>Reports</Title><CompactFilterMenu value={filterPeriod} onChange={setFilterPeriod} label="Period" options={PERIOD_FILTERS} /></View>
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: palette.background }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={[styles.metricLabel, { color: palette.textMuted }]}>Amounts are shown in {currency?.code || 'UGX'}. Historical totals may change when an updated exchange rate is used. {reportUsesStaleRates ? 'A cached offline rate is being used for one or more values, so those amounts are estimates.' : ''}</Text>
          <View style={styles.cardsContainer}>
            <Card style={[styles.summaryCard, { width: (width - 40) / 2, backgroundColor: palette.surface }]}><Card.Title title="Total Sales" left={() => <MaterialCommunityIcons name="cash" size={24} color="#367f39" />} /><Card.Content>
              <Text style={[styles.statText, { color: palette.text }]} >{salesReportAvailable ? formatMoney(filteredTotalSales, currency) : '—'}</Text><Text style={[styles.metricLabel, { color: palette.textMuted }]} >({PERIOD_FILTERS.find((item) => item.value === filterPeriod)?.label} · {currency?.code || 'UGX'})</Text>
              {salesConverting && <Text style={[styles.metricLabel, { color: palette.textMuted }]} >Converting sales…</Text>}{!!salesConversionError && <Text style={[styles.metricLabel, { color: palette.textMuted }]} >{salesConversionError}</Text>}
            </Card.Content></Card>
            <Card style={[styles.summaryCard, { width: (width - 40) / 2, backgroundColor: palette.surface }]}><Card.Title title="Sales margin" left={() => <MaterialCommunityIcons name="chart-line" size={24} color="#367f39" />} /><Card.Content>
              <Text style={[styles.statText, { color: filteredProfit >= 0 ? palette.income : palette.danger }]}>{salesReportAvailable ? formatMoney(filteredProfit, currency) : '—'}</Text><Text style={[styles.metricLabel, { color: palette.textMuted }]} >Sales less recorded product cost</Text>
              {!!costConversionError && <Text style={[styles.metricLabel, { color: palette.textMuted }]} >{costConversionError}</Text>}
            </Card.Content></Card>
          </View>

          <Card style={[styles.graphCard, { backgroundColor: palette.surface }]}><Card.Title title="Sales History Graph" subtitle="Units sold by product" left={() => <MaterialCommunityIcons name="chart-bar" size={24} color="#367f39" />} /><Card.Content>
            {salesHistoryData.length ? <ScrollView horizontal showsHorizontalScrollIndicator>
              <Svg width={chartWidth} height={chartHeight}>
                <Line x1="16" y1={baseline} x2={chartWidth - 8} y2={baseline} stroke={palette.border} strokeWidth="1" />
                {salesHistoryData.map((item, index) => {
                  const x = 24 + index * (barWidth + barGap);
                  const actualHeight = Math.max(4, (Number(item.count) / maxCount) * trackHeight);
                  const cx = x + barWidth / 2;
                  const cy = baseline - trackHeight / 2;
                  const label = item.name.length > 22 ? `${item.name.slice(0, 19)}…` : item.name;
                  return <React.Fragment key={item.id}>
                    <Rect x={x} y={baseline - trackHeight} width={barWidth} height={trackHeight} rx={5} fill={palette.surfaceAlt} />
                    <Rect x={x} y={baseline - actualHeight} width={barWidth} height={actualHeight} rx={5} fill={palette.primary} />
                    <SvgText x={cx} y={baseline - actualHeight - 5} fontSize="11" fontWeight="700" fill={palette.text} textAnchor="middle">{item.count}</SvgText>
                    <SvgText x={cx} y={cy} transform={`rotate(-90 ${cx} ${cy})`} fontSize="10" fontWeight="700" fill="#ffffff" stroke={palette.primaryStrong} strokeWidth="1.6" textAnchor="middle">{label}</SvgText>
                  </React.Fragment>;
                })}
              </Svg>
            </ScrollView> : <View style={styles.graphPlaceholder}><Text style={{ color: palette.textMuted }}>No sales data for this period.</Text></View>}
          </Card.Content></Card>

          <Card style={[styles.card, { backgroundColor: palette.surface }]}><Card.Title title="Best Selling Product" left={() => <MaterialCommunityIcons name="star" size={24} color="#367f39" />} /><Card.Content>
            <Text style={[styles.itemText, { color: palette.text }]} >{bestSellingProduct ? `${bestSellingProduct.name} (${bestSellingProduct.count} units sold)` : 'No sales data'}</Text>
          </Card.Content></Card>

          <Card style={[styles.card, { backgroundColor: palette.surface }]}><Card.Title title="Top 3 Profit-Making Products" left={() => <MaterialCommunityIcons name="trophy" size={24} color="#367f39" />} /><Card.Content>
            {salesReportAvailable && topProfitProducts.length ? topProfitProducts.map((product) => <Text key={product.id} style={[styles.itemText, { color: palette.text }]} >{product.name} · {formatMoney(product.profit, currency)}</Text>) : <Text style={[styles.itemText, { color: palette.text }]} >{salesReportAvailable ? 'No product profit data yet.' : 'Waiting for reporting conversion.'}</Text>}
          </Card.Content></Card>

          <Card style={[styles.card, { backgroundColor: palette.surface }]}><Card.Title title="Low Stock Products" left={() => <MaterialCommunityIcons name="alert" size={24} color="#b3261e" />} /><Card.Content>
            {lowStockProducts.length ? lowStockProducts.map((product) => <Text key={product.id} style={[styles.itemText, { color: palette.danger }]}>{product.name} (Stock: {product.stock})</Text>) : <Text style={[styles.itemText, { color: palette.text }]} >No low-stock products.</Text>}
          </Card.Content></Card>

          <Card style={[styles.card, { backgroundColor: palette.surface }]}><Card.Title title="Pending Orders" left={() => <MaterialCommunityIcons name="package-variant" size={24} color="#367f39" />} /><Card.Content>
            <Text style={[styles.itemText, { color: palette.text }]} >Total pending orders: {pendingOrders.length}</Text>
            <FlatList data={pendingOrders} keyExtractor={(item) => item.id} horizontal nestedScrollEnabled renderItem={({ item }) => <Card style={[styles.orderCard, { backgroundColor: palette.surfaceAlt }]}><Card.Title title={`Order #${item.id}`} subtitle={item.customerName} /><Card.Content><Text style={{ color: palette.text }}>Product: {item.productName}</Text><Text style={{ color: palette.text }}>Total: {formatMoney(item.total, { code: item.currencyCode || detectedCurrency?.code || currency?.code })}</Text></Card.Content></Card>} />
          </Card.Content></Card>

          <Card style={[styles.exportCard, { backgroundColor: palette.surface }]}><Card.Content>
            <Text style={[styles.exportTitle, { color: palette.text }]}>Detailed analysis workbook</Text><Text style={[styles.exportHelp, { color: palette.textMuted }]}>Creates an Excel-compatible workbook with separate Summary, Sales, Sales by Product, Income and Expenses, Inventory, and Orders sheets. Trade sales appear in Income and Expenses as linked From Trade entries in the active workspace.</Text>
            <Button icon="file-excel" mode="contained" loading={exporting} disabled={exporting} onPress={handleDownloadReport}>Generate Excel report</Button>
          </Card.Content></Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2f7040' },
  container: { ...contentWidthStyle, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16, alignItems: 'stretch', backgroundColor: '#f4f6f3' },
  fixedHeader: { backgroundColor: '#2f7040', paddingHorizontal: 14, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dashboardTitle: { fontSize: 22, color: '#ffffff', marginBottom: 0 },
  metricLabel: { fontSize: 11, color: '#626e65', lineHeight: 16 },
  cardsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8, gap: 8 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 12, elevation: 1 }, statText: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  graphCard: { marginBottom: 8, backgroundColor: '#fff', borderRadius: 12, elevation: 1, overflow: 'hidden' },
  graphPlaceholder: { height: 165, justifyContent: 'center', alignItems: 'center', borderColor: '#ddd', borderWidth: 1, borderRadius: 8 },
  card: { marginVertical: 4, backgroundColor: '#fff', borderRadius: 12, elevation: 1 }, itemText: { fontSize: 13, marginVertical: 2, color: '#37473a' },
  orderCard: { marginRight: 10, width: 200, backgroundColor: '#fafcf9' },
  exportCard: { marginTop: 8, marginBottom: 5, borderRadius: 12, backgroundColor: '#fff', elevation: 1 }, exportTitle: { color: '#24432b', fontWeight: '800', fontSize: 16, marginBottom: 4 }, exportHelp: { fontSize: 11, color: '#68756b', lineHeight: 17, marginBottom: 10 },
});
