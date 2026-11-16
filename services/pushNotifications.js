import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestore } from '../firebase';

const enabledKey = (uid) => `expenseTracker.${uid}.pushNotificationsEnabled`;
const tokenKey = (uid) => `expenseTracker.${uid}.expoPushToken`;
const safeTokenId = (token) => String(token || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140);
let handlerConfigured = false;

export async function configureNotificationPresentation() {
  const Notifications = await import('expo-notifications');
  if (!handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'FinanceTracker alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#2f7040',
      sound: 'default',
    });
  }
  return Notifications;
}

export async function registerPushNotifications(uid, { requestPermission = true } = {}) {
  if (!uid) throw new Error('Sign in to enable push notifications for your account.');
  const Notifications = await configureNotificationPresentation();
  const currentPermissions = await Notifications.getPermissionsAsync();
  let status = currentPermissions.status;
  if (status !== 'granted' && requestPermission) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    throw new Error('Notification permission was not granted. Enable notifications in your device settings and try again.');
  }

  const Constants = await import('expo-constants');
  const projectId = Constants.default?.expoConfig?.extra?.eas?.projectId
    || Constants.default?.easConfig?.projectId
    || Constants.expoConfig?.extra?.eas?.projectId
    || Constants.easConfig?.projectId;
  if (!projectId) throw new Error('The EAS project ID is missing from app.json. Configure extra.eas.projectId before enabling push notifications.');

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResult?.data;
  if (!token) throw new Error('Expo did not return a push token. Check your connection and production push credentials.');

  const tokenId = safeTokenId(token);
  await setDoc(doc(firestore, 'users', uid, 'pushTokens', tokenId), {
    token,
    platform: Platform.OS,
    enabled: true,
    updatedAt: serverTimestamp(),
    provider: 'expo',
  }, { merge: true });
  await AsyncStorage.multiSet([
    [enabledKey(uid), 'true'],
    [tokenKey(uid), token],
  ]);
  return token;
}

export async function disablePushNotifications(uid) {
  if (!uid) return;
  const token = await AsyncStorage.getItem(tokenKey(uid)).catch(() => null);
  if (token) {
    await setDoc(doc(firestore, 'users', uid, 'pushTokens', safeTokenId(token)), {
      token, platform: Platform.OS, enabled: false, updatedAt: serverTimestamp(), provider: 'expo',
    }, { merge: true }).catch((error) => {
      // Local opt-out must still work if the device is offline.
      console.warn('[Push] Could not update remote token status:', error?.message || error);
    });
  }
  await AsyncStorage.setItem(enabledKey(uid), 'false');
}

export async function isPushEnabledLocally(uid) {
  if (!uid) return false;
  return (await AsyncStorage.getItem(enabledKey(uid)).catch(() => 'false')) === 'true';
}

export async function scheduleTestNotification() {
  const Notifications = await configureNotificationPresentation();
  const { status } = await Notifications.getPermissionsAsync();
  let finalStatus = status;
  if (finalStatus !== 'granted') finalStatus = (await Notifications.requestPermissionsAsync()).status;
  if (finalStatus !== 'granted') throw new Error('Allow notifications in your device settings to send a test alert.');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'FinanceTracker notifications are working',
      body: 'Your device can display FinanceTracker alerts.',
      sound: 'default',
      data: { type: 'local_test' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
  });
}
