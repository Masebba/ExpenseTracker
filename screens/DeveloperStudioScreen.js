import React, { useContext, useEffect, useState } from 'react';
import { Alert, ImageBackground, ScrollView, StyleSheet, View, Platform, KeyboardAvoidingView, Modal, Pressable } from 'react-native';
import { Button, Card, IconButton, Text, TextInput, Title } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app as firebaseApp } from '../firebase';
import { AuthContext } from '../AuthContext';
import { AppFeaturesContext } from '../AppFeaturesContext';
import { contentWidthStyle } from '../utils/appUtils';
import {
  DEFAULT_TERMS_OF_SERVICE,
  publishTermsOfService,
  subscribeToTermsOfService,
} from '../services/termsOfService';

const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value) => value ? new Date(`${value}T12:00:00`) : new Date();
const monthLabel = (date) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export default function DeveloperStudioScreen() {
  const { user, isDeveloper, refreshDeveloperAccess } = useContext(AuthContext);
  const { ads, addAd, updateAd, removeAd } = useContext(AppFeaturesContext);
  const [access, setAccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [business, setBusiness] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/jpeg');
  const [linkUrl, setLinkUrl] = useState('');
  const [editing, setEditing] = useState(null);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [datePicker, setDatePicker] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [counts, setCounts] = useState(null);
  const [countsError, setCountsError] = useState('');
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [termsBody, setTermsBody] = useState(DEFAULT_TERMS_OF_SERVICE);
  const [termsUpdatedAt, setTermsUpdatedAt] = useState(null);
  const [termsError, setTermsError] = useState('');
  const [termsLoaded, setTermsLoaded] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);

  const loadCounts = async () => {
    setLoadingCounts(true);
    setCountsError('');
    try {
      const readCounts = httpsCallable(getFunctions(firebaseApp), 'getAdoptionCounts');
      const result = await readCounts({});
      setCounts(result.data);
    } catch (error) {
      setCounts(null);
      setCountsError(error?.code === 'functions/not-found'
        ? 'Adoption reporting is not deployed for this Firebase project yet. Run firebase deploy --only functions.'
        : error?.message || 'Could not read adoption counts.');
    } finally { setLoadingCounts(false); }
  };

  useEffect(() => { if (isDeveloper) loadCounts(); }, [isDeveloper]);

  useEffect(() => {
    if (!isDeveloper) return undefined;
    return subscribeToTermsOfService(
      (terms) => {
        setTermsBody(terms.body);
        setTermsUpdatedAt(terms.updatedAt);
        setTermsError('');
        setTermsLoaded(true);
      },
      (error) => setTermsError(error?.message || 'Could not load the current terms.'),
    );
  }, [isDeveloper]);

  useEffect(() => {
    let mounted = true;
    refreshDeveloperAccess().then((result) => { if (mounted) setAccess(result); });
    return () => { mounted = false; };
  }, [refreshDeveloperAccess]);

  const publish = async () => {
    if (startsAt && endsAt && startsAt > endsAt) { Alert.alert('Check advert dates', 'The stop date must be the same as or later than the start date.'); return; }
    setBusy(true);
    try {
      const data = { title, businessName: business, description, imageUri, imageUrl, imageMimeType, linkUrl, startsAt, endsAt };
      if (editing) await updateAd(editing, data); else await addAd(data);
      resetForm();
      Alert.alert(editing ? 'Advert updated' : 'Published', 'Your advert schedule has been saved.');
    } catch (error) { Alert.alert('Could not publish advert', error.message || 'Try again.'); }
    finally { setBusy(false); }
  };

  const saveTerms = async () => {
    setSavingTerms(true);
    setTermsError('');
    try {
      await publishTermsOfService(termsBody, user?.uid);
      Alert.alert('Terms published', 'Users will see the updated terms in the app.');
    } catch (error) {
      setTermsError(error.message || 'Could not publish the terms.');
    } finally {
      setSavingTerms(false);
    }
  };

  const resetForm = () => { setTitle(''); setBusiness(''); setDescription(''); setImageUri(''); setImageUrl(''); setImageMimeType('image/jpeg'); setLinkUrl(''); setEditing(null); setStartsAt(''); setEndsAt(''); };
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo access needed', 'Allow photo access to attach an advert image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing:true, quality:0.75, maxWidth:1600, maxHeight:1600 });
    if (!result.canceled && result.assets?.[0]) { setImageUri(result.assets[0].uri); setImageMimeType(result.assets[0].mimeType || 'image/jpeg'); setImageUrl(''); }
  };
  const openDatePicker = (field) => {
    const current = parseDate(field === 'start' ? startsAt : endsAt || startsAt);
    setCalendarMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    setDatePicker(field);
  };
  const chooseDay = (day) => {
    const selected = formatDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    if (datePicker === 'start') {
      setStartsAt(selected);
      if (endsAt && endsAt < selected) setEndsAt('');
    } else setEndsAt(selected);
    setDatePicker(null);
  };
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();

  if (!isDeveloper) return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><View style={styles.pageHeader}><Title style={styles.title}>Unavailable</Title></View><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Card style={styles.card}><Card.Content>
      <Text style={styles.copy}>This page is unavailable for this account.</Text>
      {access?.error ? <Text selectable style={styles.diagnostic}>Could not read Firestore profile: {access.error}</Text> : access ? <Text selectable style={styles.diagnostic}>Signed in UID: {access.uid}{access.email ? `\nEmail: ${access.email}` : ''}{`\nFirestore users/${access.uid}/developerAdmin: ${JSON.stringify(access.developerAdmin)}`}</Text> : <Text style={styles.copy}>Checking account access…</Text>}
      <Button mode="outlined" loading={busy} onPress={async () => { setBusy(true); try { setAccess(await refreshDeveloperAccess()); } finally { setBusy(false); } }}>Check access</Button>
    </Card.Content></Card>
  </ScrollView></KeyboardAvoidingView>;

  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Card style={styles.card}><Card.Title title="New advert" subtitle="Shown to app users on the home screen." /><Card.Content>
      <TextInput label="Business name (optional)" value={business} onChangeText={setBusiness} style={styles.businessInput} />
      <TextInput label="Banner headline (optional)" value={title} onChangeText={setTitle} style={styles.input} />
      <TextInput label="Advert details" value={description} onChangeText={setDescription} multiline numberOfLines={5} textAlignVertical="top" style={styles.multiline} />
      <Button mode="outlined" icon="image-plus" onPress={pickImage}>{imageUri || imageUrl ? 'Change attached image' : 'Upload image (optional)'}</Button>
      {(imageUri || imageUrl) ? <Button compact onPress={()=>{setImageUri('');setImageUrl('');}}>Remove image</Button> : null}
      <TextInput label="Business link (optional)" value={linkUrl} onChangeText={setLinkUrl} autoCapitalize="none" style={styles.input} />
      <Text style={styles.dateLabel}>Schedule (optional)</Text>
      <View style={styles.dateRow}><View style={styles.dateField}><Text style={styles.dateCaption}>Starts</Text><Button compact mode="outlined" icon="calendar-month-outline" onPress={()=>openDatePicker('start')}>{startsAt || 'Choose date'}</Button></View>{!!startsAt && <IconButton icon="close-circle-outline" size={18} onPress={()=>{setStartsAt('');setEndsAt('');}}/>}</View>
      <View style={styles.dateRow}><View style={styles.dateField}><Text style={styles.dateCaption}>Ends</Text><Button compact mode="outlined" icon="calendar-month-outline" disabled={!startsAt} onPress={()=>openDatePicker('end')}>{endsAt || (startsAt?'Choose date':'Choose a start date first')}</Button></View>{!!endsAt && <IconButton icon="close-circle-outline" size={18} onPress={()=>setEndsAt('')}/>}</View>
      {(!!business || !!title) && <ImageBackground source={(imageUri || imageUrl) ? { uri: imageUri || imageUrl } : undefined} style={styles.preview} imageStyle={styles.previewImage}><View style={styles.shade}><Text style={styles.previewBusiness}>{business || 'Business name'}</Text>{!!title && <Text style={styles.previewTitle}>{title}</Text>}<Text style={styles.copy}>{description}</Text></View></ImageBackground>}
      {!!editing && <Button compact onPress={resetForm}>Cancel editing</Button>}
      <Button mode="contained" loading={busy} disabled={busy || (!title.trim() && !business.trim())} onPress={publish}>{editing?'Save changes':'Publish advert'}</Button>
    </Card.Content></Card>
    <Card style={styles.card}><Card.Title title="Adoption" subtitle="Aggregate counts only. No account details or record contents are read." /><Card.Content>
      {!!countsError && <Text style={styles.diagnostic}>{countsError}</Text>}
      {!!counts && <>
        <View style={styles.countGrid}>
          {[
            ['Registered accounts', counts.registeredAccounts],
            ['Organisations created', counts.organizationsCreated],
            ['Workspace memberships', counts.activeMemberships ?? counts.memberships],
            ['Published adverts', counts.publishedAdverts],
          ].map(([label, value]) => <View key={label} style={styles.countCell}><Text style={styles.countValue}>{value ?? '—'}</Text><Text style={styles.countLabel}>{label}</Text></View>)}
        </View>
        <Text style={styles.copy}>{counts.newAccountTrendAvailable ? `${counts.registeredAccountsLast7Days ?? '—'} accounts and ${counts.organizationsCreatedLast30Days ?? '—'} organisations created in the last 30 days.` : 'Recent sign-up trend needs a Firestore index on createdAt; totals above are unaffected.'}</Text>
        <Text style={styles.copy}>Reported {new Date(counts.generatedAt).toLocaleString()}.</Text>
      </>}
      {!counts && !countsError && <Text style={styles.copy}>Counts have not been loaded yet.</Text>}
      <Button mode="outlined" icon="chart-bar" loading={loadingCounts} onPress={loadCounts}>{counts ? 'Refresh counts' : 'Load counts'}</Button>
    </Card.Content></Card>
    <Card style={styles.card}><Card.Title title="Terms of Service & Data" subtitle="Updates are shown to users in Workspaces and Settings." /><Card.Content>
      <Text style={styles.copy}>Edit the current user-facing terms and publish them to Firebase. The default text is used until the first version is published.</Text>
      {!termsLoaded && !termsError && <Text style={styles.copy}>Loading the current terms…</Text>}
      {!!termsUpdatedAt && <Text style={styles.copy}>Last published {new Date(termsUpdatedAt).toLocaleString()}.</Text>}
      {!!termsError && <Text accessibilityRole="alert" style={styles.diagnostic}>{termsError}</Text>}
      <TextInput label="Terms shown to users" value={termsBody} onChangeText={setTermsBody} editable={termsLoaded} multiline numberOfLines={14} textAlignVertical="top" style={styles.multiline} />
      <Button mode="contained" loading={savingTerms} disabled={!termsLoaded || savingTerms || !termsBody.trim()} onPress={saveTerms}>Publish terms</Button>
    </Card.Content></Card>
    <Card style={styles.card}><Card.Title title="Published adverts" /><Card.Content>
      {ads.filter((ad) => ad.createdBy === user?.uid).map((ad) => <View key={ad.id} style={styles.row}><View style={styles.info}><Text style={styles.adBusiness}>{ad.businessName || 'Advert'}</Text>{!!ad.title && <Text style={styles.adHeadline}>{ad.title}</Text>}<Text style={styles.copy}>{ad.description || 'No description'}{ad.startsAt?`\nStarts ${ad.startsAt}`:''}{ad.endsAt?` · Ends ${ad.endsAt}`:''}</Text></View><Button compact onPress={()=>{setEditing(ad.id);setTitle(ad.title||'');setBusiness(ad.businessName||'');setDescription(ad.description||'');setImageUri('');setImageUrl(ad.imageUrl||'');setLinkUrl(ad.linkUrl||'');setStartsAt(ad.startsAt||'');setEndsAt(ad.endsAt||'');}}>Edit</Button><Button compact textColor="#b3261e" onPress={() => removeAd(ad.id)}>Remove</Button></View>)}
      {!ads.some((ad) => ad.createdBy === user?.uid) && <Text style={styles.copy}>No published adverts yet.</Text>}
    </Card.Content></Card>
  </ScrollView><Modal transparent animationType="fade" visible={!!datePicker} onRequestClose={()=>setDatePicker(null)}><View style={styles.modalBackdrop}><View style={styles.calendar}>
    <View style={styles.calendarHeader}><IconButton icon="chevron-left" onPress={()=>setCalendarMonth((month)=>new Date(month.getFullYear(),month.getMonth()-1,1))}/><Text style={styles.calendarMonth}>{monthLabel(calendarMonth)}</Text><IconButton icon="chevron-right" onPress={()=>setCalendarMonth((month)=>new Date(month.getFullYear(),month.getMonth()+1,1))}/></View>
    <View style={styles.calendarGrid}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day)=><Text key={day} style={styles.weekday}>{day}</Text>)}</View>
    <View style={styles.calendarGrid}>{Array.from({length:firstDay+daysInMonth},(_,index)=>{const day=index-firstDay+1;if(day<1)return <View key={`blank-${index}`} style={styles.dayCell}/>;const value=formatDate(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),day));const tooEarly=datePicker==='end'&&startsAt&&value<startsAt;const tooLate=datePicker==='start'&&endsAt&&value>endsAt;const selected=value===(datePicker==='start'?startsAt:endsAt);return <Pressable key={value} disabled={!!tooEarly||!!tooLate} onPress={()=>chooseDay(day)} style={[styles.dayCell,selected&&styles.selectedDay,(tooEarly||tooLate)&&styles.disabledDay]}><Text style={[styles.dayText,selected&&styles.selectedDayText]}>{day}</Text></Pressable>;})}</View>
    <Button onPress={()=>setDatePicker(null)}>Cancel</Button>
  </View></View></Modal></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  container: { ...contentWidthStyle, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 24, backgroundColor: '#f5f6f4' },
  card: { marginBottom: 10, borderRadius: 14, backgroundColor: '#fff', elevation: 1 },
  input: { backgroundColor: '#f8f9f7', marginVertical: 6, minHeight: 50 },
  businessInput: { backgroundColor: '#f8f9f7', marginVertical: 6, minHeight: 56 },
  multiline: { backgroundColor: '#f8f9f7', marginVertical: 6, minHeight: 110, textAlignVertical: 'top' },
  copy: { color: '#647168', lineHeight: 20, marginBottom: 8 },
  diagnostic: { color: '#59675d', lineHeight: 19, fontSize: 12, marginVertical: 12 },
  dateLabel: { color: '#526157', fontWeight: '700', marginTop: 10 },
  dateRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  dateField: { flex: 1 },
  dateCaption: { color: '#748078', fontSize: 12, marginLeft: 8 },
  preview: { minHeight: 180, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e8eee9', marginVertical: 10, justifyContent: 'flex-end' },
  previewImage: { resizeMode: 'cover' },
  shade: { backgroundColor: 'rgba(255,255,255,0.84)', padding: 14 },
  previewBusiness: { color: '#26382b', fontSize: 23, fontWeight: '800' },
  previewTitle: { color: '#58655b', fontSize: 15, fontWeight: '600', marginTop: 3 },
  countGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  countCell: { width: '50%', paddingVertical: 8, paddingRight: 8 },
  countValue: { color: '#26382b', fontSize: 26, fontWeight: '800' },
  countLabel: { color: '#68756b', fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dde4dc' },
  info: { flex: 1 },
  adBusiness: { color: '#26382b', fontSize: 17, fontWeight: '800' },
  adHeadline: { color: '#58655b', fontSize: 14, fontWeight: '600', marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,30,22,0.42)', justifyContent: 'center', padding: 22 },
  calendar: { backgroundColor: '#fff', borderRadius: 18, padding: 12 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarMonth: { color: '#26382b', fontSize: 17, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', color: '#66756a', fontSize: 12, paddingVertical: 8 },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  dayText: { color: '#2c392e' },
  selectedDay: { backgroundColor: '#e6eee8' },
  selectedDayText: { color: '#315d3b', fontWeight: '700' },
  disabledDay: { opacity: 0.3 },
});
