import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './AuthContext';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import usePersistedState from './utils/usePersistedState';
import { makeId, nowIso } from './utils/appUtils';

export const AppFeaturesContext = createContext();

export function AppFeaturesProvider({ children }) {
  const { user, isDeveloper } = useContext(AuthContext);
  const uid = user?.uid || 'guest';
  const [ads, setAds, adsHydrated] = usePersistedState(`expenseTracker.${uid}.ads`, []);
  const [notifications, setNotifications] = usePersistedState(`expenseTracker.${uid}.notifications`, []);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [cloudSyncRevision, setCloudSyncRevision] = useState(0);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onSnapshot(collection(firestore, 'advertisements'), (snapshot) => {
      setAds(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => console.warn('Advert sync failed:', error?.message || error));
  }, [user?.uid, setAds]);

  useEffect(() => {
    if (!user?.uid) { setCloudSyncEnabled(false); return; }
    AsyncStorage.getItem(`expenseTracker.cloudSync.${user.uid}`).then((value) => setCloudSyncEnabled(value === 'true'));
  }, [user?.uid]);

  const toggleCloudSync = useCallback(async (enabled) => {
    if (!user?.uid) return;
    await AsyncStorage.setItem(`expenseTracker.cloudSync.${user.uid}`, enabled ? 'true' : 'false');
    setCloudSyncEnabled(enabled);
    setCloudSyncRevision((value) => value + 1);
  }, [user?.uid]);

  const addAd = useCallback(async (data) => {
    const title = String(data.title || '').trim();
    if (!title) throw new Error('Enter a title for the advert.');
    if (!user?.uid || !isDeveloper) throw new Error('Advert publishing is restricted to the app developer account.');
    const ad = { id: makeId('ad'), title, businessName: String(data.businessName || '').trim(), description: String(data.description || '').trim(), imageUrl: String(data.imageUrl || '').trim(), linkUrl: String(data.linkUrl || '').trim(), active: true, createdAt: nowIso() };
    await setDoc(doc(firestore, 'advertisements', ad.id), { ...ad, createdBy: user.uid, publisherType: 'developer' });
    setAds((current) => [...current.filter((item) => item.id !== ad.id), { ...ad, createdBy: user.uid, publisherType: 'developer' }]);
    return ad;
  }, [isDeveloper, setAds, user?.uid]);

  const removeAd = useCallback((id) => {
    if (!isDeveloper) return;
    setAds((current) => current.filter((ad) => ad.id !== id));
    if (user?.uid) deleteDoc(doc(firestore, 'advertisements', id)).catch(() => {});
  }, [isDeveloper, setAds, user?.uid]);
  const addNotification = useCallback((title, body) => setNotifications((items) => [{ id: makeId('notice'), title, body, createdAt: nowIso(), read: false }, ...items].slice(0, 100)), [setNotifications]);
  const markNotificationsRead = useCallback(() => setNotifications((items) => items.map((item) => ({ ...item, read: true }))), [setNotifications]);

  const value = useMemo(() => ({ ads, adsHydrated, addAd, removeAd, notifications, unreadCount: notifications.filter((n) => !n.read).length, addNotification, markNotificationsRead, cloudSyncEnabled, cloudSyncRevision, toggleCloudSync }), [ads, adsHydrated, addAd, removeAd, notifications, addNotification, markNotificationsRead, cloudSyncEnabled, cloudSyncRevision, toggleCloudSync]);
  return <AppFeaturesContext.Provider value={value}>{children}</AppFeaturesContext.Provider>;
}
