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

  const recordSaleBatch = useCallback(async ({ items = [], paymentOption = 'Cash', currencyCode } = {}) => {
    if (saleOperationInProgress.current) throw new Error('Another sale is being saved. Wait for it to finish and try again.');
    saleOperationInProgress.current = true;
    try {
      return await withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
        if (!Array.isArray(items) || items.length === 0) throw new Error('Add at least one product to the sale before completing checkout.');
        if (!transactionsHydrated || !Array.isArray(getCurrentTransactions())) throw new Error('Your income and expense records are still loading. Wait a moment and try again.');

        const baseCurrencyCode = currency?.code || detectedCurrency?.code || 'UGX';
        const saleCurrencyCode = String(currencyCode || baseCurrencyCode).toUpperCase();
        const quantitiesByProduct = new Map();
        const preparedLines = [];
        const timestamp = nowIso();
        const saleId = makeId('sale');

        for (let index = 0; index < items.length; index += 1) {
          const input = items[index] || {};
          const product = products.find((item) => item.id === input.productId);
          if (!product) throw new Error(`Product ${index + 1} could not be found. Remove it from the cart and add it again.`);
          const qty = Math.trunc(toNumber(input.quantity, NaN));
          const disc = toNumber(input.discount, 0);
          if (!Number.isInteger(qty) || qty < 1) throw new Error(`Quantity for ${product.name} must be a whole number greater than zero.`);
          if (!Number.isFinite(disc) || disc < 0 || disc > 100) throw new Error(`Discount for ${product.name} must be between 0% and 100%.`);
          const effectiveUnitPrice = input.unitPriceOverride === undefined || input.unitPriceOverride === null || input.unitPriceOverride === ''
            ? toNumber(product.price, NaN)
            : toNumber(input.unitPriceOverride, NaN);
          if (!Number.isFinite(effectiveUnitPrice) || effectiveUnitPrice <= 0) throw new Error(`Enter a valid selling price for ${product.name}.`);

          quantitiesByProduct.set(product.id, (quantitiesByProduct.get(product.id) || 0) + qty);
          const priceCurrencyCode = product.currencyCode || detectedCurrency?.code || currency?.code || 'UGX';
          const salePriceRate = await getExchangeRate(priceCurrencyCode, saleCurrencyCode);
          const costBase = await convertAmount(toNumber(product.buyingPrice, 0), priceCurrencyCode, baseCurrencyCode);
          const convertedUnitPrice = effectiveUnitPrice * salePriceRate.rate;
          const subtotalAmount = Math.round(convertedUnitPrice * qty * 100) / 100;
          const discountAmount = Math.round(subtotalAmount * (disc / 100) * 100) / 100;
          const finalAmount = Math.round((subtotalAmount - discountAmount) * 100) / 100;
          const convertedBase = await convertAmount(finalAmount, saleCurrencyCode, baseCurrencyCode);

          preparedLines.push({
            id: `${saleId}_item_${index + 1}`,
            productId: product.id,
            productName: product.name,
            productCategory: product.category || '',
            barcode: product.barcode || '',
            originalPrice: toNumber(product.price, 0),
            saleUnitPrice: effectiveUnitPrice,
            convertedUnitPrice: Math.round(convertedUnitPrice * 100) / 100,
            priceCurrencyCode,
            currencyCode: saleCurrencyCode,
            priceExchangeRate: salePriceRate.rate,
            priceExchangeRateTimestamp: salePriceRate.timestamp,
            priceExchangeRateStale: salePriceRate.isStale === true,
            costAtSale: toNumber(product.buyingPrice, 0),
            costCurrencyCode: priceCurrencyCode,
            costAtSaleBaseAmount: Math.round(costBase.amount * qty * 1000000) / 1000000,
            costBaseCurrencyCode: baseCurrencyCode,
            quantity: qty,
            discount: disc,
            subtotalAmount,
            discountAmount,
            finalAmount,
            baseAmount: Math.round(convertedBase.amount * 1000000) / 1000000,
            baseCurrencyCode,
            exchangeRate: convertedBase.rate,
            exchangeRateTimestamp: convertedBase.timestamp,
            exchangeRateStale: convertedBase.isStale === true || costBase.isStale === true || salePriceRate.isStale === true,
          });
        }

        for (const [productId, requestedQuantity] of quantitiesByProduct.entries()) {
          const product = products.find((item) => item.id === productId);
          if (Number(product?.stock || 0) < requestedQuantity) {
            throw new Error(`Not enough stock for ${product?.name || 'a cart item'}. Available: ${product?.stock || 0}, requested: ${requestedQuantity}.`);
          }
        }

        const totalQuantity = preparedLines.reduce((sum, line) => sum + line.quantity, 0);
        const subtotalAmount = Math.round(preparedLines.reduce((sum, line) => sum + line.subtotalAmount, 0) * 100) / 100;
        const discountAmount = Math.round(preparedLines.reduce((sum, line) => sum + line.discountAmount, 0) * 100) / 100;
        const finalAmount = Math.round(preparedLines.reduce((sum, line) => sum + line.finalAmount, 0) * 100) / 100;
        const baseAmount = Math.round(preparedLines.reduce((sum, line) => sum + line.baseAmount, 0) * 1000000) / 1000000;
        const costAtSaleBaseAmount = Math.round(preparedLines.reduce((sum, line) => sum + line.costAtSaleBaseAmount, 0) * 1000000) / 1000000;
        const firstLine = preparedLines[0];
        const lineNames = preparedLines.map((line) => line.productName);
        const displayName = preparedLines.length === 1
          ? firstLine.productName
          : `${lineNames.slice(0, 2).join(', ')}${preparedLines.length > 2 ? ` +${preparedLines.length - 2} more` : ''}`;
        const sale = {
          id: saleId,
          items: preparedLines,
          itemCount: preparedLines.length,
          totalQuantity,
          productId: preparedLines.length === 1 ? firstLine.productId : null,
          productName: displayName,
          productCategory: preparedLines.length === 1 ? firstLine.productCategory : '',
          barcode: preparedLines.length === 1 ? firstLine.barcode : '',
          ...(preparedLines.length === 1 ? {
            originalPrice: firstLine.originalPrice,
            saleUnitPrice: firstLine.saleUnitPrice,
            convertedUnitPrice: firstLine.convertedUnitPrice,
            priceCurrencyCode: firstLine.priceCurrencyCode,
            priceExchangeRate: firstLine.priceExchangeRate,
            priceExchangeRateTimestamp: firstLine.priceExchangeRateTimestamp,
            priceExchangeRateStale: firstLine.priceExchangeRateStale,
            costAtSale: firstLine.costAtSale,
            costCurrencyCode: firstLine.costCurrencyCode,
            discount: firstLine.discount,
          } : { discount: 0 }),
          subtotalAmount,
          discountAmount,
          quantity: totalQuantity,
          finalAmount,
          currencyCode: saleCurrencyCode,
          currencySymbol: currencyFromCode(saleCurrencyCode).symbol,
          currency: saleCurrencyCode,
          baseAmount,
          baseCurrencyCode,
          costAtSaleBaseAmount,
          exchangeRate: finalAmount > 0 ? baseAmount / finalAmount : 1,
          exchangeRateTimestamp: timestamp,
          exchangeRateStale: preparedLines.some((line) => line.exchangeRateStale),
          priceExchangeRateStale: preparedLines.some((line) => line.priceExchangeRateStale),
          timestamp,
          paymentOption,
          paymentMethod: paymentOption,
        };

        const nextProducts = products.map((product) => {
          const soldQuantity = quantitiesByProduct.get(product.id) || 0;
          return soldQuantity > 0 ? { ...product, stock: Number(product.stock || 0) - soldQuantity, updatedAt: timestamp } : product;
        });
        const nextSales = [...sales, sale];
        const linkedIncome = makeLinkedTradeIncome(sale);
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

  const recordSale = useCallback(async ({ productId, quantity, discount = 0, paymentOption = 'Cash', currencyCode, unitPriceOverride }) => (
    recordSaleBatch({ items: [{ productId, quantity, discount, unitPriceOverride }], paymentOption, currencyCode })
  ), [recordSaleBatch]);

  const deleteSale = useCallback(async (id) => {
    if (saleOperationInProgress.current) throw new Error('Another sale change is being saved. Wait for it to finish and try again.');
    saleOperationInProgress.current = true;
    try {
      return await withLocalLedgerMutationLock(user?.uid || 'guest', async () => {
        const sale = sales.find((item) => item.id === id);
        if (!sale) return;
        const restoreByProduct = new Map();
        const saleLines = Array.isArray(sale.items) && sale.items.length
          ? sale.items
          : [{ productId: sale.productId, quantity: sale.quantity }];
        saleLines.forEach((line) => {
          if (line?.productId) restoreByProduct.set(line.productId, (restoreByProduct.get(line.productId) || 0) + Math.max(0, Number(line.quantity || 0)));
        });
        const nextProducts = products.map((item) => {
          const restoreQuantity = restoreByProduct.get(item.id) || 0;
          return restoreQuantity > 0 ? { ...item, stock: Number(item.stock || 0) + restoreQuantity, updatedAt: nowIso() } : item;
        });
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

  const value = useMemo(() => ({ sales, setSales: setSalesSafe, recordSale, recordSaleBatch, deleteSale, hydrated }), [sales, setSalesSafe, recordSale, recordSaleBatch, deleteSale, hydrated]);
  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
};
