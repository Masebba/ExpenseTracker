import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { commitLocalJsonTransaction, makeId, nowIso, toInteger, toNumber } from './utils/appUtils';
import usePersistedState from './utils/usePersistedState';
import { deleteRecord, replaceCollection, subscribeToCollection, writeRecord } from './services/cloudSync';
import { AppFeaturesContext } from './AppFeaturesContext';
import { CurrencyContext } from './CurrencyContext';

export const ProductsContext = createContext();

export const ProductsProvider = ({ children }) => {
  const { user, activeWorkspace, storageRevision } = useContext(AuthContext);
  const { cloudSyncRevision, cloudSyncEnabled } = useContext(AppFeaturesContext);
  const { currency, detectedCurrency } = useContext(CurrencyContext);
  const scopeId = activeWorkspace?.id || 'personal';
  const storageKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}products` : 'expenseTracker.guest.products';
  const categoriesKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}productCategories` : 'expenseTracker.guest.productCategories';
  const [products, setProducts, hydrated] = usePersistedState(storageKey, [], storageRevision);
  const [categories, setCategories, categoriesHydrated] = usePersistedState(categoriesKey, ['General'], storageRevision);
  const syncTag = `${user?.uid || ''}:${scopeId}:${cloudSyncRevision}`;
  const [cloudLoadedFor, setCloudLoadedFor] = useState('');
  const cloudLoaded = cloudLoadedFor === syncTag;

  useEffect(() => {
    if (!categoriesHydrated) return;
    setCategories((current) => ['General', ...new Set(
      current.map((name) => String(name || '').trim()).filter((name) => name && name !== 'General'),
    )]);
  }, [categoriesHydrated, setCategories]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    if (!hydrated) return undefined;
    return subscribeToCollection(user.uid, 'products', (records) => {
      setProducts(records);
      setCloudLoadedFor(syncTag);
    }, (error) => console.warn('Product cloud listener failed:', error?.message || error), scopeId);
  }, [user?.uid, scopeId, cloudSyncRevision, hydrated, setProducts, syncTag]);

  useEffect(() => {
    if (!user?.uid || !cloudSyncEnabled || !hydrated || !cloudLoaded) return;
    Promise.all([
      replaceCollection(user.uid, 'products', products, scopeId),
      replaceCollection(user.uid, 'productCategories', categories.map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name })), scopeId),
    ]).catch((error) => console.warn('Local product backup failed:', error?.message || error));
  }, [user?.uid, scopeId, cloudSyncRevision, cloudSyncEnabled, hydrated, cloudLoaded, products, categories]);
  useEffect(() => {
    if (!user?.uid) return undefined;
    if (!categoriesHydrated) return undefined;
    return subscribeToCollection(user.uid, 'productCategories', (records) => {
      setCategories(['General', ...new Set(
        records.map((record) => String(record.name || '').trim()).filter((name) => name && name !== 'General'),
      )]);
    }, (error) => console.warn('Category cloud listener failed:', error?.message || error), scopeId);
  }, [user?.uid, scopeId, cloudSyncRevision, categoriesHydrated, setCategories]);

  const save = useCallback(async (record) => {
    if (!user?.uid) return;
    await writeRecord(user.uid, 'products', record, scopeId);
  }, [user?.uid, scopeId, cloudSyncRevision]);

  const addProduct = useCallback(async (data) => {
    const price = toNumber(data.price, NaN);
    const buyingPrice = toNumber(data.buyingPrice, NaN);
    const stock = toInteger(data.stock, -1);
    if (!data.name?.trim()) throw new Error('Product name is required.');
    if (!Number.isFinite(price) || price <= 0) throw new Error('Selling price must be greater than zero.');
    if (!Number.isFinite(buyingPrice) || buyingPrice < 0) throw new Error('Buying price cannot be negative.');
    if (stock < 0) throw new Error('Stock cannot be negative.');
    const product = { id: data.id || makeId('prod'), barcode: String(data.barcode || '').trim(), name: data.name.trim(), price: Math.round(price * 100) / 100, buyingPrice: Math.round(buyingPrice * 100) / 100, stock, category: String(data.category || 'General').trim() || 'General', currencyCode: data.currencyCode || currency?.code || detectedCurrency?.code || 'UGX', createdAt: nowIso(), updatedAt: nowIso() };
    await save(product);
    if (!await setProducts((current) => [...current, product])) throw new Error('Product could not be saved to this device. Check storage and try again.');
    return product;
  }, [save, setProducts, currency?.code, detectedCurrency?.code]);

  const updateProduct = useCallback(async (id, data) => {
    const current = products.find((item) => item.id === id);
    if (!current) return;
    const record = { ...current, ...data, price: data.price === undefined ? current.price : toNumber(data.price, current.price), buyingPrice: data.buyingPrice === undefined ? current.buyingPrice : toNumber(data.buyingPrice, current.buyingPrice), stock: data.stock === undefined ? current.stock : toInteger(data.stock, current.stock), updatedAt: nowIso() };
    if (!Number.isInteger(record.stock) || record.stock < 0 || !Number.isFinite(record.price) || record.price <= 0 || !Number.isFinite(record.buyingPrice) || record.buyingPrice < 0) throw new Error('Product stock and prices are invalid.');
    await save(record);
    if (!await setProducts((items) => items.map((item) => item.id === id ? record : item))) throw new Error('Product changes could not be saved to this device.');
  }, [save, setProducts]);

  const deleteProduct = useCallback(async (id) => {
    if (user?.uid) await deleteRecord(user.uid, 'products', id, scopeId);
    if (!await setProducts((current) => current.filter((p) => p.id !== id))) throw new Error('Product deletion could not be saved to this device.');
  }, [setProducts, user?.uid, scopeId]);

  const adjustStock = useCallback(async (id, delta, reason = 'manual') => {
    const amount = toInteger(delta, 0);
    const current = products.find((item) => item.id === id);
    if (!current) throw new Error('Product could not be found.');
    const nextStock = current.stock + amount;
    if (nextStock < 0) throw new Error(`Insufficient stock for ${current.name}.`);
    const updated = { ...current, stock: nextStock, updatedAt: nowIso(), lastStockAdjustment: { amount, reason, timestamp: nowIso() } };
    await save(updated);
    if (!await setProducts((items) => items.map((item) => item.id === id ? updated : item))) throw new Error('Stock adjustment could not be saved to this device.');
    return updated;
  }, [save, setProducts]);

  const addCategory = useCallback(async (name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    const next = await (async () => {
      const current = categories.includes(clean) ? categories : ['General', ...new Set([...categories, clean].filter((category) => category !== 'General'))];
      if (!await setCategories(current)) throw new Error('Product category could not be saved to this device.');
      return current;
    })();
    if (user?.uid) await writeRecord(user.uid, 'productCategories', { id: clean.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: clean }, scopeId);
    return next;
  }, [categories, setCategories, user?.uid, scopeId]);

  const updateCategory = useCallback(async (oldName, newName) => {
    const clean = String(newName || '').trim();
    if (!clean || clean === oldName) return;
    const nextCategories = ['General', ...new Set(
      categories.map((category) => category === oldName ? clean : category)
        .map((category) => String(category || '').trim())
        .filter((category) => category && category !== 'General'),
    )];
    const nextProducts = products.map((product) => product.category === oldName ? { ...product, category: clean, updatedAt: nowIso() } : product);
    await commitLocalJsonTransaction(user?.uid || 'guest', [
      { key: categoriesKey, value: nextCategories },
      { key: storageKey, value: nextProducts },
    ]);
    await setCategories(nextCategories, { skipPersist: true });
    await setProducts(nextProducts, { skipPersist: true });
    if (user?.uid) await Promise.all(nextProducts.filter((product) => product.category === clean).map((product) => writeRecord(user.uid, 'products', product, scopeId)));
  }, [categories, products, categoriesKey, storageKey, user?.uid, scopeId, setCategories, setProducts]);

  const deleteCategory = useCallback(async (name) => {
    const nextCategories = categories.filter((category) => category !== name);
    const nextProducts = products.map((product) => product.category === name ? { ...product, category: 'General', updatedAt: nowIso() } : product);
    await commitLocalJsonTransaction(user?.uid || 'guest', [
      { key: categoriesKey, value: nextCategories },
      { key: storageKey, value: nextProducts },
    ]);
    await setCategories(nextCategories, { skipPersist: true });
    await setProducts(nextProducts, { skipPersist: true });
    if (user?.uid) await Promise.all(nextProducts.filter((product) => product.category === 'General').map((product) => writeRecord(user.uid, 'products', product, scopeId)));
  }, [categories, products, categoriesKey, storageKey, user?.uid, scopeId, setCategories, setProducts]);

  const setProductsSafe = useCallback(async (updater, options = {}) => {
    const next = typeof updater === 'function' ? updater(products) : updater;
    const previousIds = new Set(products.map((p) => p.id));
    if (user?.uid && options?.skipCloudSync !== true) {
      await Promise.all(next.map((p) => writeRecord(user.uid, 'products', p, scopeId)));
      await Promise.all(products.filter((p) => !next.some((item) => item.id === p.id)).map((p) => deleteRecord(user.uid, 'products', p.id, scopeId)));
    }
    next.forEach((p) => previousIds.delete(p.id));
    const localSaved = await setProducts(next, { skipPersist: options?.skipPersist === true });
    if (!localSaved) throw new Error('Inventory could not be saved to this device.');
    return true;
  }, [products, setProducts, user?.uid, scopeId]);

  const value = useMemo(() => ({ products, setProducts: setProductsSafe, addProduct, updateProduct, deleteProduct, adjustStock, categories, addCategory, updateCategory, deleteCategory, hydrated, categoriesHydrated, cloudLoaded }), [products, setProductsSafe, addProduct, updateProduct, deleteProduct, adjustStock, categories, addCategory, updateCategory, deleteCategory, hydrated, categoriesHydrated, cloudLoaded]);
  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
};
