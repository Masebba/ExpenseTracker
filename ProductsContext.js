import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { makeId, nowIso, toInteger, toNumber } from './utils/appUtils';
import usePersistedState from './utils/usePersistedState';
import { deleteRecord, replaceCollection, subscribeToCollection, writeRecord } from './services/cloudSync';
import { AppFeaturesContext } from './AppFeaturesContext';

export const ProductsContext = createContext();

export const ProductsProvider = ({ children }) => {
  const { user, activeWorkspace } = useContext(AuthContext);
  const { cloudSyncRevision, cloudSyncEnabled } = useContext(AppFeaturesContext);
  const scopeId = activeWorkspace?.id || 'personal';
  const storageKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}products` : 'expenseTracker.guest.products';
  const categoriesKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}productCategories` : 'expenseTracker.guest.productCategories';
  const [products, setProducts, hydrated] = usePersistedState(storageKey, []);
  const [categories, setCategories, categoriesHydrated] = usePersistedState(categoriesKey, ['General']);
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
    const product = { id: data.id || makeId('prod'), barcode: String(data.barcode || '').trim(), name: data.name.trim(), price: Math.round(price * 100) / 100, buyingPrice: Math.round(buyingPrice * 100) / 100, stock, category: String(data.category || 'General').trim() || 'General', createdAt: nowIso(), updatedAt: nowIso() };
    await save(product);
    setProducts((current) => [...current, product]);
    return product;
  }, [save, setProducts]);

  const updateProduct = useCallback(async (id, data) => {
    const current = products.find((item) => item.id === id);
    if (!current) return;
    const record = { ...current, ...data, price: data.price === undefined ? current.price : toNumber(data.price, current.price), buyingPrice: data.buyingPrice === undefined ? current.buyingPrice : toNumber(data.buyingPrice, current.buyingPrice), stock: data.stock === undefined ? current.stock : toInteger(data.stock, current.stock), updatedAt: nowIso() };
    if (!Number.isInteger(record.stock) || record.stock < 0 || !Number.isFinite(record.price) || record.price <= 0 || !Number.isFinite(record.buyingPrice) || record.buyingPrice < 0) throw new Error('Product stock and prices are invalid.');
    await save(record);
    setProducts((items) => items.map((item) => item.id === id ? record : item));
  }, [save, setProducts]);

  const deleteProduct = useCallback(async (id) => {
    if (user?.uid) await deleteRecord(user.uid, 'products', id, scopeId);
    setProducts((current) => current.filter((p) => p.id !== id));
  }, [setProducts, user?.uid, scopeId]);

  const adjustStock = useCallback(async (id, delta, reason = 'manual') => {
    const amount = toInteger(delta, 0);
    const current = products.find((item) => item.id === id);
    if (!current) throw new Error('Product could not be found.');
    const nextStock = current.stock + amount;
    if (nextStock < 0) throw new Error(`Insufficient stock for ${current.name}.`);
    const updated = { ...current, stock: nextStock, updatedAt: nowIso(), lastStockAdjustment: { amount, reason, timestamp: nowIso() } };
    await save(updated);
    setProducts((items) => items.map((item) => item.id === id ? updated : item));
    return updated;
  }, [save, setProducts]);

  const addCategory = useCallback((name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    setCategories((current) => current.includes(clean)
      ? current
      : ['General', ...new Set([...current, clean].filter((category) => category !== 'General'))]);
    if (user?.uid) writeRecord(user.uid, 'productCategories', { id: clean.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: clean }, scopeId).catch(() => {});
  }, [setCategories, user?.uid, scopeId]);

  const updateCategory = useCallback((oldName, newName) => {
    const clean = String(newName || '').trim();
    if (!clean) return;
    setCategories((current) => ['General', ...new Set(
      current.map((category) => category === oldName ? clean : category)
        .map((category) => String(category || '').trim())
        .filter((category) => category && category !== 'General'),
    )]);
    setProducts((current) => current.map((p) => p.category === oldName ? { ...p, category: clean, updatedAt: nowIso() } : p));
    products.filter((p) => p.category === oldName).forEach((p) => save({ ...p, category: clean, updatedAt: nowIso() }));
  }, [products, save, setCategories, setProducts]);

  const deleteCategory = useCallback((name) => {
    setCategories((current) => current.filter((c) => c !== name));
    setProducts((current) => current.map((p) => p.category === name ? { ...p, category: 'General', updatedAt: nowIso() } : p));
    products.filter((p) => p.category === name).forEach((p) => save({ ...p, category: 'General', updatedAt: nowIso() }));
  }, [products, save, setCategories, setProducts]);

  const setProductsSafe = useCallback(async (updater) => {
    const next = typeof updater === 'function' ? updater(products) : updater;
    const previousIds = new Set(products.map((p) => p.id));
    if (user?.uid) {
      await Promise.all(next.map((p) => writeRecord(user.uid, 'products', p, scopeId)));
      await Promise.all(products.filter((p) => !next.some((item) => item.id === p.id)).map((p) => deleteRecord(user.uid, 'products', p.id, scopeId)));
    }
    next.forEach((p) => previousIds.delete(p.id));
    setProducts(next);
  }, [products, setProducts, user?.uid, scopeId]);

  const value = useMemo(() => ({ products, setProducts: setProductsSafe, addProduct, updateProduct, deleteProduct, adjustStock, categories, addCategory, updateCategory, deleteCategory, hydrated, categoriesHydrated, cloudLoaded }), [products, setProductsSafe, addProduct, updateProduct, deleteProduct, adjustStock, categories, addCategory, updateCategory, deleteCategory, hydrated, categoriesHydrated, cloudLoaded]);
  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
};
