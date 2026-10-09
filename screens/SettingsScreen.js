import React, { useCallback, useEffect, useState, useContext } from 'react';
import { View, StyleSheet, Alert, Image, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Title, TextInput, Button, Text, Modal, Portal, Switch } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { AuthContext } from '../AuthContext';
import { AppFeaturesContext } from '../AppFeaturesContext';
import { saveImageLocally, contentWidthStyle, isUsableLocalImage } from '../utils/appUtils';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { clearExternalBackupFolder, getExternalBackupFolder, getExternalBackupStatus, selectExternalBackupFolder, subscribeExternalBackupStatus, writeExternalBackup } from '../services/externalBackup';
import { restoreBackup } from '../services/backupRestore';
import TermsOfServiceButton from '../components/TermsOfServiceButton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CurrencyContext } from '../CurrencyContext';
import CurrencyPicker from '../components/CurrencyPicker';

export default function SettingsScreen({ navigation }) {
  const { user, guestMode, openAccountAccess, exitGuestMode, reloadLocalData, profileImage, updateProfileImage, signOut, updateUserProfile, updateUserData, personalDetails, updatePersonalDetails, businessProfile, updatePersonalBusinessProfile, activeWorkspace, exportMyData, deleteMyAccount } = useContext(AuthContext);
  const { currency, detectedCurrency, setCurrencyCode } = useContext(CurrencyContext);
  const storageOwner = user?.uid || (guestMode ? 'guest' : null);
  const isPersonalWorkspace = activeWorkspace?.id === 'personal';
  const { cloudSyncEnabled, toggleCloudSync } = useContext(AppFeaturesContext);
  const [profilePic, setProfilePic] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [businessForm, setBusinessForm] = useState({ legalName:'', email:'', phone:'', alternatePhone:'', address:'', city:'', country:'', taxId:'', registrationNumber:'', website:'', contactName:'', contactTitle:'', paymentMethod:'', paymentDetails:'' });
  const [personalForm, setPersonalForm] = useState({ alternatePhone:'', jobTitle:'', address:'', city:'', country:'', taxId:'', website:'', paymentMethod:'', paymentDetails:'' });
  const [showPersonalDetails, setShowPersonalDetails] = useState(false);
  const [showBusinessDetails, setShowBusinessDetails] = useState(false);
  const [externalFolder, setExternalFolder] = useState(null);
  const [backupStatus, setBackupStatus] = useState('');

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setEmail(user.email || '');
      setProfilePic(profileImage || null);
      setPhone(user.phoneNumber || '');
    }
  }, [user, profileImage]);

  useEffect(() => { setBusinessForm((form) => ({ ...form, ...(businessProfile || {}) })); }, [businessProfile]);
  useEffect(() => { setPersonalForm((form) => ({ ...form, ...(personalDetails || {}) })); }, [personalDetails]);
  useFocusEffect(useCallback(() => {
    getExternalBackupFolder(storageOwner).then(setExternalFolder).catch(() => {});
    getExternalBackupStatus(storageOwner).then((status) => setBackupStatus(status || '')).catch(() => {});
  }, [storageOwner]));

  useEffect(() => subscribeExternalBackupStatus(storageOwner, (status) => setBackupStatus(status || '')), [storageOwner]);

  const saveBusinessDetails = async () => {
    try { setSaving(true); await updatePersonalBusinessProfile(businessForm); Alert.alert('Saved', 'Your invoice business details have been saved.'); }
    catch (error) { Alert.alert('Could not save details', error.message || 'Try again.'); }
    finally { setSaving(false); }
  };

  const savePersonalDetails = async () => {
    try { setSaving(true); await updatePersonalDetails(personalForm); Alert.alert('Saved', 'Your optional details are ready to use on invoices.'); }
    catch (error) { Alert.alert('Could not save details', error.message || 'Try again.'); }
    finally { setSaving(false); }
  };

  const chooseExternalFolder = async () => {
    if (Platform.OS !== 'android') { Alert.alert('Folder picker unavailable', 'Choosing a Google Drive, Dropbox or external folder is supported through the Android system file picker.'); return; }
    try { setSaving(true); const uri = await selectExternalBackupFolder(storageOwner); if (uri) { setExternalFolder(uri); Alert.alert('Backup folder connected', 'Your app data will continue saving on this device and an updated backup will also be written to the selected folder.'); } }
    catch (error) { Alert.alert('Could not connect folder', error.message || 'Try again.'); }
    finally { setSaving(false); }
  };

  const disconnectExternalFolder = async () => {
    await clearExternalBackupFolder(storageOwner);
    setExternalFolder(null);
    setBackupStatus('External backup disconnected. The existing backup file was left in the selected folder.');
  };

  const exportData = async () => {
    try {
      setSaving(true);
      const data = await exportMyData();
      const fileUri = `${FileSystem.cacheDirectory}ExpenseTracker-export-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, data);
      // Load this native module only when export is requested. This lets the
      // app open in an older development binary and gives a useful recovery
      // message until that binary is rebuilt with expo-sharing included.
      const Sharing = await import('expo-sharing');
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Export ExpenseTracker data' });
    }
    catch (error) {
      const missingNativeModule = String(error?.message || '').includes("Cannot find native module 'ExpoSharing'");
      Alert.alert(
        'Export unavailable',
        missingNativeModule
          ? 'This installed app version does not include the native sharing module. Rebuild and reinstall the Android development app, then try again.'
          : error.message || 'Could not prepare your data export.',
      );
    }
    finally { setSaving(false); }
  };

  const restoreData = async () => {
    try {
      // Load lazily so an older development binary that predates the native
      // picker can still open Settings and use the rest of the app.
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json', '*/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const backupText = await FileSystem.readAsStringAsync(result.assets[0].uri);
      Alert.alert('Restore backup?', `Records in this backup will replace matching data on this device. Current device data is backed up temporarily and recovered if restoration fails.${user?.uid ? ' You will be signed out after a successful restore so the app can reload the restored records.' : ' The local ledger will reload after a successful restore.'}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: async () => {
          try { setSaving(true); await restoreBackup(storageOwner, backupText); if (user?.uid) await signOut(); else reloadLocalData(); }
          catch (error) { Alert.alert('Restore failed', error.message || 'The backup could not be restored.'); }
          finally { setSaving(false); }
        } },
      ]);
    } catch (error) {
      const nativeModuleMissing = String(error?.message || '').includes("Cannot find native module 'ExpoDocumentPicker'");
      Alert.alert('Restore unavailable', nativeModuleMissing
        ? 'This installed app does not include the native document picker. Rebuild and reinstall the Android development app, then try again.'
        : error.message || 'Choose a valid ExpenseTracker JSON backup.');
    }
  };

  const retryBackup = async () => {
    try { setSaving(true); const written = await writeExternalBackup(storageOwner); setBackupStatus(written ? 'Backup updated just now.' : 'Choose a backup folder to enable external backups.'); }
    catch (error) { setBackupStatus(`Backup failed: ${error.message || 'Try again.'}`); }
    finally { setSaving(false); }
  };

  const confirmDeleteAccount = () => Alert.alert('Delete account and data?', 'This permanently deletes your account and its personal cloud data. First export anything you need. Organizations you own must be transferred or deleted before this can continue.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Continue', style: 'destructive', onPress: () => setDeleteModalVisible(true) },
  ]);

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

  return <SafeAreaView edges={['top']} style={styles.safeArea}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.pageHeader}><Title style={styles.title}>Settings</Title></View>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    {user && <TouchableOpacity onPress={pickImage} disabled={saving} style={styles.avatarButton} accessibilityLabel="Choose profile photo">
      {profilePic && isUsableLocalImage(profilePic, FileSystem.documentDirectory) ? <Image source={{ uri: profilePic }} style={styles.profileImage} onError={() => setProfilePic(null)} /> : <View style={[styles.profileImage, styles.placeholder]}><MaterialCommunityIcons name="account-circle-outline" size={56} color="#7a897e" /></View>}
    </TouchableOpacity>
    }
    {user && <Text style={styles.photoHint}>{profilePic && isUsableLocalImage(profilePic, FileSystem.documentDirectory) ? 'Change profile photo' : 'Add a profile photo'}</Text>}
    {user && isPersonalWorkspace && <View style={styles.profileDetails}>
      <Text style={styles.sectionTitle}>Your account</Text>
      <Text style={styles.infoText}>Email: {email}</Text>
      <View style={styles.row}><Text style={styles.infoText}>Name: {displayName || 'Not set'}</Text>{!isEditingUserName && <Button mode="outlined" onPress={() => setIsEditingUserName(true)}>Update Name</Button>}</View>
      {isEditingUserName && <View style={styles.editRow}><TextInput label="Name" value={displayName} onChangeText={setDisplayName} style={styles.input} /><Button mode="contained" onPress={handleSaveUserName} loading={saving}>Save</Button></View>}
      <View style={styles.row}><Text style={styles.infoText}>Phone: {phone || 'Not set'}</Text>{!isEditingPhone && <Button mode="outlined" onPress={() => setIsEditingPhone(true)}>Update Phone</Button>}</View>
      {isEditingPhone && <View style={styles.editRow}><TextInput label="Phone Number" value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" /><Button mode="contained" onPress={handleSavePhone} loading={saving}>Save</Button></View>}
    </View>}
    {user && isPersonalWorkspace && <View style={styles.personalDetails}>
      <Button mode="outlined" icon={showPersonalDetails ? 'chevron-up' : 'account-edit-outline'} onPress={() => setShowPersonalDetails((visible) => !visible)}>
        {showPersonalDetails ? 'Close optional personal details' : 'Optional personal details'}
      </Button>
      {showPersonalDetails && <>
      <Text style={styles.storageHint}>You can add these to invoices when using your personal details as the issuer.</Text>
      {Object.keys(personalForm).map((key)=><TextInput key={key} label={{alternatePhone:'Alternate phone',jobTitle:'Job title or role',address:'Address',city:'City or town',country:'Country',taxId:'Personal tax ID (optional)',website:'Website',paymentMethod:'Preferred payment method',paymentDetails:'Payment instructions or account details'}[key]} value={personalForm[key]||''} onChangeText={(value)=>setPersonalForm((form)=>({...form,[key]:value}))} style={styles.input} />)}
      <Button mode="outlined" compact loading={saving} onPress={savePersonalDetails}>Save personal details</Button>
      </>}
    </View>}
    {user && isPersonalWorkspace && <View style={styles.detailsSection}>
      <Button mode="outlined" icon={showBusinessDetails ? 'chevron-up' : 'briefcase-edit-outline'} onPress={() => setShowBusinessDetails((visible) => !visible)}>
        {showBusinessDetails ? 'Close business details' : 'My business details for invoices'}
      </Button>
      {showBusinessDetails && <>
      <Text style={styles.storageHint}>Optional details used when you create an invoice from your personal workspace.</Text>
      {Object.keys(businessForm).map((key)=><TextInput key={key} label={{legalName:'Registered business name',email:'Business email',phone:'Business phone',alternatePhone:'Alternate business phone',address:'Business address',city:'City or town',country:'Country',taxId:'Tax identification number',registrationNumber:'Company registration number',website:'Website',contactName:'Invoice contact person',contactTitle:'Contact person role',paymentMethod:'Preferred payment method',paymentDetails:'Payment instructions or account details'}[key]} value={businessForm[key]||''} onChangeText={(value)=>setBusinessForm((form)=>({...form,[key]:value}))} style={styles.input} />)}
      <Button mode="contained" compact loading={saving} onPress={saveBusinessDetails}>Save business details</Button>
      </>}
    </View>}
    {user && !isPersonalWorkspace && <View style={styles.detailsSection}><Text style={styles.storageHint}>Company and organisation invoice details are managed with each workspace.</Text><Button compact mode="outlined" onPress={()=>navigation.navigate('Workspaces')}>Manage workspace details</Button></View>}
    <View style={styles.detailsSection}>
      <Text style={styles.sectionTitle}>Base currency</Text>
      <Text style={styles.storageHint}>Automatically detected as {detectedCurrency.code}. Your preference ({currency.code}) is used for new transactions and reporting; existing transaction amounts are not changed.</Text>
      <CurrencyPicker value={currency.code} onChange={setCurrencyCode} label="Reporting and default currency" />
    </View>
    <Text style={styles.helper}>Dates and times follow your device’s region settings.</Text>
    <TermsOfServiceButton style={styles.button} />
    <View style={styles.storageCard}>
      <Text style={styles.storageTitle}>Data storage</Text>
      <View style={styles.storageChoice}><MaterialCommunityIcons name="cellphone-check" size={20} color="#315d3b"/><Text style={styles.infoText}>This device · default</Text></View>
      {user && <View style={styles.storageRow}><Text style={[styles.infoText, { flex: 1 }]}>Workspace record sync</Text><Switch value={cloudSyncEnabled} disabled onValueChange={(value) => toggleCloudSync(value).catch((error) => Alert.alert('Could not update backup', error.message))} /></View>}
      <View style={styles.externalRow}><View style={{flex:1}}><Text style={styles.infoText}>External folder backup</Text>{!!externalFolder && <Text style={styles.storageHint}>Connected</Text>}</View><Button compact mode={externalFolder?'outlined':'contained'} disabled={saving} onPress={externalFolder?disconnectExternalFolder:chooseExternalFolder}>{externalFolder?'Disconnect':'Choose folder'}</Button></View>
      <View style={styles.externalRow}><Text style={[styles.storageHint,{flex:1}]}>{backupStatus || (externalFolder ? 'No successful backup recorded yet.' : 'No external backup configured.')}</Text><Button compact disabled={saving || !externalFolder} onPress={retryBackup}>Back up now</Button></View>
    </View>
    <Button mode="outlined" disabled={saving} onPress={exportData} style={styles.button}>Export my data</Button>
    <Button mode="outlined" disabled={saving} onPress={restoreData} style={styles.button}>Restore or import backup</Button>
    {guestMode && <View style={styles.detailsSection}><Text style={styles.sectionTitle}>Using ExpenseTracker without an account</Text><Text style={styles.storageHint}>Your ledger stays on this device. Sign in or create an account only when you want account features such as company workspaces. If you sign in on this device, the guest ledger is copied into that account's local records. Exiting guest mode keeps the ledger on this device; choose Continue without an account to return to it.</Text><Button mode="contained" onPress={() => openAccountAccess().catch((error) => Alert.alert('Could not open account access', error.message))}>Sign in or create account</Button></View>}
    <Button mode="contained" onPress={() => (guestMode ? exitGuestMode() : signOut()).catch((e) => Alert.alert('Error', e.message))} style={styles.button}>{guestMode ? 'Exit guest mode' : 'Sign Out'}</Button>
    {user && <Button mode="text" textColor="#b3261e" disabled={saving} onPress={confirmDeleteAccount} style={styles.button}>Delete account and personal data</Button>}
    {user && <Portal><Modal visible={deleteModalVisible} onDismiss={() => { setDeleteModalVisible(false); setDeletePassword(''); }} contentContainerStyle={styles.modal}>
      <Title>Confirm account deletion</Title>
      <Text style={styles.helper}>Enter your account password to permanently delete the account and personal cloud data.</Text>
      <TextInput label="Account password" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry style={styles.input} />
      <Button mode="contained" buttonColor="#b3261e" loading={saving} disabled={!deletePassword || saving} onPress={async () => {
        try { setSaving(true); await deleteMyAccount(deletePassword); setDeleteModalVisible(false); }
        catch (error) { Alert.alert('Account not deleted', error.message || 'Could not delete this account.'); }
        finally { setSaving(false); setDeletePassword(''); }
      }}>Delete account and data</Button>
      <Button onPress={() => { setDeleteModalVisible(false); setDeletePassword(''); }}>Cancel</Button>
    </Modal></Portal>}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea:{flex:1,backgroundColor:'#2f7040'}, pageHeader:{paddingHorizontal:14,paddingTop:10,paddingBottom:10,backgroundColor:'#2f7040'}, container: { ...contentWidthStyle, flexGrow: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, alignItems: 'center', backgroundColor: '#f4f6f3' },
  title: { width: '100%', textAlign: 'left', backgroundColor: 'transparent', margin:0, elevation: 0, color: '#ffffff', fontSize: 22 },
  avatarButton:{alignSelf:'center'}, profileImage: { width: 82, height: 82, borderRadius: 41 },
  placeholder: { backgroundColor: '#e6ece7', justifyContent: 'center', alignItems: 'center', borderWidth:1,borderColor:'#d5ded6' },
  photoHint:{fontSize:12,color:'#66756a',marginTop:5,marginBottom:10}, profileDetails:{width:'100%',paddingVertical:8,marginBottom:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#d7dfd8'},
  personalDetails:{width:'100%',paddingVertical:8,marginBottom:10}, sectionTitle:{fontSize:16,fontWeight:'700',color:'#24432b',marginBottom:8},
  infoText: { fontSize: 14, marginBottom: 5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 2 },
  editRow: { width: '100%', marginTop: 8 },
  input: { width: '100%', marginBottom: 6, backgroundColor: '#f7f9f6', height:50 },
  button: { width: '100%', marginBottom: 7, borderRadius: 20 },
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 8 },
  helper: { width: '100%', color: '#666', marginBottom: 8, textAlign: 'left',fontSize:12 },
  storageCard: { width: '100%', padding: 12, backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, elevation: 1 },
  detailsSection: { width: '100%', paddingVertical: 10, marginBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#d7dfd8' },
  storageTitle: { fontSize: 15, fontWeight: '700', marginBottom: 5, color: '#24432b' },
  storageRow: { flexDirection: 'row', alignItems: 'center',paddingVertical:8 },
  storageChoice:{flexDirection:'row',alignItems:'center',paddingVertical:7},externalRow:{flexDirection:'row',alignItems:'center',paddingVertical:8,borderTopWidth:StyleSheet.hairlineWidth,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:'#dce4dd'},
  storageHint: { color: '#68756b', fontSize: 12 },
});
