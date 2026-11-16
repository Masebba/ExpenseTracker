import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './AuthContext';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import usePersistedState from './utils/usePersistedState';
import { isValidHttpsUrl, normalizeAdvertImageUrl, makeId, nowIso } from './utils/appUtils';
import { CLOUD_SYNC_BLOCK_REASON, CLOUD_SYNC_RELEASE_BLOCKED } from './services/cloudSync';
import { configureNotificationPresentation, disablePushNotifications as disableRemotePush, isPushEnabledLocally, registerPushNotifications, scheduleTestNotification } from './services/pushNotifications';

export const AppFeaturesContext = createContext();

export function AppFeaturesProvider({ children }) {
  const { user, isDeveloper, storageRevision } = useContext(AuthContext);
  const uid = user?.uid || 'guest';
  const [ads, setAds, adsHydrated] = usePersistedState(`expenseTracker.${uid}.ads`, [], storageRevision);
  const [notifications, setNotifications] = usePersistedState(`expenseTracker.${uid}.notifications`, [], storageRevision);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [cloudSyncRevision, setCloudSyncRevision] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState('Push notifications are off.');
  const previousPushUid = useRef(null);

  useEffect(() => {
    return onSnapshot(collection(firestore, 'advertisements'), (snapshot) => {
      setAds(snapshot.docs.map((item) => {
        const data = item.data();
        const rawImage = data.imageUrl || data.imageURL || data.image_url || data.image || '';
        return { ...data, id: item.id, imageUrl: normalizeAdvertImageUrl(rawImage) || String(rawImage || '').trim() };
      }));
    }, (error) => console.warn('Advert sync failed:', error?.message || error));
  }, [setAds]);

  useEffect(() => {
    if (!user?.uid) { setCloudSyncEnabled(false); return; }
    AsyncStorage.getItem(`expenseTracker.cloudSync.${user.uid}`).then((value) => setCloudSyncEnabled(!CLOUD_SYNC_RELEASE_BLOCKED && value === 'true'));
  }, [user?.uid]);

  useEffect(() => {
    let mounted = true;
    let receivedSubscription = null;
    configureNotificationPresentation().then((Notifications) => {
      if (!mounted) return;
      receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
        const content = notification?.request?.content || {};
        const id = notification?.request?.identifier || makeId('push');
        const notice = {
          id,
          title: String(content.title || 'FinanceTracker notification'),
          body: String(content.body || ''),
          createdAt: nowIso(),
          read: false,
          data: content.data || {},
          source: 'push',
        };
        setNotifications((items) => [notice, ...items.filter((item) => item.id !== id)].slice(0, 100));
      });
    }).catch((error) => {
      // Older installed binaries may not contain the native notifications module.
      console.info('[Push] Notification support becomes available after rebuilding the app:', error?.message || error);
    });
    return () => {
      mounted = false;
      receivedSubscription?.remove?.();
    };
  }, [setNotifications]);

  useEffect(() => {
    const currentUid = user?.uid || null;
    const previousUid = previousPushUid.current;
    if (previousUid && previousUid !== currentUid) {
      disableRemotePush(previousUid).catch((error) => console.warn('[Push] Could not disable the previous account token:', error?.message || error));
    }
    previousPushUid.current = currentUid;
  }, [user?.uid]);

  useEffect(() => {
    let mounted = true;
    if (!user?.uid) { setPushEnabled(false); setPushStatus('Sign in to register this device for remote push notifications.'); return () => { mounted = false; }; }
    isPushEnabledLocally(user.uid).then(async (enabled) => {
      if (!mounted) return;
      setPushEnabled(enabled);
      setPushStatus(enabled ? 'Push notifications are enabled on this device.' : 'Push notifications are off.');
      if (enabled) {
        try { await registerPushNotifications(user.uid, { requestPermission: false }); if (mounted) setPushStatus('This device is registered for push notifications.'); }
        catch (error) { if (mounted) setPushStatus(error?.message || 'Could not refresh push registration.'); }
      }
    }).catch(() => { if (mounted) { setPushEnabled(false); setPushStatus('Push notification settings could not be loaded.'); } });
    return () => { mounted = false; };
  }, [user?.uid]);

  const enablePushNotifications = useCallback(async () => {
    if (!user?.uid) throw new Error('Sign in to enable remote push notifications. Local in-app notices remain available without an account.');
    setPushStatus('Requesting device permission and registering this device…');
    try {
      await registerPushNotifications(user.uid, { requestPermission: true });
      setPushEnabled(true);
      setPushStatus('This device is registered for push notifications. Remote alerts depend on the deployed notification service and configured push credentials.');
      return true;
    } catch (error) {
      setPushEnabled(false);
      setPushStatus(error?.message || 'Push registration failed.');
      throw error;
    }
  }, [user?.uid]);

  const disablePushNotifications = useCallback(async () => {
    if (user?.uid) await disableRemotePush(user.uid);
    setPushEnabled(false);
    setPushStatus('Push notifications are off for this device.');
  }, [user?.uid]);

  const sendTestNotification = useCallback(async () => scheduleTestNotification(), []);

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
    const rawImageUrl = String(data.imageUrl || data.imageURL || data.image_url || '').trim();
    let imageUrl = normalizeAdvertImageUrl(rawImageUrl);
    if (rawImageUrl && (!imageUrl || !isValidHttpsUrl(imageUrl))) throw new Error('Use a direct, publicly accessible HTTPS image URL. Google Drive and Dropbox sharing links are converted when their file is public.');
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

  const value = useMemo(() => ({ ads, adsHydrated, addAd, updateAd, removeAd, notifications, unreadCount: notifications.filter((n) => !n.read).length, addNotification, markNotificationsRead, cloudSyncEnabled, cloudSyncRevision, cloudSyncBlocked: CLOUD_SYNC_RELEASE_BLOCKED, cloudSyncBlockReason: CLOUD_SYNC_RELEASE_BLOCKED ? CLOUD_SYNC_BLOCK_REASON : '', toggleCloudSync, pushEnabled, pushStatus, enablePushNotifications, disablePushNotifications, sendTestNotification }), [ads, adsHydrated, addAd, updateAd, removeAd, notifications, addNotification, markNotificationsRead, cloudSyncEnabled, cloudSyncRevision, toggleCloudSync, pushEnabled, pushStatus, enablePushNotifications, disablePushNotifications, sendTestNotification]);
  return <AppFeaturesContext.Provider value={value}>{children}</AppFeaturesContext.Provider>;
}
