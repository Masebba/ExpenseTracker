import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './AuthContext';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import usePersistedState from './utils/usePersistedState';
import { isValidHttpUrl, makeId, nowIso } from './utils/appUtils';
import { CLOUD_SYNC_BLOCK_REASON, CLOUD_SYNC_RELEASE_BLOCKED } from './services/cloudSync';

export const AppFeaturesContext = createContext();

export function AppFeaturesProvider({ children }) {
  const { user, isDeveloper } = useContext(AuthContext);
  const uid = user?.uid || 'guest';
  const [ads, setAds, adsHydrated] = usePersistedState(`expenseTracker.${uid}.ads`, []);
  const [notifications, setNotifications] = usePersistedState(`expenseTracker.${uid}.notifications`, []);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [cloudSyncRevision, setCloudSyncRevision] = useState(0);

  useEffect(() => {
    return onSnapshot(collection(firestore, 'advertisements'), (snapshot) => {
      setAds(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => console.warn('Advert sync failed:', error?.message || error));
  }, [setAds]);

  useEffect(() => {
    if (!user?.uid) { setCloudSyncEnabled(false); return; }
    AsyncStorage.getItem(`expenseTracker.cloudSync.${user.uid}`).then((value) => setCloudSyncEnabled(!CLOUD_SYNC_RELEASE_BLOCKED && value === 'true'));
  }, [user?.uid]);

  const toggleCloudSync = useCallback(async (enabled) => {
    if (!user?.uid) return;
    if (enabled && CLOUD_SYNC_RELEASE_BLOCKED) throw new Error(CLOUD_SYNC_BLOCK_REASON);
    await AsyncStorage.setItem(`expenseTracker.cloudSync.${user.uid}`, enabled ? 'true' : 'false');
    setCloudSyncEnabled(enabled);
    setCloudSyncRevision((value) => value + 1);
  }, [user?.uid]);

  const addAd = useCallback(async (data) => {
    const title = String(data.title || '').trim();
    if (!title && !String(data.businessName || '').trim()) throw new Error('Enter a business name or banner headline for the advert.');
    if (!user?.uid || !isDeveloper) throw new Error('Advert publishing is restricted to the app developer account.');
    let imageUrl = String(data.imageUrl || '').trim();
    if (imageUrl && !isValidHttpUrl(imageUrl)) throw new Error('Enter a valid HTTP or HTTPS image URL.');
    const ad = { id: data.id || makeId('ad'), title, businessName: String(data.businessName || '').trim(), description: String(data.description || '').trim(), imageUrl, linkUrl: String(data.linkUrl || '').trim(), startsAt: data.startsAt || '', endsAt: data.endsAt || '', active: true, createdAt: data.createdAt || nowIso() };
    try {
      await setDoc(doc(firestore, 'advertisements', ad.id), { ...ad, createdBy: user.uid, publisherType: 'developer' });
    } catch (error) {
      console.error('[Ads] Could not publish advert:', error?.code || 'unknown', error?.message || error);
      if (error?.code === 'permission-denied') throw new Error(`Firestore rejected this ad. The deployed rules must match this app's firestore.rules and be published to Firebase project ${firestore.app.options.projectId}. Also confirm users/${user.uid}.developerAdmin is Boolean true and you are signed in as that UID.`);
      throw error;
    }
    setAds((current) => [...current.filter((item) => item.id !== ad.id), { ...ad, createdBy: user.uid, publisherType: 'developer' }]);
    return ad;
  }, [isDeveloper, setAds, user?.uid]);
  const updateAd = useCallback(async (id, data) => {
    if (!isDeveloper || !user?.uid) throw new Error('Advert editing is restricted to the app developer account.');
    await addAd({ ...data, id, createdAt: ads.find((ad) => ad.id === id)?.createdAt });
  }, [addAd, ads, isDeveloper, user?.uid]);

  const removeAd = useCallback((id) => {
    if (!isDeveloper) return;
    setAds((current) => current.filter((ad) => ad.id !== id));
    if (user?.uid) deleteDoc(doc(firestore, 'advertisements', id)).catch(() => {});
  }, [isDeveloper, setAds, user?.uid]);
  const addNotification = useCallback((title, body) => setNotifications((items) => [{ id: makeId('notice'), title, body, createdAt: nowIso(), read: false }, ...items].slice(0, 100)), [setNotifications]);
  const markNotificationsRead = useCallback(() => setNotifications((items) => items.map((item) => ({ ...item, read: true }))), [setNotifications]);

  const value = useMemo(() => ({ ads, adsHydrated, addAd, updateAd, removeAd, notifications, unreadCount: notifications.filter((n) => !n.read).length, addNotification, markNotificationsRead, cloudSyncEnabled, cloudSyncRevision, cloudSyncBlocked: CLOUD_SYNC_RELEASE_BLOCKED, cloudSyncBlockReason: CLOUD_SYNC_RELEASE_BLOCKED ? CLOUD_SYNC_BLOCK_REASON : '', toggleCloudSync }), [ads, adsHydrated, addAd, updateAd, removeAd, notifications, addNotification, markNotificationsRead, cloudSyncEnabled, cloudSyncRevision, toggleCloudSync]);
  return <AppFeaturesContext.Provider value={value}>{children}</AppFeaturesContext.Provider>;
}
