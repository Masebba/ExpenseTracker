import React, { useContext, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Avatar, Dialog, Portal, Text, Button } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AuthContext } from '../AuthContext';
import { AppFeaturesContext } from '../AppFeaturesContext';

export default function CustomHeader() {
  const { user, activeWorkspace, profileImage } = useContext(AuthContext);
  const { notifications, unreadCount, markNotificationsRead } = useContext(AppFeaturesContext);
  const [visible, setVisible] = useState(false);
  const personal = activeWorkspace?.id === 'personal';
  const name = personal ? user?.displayName || 'My account' : activeWorkspace?.name || 'Organisation';
  const photo = personal ? profileImage : activeWorkspace?.photoURL || activeWorkspace?.logoURL || profileImage;

  const openNotifications = () => { setVisible(true); markNotificationsRead(); };

  return <>
    <View style={styles.container}>
      <View style={styles.profile}>
        {photo ? <Image source={{ uri: photo }} style={styles.avatar} /> : <Avatar.Text size={38} label={(name || 'A').slice(0, 1).toUpperCase()} style={styles.avatarFallback} />}
        <Text numberOfLines={1} style={styles.name}>{name}</Text>
      </View>
      <TouchableOpacity onPress={openNotifications} style={styles.bell} accessibilityRole="button" accessibilityLabel={`Notifications. ${unreadCount} unread`}>
        <MaterialCommunityIcons name="bell-outline" size={23} color="#284b36" />
        {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
      </TouchableOpacity>
    </View>
    <Portal><Dialog visible={visible} onDismiss={() => setVisible(false)} style={styles.dialog}>
      <Dialog.Title>Notifications</Dialog.Title>
      <Dialog.ScrollArea style={styles.dialogScroll}><ScrollView contentContainerStyle={styles.notificationList}>
        {notifications.length ? notifications.map((item) => <View key={item.id} style={styles.notification}>
          <Text style={styles.notificationTitle}>{item.title}</Text><Text>{item.body}</Text><Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>) : <Text style={styles.empty}>You’re all caught up.</Text>}
      </ScrollView></Dialog.ScrollArea>
      <Dialog.Actions><Button onPress={() => setVisible(false)}>Close</Button></Dialog.Actions>
    </Dialog></Portal>
  </>;
}

const styles = StyleSheet.create({
  container: { height: 74, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, backgroundColor: '#2f7040', borderRadius: 0 },
  profile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#e5ebe4' },
  avatarFallback: { backgroundColor: '#dce8dd' },
  name: { maxWidth: '82%', fontSize: 15, fontWeight: '700', color: '#fff' },
  bell: { height: 44, width: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  badge: { position: 'absolute', right: -1, top: -1, minWidth: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#c74632' },
  badgeText: { color: 'white', fontSize: 9, fontWeight: '700' },
  dialog: { borderRadius: 18 }, dialogScroll: { maxHeight: 380, paddingHorizontal: 0 }, notificationList: { paddingHorizontal: 22 },
  notification: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dde4dc' }, notificationTitle: { fontWeight: '700', marginBottom: 5, color: '#263d2b' }, date: { marginTop: 5, fontSize: 10, color: '#78827a' }, empty: { textAlign: 'center', padding: 30, color: '#78827a' },
});
