import React, { useCallback, useEffect, useState, useContext, useRef } from 'react';
import { View, StyleSheet, Alert, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Title, TextInput, Button, Text, Modal, Portal, IconButton, Switch } from 'react-native-paper';
import * as FileSystem from 'expo-file-system/legacy';
import { AuthContext } from '../AuthContext';
import { contentWidthStyle } from '../utils/appUtils';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { clearExternalBackupFolder, getExternalBackupFolder, getExternalBackupStatus, selectExternalBackupFolder, subscribeExternalBackupStatus, writeExternalBackup } from '../services/externalBackup';
import { restoreBackup } from '../services/backupRestore';
import TermsOfServiceButton from '../components/TermsOfServiceButton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CurrencyContext } from '../CurrencyContext';
import CurrencyPicker from '../components/CurrencyPicker';
import { userFacingError } from '../utils/userFacingErrors';
import { ThemeContext } from '../ThemeContext';
import { AppFeaturesContext } from '../AppFeaturesContext';

export default function SettingsScreen({ navigation, route }) {
  const { user, guestMode, openAccountAccess, exitGuestMode, reloadLocalData, signOut, updateUserProfile, updateUserData, personalDetails, updatePersonalDetails, activeWorkspace, exportMyData, deleteMyAccount } = useContext(AuthContext);
  const { isDark, palette, setDarkMode } = useContext(ThemeContext);
  const { pushEnabled, pushStatus, enablePushNotifications, disablePushNotifications, sendTestNotification } = useContext(AppFeaturesContext);
  const { currency, detectedCurrency, setCurrencyCode } = useContext(CurrencyContext);
  const storageOwner = user?.uid || (guestMode ? 'guest' : null);
  const isPersonalWorkspace = activeWorkspace?.id === 'personal';
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personalForm, setPersonalForm] = useState({ alternatePhone:'', jobTitle:'', address:'', city:'', country:'', taxId:'', website:'', paymentMethod:'', paymentDetails:'' });
  const [showPersonalDetails, setShowPersonalDetails] = useState(false);
  const [externalFolder, setExternalFolder] = useState(null);
  const [backupStatus, setBackupStatus] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const scrollRef = useRef(null);
  const sectionOffsets = useRef({});
  const captureSection = (name) => (event) => { sectionOffsets.current[name] = event.nativeEvent.layout.y; };

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setEmail(user.email || '');
      setPhone(user.phoneNumber || '');
    }
  }, [user]);

  useEffect(() => { setPersonalForm((form) => ({ ...form, ...(personalDetails || {}) })); }, [personalDetails]);
  useFocusEffect(useCallback(() => {
    getExternalBackupFolder(storageOwner).then(setExternalFolder).catch(() => {});
    getExternalBackupStatus(storageOwner).then((status) => setBackupStatus(status || '')).catch(() => {});
  }, [storageOwner]));

  useEffect(() => subscribeExternalBackupStatus(storageOwner, (status) => setBackupStatus(status || '')), [storageOwner]);

  useEffect(() => {
    const section = route?.params?.section;
    if (!section) return undefined;
    const timer = setTimeout(() => {
      const y = sectionOffsets.current[section];
      if (Number.isFinite(y)) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
    }, 260);
    return () => clearTimeout(timer);
  }, [route?.params?.section]);

  const handlePushToggle = async (enabled) => {
    try {
      setPushBusy(true);
      if (enabled) await enablePushNotifications();
      else await disablePushNotifications();
      Alert.alert(enabled ? 'Notifications enabled' : 'Notifications disabled', enabled ? 'This device is registered for FinanceTracker push notifications. Remote alerts are delivered only for events supported by the deployed notification service.' : 'This device has been opted out of FinanceTracker push notifications.');
    } catch (error) {
      Alert.alert('Could not update notifications', userFacingError(error, 'Check device notification permission and try again.'));
    } finally { setPushBusy(false); }
  };

  const handleTestNotification = async () => {
    try { setPushBusy(true); await sendTestNotification(); Alert.alert('Test scheduled', 'A test notification should appear shortly.'); }
    catch (error) { Alert.alert('Test notification unavailable', userFacingError(error, 'Allow notifications in your device settings and try again.')); }
    finally { setPushBusy(false); }
  };

  const savePersonalDetails = async () => {
    try { setSaving(true); await updatePersonalDetails(personalForm); Alert.alert('Saved', 'Your optional details are ready to use on invoices.'); }
    catch (error) { Alert.alert('Could not save details', userFacingError(error, 'Please try again.')); }
    finally { setSaving(false); }
  };

  const chooseExternalFolder = async () => {
    if (Platform.OS !== 'android') { Alert.alert('Folder picker unavailable', 'Choosing a Google Drive, Dropbox or external folder is supported through the Android system file picker.'); return; }
    try { setSaving(true); const uri = await selectExternalBackupFolder(storageOwner); if (uri) { setExternalFolder(uri); Alert.alert('Backup folder connected', 'Your app data will continue saving on this device and an updated backup will also be written to the selected folder.'); } }
    catch (error) { Alert.alert('Could not connect folder', userFacingError(error, 'Please try again.')); }
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
      const fileUri = `${FileSystem.cacheDirectory}FinanceTracker-export-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, data);
      // Load this native module only when export is requested. This lets the
      // app open in an older development binary and gives a useful recovery
      // message until that binary is rebuilt with expo-sharing included.
      const Sharing = await import('expo-sharing');
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Export FinanceTracker data' });
    }
    catch (error) {
      const missingNativeModule = String(error?.message || '').includes("Cannot find native module 'ExpoSharing'");
      Alert.alert(
        'Export unavailable',
        missingNativeModule
          ? 'This installed app version does not include the native sharing module. Rebuild and reinstall the Android development app, then try again.'
          : userFacingError(error, 'Could not prepare your data export. Please try again.'),
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
          catch (error) { Alert.alert('Restore failed', userFacingError(error, 'The backup could not be restored. Your existing records were not intentionally deleted.')); }
          finally { setSaving(false); }
        } },
      ]);
    } catch (error) {
      const nativeModuleMissing = String(error?.message || '').includes("Cannot find native module 'ExpoDocumentPicker'");
      Alert.alert('Restore unavailable', nativeModuleMissing
        ? 'This installed app does not include the native document picker. Rebuild and reinstall the Android development app, then try again.'
        : userFacingError(error, 'Choose a valid FinanceTracker JSON backup.'));
    }
  };

  const retryBackup = async () => {
    try { setSaving(true); const written = await writeExternalBackup(storageOwner); setBackupStatus(written ? 'Backup updated just now.' : 'Choose a backup folder to enable external backups.'); }
    catch (error) { setBackupStatus(`Backup failed: ${userFacingError(error, 'Please try again.')}`); }
    finally { setSaving(false); }
  };

  const confirmDeleteAccount = () => Alert.alert('Delete account and data?', 'This permanently deletes your account and its personal cloud data. First export anything you need. Organizations you own must be transferred or deleted before this can continue.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Continue', style: 'destructive', onPress: () => setDeleteModalVisible(true) },
  ]);


  const handleSaveUserName = async () => {
    if (!displayName.trim()) { Alert.alert('Error', 'Name cannot be empty.'); return; }
    try { setSaving(true); await updateUserProfile({ displayName: displayName.trim() }); setIsEditingUserName(false); Alert.alert('Success', 'Name updated successfully.'); } catch (error) { Alert.alert('Could not save changes', userFacingError(error, 'Please try again.')); } finally { setSaving(false); }
  };

  const handleSavePhone = async () => {
    try { setSaving(true); await updateUserData({ phone: phone.trim(), phoneNumber: phone.trim() }); setIsEditingPhone(false); Alert.alert('Success', 'Phone number updated successfully.'); } catch (error) { Alert.alert('Could not save changes', userFacingError(error, 'Please try again.')); } finally { setSaving(false); }
  };

  return <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: palette.header }]}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[styles.pageHeader, { backgroundColor: palette.header }]}><IconButton icon="arrow-left" iconColor={palette.headerText} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} accessibilityLabel="Back" /><Title style={[styles.title, { color: palette.headerText }]}>Settings</Title><View style={{ width: 48 }} /></View>
    <ScrollView ref={scrollRef} contentContainerStyle={[styles.container, { backgroundColor: palette.background }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <View style={[styles.storageCard, { backgroundColor: palette.surface }]} onLayout={captureSection('appearance')}>
      <Text style={[styles.storageTitle, { color: palette.text }]}>Appearance</Text>
      <View style={styles.externalRow}><View style={{ flex: 1 }}><Text style={[styles.infoText, { color: palette.text }]}>Dark mode</Text><Text style={[styles.storageHint, { color: palette.textMuted }]}>Use a darker interface for evening and low-light use.</Text></View><Switch value={isDark} onValueChange={setDarkMode} color={palette.primary} /></View>
    </View>
    {user && <View style={[styles.profileDetails, { borderBottomColor: palette.border }]} onLayout={captureSection('profile')}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>Your account</Text>
      <Text style={[styles.infoText, { color: palette.text }]}>Email: {email}</Text>
      <View style={styles.row}><Text style={[styles.infoText, { color: palette.text }]}>Name: {displayName || 'Not set'}</Text>{!isEditingUserName && <Button mode="outlined" onPress={() => setIsEditingUserName(true)}>Update Name</Button>}</View>
      {isEditingUserName && <View style={styles.editRow}><TextInput label="Name" value={displayName} onChangeText={setDisplayName} style={[styles.input, { backgroundColor: palette.input }]} /><Button mode="contained" onPress={handleSaveUserName} loading={saving}>Save</Button></View>}
      <View style={styles.row}><Text style={[styles.infoText, { color: palette.text }]}>Phone: {phone || 'Not set'}</Text>{!isEditingPhone && <Button mode="outlined" onPress={() => setIsEditingPhone(true)}>Update Phone</Button>}</View>
      {isEditingPhone && <View style={styles.editRow}><TextInput label="Phone Number" value={phone} onChangeText={setPhone} style={[styles.input, { backgroundColor: palette.input }]} keyboardType="phone-pad" /><Button mode="contained" onPress={handleSavePhone} loading={saving}>Save</Button></View>}
    </View>}
    {user && isPersonalWorkspace && <View style={[styles.personalDetails, { borderColor: palette.border }]}>
      <Button mode="outlined" icon={showPersonalDetails ? 'chevron-up' : 'account-edit-outline'} onPress={() => setShowPersonalDetails((visible) => !visible)}>
        {showPersonalDetails ? 'Close optional personal details' : 'Optional personal details'}
      </Button>
      {showPersonalDetails && <>
      <Text style={[styles.storageHint, { color: palette.textMuted }]}>You can add these to invoices when using your personal details as the issuer.</Text>
      {Object.keys(personalForm).map((key)=><TextInput key={key} label={{alternatePhone:'Alternate phone',jobTitle:'Job title or role',address:'Address',city:'City or town',country:'Country',taxId:'Personal tax ID (optional)',website:'Website',paymentMethod:'Preferred payment method',paymentDetails:'Payment instructions or account details'}[key]} value={personalForm[key]||''} onChangeText={(value)=>setPersonalForm((form)=>({...form,[key]:value}))} style={[styles.input, { backgroundColor: palette.input }]} />)}
      <Button mode="outlined" compact loading={saving} onPress={savePersonalDetails}>Save personal details</Button>
      </>}
    </View>}
    <Button mode="outlined" icon="help-circle-outline" onPress={() => navigation.navigate('HelpCentre')} style={styles.button}>Help Centre</Button>
    <View style={[styles.detailsSection, { borderColor: palette.border }]} onLayout={captureSection('currency')}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>Base currency</Text>
      <Text style={[styles.storageHint, { color: palette.textMuted }]}>Estimated from your device time zone and locale as {detectedCurrency.code}, not verified by GPS. Your preference ({currency.code}) is used for new transactions and reporting; existing transaction amounts are not changed.</Text>
      <CurrencyPicker value={currency.code} onChange={setCurrencyCode} label="Reporting and default currency" />
    </View>
    <Text style={[styles.helper, { color: palette.textMuted }]}>Dates and times follow your device’s region settings.</Text>
    <View onLayout={captureSection('terms')}><TermsOfServiceButton style={styles.button} /></View>
    <View style={[styles.storageCard, { backgroundColor: palette.surface }]} onLayout={captureSection('data')}>
      <Text style={[styles.storageTitle, { color: palette.text }]}>Data storage and recovery</Text>
      <View style={styles.storageChoice}><MaterialCommunityIcons name="cellphone-check" size={20} color={palette.primary}/><Text style={[styles.infoText, { color: palette.text }]}>Saved on this device · works offline</Text></View>
      <Text style={[styles.storageHint, { color: palette.textMuted }]}>Your records are saved locally and remain available without internet. They are not currently synchronized as shared ledger records to the cloud. Uninstalling the app or losing this device can remove the local copy. Export a backup regularly or connect an external folder below. JSON backups contain records and settings, but do not package the actual image files, so locally stored profile or organisation photos may need to be selected again after restoring on another device.</Text>
      <View style={styles.storageChoice}><MaterialCommunityIcons name="cloud-upload-outline" size={20} color={externalFolder ? palette.primary : '#c69c53'}/><Text style={[styles.infoText, { color: palette.text }]}>{externalFolder ? 'External backup folder connected' : 'No external backup connected'}</Text></View>
      {user && <View style={styles.storageRow}><Text style={[styles.infoText, { flex: 1, color: palette.text }]}>Cloud sync for transactions and business records is not available in this release. Use export or an external backup folder to move records to another device.</Text></View>}
      <View style={styles.externalRow}><View style={{flex:1}}><Text style={[styles.infoText, { color: palette.text }]}>External folder backup</Text>{!!externalFolder && <Text style={[styles.storageHint, { color: palette.textMuted }]}>Connected</Text>}</View><Button compact mode={externalFolder?'outlined':'contained'} disabled={saving} onPress={externalFolder?disconnectExternalFolder:chooseExternalFolder}>{externalFolder?'Disconnect':'Choose folder'}</Button></View>
      <View style={styles.externalRow}><Text style={[styles.storageHint,{flex:1, color: palette.textMuted}]}>{backupStatus || (externalFolder ? 'Folder connected, but no successful backup is recorded yet.' : 'Local storage is active. No separate backup exists until you export data or connect a folder.')}</Text><Button compact disabled={saving || !externalFolder} onPress={retryBackup}>Back up now</Button></View>
    </View>
    <View style={[styles.storageCard, { backgroundColor: palette.surface }]} onLayout={captureSection('notifications')}>
      <Text style={[styles.storageTitle, { color: palette.text }]}>Notifications</Text>
      <View style={styles.externalRow}><View style={{ flex: 1 }}><Text style={[styles.infoText, { color: palette.text }]}>Push notifications</Text><Text style={[styles.storageHint, { color: palette.textMuted }]}>{user ? pushStatus : 'Sign in to register this device for remote push notifications. In-app notices remain available without an account.'}</Text></View><Switch value={pushEnabled} onValueChange={handlePushToggle} disabled={pushBusy || !user} color={palette.primary} /></View>
      <Text style={[styles.storageHint, { color: palette.textMuted, marginTop: 6 }]}>Remote alerts are currently intended for supported account and workspace events. Trade records remain device-local in this release, so they cannot trigger remote alerts on another device.</Text>
      <Button mode="outlined" compact disabled={pushBusy} loading={pushBusy} onPress={handleTestNotification} style={{ marginTop: 10, alignSelf: 'flex-start' }}>Send test notification</Button>
    </View>
    <Button mode="outlined" disabled={saving} onPress={exportData} style={styles.button}>Export my data</Button>
    <Button mode="outlined" disabled={saving} onPress={restoreData} style={styles.button}>Restore or import backup</Button>
    {guestMode && <View style={styles.detailsSection}><Text style={[styles.sectionTitle, { color: palette.text }]} >Using FinanceTracker without an account</Text><Text style={[styles.storageHint, { color: palette.textMuted }]}>Your ledger stays on this device. Sign in or create an account only when you want account features such as company workspaces. If you sign in on this device, the guest ledger is copied into that account's local records. Exiting guest mode keeps the ledger on this device; choose Continue without an account to return to it.</Text><Button mode="contained" onPress={() => openAccountAccess().catch((error) => Alert.alert('Could not open account access', userFacingError(error, 'Please try again.')))}>Sign in or create account</Button></View>}
    <Button mode="contained" onPress={() => (guestMode ? exitGuestMode() : signOut()).catch((e) => Alert.alert('Could not sign out', userFacingError(e, 'Please try again.')))} style={styles.button}>{guestMode ? 'Exit guest mode' : 'Sign Out'}</Button>
    {user && <View onLayout={captureSection('delete')}><Button mode="text" textColor={palette.danger} disabled={saving} onPress={confirmDeleteAccount} style={styles.button}>Delete account and personal data</Button></View>}
    {user && <Portal><Modal visible={deleteModalVisible} onDismiss={() => { setDeleteModalVisible(false); setDeletePassword(''); }} contentContainerStyle={[styles.modal, { backgroundColor: palette.surface }]} >
      <Title style={{ color: palette.text }}>Confirm account deletion</Title>
      <Text style={[styles.helper, { color: palette.textMuted }]}>Enter your account password to permanently delete the account and personal cloud data.</Text>
      <TextInput label="Account password" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry style={[styles.input, { backgroundColor: palette.input }]} />
      <Button mode="contained" buttonColor="#b3261e" loading={saving} disabled={!deletePassword || saving} onPress={async () => {
        try {
          setSaving(true);
          const deletion = await deleteMyAccount(deletePassword);
          setDeleteModalVisible(false);
          if (deletion?.localCleanupComplete === false) {
            Alert.alert('Account deleted, local cleanup incomplete', 'The online account was deleted, but FinanceTracker could not confirm removal of every private file on this device. Keep this device secure, do not add more records in this session, and contact support for cleanup guidance. External backup files are not deleted by the app.');
          }
        }
        catch (error) { Alert.alert('Could not complete account deletion', userFacingError(error, 'Account deletion could not be confirmed. Check your connection and try again.')); }
        finally { setSaving(false); setDeletePassword(''); }
      }}>Delete account and data</Button>
      <Button onPress={() => { setDeleteModalVisible(false); setDeletePassword(''); }}>Cancel</Button>
    </Modal></Portal>}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea:{flex:1,backgroundColor:'#267F4D'}, pageHeader:{height:56,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:8,paddingTop:0,paddingBottom:0,backgroundColor:'#267F4D'}, container: { ...contentWidthStyle, flexGrow: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, alignItems: 'center', backgroundColor: '#f4f6f3' },
  title: { flex: 1, textAlign: 'left', backgroundColor: 'transparent', margin: 0, elevation: 0, color: '#ffffff', fontSize: 22 },
  profileDetails:{width:'100%',paddingVertical:8,marginBottom:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#d7dfd8'},
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
