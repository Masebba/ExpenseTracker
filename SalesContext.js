import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { CurrencyContext } from './CurrencyContext';
import usePersistedState from './utils/usePersistedState';
import { deleteRecord, replaceCollection, subscribeToCollection, writeRecord } from './services/cloudSync';
import { makeId, nowIso, toNumber } from './utils/appUtils';
import { ProductsContext } from './ProductsContext';
import { AppFeaturesContext } from './AppFeaturesContext';

export const SalesContext = createContext();

export const SalesProvider = ({ children }) => {
  const { user, activeWorkspace } = useContext(AuthContext);
  const { cloudSyncRevision, cloudSyncEnabled } = useContext(AppFeaturesContext);
  const { currency } = useContext(CurrencyContext);
  const { products, updateProduct } = useContext(ProductsContext);
  const scopeId = activeWorkspace?.id || 'personal';
  const storageKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}sales` : 'expenseTracker.guest.sales';
  const [sales, setSales, hydrated] = usePersistedState(storageKey, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeToCollection(user.uid, 'sales', (records) => setSales((current) => [...records, ...current.filter((x) => !records.some((r) => r.id === x.id))]), undefined, scopeId);
  }, [user?.uid, setSales, scopeId, cloudSyncRevision]);

  useEffect(() => {
    if (!user?.uid || !cloudSyncEnabled || !hydrated) return;
    replaceCollection(user.uid, 'sales', sales, scopeId).catch((error) => console.warn('Local sales backup failed:', error?.message || error));
  }, [user?.uid, scopeId, cloudSyncRevision, cloudSyncEnabled, hydrated]);

  const recordSale = useCallback(async ({ productId, quantity, discount = 0, paymentOption = 'Cash' }) => {
    const product = products.find((p) => p.id === productId);
    if (!product) throw new Error('Product could not be found.');
    const qty = Math.trunc(toNumber(quantity, NaN));
    const disc = toNumber(discount, 0);
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Quantity must be a whole number greater than zero.');
    if (product.stock < qty) throw new Error(`Not enough stock. Available: ${product.stock}`);
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) throw new Error('Discount must be between 0% and 100%.');
    const unitPrice = product.price * (1 - disc / 100);
    const finalAmount = Math.round(unitPrice * qty * 100) / 100;
    const sale = { id: makeId('sale'), productId, productName: product.name, originalPrice: product.price, costAtSale: product.buyingPrice, finalAmount, discount: disc, quantity: qty, timestamp: nowIso(), paymentOption, currency: currency?.code || 'UGX' };
    setSales((current) => [...current, sale]);
    await writeRecord(user?.uid, 'sales', sale, scopeId).catch(() => {});
    await updateProduct(productId, { stock: product.stock - qty });
    return sale;
  }, [currency?.code, products, setSales, updateProduct, user?.uid, scopeId]);

  const deleteSale = useCallback(async (id) => {
    setSales((current) => current.filter((s) => s.id !== id));
    if (user?.uid) await deleteRecord(user.uid, 'sales', id, scopeId).catch(() => {});
  }, [setSales, user?.uid, scopeId]);

  const setSalesSafe = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(sales) : updater;
    const previousIds = new Set(sales.map((x) => x.id));
    setSales(next);
    if (user?.uid) {
      next.forEach((x) => { writeRecord(user.uid, 'sales', x, scopeId).catch(() => {}); previousIds.delete(x.id); });
      previousIds.forEach((id) => deleteRecord(user.uid, 'sales', id, scopeId).catch(() => {}));
    }
  }, [sales, setSales, user?.uid, scopeId]);
  const value = useMemo(() => ({ sales, setSales: setSalesSafe, recordSale, deleteSale, hydrated }), [sales, setSalesSafe, recordSale, deleteSale, hydrated]);
  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
};
