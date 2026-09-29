import React, { useContext, useEffect, useState } from 'react';
import { Alert, ImageBackground, ScrollView, StyleSheet, View, Platform, KeyboardAvoidingView } from 'react-native';
import { Button, Card, Text, TextInput, Title } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../AuthContext';
import { AppFeaturesContext } from '../AppFeaturesContext';

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
  const [linkUrl, setLinkUrl] = useState('');
  const [editing, setEditing] = useState(null);
  const [themeColor, setThemeColor] = useState('#657a6c');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  useEffect(() => {
    let mounted = true;
    refreshDeveloperAccess().then((result) => { if (mounted) setAccess(result); });
    return () => { mounted = false; };
  }, [refreshDeveloperAccess]);

  const publish = async () => {
    if (themeColor && !/^#[0-9a-f]{6}$/i.test(themeColor)) { Alert.alert('Check background colour', 'Enter a six-digit hex colour such as #657a6c.'); return; }
    const validDate = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
    if (!validDate(startsAt) || !validDate(endsAt)) { Alert.alert('Check advert dates', 'Use YYYY-MM-DD for the start and end dates.'); return; }
    if (startsAt && endsAt && startsAt > endsAt) { Alert.alert('Check advert dates', 'The stop date must be the same as or later than the start date.'); return; }
    setBusy(true);
    try {
      const data = { title, businessName: business, description, imageUri, imageUrl, linkUrl, themeColor, startsAt, endsAt };
      if (editing) await updateAd(editing, data); else await addAd(data);
      resetForm();
      Alert.alert(editing ? 'Advert updated' : 'Published', 'Your advert schedule has been saved.');
    } catch (error) { Alert.alert('Could not publish advert', error.message || 'Try again.'); }
    finally { setBusy(false); }
  };

  const resetForm = () => { setTitle(''); setBusiness(''); setDescription(''); setImageUri(''); setImageUrl(''); setLinkUrl(''); setEditing(null); setStartsAt(''); setEndsAt(''); setThemeColor('#657a6c'); };
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo access needed', 'Allow photo access to attach an advert image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing:true, quality:0.75 });
    if (!result.canceled && result.assets?.[0]) { setImageUri(result.assets[0].uri); setImageUrl(''); }
  };

  if (!isDeveloper) return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><View style={styles.pageHeader}><Title style={styles.title}>Unavailable</Title></View><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Card style={styles.card}><Card.Content>
      <Text style={styles.copy}>This page is unavailable for this account.</Text>
      {access?.error ? <Text selectable style={styles.diagnostic}>Could not read Firestore profile: {access.error}</Text> : access ? <Text selectable style={styles.diagnostic}>Signed in UID: {access.uid}{access.email ? `\nEmail: ${access.email}` : ''}{`\nFirestore users/${access.uid}/developerAdmin: ${JSON.stringify(access.developerAdmin)}`}</Text> : <Text style={styles.copy}>Checking account access…</Text>}
      <Button mode="outlined" loading={busy} onPress={async () => { setBusy(true); try { setAccess(await refreshDeveloperAccess()); } finally { setBusy(false); } }}>Check access</Button>
    </Card.Content></Card>
  </ScrollView></KeyboardAvoidingView>;

  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Card style={styles.card}><Card.Title title="New advert" subtitle="Shown to app users on the home screen." /><Card.Content>
      <TextInput label="Banner headline" value={title} onChangeText={setTitle} style={styles.input} />
      <TextInput label="Business name (optional)" value={business} onChangeText={setBusiness} style={styles.input} />
      <TextInput label="Advert details" value={description} onChangeText={setDescription} multiline numberOfLines={5} textAlignVertical="top" style={styles.multiline} />
      <Button mode="outlined" icon="image-plus" onPress={pickImage}>{imageUri || imageUrl ? 'Change attached image' : 'Upload image (optional)'}</Button>
      {(imageUri || imageUrl) ? <Button compact onPress={()=>{setImageUri('');setImageUrl('');}}>Remove image</Button> : null}
      <TextInput label="Business link (optional)" value={linkUrl} onChangeText={setLinkUrl} autoCapitalize="none" style={styles.input} />
      <TextInput label="Background colour (hex)" value={themeColor} onChangeText={setThemeColor} autoCapitalize="none" style={styles.input} />
      <TextInput label="Starts at (YYYY-MM-DD)" value={startsAt} onChangeText={setStartsAt} style={styles.input} />
      <TextInput label="Stops at (YYYY-MM-DD)" value={endsAt} onChangeText={setEndsAt} style={styles.input} />
      {!!title && <ImageBackground source={(imageUri || imageUrl) ? { uri: imageUri || imageUrl } : undefined} style={[styles.preview,{backgroundColor:themeColor}]} imageStyle={styles.previewImage}><View style={styles.shade}><Text style={styles.business}>{business || 'Business name'}</Text><Text style={styles.previewTitle}>{title}</Text><Text style={styles.copy}>{description}</Text></View></ImageBackground>}
      {!!editing && <Button compact onPress={resetForm}>Cancel editing</Button>}
      <Button mode="contained" loading={busy} disabled={busy || !title.trim()} onPress={publish}>{editing?'Save changes':'Publish advert'}</Button>
    </Card.Content></Card>
    <Card style={styles.card}><Card.Title title="Published adverts" /><Card.Content>
      {ads.filter((ad) => ad.createdBy === user?.uid).map((ad) => <View key={ad.id} style={styles.row}><View style={styles.info}><Text>{ad.businessName || 'Advert'} · {ad.title}</Text><Text style={styles.copy}>{ad.description || 'No description'}{ad.startsAt?`\nStarts ${ad.startsAt}`:''}{ad.endsAt?` · Ends ${ad.endsAt}`:''}</Text></View><Button compact onPress={()=>{setEditing(ad.id);setTitle(ad.title);setBusiness(ad.businessName||'');setDescription(ad.description||'');setImageUri('');setImageUrl(ad.imageUrl||'');setLinkUrl(ad.linkUrl||'');setThemeColor(ad.themeColor||'#657a6c');setStartsAt(ad.startsAt||'');setEndsAt(ad.endsAt||'');}}>Edit</Button><Button compact textColor="#b3261e" onPress={() => removeAd(ad.id)}>Remove</Button></View>)}
      {!ads.some((ad) => ad.createdBy === user?.uid) && <Text style={styles.copy}>No published adverts yet.</Text>}
    </Card.Content></Card>
  </ScrollView></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ container: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 24, backgroundColor: '#f4f6f3' }, card: { marginBottom: 10, borderRadius: 14, backgroundColor: '#fff', elevation: 1 }, input: { backgroundColor: '#f7f9f6', marginVertical: 6, minHeight:50 }, multiline:{backgroundColor:'#f7f9f6',marginVertical:6,minHeight:110,textAlignVertical:'top'}, copy: { color: '#647168', lineHeight: 20, marginBottom: 8 }, diagnostic: { color: '#59675d', lineHeight: 19, fontSize: 12, marginVertical: 12 }, preview: { minHeight: 180, borderRadius: 14, overflow: 'hidden', backgroundColor: '#657a6c', marginVertical: 10, justifyContent: 'flex-end' }, previewImage: { resizeMode: 'cover' }, shade: { backgroundColor: 'rgba(0,0,0,0.38)', padding: 14 }, business: { color: '#f0f4f1', fontSize: 11, fontWeight: '700' }, previewTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 3 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dde4dc' }, info: { flex: 1 } });
