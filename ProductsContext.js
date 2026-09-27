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
  const [cloudLoaded, setCloudLoaded] = useState(false);

  useEffect(() => setCloudLoaded(false), [user?.uid, scopeId]);
  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeToCollection(user.uid, 'products', (records) => {
      setProducts((current) => [...records, ...current.filter((item) => !records.some((r) => r.id === item.id))]);
      setCloudLoaded(true);
    }, undefined, scopeId);
  }, [user?.uid, scopeId, cloudSyncRevision]);

  useEffect(() => {
    if (!user?.uid || !cloudSyncEnabled || !hydrated) return;
    Promise.all([
      replaceCollection(user.uid, 'products', products, scopeId),
      replaceCollection(user.uid, 'productCategories', categories.map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name })), scopeId),
    ]).catch((error) => console.warn('Local product backup failed:', error?.message || error));
  }, [user?.uid, scopeId, cloudSyncRevision, cloudSyncEnabled, hydrated, categories]);
  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeToCollection(user.uid, 'productCategories', (records) => {
      if (records?.length) setCategories(records.map((r) => r.name));
    }, undefined, scopeId);
  }, [user?.uid, scopeId, cloudSyncRevision]);

  const save = useCallback(async (record) => {
    if (!user?.uid) return;
    try { await writeRecord(user.uid, 'products', record, scopeId); } catch (e) { console.warn('Product cloud sync failed:', e?.message || e); }
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
    setProducts((current) => [...current, product]);
    await save(product);
    return product;
  }, [save, setProducts]);

  const updateProduct = useCallback(async (id, data) => {
    let updated;
    setProducts((current) => {
      updated = current.map((p) => p.id === id ? { ...p, ...data, price: data.price === undefined ? p.price : toNumber(data.price, p.price), buyingPrice: data.buyingPrice === undefined ? p.buyingPrice : toNumber(data.buyingPrice, p.buyingPrice), stock: data.stock === undefined ? p.stock : toInteger(data.stock, p.stock), updatedAt: nowIso() } : p);
      return updated;
    });
    const record = updated?.find((p) => p.id === id);
    if (record) await save(record);
  }, [save, setProducts]);

  const deleteProduct = useCallback(async (id) => {
    setProducts((current) => current.filter((p) => p.id !== id));
    if (user?.uid) await deleteRecord(user.uid, 'products', id, scopeId).catch(() => {});
  }, [setProducts, user?.uid, scopeId]);

  const adjustStock = useCallback(async (id, delta, reason = 'manual') => {
    const amount = toInteger(delta, 0);
    let updated;
    setProducts((current) => current.map((p) => {
      if (p.id !== id) return p;
      const nextStock = p.stock + amount;
      if (nextStock < 0) throw new Error(`Insufficient stock for ${p.name}.`);
      updated = { ...p, stock: nextStock, updatedAt: nowIso(), lastStockAdjustment: { amount, reason, timestamp: nowIso() } };
      return updated;
    }));
    if (updated) await save(updated);
    return updated;
  }, [save, setProducts]);

  const addCategory = useCallback((name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    setCategories((current) => current.includes(clean) ? current : [...current, clean]);
    if (user?.uid) writeRecord(user.uid, 'productCategories', { id: clean.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: clean }, scopeId).catch(() => {});
  }, [setCategories, user?.uid, scopeId]);

  const updateCategory = useCallback((oldName, newName) => {
    const clean = String(newName || '').trim();
    if (!clean) return;
    setCategories((current) => current.map((c) => c === oldName ? clean : c));
    setProducts((current) => current.map((p) => p.category === oldName ? { ...p, category: clean, updatedAt: nowIso() } : p));
    products.filter((p) => p.category === oldName).forEach((p) => save({ ...p, category: clean, updatedAt: nowIso() }));
  }, [products, save, setCategories, setProducts]);

  const deleteCategory = useCallback((name) => {
    setCategories((current) => current.filter((c) => c !== name));
    setProducts((current) => current.map((p) => p.category === name ? { ...p, category: 'General', updatedAt: nowIso() } : p));
    products.filter((p) => p.category === name).forEach((p) => save({ ...p, category: 'General', updatedAt: nowIso() }));
  }, [products, save, setCategories, setProducts]);

  const setProductsSafe = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(products) : updater;
    const previousIds = new Set(products.map((p) => p.id));
    setProducts(next);
    if (user?.uid) {
      next.forEach((p) => { writeRecord(user.uid, 'products', p, scopeId).catch(() => {}); previousIds.delete(p.id); });
      previousIds.forEach((id) => deleteRecord(user.uid, 'products', id, scopeId).catch(() => {}));
    }
  }, [products, setProducts, user?.uid, scopeId]);

  const value = useMemo(() => ({ products, setProducts: setProductsSafe, addProduct, updateProduct, deleteProduct, adjustStock, categories, addCategory, updateCategory, deleteCategory, hydrated, categoriesHydrated, cloudLoaded }), [products, setProductsSafe, addProduct, updateProduct, deleteProduct, adjustStock, categories, addCategory, updateCategory, deleteCategory, hydrated, categoriesHydrated, cloudLoaded]);
  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
};
