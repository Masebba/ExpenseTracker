import React, { useContext, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Title, Text, Card, Button, TextInput, Modal, Portal } from 'react-native-paper';
import { CurrencyContext } from '../CurrencyContext';
import { OrdersContext } from '../OrdersContext';
import { currencyFromCode, formatMoney } from '../utils/appUtils';
import CurrencyPicker from '../components/CurrencyPicker';

export default function OrdersScreen() {
  const { currency, detectedCurrency } = useContext(CurrencyContext);
  const { orders, addOrder, updateOrder, deleteOrder, addInstallment } = useContext(OrdersContext);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [installmentModalVisible, setInstallmentModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productName, setProductName] = useState('');
  const [total, setTotal] = useState('');
  const [orderCurrencyCode, setOrderCurrencyCode] = useState(currency?.code || 'UGX');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const resetOrderForm = () => { setCustomerName(''); setCustomerPhone(''); setProductName(''); setTotal(''); setOrderCurrencyCode(currency?.code || 'UGX'); setEditingOrder(null); };

  const handleSaveOrder = async () => {
    try {
      if (editingOrder) await updateOrder(editingOrder.id, { customerName: customerName.trim(), customerPhone: customerPhone.trim(), productName: productName.trim(), total: Number(total), currencyCode: orderCurrencyCode });
      else await addOrder({ customerName, customerPhone, productName, total, currencyCode: orderCurrencyCode });
      resetOrderForm(); setOrderModalVisible(false);
    } catch (error) { Alert.alert('Unable to save order', error.message); }
  };

  const handleAddInstallment = async () => {
    if (!editingOrder) return;
    try {
      await addInstallment(editingOrder.id, installmentAmount);
      setInstallmentAmount(''); setEditingOrder(null); setInstallmentModalVisible(false);
    } catch (error) { Alert.alert('Unable to add installment', error.message); }
  };

  const renderOrder = ({ item }) => {
    const paid = (item.installments || []).reduce((sum, inst) => sum + Number(inst.amount || 0), 0);
    const balance = Math.max(0, item.total - paid);
    return <Card style={styles.card}>
      <Card.Title title={`Order #${item.id}`} subtitle={`Status: ${item.status}`} subtitleStyle={item.status === 'Completed' ? styles.statusCompleted : styles.statusPending} />
      <Card.Content>
        <Text>Customer: {item.customerName}</Text>
        <Text>Phone: {item.customerPhone || 'Not provided'}</Text>
        <Text>Product: {item.productName}</Text>
        <Text>Total: {formatMoney(item.total, currencyFromCode(item.currencyCode || detectedCurrency?.code || currency?.code))}</Text>
        <Text>Paid: {formatMoney(paid, currencyFromCode(item.currencyCode || detectedCurrency?.code || currency?.code))}</Text>
        <Text>Balance: {formatMoney(balance, currencyFromCode(item.currencyCode || detectedCurrency?.code || currency?.code))}</Text>
        {!!item.installments?.length && <View style={styles.installmentsContainer}><Text>Installments:</Text>{item.installments.map((inst) => <Text key={inst.id || inst.date}>- {formatMoney(inst.amount, currencyFromCode(inst.currencyCode || item.currencyCode || detectedCurrency?.code || currency?.code))} on {new Date(inst.date).toLocaleString()}</Text>)}</View>}
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => { setEditingOrder(item); setOrderCurrencyCode(item.currencyCode || currency?.code || 'UGX'); setCustomerName(item.customerName); setCustomerPhone(item.customerPhone || ''); setProductName(item.productName); setTotal(String(item.total)); setOrderModalVisible(true); }}>Edit</Button>
        <Button onPress={() => Alert.alert('Delete order', 'Are you sure you want to delete this order?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteOrder(item.id) }])}>Delete</Button>
        {balance > 0 && <Button onPress={() => { setEditingOrder(item); setInstallmentModalVisible(true); }}>Add Installment</Button>}
      </Card.Actions>
    </Card>;
  };

  return <View style={styles.container}>
    <Title>Order Management</Title>
    <Button mode="contained" onPress={() => { resetOrderForm(); setOrderModalVisible(true); }} style={styles.button}>Add Order (Installments)</Button>
    <TextInput label="Search customer, phone or product" value={search} onChangeText={setSearch} style={styles.input} />
    <View style={styles.filters}>{['All','Pending','Completed'].map((status) => <Button key={status} compact mode={statusFilter===status?'contained':'outlined'} onPress={() => setStatusFilter(status)}>{status}</Button>)}</View>
    {orders.length ? <FlatList data={orders.filter((order) => (statusFilter==='All' || order.status===statusFilter) && `${order.customerName} ${order.customerPhone} ${order.productName}`.toLowerCase().includes(search.trim().toLowerCase()))} keyExtractor={(item) => item.id} renderItem={renderOrder} /> : <Text style={styles.empty}>No orders recorded yet.</Text>}
    <Portal>
      <Modal visible={orderModalVisible} onDismiss={() => { setOrderModalVisible(false); resetOrderForm(); }} contentContainerStyle={styles.modal}>
        <Title>{editingOrder ? 'Edit Order' : 'Add Order'}</Title>
        <TextInput label="Customer Name" value={customerName} onChangeText={setCustomerName} style={styles.input} />
        <TextInput label="Customer Phone" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" style={styles.input} />
        <TextInput label="Product Name" value={productName} onChangeText={setProductName} style={styles.input} />
        <CurrencyPicker value={orderCurrencyCode} onChange={setOrderCurrencyCode} label="Order currency" />
        <TextInput label={`Total (${orderCurrencyCode})`} value={total} onChangeText={setTotal} keyboardType="numeric" style={styles.input} />
        <Button mode="contained" onPress={handleSaveOrder} style={styles.button}>{editingOrder ? 'Update Order' : 'Add Order'}</Button>
        <Button onPress={() => { setOrderModalVisible(false); resetOrderForm(); }}>Cancel</Button>
      </Modal>
      <Modal visible={installmentModalVisible} onDismiss={() => { setInstallmentModalVisible(false); setInstallmentAmount(''); setEditingOrder(null); }} contentContainerStyle={styles.modal}>
        <Title>Add Installment</Title>
        <TextInput label={`Installment Amount (${editingOrder?.currencyCode || detectedCurrency?.code || currency.code})`} value={installmentAmount} onChangeText={setInstallmentAmount} keyboardType="numeric" style={styles.input} />
        <Button mode="contained" onPress={handleAddInstallment} style={styles.button}>Add Installment</Button>
        <Button onPress={() => { setInstallmentModalVisible(false); setInstallmentAmount(''); setEditingOrder(null); }}>Cancel</Button>
      </Modal>
    </Portal>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 112, backgroundColor: '#f4f6f3' },
  filters:{flexDirection:'row',gap:4,marginBottom:6},
  card: { marginVertical: 6, backgroundColor: '#fff', borderRadius: 16, elevation: 1 },
  button: { marginVertical: 5, borderRadius: 24 },
  input: { marginBottom: 10, backgroundColor: '#fff' },
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 20 },
  installmentsContainer: { marginTop: 10 },
  statusCompleted: { color: 'green', fontWeight: 'bold' },
  statusPending: { color: 'red', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 30 },
});
