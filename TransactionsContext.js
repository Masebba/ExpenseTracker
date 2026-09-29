import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { CurrencyContext } from './CurrencyContext';
import { STORAGE_KEYS, makeId, nowIso, toNumber } from './utils/appUtils';
import usePersistedState from './utils/usePersistedState';
import { deleteRecord, replaceCollection, subscribeToCollection, writeRecord } from './services/cloudSync';
import { AppFeaturesContext } from './AppFeaturesContext';

export const TransactionsContext = createContext();
const defaultCategories = { income: ['Salary', 'Bonus', 'Gift'], expense: ['Food', 'Transport', 'Bills'] };

export const TransactionsProvider = ({ children }) => {
  const { user, activeWorkspace } = useContext(AuthContext);
  const { currency } = useContext(CurrencyContext);
  const { addNotification, cloudSyncRevision, cloudSyncEnabled } = useContext(AppFeaturesContext);
  const scopeId = activeWorkspace?.id || 'personal';
  const storageKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}transactions` : 'expenseTracker.guest.transactions';
  const categoryKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}categories` : 'expenseTracker.guest.categories';
  const [transactions, setTransactions, hydrated] = usePersistedState(storageKey, []);
  const [categories, setCategories] = usePersistedState(categoryKey, defaultCategories);
  const syncTag = `${user?.uid || ''}:${scopeId}:${cloudSyncRevision}`;
  const [cloudLoadedFor, setCloudLoadedFor] = useState('');
  const cloudLoaded = cloudLoadedFor === syncTag;

  useEffect(() => {
    if (!user?.uid || !hydrated) return undefined;
    return subscribeToCollection(user.uid, 'transactions', (records) => {
      if (hydrated) setTransactions(records);
      setCloudLoadedFor(syncTag);
    }, (error) => console.warn('Transaction cloud listener failed:', error?.message || error), scopeId);
  }, [user?.uid, scopeId, cloudSyncRevision, hydrated, setTransactions, syncTag]);

  useEffect(() => {
    if (user?.uid && cloudSyncEnabled && hydrated && cloudLoaded) replaceCollection(user.uid, 'transactions', transactions, scopeId).catch((error) => console.warn('Local transaction backup failed:', error?.message || error));
  }, [user?.uid, scopeId, cloudSyncRevision, cloudSyncEnabled, hydrated, cloudLoaded, transactions]);

  const persist = useCallback(async (next, removedId = null) => {
    if (!user?.uid) return;
    if (removedId) return deleteRecord(user.uid, 'transactions', removedId, scopeId);
    if (next) return Promise.all(next.map((record) => writeRecord(user.uid, 'transactions', record, scopeId)));
  }, [user?.uid, scopeId, cloudSyncRevision]);

  const addTransaction = useCallback(async ({ type, amount, description = '', category = 'Uncategorized', id, currency: transactionCurrency }) => {
    const value = toNumber(amount, NaN);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Enter an amount greater than zero.');
    if (!['income', 'expense'].includes(type)) throw new Error('Invalid transaction type.');
    const transaction = { id: id || makeId('txn'), type, amount: Math.round(value * 100) / 100, description: description.trim(), category: category || 'Uncategorized', currency: transactionCurrency || currency?.code || null, timestamp: nowIso(), updatedAt: nowIso() };
    await persist([transaction]);
    setTransactions((current) => [...current, transaction]);
    addNotification(type === 'income' ? 'Income recorded' : 'Expense recorded', `${transaction.description || transaction.category}: ${transaction.currency || currency?.code || ''} ${transaction.amount.toFixed(2)}`);
    return transaction;
  }, [persist, setTransactions, addNotification, currency?.code]);

  const updateTransaction = useCallback(async (id, updatedData) => {
    if (updatedData.amount !== undefined && (!Number.isFinite(toNumber(updatedData.amount, NaN)) || toNumber(updatedData.amount, NaN) <= 0)) throw new Error('Enter an amount greater than zero.');
    let updated;
    const current = transactions.find((item) => item.id === id);
    if (!current) return;
    updated = { ...current, ...updatedData, amount: updatedData.amount === undefined ? current.amount : toNumber(updatedData.amount, current.amount), updatedAt: nowIso() };
    await persist([updated]);
    setTransactions((items) => items.map((item) => item.id === id ? updated : item));
  }, [persist, transactions, setTransactions]);

  const deleteTransaction = useCallback(async (id) => {
    await persist(null, id);
    setTransactions((current) => current.filter((t) => t.id !== id));
  }, [persist, setTransactions]);

  const addCategory = useCallback((type, name) => {
    const clean = String(name || '').trim();
    if (!clean || !categories[type]) return;
    setCategories((current) => current[type].includes(clean) ? current : { ...current, [type]: [...current[type], clean] });
  }, [categories, setCategories]);

  const updateCategory = useCallback((type, oldCategory, newCategory) => {
    const clean = String(newCategory || '').trim();
    if (!clean || !categories[type]) return;
    setCategories((current) => ({ ...current, [type]: current[type].map((cat) => cat === oldCategory ? clean : cat) }));
    setTransactions((current) => current.map((t) => t.type === type && t.category === oldCategory ? { ...t, category: clean, updatedAt: nowIso() } : t));
  }, [categories, setCategories, setTransactions]);

  const deleteCategory = useCallback((type, categoryToDelete) => {
    if (!categories[type]) return;
    setCategories((current) => ({ ...current, [type]: current[type].filter((cat) => cat !== categoryToDelete) }));
    setTransactions((current) => current.map((t) => t.type === type && t.category === categoryToDelete ? { ...t, category: 'Uncategorized', updatedAt: nowIso() } : t));
  }, [categories, setCategories, setTransactions]);

  const clearTransactions = useCallback(async () => {
    const ids = transactions.map((t) => t.id);
    await Promise.all(ids.map((id) => deleteRecord(user?.uid, 'transactions', id, scopeId)));
    setTransactions([]);
  }, [transactions, setTransactions, user?.uid, scopeId]);

  const value = useMemo(() => ({ transactions, addTransaction, updateTransaction, editTransaction: updateTransaction, deleteTransaction, categories, addCategory, updateCategory, deleteCategory, clearTransactions, hydrated, cloudLoaded }), [transactions, addTransaction, updateTransaction, deleteTransaction, categories, addCategory, updateCategory, deleteCategory, clearTransactions, hydrated, cloudLoaded]);
  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
};
