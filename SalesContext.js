import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { CurrencyContext } from './CurrencyContext';
import usePersistedState from './utils/usePersistedState';
import { deleteRecord, replaceCollection, subscribeToCollection, writeRecord } from './services/cloudSync';
import { makeId, nowIso, toNumber } from './utils/appUtils';
import { ProductsContext } from './ProductsContext';
import { AppFeaturesContext } from './AppFeaturesContext';
import { convertAmount, getExchangeRate } from './services/currencyConversion';
import { currencyFromCode } from './utils/appUtils';

export const SalesContext = createContext();

export const SalesProvider = ({ children }) => {
  const { user, activeWorkspace } = useContext(AuthContext);
  const { cloudSyncRevision, cloudSyncEnabled } = useContext(AppFeaturesContext);
  const { currency, detectedCurrency } = useContext(CurrencyContext);
  const { products, updateProduct } = useContext(ProductsContext);
  const scopeId = activeWorkspace?.id || 'personal';
  const storageKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}sales` : 'expenseTracker.guest.sales';
  const [sales, setSales, hydrated] = usePersistedState(storageKey, []);
  const syncTag = `${user?.uid || ''}:${scopeId}:${cloudSyncRevision}`;
  const [cloudLoadedFor, setCloudLoadedFor] = React.useState('');
  const cloudLoaded = cloudLoadedFor === syncTag;

  useEffect(() => {
    if (!user?.uid) return undefined;
    if (!hydrated) return undefined;
    return subscribeToCollection(user.uid, 'sales', (records) => { setSales(records); setCloudLoadedFor(syncTag); }, (error) => console.warn('Sales cloud listener failed:', error?.message || error), scopeId);
  }, [user?.uid, setSales, scopeId, cloudSyncRevision, hydrated, syncTag]);

  useEffect(() => {
    if (!user?.uid || !cloudSyncEnabled || !hydrated || !cloudLoaded) return;
    replaceCollection(user.uid, 'sales', sales, scopeId).catch((error) => console.warn('Local sales backup failed:', error?.message || error));
  }, [user?.uid, scopeId, cloudSyncRevision, cloudSyncEnabled, hydrated, cloudLoaded, sales]);

  const recordSale = useCallback(async ({ productId, quantity, discount = 0, paymentOption = 'Cash', currencyCode }) => {
    const product = products.find((p) => p.id === productId);
    if (!product) throw new Error('Product could not be found.');
    const qty = Math.trunc(toNumber(quantity, NaN));
    const disc = toNumber(discount, 0);
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Quantity must be a whole number greater than zero.');
    if (product.stock < qty) throw new Error(`Not enough stock. Available: ${product.stock}`);
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) throw new Error('Discount must be between 0% and 100%.');
    const priceCurrencyCode = product.currencyCode || detectedCurrency?.code || currency?.code || 'UGX';
    const saleCurrencyCode = String(currencyCode || priceCurrencyCode).toUpperCase();
    const salePriceRate = await getExchangeRate(priceCurrencyCode, saleCurrencyCode);
    const costBase = await convertAmount(product.buyingPrice, priceCurrencyCode, currency?.code || 'UGX');
    const unitPrice = product.price * salePriceRate.rate * (1 - disc / 100);
    const finalAmount = Math.round(unitPrice * qty * 100) / 100;
    const converted = await convertAmount(finalAmount, saleCurrencyCode, currency?.code || 'UGX');
    const sale = {
      id: makeId('sale'),
      productId,
      productName: product.name,
      originalPrice: product.price,
      priceCurrencyCode,
      costAtSale: product.buyingPrice,
      costCurrencyCode: priceCurrencyCode,
      costAtSaleBaseAmount: Math.round(costBase.amount * qty * 1000000) / 1000000,
      finalAmount,
      currencyCode: saleCurrencyCode,
      currencySymbol: currencyFromCode(saleCurrencyCode).symbol,
      currency: saleCurrencyCode,
      baseAmount: Math.round(converted.amount * 1000000) / 1000000,
      baseCurrencyCode: currency?.code || 'UGX',
      exchangeRate: converted.rate,
      exchangeRateTimestamp: converted.timestamp,
      discount: disc,
      quantity: qty,
      timestamp: nowIso(),
      paymentOption,
    };
    // Persist the inventory decrement before recording the sale, so a stock
    // write failure never leaves a sale with unchanged inventory.
    await updateProduct(productId, { stock: product.stock - qty });
    try {
      await writeRecord(user?.uid, 'sales', sale, scopeId);
    } catch (error) {
      await updateProduct(productId, { stock: product.stock }).catch(() => {});
      throw new Error(`Sale could not be saved. Inventory was restored. ${error?.message || ''}`.trim());
    }
    setSales((current) => [...current, sale]);
    return sale;
  }, [currency?.code, detectedCurrency?.code, products, setSales, updateProduct, user?.uid, scopeId]);

  const deleteSale = useCallback(async (id) => {
    const sale = sales.find((item) => item.id === id);
    if (!sale) return;
    const product = products.find((item) => item.id === sale.productId);
    if (product) await updateProduct(product.id, { stock: product.stock + sale.quantity });
    try {
      if (user?.uid) await deleteRecord(user.uid, 'sales', id, scopeId);
    } catch (error) {
      if (product) await updateProduct(product.id, { stock: product.stock }).catch(() => {});
      throw error;
    }
    setSales((current) => current.filter((item) => item.id !== id));
  }, [sales, products, updateProduct, setSales, user?.uid, scopeId]);

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
