import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, Share, StyleSheet, View, Platform, KeyboardAvoidingView } from 'react-native';
import { Button, Card, Dialog, Menu, Portal, Text, TextInput, Title } from 'react-native-paper';
import * as Print from 'expo-print';
import { BusinessRecordsContext } from '../BusinessRecordsContext';
import { ProductsContext } from '../ProductsContext';
import { CurrencyContext } from '../CurrencyContext';
import { AuthContext } from '../AuthContext';
import { currencyFromCode, formatMoney, toNumber, contentWidthStyle } from '../utils/appUtils';

const fresh = { name: '', email: '', phone: '', address: '', taxId: '', creditLimit: '' };
const todayIso = () => new Date().toISOString().slice(0, 10);
const htmlEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export default function BusinessRecordsScreen({ route }) {
  const mode = route?.params?.mode || 'customers';
  const { customers, suppliers, invoices, purchases, addCustomer, addSupplier, updateCustomer, updateSupplier, addInvoice, addInvoicePayment, addPurchase, addPurchasePayment } = useContext(BusinessRecordsContext);
  const { products } = useContext(ProductsContext);
  const { currency } = useContext(CurrencyContext);
  const { user, personalDetails, businessProfile, activeWorkspace, memberships } = useContext(AuthContext);
  const [customerForm, setCustomerForm] = useState(fresh);
  const [supplierForm, setSupplierForm] = useState(fresh);
  const [purchaseForm, setPurchaseForm] = useState({ supplierId: '', description: '', amount: '', billNumber: '', dueDate: '' });
  const [invoiceForm, setInvoiceForm] = useState({ customerId: '', customerName:'', customerEmail:'', customerPhone:'', customerAddress:'', customerTaxId:'', issuerName:'', issuerEmail:'', issuerPhone:'', issuerSecondaryPhone:'', issuerAddress:'', issuerCity:'', issuerCountry:'', issuerTaxId:'', issuerRegistrationNumber:'', issuerWebsite:'', issuerContactName:'', issuerContactTitle:'', name: '', quantity: '1', unitPrice: '', taxRate: '0', discount: '0', dueDate: '', paymentLink: '', paymentMethod: '', paymentDetails: '', notes: '' });
  const [issuerWorkspaceId, setIssuerWorkspaceId] = useState(activeWorkspace?.id || 'personal');
  const [lines, setLines] = useState([]);
  const [menu, setMenu] = useState('');
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const matchesSearch = (record, extra = '') => `${record.name || ''} ${record.number || ''} ${record.customerName || ''} ${record.email || ''} ${record.phone || ''} ${record.address || ''} ${extra}`.toLowerCase().includes(search.trim().toLowerCase());
  const money = (amount, code = currency?.code) => formatMoney(amount, currencyFromCode(code || 'UGX'));
  useEffect(() => {
    const details = activeWorkspace?.id !== 'personal' ? (activeWorkspace?.details || {}) : (businessProfile || {});
    const person = personalDetails || {};
    setInvoiceForm((form) => ({ ...form, issuerName: details.legalName || (activeWorkspace?.id === 'personal' ? user?.displayName : activeWorkspace?.name) || form.issuerName, issuerEmail: details.email || user?.email || form.issuerEmail, issuerPhone: details.phone || person.phone || user?.phoneNumber || form.issuerPhone, issuerSecondaryPhone: details.alternatePhone || person.alternatePhone || form.issuerSecondaryPhone, issuerAddress: details.address || person.address || form.issuerAddress, issuerCity: details.city || person.city || form.issuerCity, issuerCountry: details.country || person.country || form.issuerCountry, issuerTaxId: details.taxId || person.taxId || form.issuerTaxId, issuerRegistrationNumber: details.registrationNumber || form.issuerRegistrationNumber, issuerWebsite: details.website || person.website || form.issuerWebsite, issuerContactName: details.contactName || (activeWorkspace?.id === 'personal' ? user?.displayName : '') || form.issuerContactName, issuerContactTitle: details.contactTitle || person.jobTitle || form.issuerContactTitle, paymentMethod: details.paymentMethod || person.paymentMethod || form.paymentMethod, paymentDetails: details.paymentDetails || person.paymentDetails || form.paymentDetails }));
  }, [activeWorkspace?.id, activeWorkspace?.details, businessProfile, personalDetails, user?.displayName, user?.email, user?.phoneNumber]);
  const setInvoiceIssuer = (workspace) => {
    const details = workspace?.id === 'personal' ? { ...(personalDetails || {}), ...(businessProfile || {}) } : (workspace?.details || {});
    setIssuerWorkspaceId(workspace?.id || 'personal');
    setInvoiceForm((form) => ({ ...form, issuerName: details.legalName || (workspace?.id === 'personal' ? user?.displayName : workspace?.name) || '', issuerEmail: details.email || (workspace?.id === 'personal' ? user?.email : '') || '', issuerPhone: details.phone || (workspace?.id === 'personal' ? user?.phoneNumber : '') || '', issuerSecondaryPhone: details.alternatePhone || '', issuerAddress: details.address || '', issuerCity: details.city || '', issuerCountry: details.country || '', issuerTaxId: details.taxId || '', issuerRegistrationNumber: details.registrationNumber || '', issuerWebsite: details.website || '', issuerContactName: details.contactName || (workspace?.id === 'personal' ? user?.displayName : '') || '', issuerContactTitle: details.contactTitle || details.jobTitle || '', paymentMethod: details.paymentMethod || '', paymentDetails: details.paymentDetails || '' }));
    setMenu('');
  };
  const outstandingCustomer = (id) => invoices.filter((invoice) => invoice.customerId === id).reduce((sum, invoice) => sum + Math.max(0, invoice.total - invoice.amountPaid), 0);
  const outstandingSupplier = (id) => purchases.filter((bill) => bill.supplierId === id).reduce((sum, bill) => sum + Math.max(0, bill.amount - bill.amountPaid), 0);
  const save = async (operation, reset) => { setBusy(true); try { await operation(); reset?.(); } catch (error) { Alert.alert('Could not save', error.message || 'Please try again.'); } finally { setBusy(false); } };

  const chooseProduct = (product) => {
    setInvoiceForm((form) => ({ ...form, name: product.name, unitPrice: String(product.price) }));
    setMenu('');
  };
  const addLine = () => {
    const name = invoiceForm.name.trim(); const quantity = toNumber(invoiceForm.quantity, NaN); const unitPrice = toNumber(invoiceForm.unitPrice, NaN);
    if (!name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) { Alert.alert('Check line item', 'Enter a product or service, quantity, and valid unit price.'); return; }
    setLines((items) => [...items, { name, quantity, unitPrice }]);
    setInvoiceForm((form) => ({ ...form, name: '', quantity: '1', unitPrice: '' }));
  };
  const createInvoice = async () => {
    const savedCustomer = customers.find((item) => item.id === invoiceForm.customerId);
    const customer = { ...savedCustomer, name: invoiceForm.customerName, email: invoiceForm.customerEmail, phone: invoiceForm.customerPhone, address: invoiceForm.customerAddress, taxId: invoiceForm.customerTaxId };
    if (!customer.name?.trim()) { Alert.alert('Add customer details', 'Enter the customer name or choose a saved customer.'); return; }
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const taxable = subtotal * (1 - Math.min(100, Math.max(0, toNumber(invoiceForm.discount, 0))) / 100);
    const newBalance = savedCustomer ? outstandingCustomer(savedCustomer.id) + taxable * (1 + Math.max(0, toNumber(invoiceForm.taxRate, 0)) / 100) : 0;
    if (savedCustomer?.creditLimit > 0 && newBalance > savedCustomer.creditLimit) { Alert.alert('Credit limit exceeded', 'This invoice would take the customer above their credit limit.'); return; }
    const issuer = { name: invoiceForm.issuerName, email: invoiceForm.issuerEmail, phone: invoiceForm.issuerPhone, alternatePhone: invoiceForm.issuerSecondaryPhone, address: invoiceForm.issuerAddress, city: invoiceForm.issuerCity, country: invoiceForm.issuerCountry, taxId: invoiceForm.issuerTaxId, registrationNumber: invoiceForm.issuerRegistrationNumber, website: invoiceForm.issuerWebsite, contactName: invoiceForm.issuerContactName, contactTitle: invoiceForm.issuerContactTitle };
    await save(() => addInvoice({ customerId: customer.id, customerName: customer.name, customerEmail: customer.email, customerPhone: customer.phone, customerAddress: customer.address, customerTaxId: customer.taxId, issuer, items: lines, taxRate: invoiceForm.taxRate, discount: invoiceForm.discount, dueDate: invoiceForm.dueDate, paymentLink: invoiceForm.paymentLink, paymentMethod: invoiceForm.paymentMethod, paymentDetails: invoiceForm.paymentDetails, notes: invoiceForm.notes, currency: currency?.code }), () => { setLines([]); setInvoiceForm((form) => ({ ...form, customerId:'', customerName:'', customerEmail:'', customerPhone:'', customerAddress:'', customerTaxId:'', name: '', quantity: '1', unitPrice: '', taxRate: '0', discount: '0', dueDate: '', paymentLink: '', paymentMethod: '', paymentDetails: '', notes: '' })); });
  };
  const recordPayment = async () => {
    if (!paymentTarget) return;
    await save(() => paymentTarget.kind === 'invoice' ? addInvoicePayment(paymentTarget.id, paymentAmount, 'Manual') : addPurchasePayment(paymentTarget.id, paymentAmount, 'Manual'), () => { setPaymentTarget(null); setPaymentAmount(''); });
  };
  const invoiceStatus = (invoice) => invoice.amountPaid >= invoice.total ? 'paid' : invoice.dueDate && invoice.dueDate < todayIso() ? 'overdue' : invoice.amountPaid > 0 ? 'partial' : 'unpaid';
  const shareInvoice = async (invoice, channel) => {
    const message = `${invoice.number} from ${invoice.issuer?.name || 'Your business'}\nBill to: ${invoice.customerName}\nTotal: ${money(invoice.total, invoice.currency)}\nOutstanding: ${money(invoice.total - invoice.amountPaid, invoice.currency)}${invoice.paymentLink ? `\nPay: ${invoice.paymentLink}` : ''}`;
    const encoded = encodeURIComponent(message);
    const url = channel === 'whatsapp' ? `whatsapp://send?text=${encoded}` : `mailto:${encodeURIComponent(invoice.customerEmail || '')}?subject=${encodeURIComponent(`Invoice ${invoice.number}`)}&body=${encoded}`;
    try { await Linking.openURL(url); } catch { await Share.share({ message }); }
  };
  const sharePdf = async (invoice) => {
    const rows = invoice.items.map((item) => `<tr><td>${htmlEscape(item.name)}</td><td>${item.quantity}</td><td>${money(item.unitPrice, invoice.currency)}</td><td>${money(item.quantity * item.unitPrice, invoice.currency)}</td></tr>`).join('');
    const issuer = invoice.issuer || {};
    const issuerLines = [issuer.address, [issuer.city, issuer.country].filter(Boolean).join(', '), [issuer.email, issuer.phone, issuer.alternatePhone].filter(Boolean).join(' · '), issuer.website, issuer.contactName && `${issuer.contactName}${issuer.contactTitle ? ` · ${issuer.contactTitle}` : ''}`, issuer.taxId && `Tax ID: ${issuer.taxId}`, issuer.registrationNumber && `Registration: ${issuer.registrationNumber}`].filter(Boolean).map(htmlEscape).join('<br>');
    const customerLines = [invoice.customerAddress, [invoice.customerEmail, invoice.customerPhone].filter(Boolean).join(' · '), invoice.customerTaxId && `Tax ID: ${invoice.customerTaxId}`].filter(Boolean).map(htmlEscape).join('<br>');
    const html = `<html><body style="font-family:Arial;padding:28px;color:#24392a"><h1>${htmlEscape(issuer.name || 'Invoice')}</h1><p>${issuerLines}</p><hr><h2>Invoice ${htmlEscape(invoice.number)}</h2><p>Bill to: ${htmlEscape(invoice.customerName)}<br>${customerLines}<br>Issued ${htmlEscape(invoice.issueDate.slice(0,10))} · Due ${htmlEscape(invoice.dueDate || 'On receipt')}</p><table style="width:100%;border-collapse:collapse" border="1" cellpadding="8"><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>${rows}</table><p>Subtotal: ${money(invoice.subtotal, invoice.currency)}<br>Discount: ${invoice.discountRate}%<br>Tax: ${money(invoice.tax, invoice.currency)}</p><h2>Total: ${money(invoice.total, invoice.currency)}</h2><p>Paid: ${money(invoice.amountPaid, invoice.currency)} · Balance: ${money(invoice.total-invoice.amountPaid, invoice.currency)}</p><h3>Payment details</h3><p>${htmlEscape(invoice.paymentMethod || 'Method not specified')}<br>${htmlEscape(invoice.paymentDetails || '')}</p><p>${htmlEscape(invoice.notes)}</p></body></html>`;
    try {
      const file = await Print.printToFileAsync({ html });
      try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: invoice.number });
        else Alert.alert('PDF created', `The PDF is saved on this device at:\n${file.uri}`);
      } catch (error) {
        console.warn('Native PDF sharing is unavailable:', error?.message || error);
        Alert.alert('PDF created', `The PDF was created at:\n${file.uri}\n\nSharing needs a rebuilt app version. See the app setup instructions.`);
      }
    } catch (error) { Alert.alert('Could not create invoice PDF', error.message); }
  };

  const customerSection = <>
    <Card style={styles.card}><Card.Title title="New customer" subtitle="Save contact, billing details and credit limit."/><Card.Content>
      {['name','email','phone','address','taxId','creditLimit'].map((key) => <TextInput key={key} label={{ name:'Customer or business name',email:'Email',phone:'Phone',address:'Billing address',taxId:'Tax ID',creditLimit:`Credit limit (${currency?.code || 'UGX'})` }[key]} value={customerForm[key]} onChangeText={(value) => setCustomerForm((form) => ({ ...form, [key]: value }))} keyboardType={key === 'creditLimit' ? 'decimal-pad' : key === 'phone' ? 'phone-pad' : 'default'} style={styles.input}/ >)}
      <Button mode="contained" loading={busy} onPress={() => save(() => editingCustomer ? updateCustomer(editingCustomer, customerForm) : addCustomer(customerForm), () => { setCustomerForm(fresh); setEditingCustomer(null); })}>{editingCustomer ? 'Update customer' : 'Save customer'}</Button>
    </Card.Content></Card>
    {customers.filter((customer) => matchesSearch(customer)).map((customer) => { const balance = outstandingCustomer(customer.id); const history = invoices.filter((item) => item.customerId === customer.id); return <Card key={customer.id} style={styles.card}><Card.Title title={customer.name} subtitle={`${customer.email || customer.phone || 'No contact details'} · ${history.length} invoice(s)`}/><Card.Content><Text>{customer.address || 'No billing address'}{customer.taxId ? ` · Tax ID ${customer.taxId}` : ''}</Text><Text style={styles.balance}>Outstanding {money(balance)} · Credit limit {money(customer.creditLimit)}</Text>{history.map((invoice) => <View key={invoice.id}><Text style={styles.meta}>{invoice.number} · {invoiceStatus(invoice)} · {money(invoice.total-invoice.amountPaid, invoice.currency)} due</Text>{invoice.payments.map((payment)=><Text key={payment.id} style={styles.meta}>Received {money(payment.amount,invoice.currency)} via {payment.method} · {payment.date.slice(0,10)}</Text>)}</View>)}<Button compact onPress={()=>{setEditingCustomer(customer.id);setCustomerForm({name:customer.name,email:customer.email||'',phone:customer.phone||'',address:customer.address||'',taxId:customer.taxId||'',creditLimit:String(customer.creditLimit||0)});}}>Edit profile</Button></Card.Content></Card>; })}
    {!customers.length && <Text style={styles.empty}>Add a customer to start tracking invoices and balances.</Text>}
  </>;

  const supplierSection = <>
    <Card style={styles.card}><Card.Title title="New supplier" subtitle="Save supplier contact and tax details."/><Card.Content>
      {['name','contactName','email','phone','address','taxId'].map((key) => <TextInput key={key} label={{ name:'Supplier or business name',contactName:'Contact person',email:'Email',phone:'Phone',address:'Address',taxId:'Tax ID' }[key]} value={supplierForm[key] || ''} onChangeText={(value) => setSupplierForm((form) => ({ ...form, [key]: value }))} style={styles.input}/>)}
      <Button mode="contained" loading={busy} onPress={() => save(() => editingSupplier ? updateSupplier(editingSupplier,supplierForm) : addSupplier(supplierForm), () => {setSupplierForm(fresh);setEditingSupplier(null);})}>{editingSupplier ? 'Update supplier' : 'Save supplier'}</Button>
    </Card.Content></Card>
    <Card style={styles.card}><Card.Title title="Record bill or purchase"/><Card.Content>
      <Menu visible={menu === 'supplier'} onDismiss={() => setMenu('')} anchor={<Button mode="outlined" onPress={() => setMenu('supplier')}>{suppliers.find((item) => item.id === purchaseForm.supplierId)?.name || 'Choose supplier'}</Button>}>{suppliers.map((supplier) => <Menu.Item key={supplier.id} title={supplier.name} onPress={() => { setPurchaseForm((form) => ({ ...form, supplierId: supplier.id })); setMenu(''); }}/>)}</Menu>
      <TextInput label="Purchase or bill description" value={purchaseForm.description} onChangeText={(value) => setPurchaseForm((form) => ({ ...form, description:value }))} style={styles.input}/><TextInput label={`Amount (${currency?.code || 'UGX'})`} value={purchaseForm.amount} onChangeText={(value) => setPurchaseForm((form) => ({ ...form, amount:value }))} keyboardType="decimal-pad" style={styles.input}/><TextInput label="Supplier bill number" value={purchaseForm.billNumber} onChangeText={(value) => setPurchaseForm((form) => ({ ...form, billNumber:value }))} style={styles.input}/><TextInput label="Due date (YYYY-MM-DD)" value={purchaseForm.dueDate} onChangeText={(value) => setPurchaseForm((form) => ({ ...form, dueDate:value }))} style={styles.input}/>
      <Button mode="contained" loading={busy} onPress={() => { const supplier=suppliers.find((item)=>item.id===purchaseForm.supplierId); save(() => addPurchase({ ...purchaseForm, supplierName:supplier?.name, currency:currency?.code }), () => setPurchaseForm({ supplierId:'', description:'', amount:'', billNumber:'', dueDate:'' })); }}>Save bill</Button>
    </Card.Content></Card>
    {suppliers.filter((supplier) => matchesSearch(supplier)).map((supplier) => <Card key={supplier.id} style={styles.card}><Card.Title title={supplier.name} subtitle={`${supplier.contactName || supplier.email || supplier.phone || 'No contact details'} · balance ${money(outstandingSupplier(supplier.id))}`}/><Card.Content><Text>{supplier.address || 'No address'}{supplier.taxId ? ` · Tax ID ${supplier.taxId}` : ''}</Text><Button compact onPress={()=>{setEditingSupplier(supplier.id);setSupplierForm({name:supplier.name,contactName:supplier.contactName||'',email:supplier.email||'',phone:supplier.phone||'',address:supplier.address||'',taxId:supplier.taxId||''});}}>Edit profile</Button>{purchases.filter((bill) => bill.supplierId===supplier.id).map((bill) => <View key={bill.id} style={styles.listRow}><View style={styles.flex}><Text>{bill.billNumber || bill.description}</Text><Text style={styles.meta}>{bill.status} · outstanding {money(bill.amount-bill.amountPaid,bill.currency)}{bill.dueDate ? ` · due ${bill.dueDate}` : ''}</Text>{bill.payments.map((payment) => <Text key={payment.id} style={styles.meta}>Paid {money(payment.amount,bill.currency)} · {payment.date.slice(0,10)}</Text>)}</View>{bill.amountPaid<bill.amount && <Button compact onPress={() => {setPaymentTarget({id:bill.id,kind:'purchase'});setPaymentAmount('');}}>Pay</Button>}</View>)}</Card.Content></Card>)}
    {!suppliers.length && <Text style={styles.empty}>Add a supplier to record bills and purchase payments.</Text>}
  </>;

  const invoiceSection = <>
    <Card style={styles.card}><Card.Title title="Create invoice" subtitle="Add products or services, tax, discounts, due date and payment link."/><Card.Content>
      <Text style={styles.sectionLabel}>Your details (invoice issuer)</Text>
      <Menu visible={menu==='issuer'} onDismiss={()=>setMenu('')} anchor={<Button mode="outlined" compact onPress={()=>setMenu('issuer')}>{issuerWorkspaceId==='personal'?'Personal business details':memberships.find((item)=>item.id===issuerWorkspaceId)?.name || activeWorkspace?.name || 'Choose registered business'}</Button>}>
        <Menu.Item title="Personal business details" onPress={()=>setInvoiceIssuer({id:'personal'})}/>
        {memberships.filter((item)=>item.status==='active').map((workspace)=><Menu.Item key={workspace.id} title={`${workspace.name} · ${workspace.type==='company'?'Company':'Organisation'}`} onPress={()=>setInvoiceIssuer(workspace)}/>)}
      </Menu>
      {['issuerName','issuerContactName','issuerContactTitle','issuerEmail','issuerPhone','issuerSecondaryPhone','issuerAddress','issuerCity','issuerCountry','issuerTaxId','issuerRegistrationNumber','issuerWebsite'].map((key)=><TextInput key={key} label={{issuerName:'Business or issuer name',issuerContactName:'Contact person',issuerContactTitle:'Contact role',issuerEmail:'Business email',issuerPhone:'Business phone',issuerSecondaryPhone:'Alternate phone',issuerAddress:'Business address',issuerCity:'City or town',issuerCountry:'Country',issuerTaxId:'Tax ID',issuerRegistrationNumber:'Registration number',issuerWebsite:'Website'}[key]} value={invoiceForm[key]} onChangeText={(value)=>setInvoiceForm((form)=>({...form,[key]:value}))} style={styles.input} />)}
      <Text style={styles.sectionLabel}>Customer details</Text>
      <Menu visible={menu==='customer'} onDismiss={()=>setMenu('')} anchor={<Button mode="outlined" compact onPress={()=>setMenu('customer')}>{customers.find((item)=>item.id===invoiceForm.customerId)?.name || 'Choose saved customer (optional)'}</Button>}>{customers.map((customer)=><Menu.Item key={customer.id} title={customer.name} onPress={()=>{setInvoiceForm((form)=>({...form,customerId:customer.id,customerName:customer.name,customerEmail:customer.email||'',customerPhone:customer.phone||'',customerAddress:customer.address||'',customerTaxId:customer.taxId||''}));setMenu('');}}/>)}</Menu>
      {!!invoiceForm.customerId && <Button compact onPress={()=>setInvoiceForm((form)=>({...form,customerId:''}))}>Use manual customer details</Button>}
      {['customerName','customerEmail','customerPhone','customerAddress','customerTaxId'].map((key)=><TextInput key={key} label={{customerName:'Customer name',customerEmail:'Customer email',customerPhone:'Customer phone',customerAddress:'Customer address',customerTaxId:'Customer tax ID'}[key]} value={invoiceForm[key]} onChangeText={(value)=>setInvoiceForm((form)=>({...form,[key]:value}))} style={styles.input} />)}
      <Menu visible={menu==='product'} onDismiss={()=>setMenu('')} anchor={<Button mode="text" onPress={()=>setMenu('product')}>Select saved product</Button>}>{products.map((product)=><Menu.Item key={product.id} title={`${product.name} · ${money(product.price)}`} onPress={()=>chooseProduct(product)}/>)}</Menu>
      <TextInput label="Product or service" value={invoiceForm.name} onChangeText={(value)=>setInvoiceForm((form)=>({...form,name:value}))} style={styles.input}/><View style={styles.inline}><TextInput label="Qty" value={invoiceForm.quantity} onChangeText={(value)=>setInvoiceForm((form)=>({...form,quantity:value}))} keyboardType="decimal-pad" style={[styles.input,styles.half]}/><TextInput label="Unit price" value={invoiceForm.unitPrice} onChangeText={(value)=>setInvoiceForm((form)=>({...form,unitPrice:value}))} keyboardType="decimal-pad" style={[styles.input,styles.half]}/></View><Button mode="outlined" onPress={addLine}>Add line item</Button>
      {lines.map((line,index)=><View key={`${line.name}-${index}`} style={styles.listRow}><Text style={styles.flex}>{line.name} × {line.quantity}</Text><Text>{money(line.quantity*line.unitPrice)}</Text><Button compact onPress={()=>setLines((items)=>items.filter((_,i)=>i!==index))}>Remove</Button></View>)}
      <View style={styles.inline}><TextInput label="Tax %" value={invoiceForm.taxRate} onChangeText={(value)=>setInvoiceForm((form)=>({...form,taxRate:value}))} keyboardType="decimal-pad" style={[styles.input,styles.half]}/><TextInput label="Discount %" value={invoiceForm.discount} onChangeText={(value)=>setInvoiceForm((form)=>({...form,discount:value}))} keyboardType="decimal-pad" style={[styles.input,styles.half]}/></View>
      <TextInput label="Due date (YYYY-MM-DD)" value={invoiceForm.dueDate} onChangeText={(value)=>setInvoiceForm((form)=>({...form,dueDate:value}))} style={styles.input}/><TextInput label="Payment method" placeholder="Mobile Money, bank transfer, cash…" value={invoiceForm.paymentMethod} onChangeText={(value)=>setInvoiceForm((form)=>({...form,paymentMethod:value}))} style={styles.input}/><TextInput label="Payment details" placeholder="Account name, number or instructions" value={invoiceForm.paymentDetails} onChangeText={(value)=>setInvoiceForm((form)=>({...form,paymentDetails:value}))} multiline style={styles.input}/><TextInput label="Payment link (optional)" value={invoiceForm.paymentLink} onChangeText={(value)=>setInvoiceForm((form)=>({...form,paymentLink:value}))} autoCapitalize="none" style={styles.input}/><TextInput label="Notes" value={invoiceForm.notes} onChangeText={(value)=>setInvoiceForm((form)=>({...form,notes:value}))} multiline style={styles.input}/>
      <Text style={styles.balance}>Subtotal {money(lines.reduce((sum,line)=>sum+line.quantity*line.unitPrice,0))}</Text><Button mode="contained" loading={busy} disabled={!lines.length || !invoiceForm.customerName.trim()} onPress={createInvoice}>Create invoice</Button>
    </Card.Content></Card>
    {invoices.filter((invoice) => matchesSearch(invoice, invoice.items.map((item) => item.name).join(' '))).slice().reverse().map((invoice)=>{const status=invoiceStatus(invoice);const balance=invoice.total-invoice.amountPaid;return <Card key={invoice.id} style={styles.card}><Card.Title title={`${invoice.number} · ${invoice.customerName}`} subtitle={`${status.toUpperCase()} · due ${invoice.dueDate || 'on receipt'}`} subtitleStyle={status==='overdue'?styles.overdue:styles.meta}/><Card.Content>{invoice.items.map((item,index)=><Text key={`${item.name}-${index}`}>{item.name} × {item.quantity} · {money(item.quantity*item.unitPrice,invoice.currency)}</Text>)}<Text style={styles.balance}>Total {money(invoice.total,invoice.currency)} · Paid {money(invoice.amountPaid,invoice.currency)} · Balance {money(balance,invoice.currency)}</Text>{invoice.payments.map((payment)=><Text key={payment.id} style={styles.meta}>Payment {money(payment.amount,invoice.currency)} via {payment.method} · {payment.date.slice(0,10)}</Text>)}<View style={styles.actions}><Button compact onPress={()=>sharePdf(invoice)}>PDF</Button><Button compact onPress={()=>shareInvoice(invoice,'whatsapp')}>WhatsApp</Button><Button compact onPress={()=>shareInvoice(invoice,'email')}>Email</Button>{invoice.paymentLink && <Button compact onPress={()=>Linking.openURL(invoice.paymentLink).catch(()=>Alert.alert('Link unavailable','Could not open the payment link.'))}>Pay link</Button>}{balance>0&&<Button compact onPress={()=>{setPaymentTarget({id:invoice.id,kind:'invoice'});setPaymentAmount('');}}>Add payment</Button>}</View></Card.Content></Card>;})}
    {!customers.length&&<Text style={styles.empty}>Create a customer profile before making an invoice.</Text>}
  </>;

  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><View style={styles.searchArea}><TextInput dense label={`Search ${mode === 'customers' ? 'customers' : mode === 'suppliers' ? 'suppliers' : 'invoices'}`} value={search} onChangeText={setSearch} style={styles.search} /></View><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{mode==='customers'?customerSection:mode==='suppliers'?supplierSection:invoiceSection}<Portal><Dialog visible={!!paymentTarget} onDismiss={()=>setPaymentTarget(null)}><Dialog.Title>Record payment</Dialog.Title><Dialog.Content><TextInput label={`Amount (${currency?.code || 'UGX'})`} value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" style={styles.input}/></Dialog.Content><Dialog.Actions><Button onPress={()=>setPaymentTarget(null)}>Cancel</Button><Button onPress={recordPayment}>Save payment</Button></Dialog.Actions></Dialog></Portal></ScrollView></KeyboardAvoidingView>;
}

const styles=StyleSheet.create({searchArea:{paddingHorizontal:18,paddingTop:8,backgroundColor:'#f4f6f3'},search:{backgroundColor:'#fff'},container:{...contentWidthStyle,paddingHorizontal:18,paddingTop:10,paddingBottom:120,backgroundColor:'#f4f6f3'},card:{backgroundColor:'#fff',borderRadius:16,marginBottom:14,elevation:1},input:{backgroundColor:'#f7f9f6',marginVertical:6},sectionLabel:{fontWeight:'700',fontSize:14,color:'#315d3b',marginTop:12,marginBottom:4},balance:{fontWeight:'700',color:'#315d3b',marginTop:10,marginBottom:6},meta:{color:'#6e7a70',fontSize:12,marginTop:4},overdue:{color:'#bd4936',fontWeight:'700'},empty:{textAlign:'center',color:'#6e7a70',padding:24},inline:{flexDirection:'row',gap:10},half:{flex:1},listRow:{flexDirection:'row',alignItems:'center',paddingVertical:8,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:'#dde4dc'},flex:{flex:1},actions:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',marginTop:10}});
