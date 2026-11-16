import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import { CurrencyContext } from './CurrencyContext';
import usePersistedState from './utils/usePersistedState';
import { deleteRecord, replaceCollection, subscribeToCollection, writeRecord } from './services/cloudSync';
import { commitLocalJsonTransaction, makeId, nowIso, toNumber, currencyFromCode } from './utils/appUtils';
import { ProductsContext } from './ProductsContext';
import { AppFeaturesContext } from './AppFeaturesContext';
import { TransactionsContext } from './TransactionsContext';
import { convertAmount, getExchangeRate } from './services/currencyConversion';
import { withLocalLedgerMutationLock } from './utils/ledgerMutationLock';

export const SalesContext = createContext();

const makeLinkedTradeIncome = (sale) => ({
  id: `trade_income_${sale.id}`,
  type: 'income',
  amount: sale.finalAmount,
  currencyCode: sale.currencyCode || sale.currency || 'UGX',
  currencySymbol: sale.currencySymbol || currencyFromCode(sale.currencyCode || sale.currency || 'UGX').symbol,
  currency: sale.currencyCode || sale.currency || 'UGX',
  ...(sale.baseAmount !== undefined ? { baseAmount: sale.baseAmount } : {}),
  ...(sale.baseCurrencyCode ? { baseCurrencyCode: sale.baseCurrencyCode } : {}),
  ...(sale.exchangeRate !== undefined ? { exchangeRate: sale.exchangeRate } : {}),
  ...(sale.exchangeRateTimestamp ? { exchangeRateTimestamp: sale.exchangeRateTimestamp } : {}),
  exchangeRateStale: sale.exchangeRateStale === true,
  description: `From Trade: ${sale.productName || 'Sale'}`,
  category: 'From Trade',
  timestamp: sale.timestamp || sale.createdAt || nowIso(),
  updatedAt: sale.timestamp || sale.createdAt || nowIso(),
  sourceType: 'trade',
  sourceId: sale.id,
  paymentOption: sale.paymentOption || sale.paymentMethod || 'Cash',
});

export const SalesProvider = ({ children }) => {
  const { user, activeWorkspace, storageRevision } = useContext(AuthContext);
  const { cloudSyncRevision, cloudSyncEnabled } = useContext(AppFeaturesContext);
  const { currency, detectedCurrency } = useContext(CurrencyContext);
  const { products, setProducts: setProductsState } = useContext(ProductsContext);
  const { setTransactionsForTrade, getCurrentTransactions, hydrated: transactionsHydrated } = useContext(TransactionsContext);
  const scopeId = activeWorkspace?.id || 'personal';
  const storageKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}sales` : 'expenseTracker.guest.sales';
  const transactionsStorageKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}transactions` : 'expenseTracker.guest.transactions';
  const [sales, setSales, hydrated] = usePersistedState(storageKey, [], storageRevision);
  const syncTag = `${user?.uid || ''}:${scopeId}:${cloudSyncRevision}`;
  const [cloudLoadedFor, setCloudLoadedFor] = useState('');
  const saleOperationInProgress = useRef(false);
  const cloudLoaded = cloudLoadedFor === syncTag;

  useEffect(() => {
    if (!user?.uid || !hydrated) return undefined;
    return subscribeToCollection(user.uid, 'sales', (records) => {
      setSales(records);
      setCloudLoadedFor(syncTag);
    }, (error) => console.warn('Sales cloud listener failed:', error?.message || error), scopeId);
  }, [user?.uid, setSales, scopeId, cloudSyncRevision, hydrated, syncTag]);

  useEffect(() => {
    if (!user?.uid || !cloudSyncEnabled || !hydrated || !cloudLoaded) return;
    replaceCollection(user.uid, 'sales', sales, scopeId).catch((error) => console.warn('Local sales backup failed:', error?.message || error));
  }, [user?.uid, scopeId, cloudSyncRevision, cloudSyncEnabled, hydrated, cloudLoaded, sales]);

  // Older app versions only linked Trade sales to income in the personal ledger.
  // Reconcile historical sales in every active scope so workspace dashboards and
  // the Income screen reflect existing sales exactly once.
  const reconciledIncomeScopes = useRef(new Set());
  useEffect(() => {
    if (!hydrated || !transactionsHydrated) return;
    const reconciliationKey = `${user?.uid || 'guest'}:${scopeId}:${storageRevision}`;
    if (reconciledIncomeScopes.current.has(reconciliationKey)) return;

    // Reserve this pass before entering the shared ledger queue so duplicate
    // effects cannot schedule duplicate migrations for the same storage scope.
    reconciledIncomeScopes.current.add(reconciliationKey);
    (async () => {
      try {
        await withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
          const currentTransactions = getCurrentTransactions();
          if (!Array.isArray(currentTransactions)) throw new Error('The active income ledger has not finished loading.');
          const sourceIds = new Set(currentTransactions
            .filter((item) => item?.sourceType === 'trade' && item?.sourceId)
            .map((item) => item.sourceId));
          const missingSales = sales.filter((sale) => sale?.id && !sourceIds.has(sale.id));
          if (!missingSales.length) return;
          const nextTransactions = [...currentTransactions, ...missingSales.map(makeLinkedTradeIncome)];
          await commitLocalJsonTransaction(user?.uid || 'guest', [
            { key: transactionsStorageKey, value: nextTransactions },
          ]);
          const saved = await setTransactionsForTrade(nextTransactions, { skipPersist: true });
          if (saved === false) throw new Error('Trade income could not be applied to the active ledger.');
        });
      } catch (error) {
        reconciledIncomeScopes.current.delete(reconciliationKey);
        console.warn('[Trade] Could not reconcile linked income for this ledger:', error?.message || error);
      }
    })();
  }, [hydrated, transactionsHydrated, sales, getCurrentTransactions, setTransactionsForTrade, transactionsStorageKey, user?.uid, scopeId, storageRevision]);

  const makeProductsKey = useCallback(() => user
    ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}products`
    : 'expenseTracker.guest.products', [user?.uid, scopeId]);

  const recordSale = useCallback(async ({ productId, quantity, discount = 0, paymentOption = 'Cash', currencyCode, unitPriceOverride }) => {
    if (saleOperationInProgress.current) throw new Error('Another sale is being saved. Wait for it to finish and try again.');
    saleOperationInProgress.current = true;
    try {
      return await withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
        const product = products.find((item) => item.id === productId);
        if (!product) throw new Error('Product could not be found.');
        const qty = Math.trunc(toNumber(quantity, NaN));
        const disc = toNumber(discount, 0);
        if (!Number.isInteger(qty) || qty < 1) throw new Error('Quantity must be a whole number greater than zero.');
        if (product.stock < qty) throw new Error(`Not enough stock. Available: ${product.stock}`);
        if (!Number.isFinite(disc) || disc < 0 || disc > 100) throw new Error('Discount must be between 0% and 100%.');
        const effectiveUnitPrice = unitPriceOverride === undefined || unitPriceOverride === null || unitPriceOverride === ''
          ? product.price
          : toNumber(unitPriceOverride, NaN);
        if (!Number.isFinite(effectiveUnitPrice) || effectiveUnitPrice <= 0) throw new Error('Enter a valid unit selling price greater than zero.');
        if (!transactionsHydrated || !Array.isArray(getCurrentTransactions())) throw new Error('Your income and expense records are still loading. Wait a moment and try again.');

        const priceCurrencyCode = product.currencyCode || detectedCurrency?.code || currency?.code || 'UGX';
        const saleCurrencyCode = String(currencyCode || priceCurrencyCode).toUpperCase();
        const salePriceRate = await getExchangeRate(priceCurrencyCode, saleCurrencyCode);
        const costBase = await convertAmount(product.buyingPrice, priceCurrencyCode, currency?.code || 'UGX');
        const unitPrice = effectiveUnitPrice * salePriceRate.rate * (1 - disc / 100);
        const finalAmount = Math.round(unitPrice * qty * 100) / 100;
        const converted = await convertAmount(finalAmount, saleCurrencyCode, currency?.code || 'UGX');
        const sale = {
          id: makeId('sale'), productId, productName: product.name, barcode: product.barcode || '', productCategory: product.category || '',
          originalPrice: product.price, saleUnitPrice: effectiveUnitPrice, convertedUnitPrice: Math.round(effectiveUnitPrice * salePriceRate.rate * 100) / 100, priceCurrencyCode,
          priceExchangeRate: salePriceRate.rate, priceExchangeRateTimestamp: salePriceRate.timestamp, priceExchangeRateStale: salePriceRate.isStale === true,
          costAtSale: product.buyingPrice, costCurrencyCode: priceCurrencyCode,
          costAtSaleBaseAmount: Math.round(costBase.amount * qty * 1000000) / 1000000,
          finalAmount, currencyCode: saleCurrencyCode,
          currencySymbol: currencyFromCode(saleCurrencyCode).symbol, currency: saleCurrencyCode,
          baseAmount: Math.round(converted.amount * 1000000) / 1000000,
          baseCurrencyCode: currency?.code || 'UGX', exchangeRate: converted.rate,
          exchangeRateTimestamp: converted.timestamp,
          exchangeRateStale: converted.isStale === true || costBase.isStale === true || salePriceRate.isStale === true,
          discount: disc, quantity: qty, timestamp: nowIso(), paymentOption,
        };
        const nextProducts = products.map((item) => item.id === productId
          ? { ...item, stock: item.stock - qty, updatedAt: nowIso() }
          : item);
        const nextSales = [...sales, sale];
        const linkedIncome = makeLinkedTradeIncome(sale);
        // Read inside the shared queue, not from a rendered closure, so an
        // income or expense saved just before this sale is never overwritten.
        const currentTransactions = getCurrentTransactions();
        if (!Array.isArray(currentTransactions)) throw new Error('Your income and expense records are still loading. Wait a moment and try again.');
        const nextTransactions = [
          ...currentTransactions.filter((item) => !(item.sourceType === 'trade' && item.sourceId === sale.id)),
          linkedIncome,
        ];
        const writes = [
          { key: makeProductsKey(), value: nextProducts },
          { key: storageKey, value: nextSales },
          { key: transactionsStorageKey, value: nextTransactions },
        ];
        await commitLocalJsonTransaction(user?.uid || 'guest', writes);
        if (!await setProductsState(nextProducts, { skipPersist: true, skipCloudSync: true })) throw new Error('Sale data was journalled, but the inventory state could not be updated. Reopen the app and check recovery.');
        if (!await setSales(nextSales, { skipPersist: true })) throw new Error('Sale data was journalled, but the sales list could not be updated. Reopen the app and check recovery.');
        if (!await setTransactionsForTrade(nextTransactions, { skipPersist: true })) throw new Error('Sale data was journalled, but its income entry could not be applied. Reopen the app and check recovery before processing another sale.');
        return sale;
      });
    } finally {
      saleOperationInProgress.current = false;
    }
  }, [products, sales, detectedCurrency?.code, currency?.code, user?.uid, makeProductsKey, storageKey, transactionsStorageKey, transactionsHydrated, getCurrentTransactions, setProductsState, setSales, setTransactionsForTrade]);

  const deleteSale = useCallback(async (id) => {
    if (saleOperationInProgress.current) throw new Error('Another sale change is being saved. Wait for it to finish and try again.');
    saleOperationInProgress.current = true;
    try {
      return await withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
        const sale = sales.find((item) => item.id === id);
        if (!sale) return;
        const product = products.find((item) => item.id === sale.productId);
        const nextProducts = product
          ? products.map((item) => item.id === product.id ? { ...item, stock: item.stock + sale.quantity, updatedAt: nowIso() } : item)
          : products;
        const nextSales = sales.filter((item) => item.id !== id);
        const currentTransactions = getCurrentTransactions();
        if (!Array.isArray(currentTransactions)) throw new Error('Your income and expense records are still loading. Wait a moment and try again.');
        const nextTransactions = currentTransactions.filter((item) => !(item.sourceType === 'trade' && item.sourceId === id));
        const writes = [
          { key: makeProductsKey(), value: nextProducts },
          { key: storageKey, value: nextSales },
          { key: transactionsStorageKey, value: nextTransactions },
        ];
        await commitLocalJsonTransaction(user?.uid || 'guest', writes);
        if (!await setProductsState(nextProducts, { skipPersist: true, skipCloudSync: true })) throw new Error('Sale data was journalled, but the inventory state could not be updated. Reopen the app and check recovery.');
        if (!await setSales(nextSales, { skipPersist: true })) throw new Error('Sale data was journalled, but the sales list could not be updated. Reopen the app and check recovery.');
        if (!await setTransactionsForTrade(nextTransactions, { skipPersist: true })) throw new Error('Sale changes were saved, but the income ledger could not be updated. Reopen the app and check recovery.');
      });
    } finally {
      saleOperationInProgress.current = false;
    }
  }, [sales, products, user?.uid, makeProductsKey, storageKey, transactionsStorageKey, getCurrentTransactions, setProductsState, setSales, setTransactionsForTrade]);

  const setSalesSafe = useCallback(async (updater) => {
    const next = typeof updater === 'function' ? updater(sales) : updater;
    if (!Array.isArray(next)) throw new Error('Sales records must be a list.');
    const saved = await setSales(next);
    if (!saved) throw new Error('Sales could not be saved to this device.');
    if (user?.uid) {
      const nextIds = new Set(next.map((item) => item.id));
      await Promise.all(next.map((item) => writeRecord(user.uid, 'sales', item, scopeId)));
      await Promise.all(sales.filter((item) => !nextIds.has(item.id)).map((item) => deleteRecord(user.uid, 'sales', item.id, scopeId)));
    }
  }, [sales, setSales, user?.uid, scopeId]);

  const value = useMemo(() => ({ sales, setSales: setSalesSafe, recordSale, deleteSale, hydrated }), [sales, setSalesSafe, recordSale, deleteSale, hydrated]);
  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
};
