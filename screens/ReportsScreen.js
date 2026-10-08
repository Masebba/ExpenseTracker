// screens/ReportsScreen.js
import React, { useContext, useState, } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions, FlatList, Platform, KeyboardAvoidingView } from 'react-native';
import { Title, Text, Button, Card } from 'react-native-paper';
import * as Print from 'expo-print';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { SalesContext } from '../SalesContext';
import { ProductsContext } from '../ProductsContext';
import { OrdersContext } from '../OrdersContext';
import { CurrencyContext } from '../CurrencyContext';
import { TransactionsContext } from '../TransactionsContext';
import { formatMoney, inPeriod, escapeHtml, CONTENT_MAX_WIDTH, contentWidthStyle } from '../utils/appUtils';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReportsScreen() {
    const { width: windowWidth } = useWindowDimensions();
    const width = Math.min(windowWidth, CONTENT_MAX_WIDTH);
    const { sales } = useContext(SalesContext);
    const { products } = useContext(ProductsContext);
    const { orders } = useContext(OrdersContext);

    const { currency } = useContext(CurrencyContext);
    const { transactions } = useContext(TransactionsContext);
    // log the currency for debugging:

    // Filter state for sales metrics.
    const filterOptions = ['daily', 'weekly', 'monthly', 'yearly'];
    const [filterPeriod, setFilterPeriod] = useState('daily');

    const filteredSales = sales.filter((sale) => inPeriod(sale.timestamp, filterPeriod));
    const currencySales = filteredSales.filter((sale) => !sale.currency || sale.currency === currency?.code);
    const excludedCurrencySales = filteredSales.length - currencySales.length;
    const filteredTotalSales = currencySales.reduce((sum, sale) => sum + Number(sale.finalAmount || 0), 0);

    const filteredBuyingCost = currencySales.reduce((sum, sale) => sum + ((sale.costAtSale ?? products.find(p => p.id === sale.productId)?.buyingPrice ?? 0) * sale.quantity), 0);

    // Profit/Loss: Total Sales minus Total Buying Cost.
    const filteredProfit = filteredTotalSales - filteredBuyingCost;

    // Sales History: count units sold per product (filtered).
    const productSalesCount = {};
    currencySales.forEach(sale => {
        productSalesCount[sale.productId] = (productSalesCount[sale.productId] || 0) + sale.quantity;
    });
    // Prepare data for the BarChart.
    const salesHistoryData = Object.keys(productSalesCount).map(id => {
        const product = products.find(p => p.id === id);
        return { name: product ? product.name : 'Unknown', count: productSalesCount[id] };
    });

    // Best Selling Product.
    const bestSellingProductId = Object.keys(productSalesCount).reduce((best, id) =>
        productSalesCount[id] > (productSalesCount[best] || 0) ? id : best, '');
    const bestSellingProduct = products.find(p => p.id === bestSellingProductId);

    // Top 3 Profit-Making Products (filtered).
    const productProfitMap = {};
    currencySales.forEach(sale => {
        const product = products.find(p => p.id === sale.productId);
        if (product) {
            const profit = sale.finalAmount - (sale.costAtSale ?? product.buyingPrice) * sale.quantity;
            productProfitMap[product.id] = (productProfitMap[product.id] || 0) + profit;
        }
    });
    const topProfitProducts = Object.keys(productProfitMap)
        .map(id => {
            const product = products.find(p => p.id === id);
            return { ...product, profit: productProfitMap[id] };
        })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 3);

    // Low Stock Products: products with stock less than 3.
    const lowStockProducts = products.filter(p => p.stock < 3);

    // Orders Overview: pending orders.
    const pendingOrders = orders.filter(order => order.status === 'Pending');

    // Handler to generate a detailed HTML report.
    const handleDownloadReport = async () => {
        const reportHtml = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h2, h3 { text-align: center; }
          .profit-positive { color: green; }
          .profit-negative { color: red; }
          ul, ol { margin: 0 0 20px 20px; }
        </style>
      </head>
      <body>
        <h2>Detailed Report (${filterPeriod})</h2>
        <p><strong>Total Sales:</strong> ${formatMoney(filteredTotalSales, currency)}</p>
        <p><strong>Total Profit/Loss:</strong> <span class="${filteredProfit >= 0 ? 'profit-positive' : 'profit-negative'}">${formatMoney(filteredProfit, currency)}</span></p>
        <h3>Sales History</h3>
        <ol>
          ${salesHistoryData.map(item => `<li>${escapeHtml(item.name)} - ${item.count} units sold</li>`).join('')}
        </ol>
        <h3>Top 3 Profit-Making Products</h3>
        <ol>
          ${topProfitProducts.map(p => `<li>${escapeHtml(p.name)} - Profit: ${formatMoney(p.profit, currency)}</li>`).join('')}
        </ol>
        <h3>Low Stock Products</h3>
        <ul>
          ${lowStockProducts.map(p => `<li style="color:red;">${escapeHtml(p.name)} (Stock: ${p.stock})</li>`).join('')}
        </ul>
        <h3>Pending Orders Overview</h3>
        <p><strong>Pending Orders:</strong> ${pendingOrders.length}</p>
      </body>
      </html>
    `;
        try {
            await Print.printAsync({ html: reportHtml });
        } catch (error) {
            console.error('Error printing report:', error);
        }
    };

    return (
        <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:'#2f7040'}}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><View style={styles.fixedHeader}><Title style={styles.dashboardTitle}>Dashboard</Title></View><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

            {/* Filters */}
            <View style={styles.filterContainer}>
                {filterOptions.map(period => (
                    <Button
                        key={period}
                        mode={filterPeriod === period ? 'contained' : 'outlined'}
                        onPress={() => setFilterPeriod(period)}
                        style={styles.filterButton}
                        compact
                    >
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                    </Button>
                ))}
            </View>

            {/* Summary Cards */}
            <View style={styles.cardsContainer}>
                <Card style={[styles.summaryCard, { width: (width - 40) / 2 }]}>
                    <Card.Title
                        title="Total Sales"
                        left={() => <MaterialCommunityIcons name="cash" size={24} color="#367f39" />}
                    />
                    <Card.Content>
                        <Text style={styles.statText}>{formatMoney(filteredTotalSales, currency)}</Text>
                        <Text style={styles.metricLabel}>({filterPeriod} · {currency?.code || 'UGX'})</Text>
                        {excludedCurrencySales > 0 && <Text style={styles.metricLabel}>Excludes {excludedCurrencySales} sale{excludedCurrencySales === 1 ? '' : 's'} in another currency.</Text>}
                    </Card.Content>
                </Card>
                <Card style={[styles.summaryCard, { width: (width - 40) / 2 }]}>
                    <Card.Title
                        title="Sales margin"
                        left={() => <MaterialCommunityIcons name="chart-line" size={24} color="#367f39" />}
                    />
                    <Card.Content>
                        <Text style={[styles.statText, { color: filteredProfit >= 0 ? 'green' : 'red' }]}>
                            {formatMoney(filteredProfit, currency)}
                        </Text>
                        <Text style={styles.metricLabel}>({filterPeriod})</Text>
                    </Card.Content>
                </Card>
            </View>

            {/* Sales History Graph */}
            <Card style={styles.graphCard}>
                <Card.Title
                    title="Sales History Graph"
                    left={() => <MaterialCommunityIcons name="chart-bar" size={24} color="#367f39" />}
                />
                <Card.Content>
                    {salesHistoryData.length > 0 ? (
                        <ScrollView horizontal>
                            <BarChart
                                data={{
                                    labels: salesHistoryData.map(item => item.name),
                                    datasets: [{ data: salesHistoryData.map(item => item.count) }],
                                }}
                                width={Math.max(width - 30, salesHistoryData.length * 60)}
                                height={220}
                                fromZero
                                chartConfig={{
                                    backgroundColor: "#fff",
                                    backgroundGradientFrom: "#fff",
                                    backgroundGradientTo: "#fff",
                                    decimalPlaces: 0,
                                    color: (opacity = 1) => `rgba(5, 133, 5, ${opacity})`,
                                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                                    style: { borderRadius: 16 },
                                }}
                                style={{ marginVertical: 8, borderRadius: 16 }}
                            />
                        </ScrollView>
                    ) : (
                        <View style={styles.graphPlaceholder}>
                            <Text style={{ color: '#aaa' }}>[No Sales Data]</Text>
                        </View>
                    )}
                </Card.Content>
            </Card>

            {/* Best Selling Product */}
            <Card style={styles.card}>
                <Card.Title
                    title="Best Selling Product"
                    left={() => <MaterialCommunityIcons name="star" size={24} color="#367f39" />}
                />
                <Card.Content>
                    {bestSellingProduct ? (
                        <Text style={styles.itemText}>
                            {bestSellingProduct.name} ({productSalesCount[bestSellingProduct.id]} units sold)
                        </Text>
                    ) : (
                        <Text style={styles.itemText}>No sales data</Text>
                    )}
                </Card.Content>
            </Card>

            {/* Top 3 Profit-Making Products */}
            <Card style={styles.card}>
                <Card.Title
                    title="Top 3 Profit-Making Products"
                    left={() => <MaterialCommunityIcons name="trophy" size={24} color="#367f39" />}
                />
                <Card.Content>
                    {topProfitProducts.map(p => (
                        <Text key={p.id} style={styles.itemText}>
                            {p.name} - Profit: {formatMoney(p.profit, currency)}
                        </Text>
                    ))}
                </Card.Content>
            </Card>

            {/* Low Stock Products */}
            <Card style={styles.card}>
                <Card.Title
                    title="Low Stock Products"
                    left={() => <MaterialCommunityIcons name="alert" size={24} color="red" />}
                />
                <Card.Content>
                    {lowStockProducts.length > 0 ? (
                        lowStockProducts.map(p => (
                            <Text key={p.id} style={[styles.itemText, { color: 'red' }]}>
                                {p.name} (Stock: {p.stock})
                            </Text>
                        ))
                    ) : (
                        <Text style={styles.itemText}>No low stock products</Text>
                    )}
                </Card.Content>
            </Card>

            {/* Pending Orders Overview */}
            <Card style={styles.card}>
                <Card.Title
                    title="Pending Orders"
                    left={() => <MaterialCommunityIcons name="package-variant" size={24} color="#367f39" />}
                />
                <Card.Content>
                    <Text style={styles.itemText}>Total Pending Orders: {pendingOrders.length}</Text>
                    <FlatList
                        data={pendingOrders}
                        keyExtractor={item => item.id}
                        horizontal
                        renderItem={({ item }) => (
                            <Card style={styles.orderCard}>
                                <Card.Title title={`Order #${item.id}`} subtitle={item.customerName} />
                                <Card.Content>
                                    <Text>Product: {item.productName}</Text>
                                    <Text>Total: {formatMoney(item.total, currency)}</Text>
                                </Card.Content>
                            </Card>
                        )}
                    />
                </Card.Content>
            </Card>

            {/* Detailed Report Button */}
            <Button mode="outlined" style={styles.reportButton} onPress={handleDownloadReport}>
                Generate Detailed Report
            </Button>
        </ScrollView></KeyboardAvoidingView></SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        ...contentWidthStyle,
        padding: 12,
        paddingBottom: 90,
        alignItems: 'stretch',
        backgroundColor: '#f4f6f3',
    },
    fixedHeader: { backgroundColor: '#2f7040', paddingHorizontal: 18, paddingVertical: 10 },
    dashboardTitle: {
        textAlign: 'left',
        marginBottom: 0,
        fontSize: 24,
        color: '#ffffff',
        paddingTop: 0,
    },
    filterContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    filterButton: {
        marginHorizontal: 2,
    },
    cardsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        elevation: 1,
    },
    statText: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 4,
    },
    metricLabel: {
        fontSize: 12,
        color: '#555',
    },
    graphCard: {
        marginBottom: 9,
        backgroundColor: '#fff',
        borderRadius: 12,
        elevation: 1,
        overflow: 'hidden',
    },
    graphPlaceholder: {
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 8,
    },
    card: {
        marginVertical: 4,
        backgroundColor: '#fff',
        borderRadius: 12,
        elevation: 1,
    },
    itemText: {
        fontSize: 14,
        marginVertical: 2,
    },
    orderCard: {
        marginRight: 10,
        width: 200,
    },
    reportButton: {
        marginTop: 30,
        alignSelf: 'center',
        width: '80%',
    },
});
