import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './AuthContext';
import { getIdToken } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firestore, storage } from './firebase';
import { getDownloadURL, ref } from 'firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';
import usePersistedState from './utils/usePersistedState';
import { makeId, nowIso } from './utils/appUtils';
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
    if (data.imageUri && user?.uid) {
      const imagePath = `users/${user.uid}/ads/${data.imageName || `${makeId('banner')}.jpg`}`;
      const imageRef = ref(storage, imagePath);
      try {
        const bucket = storage.app.options.storageBucket;
        if (!bucket) throw new Error('Firebase Storage is not configured with a bucket.');
        const token = await getIdToken(user);
        const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(imagePath)}`;
        const response = await FileSystem.uploadAsync(uploadUrl, data.imageUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': data.imageMimeType || 'image/jpeg',
          },
        });
        if (response.status < 200 || response.status >= 300) {
          let details = response.body;
          try {
            const payload = JSON.parse(response.body);
            details = payload.error?.message || response.body;
          } catch {
            // Preserve the response body when the server does not return JSON.
          }
          const error = new Error(details || `Firebase Storage returned HTTP ${response.status}.`);
          error.code = response.status === 401 || response.status === 403
            ? 'storage/unauthorized'
            : response.status === 404
              ? 'storage/bucket-not-found'
              : `storage/http-${response.status}`;
          throw error;
        }
        imageUrl = await getDownloadURL(imageRef);
      } catch (error) {
        console.error('[Ads] Could not upload advert image:', error?.code || 'unknown', error?.message || error);
        if (error?.code === 'storage/unauthorized' || error?.code === 'storage/unauthenticated') {
          throw new Error('Firebase Storage rejected the image upload. Publish storage.rules to the configured Firebase project and confirm this developer account can write to its users/{uid}/ads/ folder.');
        }
        if (error?.code === 'storage/bucket-not-found') {
          throw new Error('The Firebase Storage bucket was not found. Check EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET and confirm Storage is enabled in the configured Firebase project.');
        }
        if (String(error?.code || '').startsWith('storage/')) {
          throw new Error(`Firebase Storage could not upload the image (${error.code}): ${error.message || 'Check Storage configuration, connectivity, and the deployed storage.rules.'}`);
        }
        throw new Error(`The advert image could not be read or uploaded: ${error?.message || 'Check the image file and Firebase Storage configuration.'}`);
      }
    }
    const ad = { id: data.id || makeId('ad'), title, businessName: String(data.businessName || '').trim(), description: String(data.description || '').trim(), imageUrl, linkUrl: String(data.linkUrl || '').trim(), startsAt: data.startsAt || '', endsAt: data.endsAt || '', active: true, createdAt: data.createdAt || nowIso() };
    try {
      await setDoc(doc(firestore, 'advertisements', ad.id), { ...ad, createdBy: user.uid, publisherType: 'developer' });
    } catch (error) {
      console.error('[Ads] Could not publish advert:', error?.code || 'unknown', error?.message || error);
      if (error?.code === 'storage/unauthorized' || error?.code === 'storage/unauthenticated') throw new Error('The image could not be uploaded. Check Firebase Storage rules and make sure the developer account has permission to write to users/{uid}/ads/.');
      if (error?.code === 'storage/bucket-not-found') throw new Error('The Firebase Storage bucket was not found. Check EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET in your app configuration.');
      if (String(error?.code || '').startsWith('storage/')) throw new Error(`Firebase Storage could not upload the image (${error.code}): ${error.message || 'Check the bucket and Storage rules.'}`);
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
