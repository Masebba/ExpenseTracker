import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { AppFeaturesContext } from './AppFeaturesContext';
import { makeId, nowIso, toNumber } from './utils/appUtils';
import usePersistedState from './utils/usePersistedState';
import { deleteRecord, subscribeToCollection, writeRecord } from './services/cloudSync';
import { CurrencyContext } from './CurrencyContext';
import { convertAmount } from './services/currencyConversion';
import { currencyFromCode } from './utils/appUtils';

export const BusinessRecordsContext = createContext();

export function BusinessRecordsProvider({ children }) {
  const { user, activeWorkspace, storageRevision } = useContext(AuthContext);
  const { currency } = useContext(CurrencyContext);
  const { cloudSyncRevision } = useContext(AppFeaturesContext);
  const workspaceId = activeWorkspace?.id || 'personal';
  const scope = `${user?.uid || 'guest'}.${workspaceId}`;
  const [customers, setCustomers] = usePersistedState(`expenseTracker.${scope}.customers`, [], storageRevision);
  const [suppliers, setSuppliers] = usePersistedState(`expenseTracker.${scope}.suppliers`, [], storageRevision);
  const [invoices, setInvoices] = usePersistedState(`expenseTracker.${scope}.invoices`, [], storageRevision);
  const [purchases, setPurchases] = usePersistedState(`expenseTracker.${scope}.purchases`, [], storageRevision);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const streams = [
      ['customers', setCustomers], ['suppliers', setSuppliers], ['invoices', setInvoices], ['purchases', setPurchases],
    ].map(([name, setter]) => subscribeToCollection(user.uid, name, (records) => setter(records), (error) => console.warn(`${name} cloud listener failed:`, error?.message || error), workspaceId));
    return () => streams.forEach((unsubscribe) => unsubscribe());
  }, [user?.uid, workspaceId, cloudSyncRevision, setCustomers, setSuppliers, setInvoices, setPurchases]);

  const applyLocal = useCallback(async (setter, updater, message = 'Business record could not be saved to this device.') => {
    if (!await setter(updater)) throw new Error(message);
  }, []);

  const saveRecord = useCallback(async (name, record) => {
    const next = { ...record, updatedAt: nowIso() };
    if (user?.uid) await writeRecord(user.uid, name, next, workspaceId);
    return next;
  }, [user?.uid, workspaceId]);
  const deleteBusinessRecord = useCallback(async (name, id) => {
    const setters = { customers: setCustomers, suppliers: setSuppliers, invoices: setInvoices, purchases: setPurchases };
    const setter = setters[name];
    if (!setter) throw new Error('Unknown business record type.');
    if (user?.uid) await deleteRecord(user.uid, name, id, workspaceId);
    await applyLocal(setter, (items) => items.filter((item) => item.id !== id), 'Business record deletion could not be saved to this device.');
  }, [user?.uid, workspaceId, setCustomers, setSuppliers, setInvoices, setPurchases, applyLocal]);

  const addCustomer = useCallback(async (data) => {
    if (!String(data.name || '').trim()) throw new Error('Customer name is required.');
    const creditLimit = toNumber(data.creditLimit || 0, NaN);
    if (!Number.isFinite(creditLimit) || creditLimit < 0) throw new Error('Credit limit must be zero or greater.');
    const record = { id: makeId('cus'), name: data.name.trim(), email: String(data.email || '').trim(), phone: String(data.phone || '').trim(), address: String(data.address || '').trim(), taxId: String(data.taxId || '').trim(), creditLimit, creditLimitCurrencyCode: String(data.creditLimitCurrencyCode || currency?.code || 'UGX').toUpperCase(), createdAt: nowIso() };
    const saved = await saveRecord('customers', record); await applyLocal(setCustomers, (items) => [...items, saved]); return saved;
  }, [saveRecord, setCustomers, applyLocal, currency?.code]);
  const addSupplier = useCallback(async (data) => {
    if (!String(data.name || '').trim()) throw new Error('Supplier name is required.');
    const record = { id: makeId('sup'), name: data.name.trim(), contactName: String(data.contactName || '').trim(), email: String(data.email || '').trim(), phone: String(data.phone || '').trim(), address: String(data.address || '').trim(), taxId: String(data.taxId || '').trim(), createdAt: nowIso() };
    const saved = await saveRecord('suppliers', record); await applyLocal(setSuppliers, (items) => [...items, saved]); return saved;
  }, [saveRecord, setSuppliers, applyLocal]);
  const updateCustomer = useCallback(async (id, data) => {
    if (!String(data.name || '').trim()) throw new Error('Customer name is required.');
    const creditLimit = toNumber(data.creditLimit || 0, NaN);
    if (!Number.isFinite(creditLimit) || creditLimit < 0) throw new Error('Credit limit must be zero or greater.');
    const existing = customers.find((item) => item.id === id);
    if (!existing) throw new Error('Customer could not be found.');
    const record = { ...existing, ...data, id, name: data.name.trim(), creditLimit, creditLimitCurrencyCode: String(data.creditLimitCurrencyCode || existing.creditLimitCurrencyCode || currency?.code || 'UGX').toUpperCase(), updatedAt: nowIso() };
    const saved = await saveRecord('customers', record); await applyLocal(setCustomers, (items) => items.map((item) => item.id === id ? saved : item)); return saved;
  }, [customers, saveRecord, setCustomers, applyLocal, currency?.code]);
  const updateSupplier = useCallback(async (id, data) => {
    if (!String(data.name || '').trim()) throw new Error('Supplier name is required.');
    const record = { ...suppliers.find((item) => item.id === id), ...data, id, name: data.name.trim(), updatedAt: nowIso() };
    const saved = await saveRecord('suppliers', record); await applyLocal(setSuppliers, (items) => items.map((item) => item.id === id ? saved : item)); return saved;
  }, [suppliers, saveRecord, setSuppliers, applyLocal]);
  const addInvoice = useCallback(async (data) => {
    if (!String(data.customerName || '').trim()) throw new Error('Enter the customer name for this invoice.');
    if (!Array.isArray(data.items) || !data.items.length) throw new Error('Add at least one product or service.');
    const discountInput = toNumber(data.discount ?? 0, NaN);
    const taxInput = toNumber(data.taxRate ?? 0, NaN);
    if (!Number.isFinite(discountInput) || discountInput < 0 || discountInput > 100) throw new Error('Discount must be between 0% and 100%.');
    if (!Number.isFinite(taxInput) || taxInput < 0 || taxInput > 100) throw new Error('Tax must be between 0% and 100%.');
    for (const item of data.items) {
      if (!String(item.name || '').trim()) throw new Error('Every invoice line needs a description.');
      if (!Number.isFinite(toNumber(item.quantity, NaN)) || toNumber(item.quantity, NaN) <= 0) throw new Error('Invoice quantities must be greater than zero.');
      if (!Number.isFinite(toNumber(item.unitPrice, NaN)) || toNumber(item.unitPrice, NaN) < 0) throw new Error('Invoice unit prices cannot be negative.');
    }
    const year = new Date().getFullYear();
    // Keep the familiar yearly sequence, but add a random suffix so invoices
    // created offline on two devices are unlikely to reuse the same number.
    // Ledger sync is disabled, so the local list alone cannot guarantee a
    // sequence globally across devices.
    const sequence = invoices.reduce((max, invoice) => {
      const match = String(invoice.number || '').match(new RegExp(`^INV-${year}-(\\d+)(?:-[A-Z0-9]{8})?$`));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
    const subtotal = data.items.reduce((sum, item) => sum + toNumber(item.quantity, 0) * toNumber(item.unitPrice, 0), 0);
    const discount = discountInput;
    const taxable = subtotal * (1 - discount / 100);
    const tax = taxable * taxInput / 100;
    const invoiceCurrencyCode = data.currencyCode || data.currency || currency?.code || 'UGX';
    const total = Math.round((taxable + tax) * 100) / 100;
    const conversion = await convertAmount(total, invoiceCurrencyCode, currency?.code || 'UGX');
    const usedNumbers = new Set(invoices.map((record) => String(record.number || '').toUpperCase()));
    let nextSequence = sequence;
    let invoiceNumber;
    do {
      const randomSuffix = makeId('invoice').split('_').pop().slice(0, 8).toUpperCase().padEnd(8, '0');
      invoiceNumber = `INV-${year}-${String(nextSequence).padStart(4, '0')}-${randomSuffix}`;
      if (usedNumbers.has(invoiceNumber.toUpperCase())) nextSequence += 1;
    } while (usedNumbers.has(invoiceNumber.toUpperCase()));
    const invoice = { id: makeId('inv'), number: invoiceNumber, customerId: data.customerId || '', customerName: String(data.customerName).trim(), customerEmail: data.customerEmail || '', customerPhone: data.customerPhone || '', customerAddress: data.customerAddress || '', customerTaxId: data.customerTaxId || '', issuer: data.issuer || {}, items: data.items.map((item) => ({ name: String(item.name).trim(), quantity: toNumber(item.quantity, 1), unitPrice: toNumber(item.unitPrice, 0) })), subtotal: Math.round(subtotal * 100) / 100, discountRate: discount, taxRate: taxInput, tax: Math.round(tax * 100) / 100, total, amountPaid: 0, payments: [], currency: invoiceCurrencyCode, currencyCode: invoiceCurrencyCode, currencySymbol: currencyFromCode(invoiceCurrencyCode).symbol, baseAmount: Math.round(conversion.amount * 1000000) / 1000000, baseCurrencyCode: currency?.code || 'UGX', exchangeRate: conversion.rate, exchangeRateTimestamp: conversion.timestamp, exchangeRateStale: conversion.isStale === true, issueDate: nowIso(), dueDate: data.dueDate || '', notes: String(data.notes || ''), paymentLink: String(data.paymentLink || ''), paymentMethod: String(data.paymentMethod || ''), paymentDetails: String(data.paymentDetails || ''), status: 'unpaid', createdAt: nowIso() };
    const saved = await saveRecord('invoices', invoice); await applyLocal(setInvoices, (items) => [...items, saved], 'Invoice could not be saved to this device.'); return saved;
  }, [invoices, saveRecord, setInvoices, applyLocal, currency?.code]);
  const addInvoicePayment = useCallback(async (id, amount, method = 'Cash') => {
    const value = toNumber(amount, NaN);
    const invoice = invoices.find((item) => item.id === id);
    if (!invoice) throw new Error('Invoice not found.');
    if (!Number.isFinite(value) || value <= 0 || value > invoice.total - invoice.amountPaid + 0.001) throw new Error('Enter a payment up to the outstanding invoice balance.');
    const paymentCurrencyCode = invoice.currencyCode || invoice.currency || currency?.code || 'UGX';
    const conversion = await convertAmount(value, paymentCurrencyCode, currency?.code || 'UGX');
    const payment = { id: makeId('payment'), amount: Math.round(value * 100) / 100, currencyCode: paymentCurrencyCode, currencySymbol: currencyFromCode(paymentCurrencyCode).symbol, baseAmount: Math.round(conversion.amount * 1000000) / 1000000, baseCurrencyCode: currency?.code || 'UGX', exchangeRate: conversion.rate, exchangeRateTimestamp: conversion.timestamp, exchangeRateStale: conversion.isStale === true, method, date: nowIso() };
    const amountPaid = Math.round((invoice.amountPaid + value) * 100) / 100;
    const status = amountPaid >= invoice.total ? 'paid' : 'partial';
    const updated = { ...invoice, amountPaid, payments: [...(invoice.payments || []), payment], status, updatedAt: nowIso() };
    const saved = await saveRecord('invoices', updated); await applyLocal(setInvoices, (items) => items.map((item) => item.id === id ? saved : item), 'Invoice payment could not be saved to this device.'); return saved;
  }, [invoices, saveRecord, setInvoices, applyLocal, currency?.code]);
  const addPurchase = useCallback(async (data) => {
    if (!data.supplierId || !String(data.description || '').trim()) throw new Error('Choose a supplier and describe the bill or purchase.');
    const amount = toNumber(data.amount, NaN);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Purchase amount must be greater than zero.');
    const purchaseCurrencyCode = data.currencyCode || data.currency || currency?.code || 'UGX';
    const conversion = await convertAmount(amount, purchaseCurrencyCode, currency?.code || 'UGX');
    const record = { id: makeId('buy'), supplierId: data.supplierId, supplierName: data.supplierName, description: data.description.trim(), amount: Math.round(amount * 100) / 100, amountPaid: 0, payments: [], currency: purchaseCurrencyCode, currencyCode: purchaseCurrencyCode, currencySymbol: currencyFromCode(purchaseCurrencyCode).symbol, baseAmount: Math.round(conversion.amount * 1000000) / 1000000, baseCurrencyCode: currency?.code || 'UGX', exchangeRate: conversion.rate, exchangeRateTimestamp: conversion.timestamp, exchangeRateStale: conversion.isStale === true, billNumber: String(data.billNumber || '').trim(), dueDate: data.dueDate || '', createdAt: nowIso(), status: 'unpaid' };
    const saved = await saveRecord('purchases', record); await applyLocal(setPurchases, (items) => [...items, saved], 'Supplier bill could not be saved to this device.'); return saved;
  }, [saveRecord, setPurchases, applyLocal, currency?.code]);
  const addPurchasePayment = useCallback(async (id, amount, method = 'Cash') => {
    const value = toNumber(amount, NaN);
    const purchase = purchases.find((item) => item.id === id);
    if (!purchase) throw new Error('Supplier bill not found.');
    if (!Number.isFinite(value) || value <= 0 || value > purchase.amount - purchase.amountPaid + 0.001) throw new Error('Enter a payment up to the outstanding bill balance.');
    const paymentCurrencyCode = purchase.currencyCode || purchase.currency || currency?.code || 'UGX';
    const conversion = await convertAmount(value, paymentCurrencyCode, currency?.code || 'UGX');
    const payment = { id: makeId('payment'), amount: Math.round(value * 100) / 100, currencyCode: paymentCurrencyCode, currencySymbol: currencyFromCode(paymentCurrencyCode).symbol, baseAmount: Math.round(conversion.amount * 1000000) / 1000000, baseCurrencyCode: currency?.code || 'UGX', exchangeRate: conversion.rate, exchangeRateTimestamp: conversion.timestamp, exchangeRateStale: conversion.isStale === true, method, date: nowIso() };
    const amountPaid = Math.round((purchase.amountPaid + value) * 100) / 100;
    const updated = { ...purchase, amountPaid, payments: [...(purchase.payments || []), payment], status: amountPaid >= purchase.amount ? 'paid' : 'partial', updatedAt: nowIso() };
    const saved = await saveRecord('purchases', updated); await applyLocal(setPurchases, (items) => items.map((item) => item.id === id ? saved : item), 'Supplier payment could not be saved to this device.'); return saved;
  }, [purchases, saveRecord, setPurchases, applyLocal, currency?.code]);

  const value = useMemo(() => ({ customers, suppliers, invoices, purchases, addCustomer, addSupplier, updateCustomer, updateSupplier, addInvoice, addInvoicePayment, addPurchase, addPurchasePayment, deleteBusinessRecord }), [customers, suppliers, invoices, purchases, addCustomer, addSupplier, updateCustomer, updateSupplier, addInvoice, addInvoicePayment, addPurchase, addPurchasePayment, deleteBusinessRecord]);
  return <BusinessRecordsContext.Provider value={value}>{children}</BusinessRecordsContext.Provider>;
}
