import React, { useEffect, useState, useContext } from 'react';
import { View, StyleSheet, Alert, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Title, TextInput, Button, Text, Modal, Portal, Switch } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { AuthContext } from '../AuthContext';
import CurrencySettings from '../CurrencySettings';
import { AppFeaturesContext } from '../AppFeaturesContext';
import { saveImageLocally } from '../utils/appUtils';

export default function SettingsScreen() {
  const { user, profileImage, updateProfileImage, signOut, updateUserProfile, updateUserData } = useContext(AuthContext);
  const { cloudSyncEnabled, toggleCloudSync } = useContext(AppFeaturesContext);
  const [profilePic, setProfilePic] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setEmail(user.email || '');
      setProfilePic(profileImage || null);
      setPhone(user.phoneNumber || '');
    }
  }, [user, profileImage]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permission required', 'Allow access to your photos to choose a profile image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (result.canceled || !result.assets?.length || !user) return;
    const uri = result.assets[0].uri;
    setSaving(true);
    try {
      const localImage = await saveImageLocally(uri, `${user.uid}-profile`);
      await updateProfileImage(localImage);
      setProfilePic(localImage);
      Alert.alert('Success', 'Profile photo saved on this device.');
    } catch (error) {
      Alert.alert('Could not save image', error.message || 'The image could not be saved on this device.');
    } finally { setSaving(false); }
  };

  const handleSaveUserName = async () => {
    if (!displayName.trim()) { Alert.alert('Error', 'Name cannot be empty.'); return; }
    try { setSaving(true); await updateUserProfile({ displayName: displayName.trim() }); setIsEditingUserName(false); Alert.alert('Success', 'Name updated successfully.'); } catch (error) { Alert.alert('Error', error.message); } finally { setSaving(false); }
  };

  const handleSavePhone = async () => {
    try { setSaving(true); await updateUserData({ phone: phone.trim(), phoneNumber: phone.trim() }); setIsEditingPhone(false); Alert.alert('Success', 'Phone number updated successfully.'); } catch (error) { Alert.alert('Error', error.message); } finally { setSaving(false); }
  };

  const handleChangePin = async () => {
    const hasOldPin = !!(await SecureStore.getItemAsync(`expenseTracker.appPin.${user?.uid}`));
    if ((hasOldPin && !/^\d{4,6}$/.test(oldPin)) || !/^\d{4,6}$/.test(newPin)) { Alert.alert('Invalid PIN', hasOldPin ? 'Use a 4 to 6 digit current and new PIN.' : 'Use a 4 to 6 digit new PIN.'); return; }
    try {
      const stored = await SecureStore.getItemAsync(`expenseTracker.appPin.${user?.uid}`);
      if (stored && stored !== oldPin) { Alert.alert('Incorrect PIN', 'The current app PIN is incorrect.'); return; }
      await SecureStore.setItemAsync(`expenseTracker.appPin.${user?.uid}`, newPin);
      setOldPin(''); setNewPin(''); setPinModalVisible(false);
      Alert.alert('Success', 'Your device-only app PIN has been changed.');
    } catch (error) { Alert.alert('Error', 'The app PIN could not be saved securely on this device.'); }
  };

  return <ScrollView contentContainerStyle={styles.container}>
    <Title style={styles.title}>Settings</Title>
    <TouchableOpacity onPress={pickImage} disabled={saving}>
      {profilePic ? <Image source={{ uri: profilePic }} style={styles.profileImage} /> : <View style={[styles.profileImage, styles.placeholder]}><Text>Upload Picture</Text></View>}
    </TouchableOpacity>
    <View style={styles.infoContainer}>
      <Text style={styles.infoText}>Email: {email}</Text>
      <View style={styles.row}><Text style={styles.infoText}>Name: {displayName || 'Not set'}</Text>{!isEditingUserName && <Button mode="outlined" onPress={() => setIsEditingUserName(true)}>Update Name</Button>}</View>
      {isEditingUserName && <View style={styles.editRow}><TextInput label="Name" value={displayName} onChangeText={setDisplayName} style={styles.input} /><Button mode="contained" onPress={handleSaveUserName} loading={saving}>Save</Button></View>}
      <View style={styles.row}><Text style={styles.infoText}>Phone: {phone || 'Not set'}</Text>{!isEditingPhone && <Button mode="outlined" onPress={() => setIsEditingPhone(true)}>Update Phone</Button>}</View>
      {isEditingPhone && <View style={styles.editRow}><TextInput label="Phone Number" value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" /><Button mode="contained" onPress={handleSavePhone} loading={saving}>Save</Button></View>}
    </View>
    <CurrencySettings />
    <Text style={styles.helper}>Changing currency sets the display currency for future entries. Existing amounts are not automatically converted.</Text>
    <View style={styles.storageCard}>
      <Text style={styles.storageTitle}>Your data stays on this device</Text>
      <Text style={styles.helper}>Records are stored locally in the app’s ExpenseTracker folder. Cloud sync is optional and off by default. Turn it on to back up and share records through this app’s Firebase account.</Text>
      <View style={styles.storageRow}><View style={{ flex: 1 }}><Text style={styles.infoText}>Cloud backup and sync</Text><Text style={styles.storageHint}>{cloudSyncEnabled ? 'Enabled for this account' : 'Local storage only'}</Text></View><Switch value={cloudSyncEnabled} onValueChange={(value) => toggleCloudSync(value).catch((error) => Alert.alert('Could not update backup', error.message))} /></View>
    </View>
    <Button mode="outlined" onPress={() => setPinModalVisible(true)} style={styles.button}>Change App PIN</Button>
    <Button mode="contained" onPress={() => signOut().catch((e) => Alert.alert('Error', e.message))} style={styles.button}>Sign Out</Button>
    <Portal><Modal visible={pinModalVisible} onDismiss={() => setPinModalVisible(false)} contentContainerStyle={styles.modal}>
      <Title>Change App PIN</Title>
      <Text style={styles.helper}>This is a device-only app lock PIN, not your Firebase account password.</Text>
      <TextInput label="Current PIN" value={oldPin} onChangeText={setOldPin} secureTextEntry keyboardType="number-pad" style={styles.input} />
      <TextInput label="New PIN" value={newPin} onChangeText={setNewPin} secureTextEntry keyboardType="number-pad" style={styles.input} />
      <Button mode="contained" onPress={handleChangePin} style={styles.button}>Save PIN</Button>
    </Modal></Portal>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 120, alignItems: 'center', backgroundColor: '#f4f6f3' },
  title: { width: '100%', textAlign: 'left', backgroundColor: 'transparent', paddingTop: 34, paddingBottom: 12, marginBottom: 10, elevation: 0, color: '#24432b', fontSize: 25 },
  profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 20 },
  placeholder: { backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  infoContainer: { width: '100%', padding: 16, backgroundColor: '#fff', borderRadius: 16, marginBottom: 14, elevation: 1 },
  infoText: { fontSize: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 5 },
  editRow: { width: '100%', marginTop: 8 },
  input: { width: '100%', marginBottom: 10, backgroundColor: '#f1fff1' },
  button: { width: '100%', marginBottom: 10, borderRadius: 24 },
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 8 },
  helper: { width: '92%', color: '#666', marginBottom: 12, textAlign: 'center' },
  storageCard: { width: '100%', padding: 16, backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, elevation: 1 },
  storageTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#24432b' },
  storageRow: { flexDirection: 'row', alignItems: 'center' },
  storageHint: { color: '#68756b', fontSize: 12 },
});
