import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { makeId, nowIso, toNumber } from './utils/appUtils';
import usePersistedState from './utils/usePersistedState';
import { deleteRecord, replaceCollection, subscribeToCollection, writeRecord } from './services/cloudSync';
import { AppFeaturesContext } from './AppFeaturesContext';

export const OrdersContext = createContext();

export const OrdersProvider = ({ children }) => {
  const { user, activeWorkspace } = useContext(AuthContext);
  const { cloudSyncRevision, cloudSyncEnabled } = useContext(AppFeaturesContext);
  const scopeId = activeWorkspace?.id || 'personal';
  const storageKey = user ? `expenseTracker.${user.uid}.${scopeId === 'personal' ? '' : `${scopeId}.`}orders` : 'expenseTracker.guest.orders';
  const [orders, setOrders, hydrated] = usePersistedState(storageKey, []);
  const syncTag = `${user?.uid || ''}:${scopeId}:${cloudSyncRevision}`;
  const [cloudLoadedFor, setCloudLoadedFor] = React.useState('');
  const cloudLoaded = cloudLoadedFor === syncTag;

  useEffect(() => {
    if (!user?.uid) return undefined;
    if (!hydrated) return undefined;
    return subscribeToCollection(user.uid, 'orders', (records) => { setOrders(records); setCloudLoadedFor(syncTag); }, (error) => console.warn('Orders cloud listener failed:', error?.message || error), scopeId);
  }, [user?.uid, setOrders, scopeId, cloudSyncRevision, hydrated, syncTag]);

  useEffect(() => {
    if (!user?.uid || !cloudSyncEnabled || !hydrated || !cloudLoaded) return;
    replaceCollection(user.uid, 'orders', orders, scopeId).catch((error) => console.warn('Local order backup failed:', error?.message || error));
  }, [user?.uid, scopeId, cloudSyncRevision, cloudSyncEnabled, hydrated, cloudLoaded, orders]);

  const addOrder = useCallback(async (data) => {
    const total = toNumber(data.total, NaN);
    if (!data.customerName?.trim() || !data.productName?.trim()) throw new Error('Customer name and product name are required.');
    if (!Number.isFinite(total) || total <= 0) throw new Error('Order total must be greater than zero.');
    const order = { id: makeId('order'), customerName: data.customerName.trim(), customerPhone: String(data.customerPhone || '').trim(), productName: data.productName.trim(), total: Math.round(total * 100) / 100, status: 'Pending', installments: [], createdAt: nowIso(), updatedAt: nowIso() };
    await writeRecord(user?.uid, 'orders', order, scopeId);
    setOrders((current) => [...current, order]);
    return order;
  }, [setOrders, user?.uid, scopeId]);

  const updateOrder = useCallback(async (id, updates) => {
    const current = orders.find((x) => x.id === id);
    if (!current) return;
    const updated = { ...current, ...updates, total: updates.total === undefined ? current.total : toNumber(updates.total, NaN), updatedAt: nowIso() };
    if (!Number.isFinite(updated.total) || updated.total <= 0) throw new Error('Order total must be greater than zero.');
    await writeRecord(user?.uid, 'orders', updated, scopeId);
    setOrders((items) => items.map((x) => x.id === id ? updated : x));
  }, [orders, setOrders, user?.uid, scopeId]);

  const deleteOrder = useCallback(async (id) => {
    if (user?.uid) await deleteRecord(user.uid, 'orders', id, scopeId);
    setOrders((current) => current.filter((x) => x.id !== id));
  }, [setOrders, user?.uid, scopeId]);

  const addInstallment = useCallback(async (id, amount) => {
    const value = toNumber(amount, NaN);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Installment amount must be greater than zero.');
    const current = orders.find((x) => x.id === id);
    if (!current) throw new Error('Order not found.');
    const paid = (current.installments || []).reduce((sum, item) => sum + toNumber(item.amount), 0);
    const remaining = Math.max(0, current.total - paid);
    if (value > remaining) throw new Error(`Installment cannot exceed the remaining balance of ${remaining.toFixed(2)}.`);
    const installment = { id: makeId('inst'), amount: Math.round(value * 100) / 100, date: nowIso() };
    const updated = { ...current, installments: [...(current.installments || []), installment], status: paid + value >= current.total ? 'Completed' : 'Pending', updatedAt: nowIso() };
    await writeRecord(user?.uid, 'orders', updated, scopeId);
    setOrders((list) => list.map((x) => x.id === id ? updated : x));
    return installment;
  }, [orders, setOrders, user?.uid, scopeId]);

  const setOrdersSafe = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(orders) : updater;
    const previousIds = new Set(orders.map((x) => x.id));
    setOrders(next);
    if (user?.uid) {
      next.forEach((x) => { writeRecord(user.uid, 'orders', x, scopeId).catch(() => {}); previousIds.delete(x.id); });
      previousIds.forEach((id) => deleteRecord(user.uid, 'orders', id, scopeId).catch(() => {}));
    }
  }, [orders, setOrders, user?.uid, scopeId]);
  const value = useMemo(() => ({ orders, setOrders: setOrdersSafe, addOrder, updateOrder, deleteOrder, addInstallment, hydrated }), [orders, setOrdersSafe, addOrder, updateOrder, deleteOrder, addInstallment, hydrated]);
  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
};
