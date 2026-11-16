import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { CurrencyContext } from './CurrencyContext';
import { STORAGE_KEYS, commitLocalJsonTransaction, makeId, nowIso, toNumber } from './utils/appUtils';
import usePersistedState from './utils/usePersistedState';
import { deleteRecord, replaceCollection, subscribeToCollection, writeRecord } from './services/cloudSync';
import { AppFeaturesContext } from './AppFeaturesContext';
import { convertAmount } from './services/currencyConversion';
import { currencyFromCode, formatMoney } from './utils/appUtils';
import { withLocalLedgerMutationLock } from './utils/ledgerMutationLock';

export const TransactionsContext = createContext();
const defaultCategories = { income: ['Salary', 'Bonus', 'Gift'], expense: ['Food', 'Transport', 'Bills'] };

export const TransactionsProvider = ({ children }) => {
  const { user, activeWorkspace, storageRevision } = useContext(AuthContext);
  const { currency } = useContext(CurrencyContext);
  const { addNotification, cloudSyncRevision, cloudSyncEnabled } = useContext(AppFeaturesContext);
  const scopeId = activeWorkspace?.id || 'personal';
  const storageKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}transactions` : 'expenseTracker.guest.transactions';
  const categoryKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}categories` : 'expenseTracker.guest.categories';
  const [transactions, setTransactions, hydrated, getCurrentTransactions] = usePersistedState(storageKey, [], storageRevision);
  const [categories, setCategories, categoriesHydrated, getCurrentCategories] = usePersistedState(categoryKey, defaultCategories, storageRevision);
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

  const addTransaction = useCallback(async ({ type, amount, description = '', category = 'Uncategorized', id, currency: legacyCurrency, currencyCode }) => {
    const value = toNumber(amount, NaN);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Enter an amount greater than zero.');
    if (!['income', 'expense'].includes(type)) throw new Error('Invalid transaction type.');
    const transactionCurrencyCode = String(currencyCode || legacyCurrency || currency?.code || 'UGX').toUpperCase();
    const converted = await convertAmount(value, transactionCurrencyCode, currency?.code || 'UGX');
    const timestamp = nowIso();
    const transaction = {
      id: id || makeId('txn'), type, amount: Math.round(value * 100) / 100,
      currencyCode: transactionCurrencyCode,
      currencySymbol: currencyFromCode(transactionCurrencyCode).symbol,
      currency: transactionCurrencyCode,
      baseAmount: Math.round(converted.amount * 1000000) / 1000000,
      baseCurrencyCode: currency?.code || 'UGX', exchangeRate: converted.rate,
      exchangeRateTimestamp: converted.timestamp, exchangeRateStale: converted.isStale === true,
      description: description.trim(), category: category || 'Uncategorized', timestamp, updatedAt: timestamp,
    };
    return withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
      const currentTransactions = getCurrentTransactions();
      if (!Array.isArray(currentTransactions)) throw new Error('Your income and expense records are changing workspaces. Wait a moment and retry.');
      if (!await setTransactions([...currentTransactions, transaction])) throw new Error('Transaction could not be saved to this device. Check storage and try again.');
      await persist([transaction]);
      addNotification(type === 'income' ? 'Income recorded' : 'Expense recorded', `${transaction.description || transaction.category}: ${formatMoney(transaction.amount, transaction.currencyCode)}`);
      return transaction;
    });
  }, [persist, setTransactions, getCurrentTransactions, addNotification, currency?.code, user?.uid]);

  const updateTransaction = useCallback(async (id, updatedData) => withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
    const currentTransactions = getCurrentTransactions();
    if (!Array.isArray(currentTransactions)) throw new Error('Your income and expense records are changing workspaces. Wait a moment and retry.');
    const current = currentTransactions.find((item) => item.id === id);
    if (current?.sourceType === 'trade') throw new Error('This income entry is linked to a Trade sale. Edit or remove the sale in Trade to keep your records consistent.');
    if (updatedData.amount !== undefined && (!Number.isFinite(toNumber(updatedData.amount, NaN)) || toNumber(updatedData.amount, NaN) <= 0)) throw new Error('Enter an amount greater than zero.');
    if (!current) return;
    const nextAmount = updatedData.amount === undefined ? current.amount : toNumber(updatedData.amount, current.amount);
    const nextCurrencyCode = String(updatedData.currencyCode || updatedData.currency || current.currencyCode || current.currency || currency?.code || 'UGX').toUpperCase();
    let updated = { ...current, ...updatedData, amount: nextAmount, currencyCode: nextCurrencyCode, currency: nextCurrencyCode, updatedAt: nowIso() };
    if (nextAmount !== current.amount || nextCurrencyCode !== (current.currencyCode || current.currency)) {
      const converted = await convertAmount(nextAmount, nextCurrencyCode, currency?.code || 'UGX');
      updated = { ...updated, currencySymbol: currencyFromCode(nextCurrencyCode).symbol, baseAmount: Math.round(converted.amount * 1000000) / 1000000, baseCurrencyCode: currency?.code || 'UGX', exchangeRate: converted.rate, exchangeRateTimestamp: converted.timestamp, exchangeRateStale: converted.isStale === true };
    }
    if (!await setTransactions((items) => items.map((item) => item.id === id ? updated : item))) throw new Error('Transaction changes could not be saved to this device.');
    await persist([updated]);
  }), [persist, getCurrentTransactions, setTransactions, user?.uid, currency?.code]);

  const deleteTransaction = useCallback(async (id) => withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
    const currentTransactions = getCurrentTransactions();
    if (!Array.isArray(currentTransactions)) throw new Error('Your income and expense records are changing workspaces. Wait a moment and retry.');
    const current = currentTransactions.find((item) => item.id === id);
    if (current?.sourceType === 'trade') throw new Error('This income entry is linked to a Trade sale. Remove the sale in Trade to keep your records consistent.');
    if (!await setTransactions((items) => items.filter((transaction) => transaction.id !== id))) throw new Error('Transaction deletion could not be saved to this device.');
    await persist(null, id);
  }), [persist, setTransactions, getCurrentTransactions, user?.uid]);

  const addCategory = useCallback(async (type, name) => {
    const clean = String(name || '').trim();
    if (!clean || !categories[type]) return;
    await withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
      const currentCategories = getCurrentCategories();
      if (!currentCategories || !currentCategories[type]) throw new Error('Categories are still loading. Try again.');
      const saved = await setCategories((current) => current[type].includes(clean) ? current : { ...current, [type]: [...current[type], clean] });
      if (!saved) throw new Error('Category could not be saved to this device.');
    });
  }, [categories, getCurrentCategories, setCategories, user?.uid]);

  const updateCategory = useCallback(async (type, oldCategory, newCategory) => {
    const clean = String(newCategory || '').trim();
    if (!clean || oldCategory === clean) return;
    await withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
      const currentCategories = getCurrentCategories();
      const currentTransactions = getCurrentTransactions();
      if (!currentCategories?.[type] || !Array.isArray(currentTransactions)) throw new Error('Your records are still loading. Try again.');
      if (!currentCategories[type].includes(oldCategory)) return;
      const nextCategories = { ...currentCategories, [type]: currentCategories[type].map((category) => category === oldCategory ? clean : category) };
      const nextTransactions = currentTransactions.map((item) => item.type === type && item.category === oldCategory ? { ...item, category: clean, updatedAt: nowIso() } : item);
      await commitLocalJsonTransaction(user?.uid || 'guest', [
        { key: categoryKey, value: nextCategories }, { key: storageKey, value: nextTransactions },
      ]);
      await setCategories(nextCategories, { skipPersist: true });
      await setTransactions(nextTransactions, { skipPersist: true });
    });
  }, [categoryKey, storageKey, user?.uid, getCurrentCategories, getCurrentTransactions, setCategories, setTransactions]);

  const deleteCategory = useCallback(async (type, categoryToDelete) => {
    await withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
      const currentCategories = getCurrentCategories();
      const currentTransactions = getCurrentTransactions();
      if (!currentCategories?.[type] || !Array.isArray(currentTransactions)) throw new Error('Your records are still loading. Try again.');
      const nextCategories = { ...currentCategories, [type]: currentCategories[type].filter((category) => category !== categoryToDelete) };
      const nextTransactions = currentTransactions.map((item) => item.type === type && item.category === categoryToDelete ? { ...item, category: 'Uncategorized', updatedAt: nowIso() } : item);
      await commitLocalJsonTransaction(user?.uid || 'guest', [
        { key: categoryKey, value: nextCategories }, { key: storageKey, value: nextTransactions },
      ]);
      await setCategories(nextCategories, { skipPersist: true });
      await setTransactions(nextTransactions, { skipPersist: true });
    });
  }, [categoryKey, storageKey, user?.uid, getCurrentCategories, getCurrentTransactions, setCategories, setTransactions]);

  const clearTransactions = useCallback(async () => withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
    const currentTransactions = getCurrentTransactions();
    if (!Array.isArray(currentTransactions)) throw new Error('Your records are still loading. Try again.');
    if (currentTransactions.some((item) => item.sourceType === 'trade')) throw new Error('Trade-linked income cannot be cleared separately. Remove the related sales in Trade first.');
    const ids = currentTransactions.map((transaction) => transaction.id);
    if (!await setTransactions([])) throw new Error('Transactions could not be cleared on this device.');
    await Promise.all(ids.map((id) => deleteRecord(user?.uid, 'transactions', id, scopeId)));
  }), [getCurrentTransactions, setTransactions, user?.uid, scopeId]);

  const value = useMemo(() => ({ transactions, setTransactionsForTrade: setTransactions, getCurrentTransactions, addTransaction, updateTransaction, editTransaction: updateTransaction, deleteTransaction, categories, addCategory, updateCategory, deleteCategory, clearTransactions, hydrated, cloudLoaded }), [transactions, getCurrentTransactions, addTransaction, updateTransaction, deleteTransaction, categories, addCategory, updateCategory, deleteCategory, clearTransactions, hydrated, cloudLoaded]);
  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
};
