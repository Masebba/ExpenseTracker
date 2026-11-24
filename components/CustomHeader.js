import React, { useContext, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Avatar, Dialog, Portal, Text, Button, Menu, Divider } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../AuthContext';
import { isUsableLocalImage, saveImageLocally } from '../utils/appUtils';
import { AppFeaturesContext } from '../AppFeaturesContext';
import { ThemeContext } from '../ThemeContext';
import { userFacingError } from '../utils/userFacingErrors';

export default function CustomHeader() {
  const navigation = useNavigation();
  const {
    user, guestMode, activeWorkspace, profileImage, updateProfileImage,
    updateWorkspacePhoto, signOut, exitGuestMode,
  } = useContext(AuthContext);
  const { notifications, unreadCount, markNotificationsRead } = useContext(AppFeaturesContext);
  const { isDark, palette, setDarkMode } = useContext(ThemeContext);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const personal = activeWorkspace?.id === 'personal';
  const name = personal
    ? (guestMode ? 'Personal · This device' : user?.displayName || 'My account')
    : activeWorkspace?.name || 'Organisation';
  const rawPhoto = personal
    ? profileImage
    : activeWorkspace?.photoURL || activeWorkspace?.logoURL || profileImage;
  const photo = rawPhoto && isUsableLocalImage(rawPhoto, FileSystem.documentDirectory) ? rawPhoto : null;

  const openNotifications = () => {
    setNotificationsVisible(true);
    markNotificationsRead();
  };

  useEffect(() => {
    let mounted = true;
    let responseSubscription = null;
    import('expo-notifications').then(async (Notifications) => {
      if (!mounted) return;
      const handleResponse = (response) => {
        const data = response?.notification?.request?.content?.data || {};
        if (data.type === 'workspace_invitation') {
          navigation.navigate('Workspaces');
        }
      };
      responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (mounted && lastResponse) { handleResponse(lastResponse); await Notifications.clearLastNotificationResponseAsync?.(); }
      } catch (error) {
        console.info('[Push] Could not read the last notification response:', error?.message || error);
      }
    }).catch((error) => console.info('[Push] Notification tap handling is available after the app is rebuilt:', error?.message || error));
    return () => {
      mounted = false;
      responseSubscription?.remove?.();
    };
  }, [navigation]);

  const pickProfilePhoto = async () => {
    try {
      setPhotoBusy(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access required', 'Allow photo-library access to choose a profile or workspace photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.72 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      if (personal) {
        const localImage = await saveImageLocally(uri, `${user?.uid || 'guest'}-profile`);
        await updateProfileImage(localImage);
        Alert.alert('Profile photo updated', 'Your photo is saved on this device.');
      } else {
        if (!user?.uid) throw new Error('Sign in to update a workspace logo.');
        if (!['owner', 'admin', 'editor'].includes(activeWorkspace?.role)) throw new Error('You do not have permission to change this workspace photo.');
        const localImage = await saveImageLocally(uri, `${user.uid}-workspace-${activeWorkspace.id}`);
        await updateWorkspacePhoto(activeWorkspace.id, localImage);
        Alert.alert('Workspace photo updated', 'The workspace photo is saved on this device.');
      }
    } catch (error) {
      Alert.alert('Could not update photo', userFacingError(error, 'Please try again.'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const openSettingsSection = (section) => {
    setMenuVisible(false);
    navigation.navigate('Settings', { section });
  };

  const openSalesScanner = () => {
    setMenuVisible(false);
    navigation.navigate('PoSNavigator', { screen: 'Sales', params: { openProcessSale: true } });
  };

  const confirmSignOut = () => {
    setMenuVisible(false);
    Alert.alert(guestMode ? 'Exit guest mode?' : 'Sign out?', guestMode ? 'Your guest records will remain on this device.' : 'You can sign in again to access your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: guestMode ? 'Exit guest mode' : 'Sign out', style: 'destructive', onPress: () => (guestMode ? exitGuestMode() : signOut()).catch((error) => Alert.alert('Could not sign out', userFacingError(error, 'Please try again.'))) },
    ]);
  };

  const openHelp = () => {
    setMenuVisible(false);
    navigation.navigate('HelpCentre');
  };

  return (
    <>
      <View style={[styles.container, { backgroundColor: palette.header }]}>
        <View style={styles.profile}>
          <TouchableOpacity onPress={pickProfilePhoto} disabled={photoBusy} style={styles.avatarButton} accessibilityRole="button" accessibilityLabel={personal ? 'Update profile photo' : 'Update workspace photo'}>
            {photoBusy ? (
              <View style={[styles.avatar, styles.avatarFallback]}><ActivityIndicator size="small" color={palette.primary} /></View>
            ) : photo ? (
              <Image source={{ uri: photo }} style={styles.avatar} />
            ) : (
              <Avatar.Text size={38} label={(name || 'A').slice(0, 1).toUpperCase()} style={styles.avatarFallback} color={palette.primaryStrong} />
            )}
            <View style={[styles.cameraBadge, { backgroundColor: palette.surface }]}><MaterialCommunityIcons name="camera-plus-outline" size={11} color={palette.primary} /></View>
          </TouchableOpacity>
          <View style={styles.nameBox}>
            <Text numberOfLines={1} style={[styles.name, { color: palette.headerText }]}>{name}</Text>
            <Text numberOfLines={1} style={[styles.workspaceRole, { color: palette.headerText }]}>{personal ? (guestMode ? 'Guest account · Saved on this device' : 'Private ledger') : (activeWorkspace?.role ? `${activeWorkspace.role} workspace` : 'Business workspace')}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openSalesScanner} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Quick sale, open sales scanner">
            <MaterialCommunityIcons name="barcode-scan" size={20} color={palette.headerText} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openNotifications} style={styles.actionButton} accessibilityRole="button" accessibilityLabel={`Notifications. ${unreadCount} unread`}>
            <MaterialCommunityIcons name="bell-outline" size={20} color={palette.headerText} />
            {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
          </TouchableOpacity>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={<TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="More options"><MaterialCommunityIcons name="dots-vertical" size={21} color={palette.headerText} /></TouchableOpacity>}
            contentStyle={[styles.menu, { backgroundColor: palette.surface }]}
          >
            <Menu.Item dense title="Update profile details" onPress={() => openSettingsSection('profile')} titleStyle={{ color: palette.text, fontSize: 13 }} />
            <Menu.Item dense title="Change currency" onPress={() => openSettingsSection('currency')} titleStyle={{ color: palette.text, fontSize: 13 }} />
            <Menu.Item dense title="Data storage and recovery" onPress={() => openSettingsSection('data')} titleStyle={{ color: palette.text, fontSize: 13 }} />
            <Menu.Item dense title="Terms of Service" onPress={() => openSettingsSection('terms')} titleStyle={{ color: palette.text, fontSize: 13 }} />
            <Menu.Item dense title="Help Centre" onPress={openHelp} titleStyle={{ color: palette.text, fontSize: 13 }} />
            <Divider style={{ backgroundColor: palette.border, marginVertical: 4 }} />
            <Menu.Item dense title={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onPress={() => { setMenuVisible(false); setDarkMode(!isDark); }} titleStyle={{ color: palette.text, fontSize: 13 }} />
            <Menu.Item dense title="Notification settings" onPress={() => openSettingsSection('notifications')} titleStyle={{ color: palette.text, fontSize: 13 }} />
            <Menu.Item dense title="All settings" onPress={() => openSettingsSection('appearance')} titleStyle={{ color: palette.text, fontSize: 13 }} />
            <Divider style={{ backgroundColor: palette.border, marginVertical: 4 }} />
            <Menu.Item dense title={guestMode ? 'Exit guest mode' : 'Sign out'} onPress={confirmSignOut} titleStyle={{ color: palette.danger, fontSize: 13 }} />
          </Menu>
        </View>
      </View>

      <Portal>
        <Dialog visible={notificationsVisible} onDismiss={() => setNotificationsVisible(false)} style={[styles.dialog, { backgroundColor: palette.surface }]}>
          <Dialog.Title style={{ color: palette.text }}>Notifications</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScroll}>
            <ScrollView contentContainerStyle={styles.notificationList}>
              {notifications.length ? notifications.map((item) => (
                <View key={item.id} style={[styles.notification, { borderBottomColor: palette.border }]}>
                  <Text style={[styles.notificationTitle, { color: palette.text }]}>{item.title}</Text>
                  <Text style={{ color: palette.text }}>{item.body}</Text>
                  <Text style={[styles.date, { color: palette.textMuted }]}>{new Date(item.createdAt).toLocaleString()}</Text>
                </View>
              )) : <Text style={[styles.empty, { color: palette.textMuted }]}>You’re all caught up.</Text>}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions><Button onPress={() => setNotificationsVisible(false)}>Close</Button></Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { height: 74, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 0, paddingBottom: 0 },
  profile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
  avatarButton: { width: 42, height: 42, position: 'relative', justifyContent: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#e5ebe4' },
  avatarFallback: { backgroundColor: '#dce8dd', alignItems: 'center', justifyContent: 'center' },
  cameraBadge: { position: 'absolute', right: 1, bottom: 0, height: 17, width: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#267F4D' },
  nameBox: { flex: 1, minWidth: 0 },
  name: { maxWidth: '100%', fontSize: 12, marginTop: 2, fontWeight: '600' },
  workspaceRole: { fontSize: 9, opacity: 0.8, marginTop: 1, textTransform: 'capitalize' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4 },
  actionButton: { height: 34, width: 30, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)' },
  badge: { position: 'absolute', right: -1, top: -1, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#c74632' },
  badgeText: { color: 'white', fontSize: 9, fontWeight: '700' },
  menu: { borderRadius: 16, maxWidth: 320 },
  dialog: { borderRadius: 18 },
  dialogScroll: { maxHeight: 380, paddingHorizontal: 0 },
  notificationList: { paddingHorizontal: 22 },
  notification: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  notificationTitle: { fontWeight: '700', marginBottom: 5 },
  date: { marginTop: 5, fontSize: 10 },
  empty: { textAlign: 'center', padding: 30 },
});
