import React, { useContext, useEffect, useState } from 'react';
import { Alert, ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput, Title } from 'react-native-paper';
import { AuthContext } from '../AuthContext';
import { AppFeaturesContext } from '../AppFeaturesContext';

export default function DeveloperStudioScreen() {
  const { user, isDeveloper, refreshDeveloperAccess } = useContext(AuthContext);
  const { ads, addAd, removeAd } = useContext(AppFeaturesContext);
  const [access, setAccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [business, setBusiness] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    let mounted = true;
    refreshDeveloperAccess().then((result) => { if (mounted) setAccess(result); });
    return () => { mounted = false; };
  }, [refreshDeveloperAccess]);

  const publish = async () => {
    setBusy(true);
    try {
      await addAd({ title, businessName: business, description, imageUrl, linkUrl });
      setTitle(''); setBusiness(''); setDescription(''); setImageUrl(''); setLinkUrl('');
      Alert.alert('Published', 'The advert is now available to app users.');
    } catch (error) { Alert.alert('Could not publish advert', error.message || 'Try again.'); }
    finally { setBusy(false); }
  };

  if (!isDeveloper) return <ScrollView contentContainerStyle={styles.container}>
    <Title style={styles.title}>Unavailable</Title>
    <Card style={styles.card}><Card.Content>
      <Text style={styles.copy}>This page is unavailable for this account.</Text>
      {access?.error ? <Text selectable style={styles.diagnostic}>Could not read Firestore profile: {access.error}</Text> : access ? <Text selectable style={styles.diagnostic}>Signed in UID: {access.uid}{access.email ? `\nEmail: ${access.email}` : ''}{`\nFirestore users/${access.uid}/developerAdmin: ${JSON.stringify(access.developerAdmin)}`}</Text> : <Text style={styles.copy}>Checking account access…</Text>}
      <Button mode="outlined" loading={busy} onPress={async () => { setBusy(true); try { setAccess(await refreshDeveloperAccess()); } finally { setBusy(false); } }}>Check access</Button>
    </Card.Content></Card>
  </ScrollView>;

  return <ScrollView contentContainerStyle={styles.container}>
    <Title style={styles.title}>Campaigns</Title>
    <Card style={styles.card}><Card.Title title="New advert" subtitle="Shown to app users on the home screen." /><Card.Content>
      <TextInput label="Banner headline" value={title} onChangeText={setTitle} style={styles.input} />
      <TextInput label="Business name" value={business} onChangeText={setBusiness} style={styles.input} />
      <TextInput label="Advert details" value={description} onChangeText={setDescription} multiline numberOfLines={4} style={styles.input} />
      <TextInput label="Banner image URL" value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" style={styles.input} />
      <TextInput label="Business link" value={linkUrl} onChangeText={setLinkUrl} autoCapitalize="none" style={styles.input} />
      {!!title && <ImageBackground source={imageUrl ? { uri: imageUrl } : undefined} style={styles.preview} imageStyle={styles.previewImage}><View style={styles.shade}><Text style={styles.business}>{business || 'Business name'}</Text><Text style={styles.previewTitle}>{title}</Text><Text style={styles.copy}>{description}</Text></View></ImageBackground>}
      <Button mode="contained" loading={busy} disabled={busy || !title.trim() || !business.trim() || !imageUrl.trim() || !linkUrl.trim()} onPress={publish}>Publish advert</Button>
    </Card.Content></Card>
    <Card style={styles.card}><Card.Title title="Published adverts" /><Card.Content>
      {ads.filter((ad) => ad.createdBy === user?.uid).map((ad) => <View key={ad.id} style={styles.row}><View style={styles.info}><Text>{ad.businessName} · {ad.title}</Text><Text style={styles.copy}>{ad.description || 'No description'}</Text></View><Button compact textColor="#b3261e" onPress={() => removeAd(ad.id)}>Remove</Button></View>)}
      {!ads.some((ad) => ad.createdBy === user?.uid) && <Text style={styles.copy}>No published adverts yet.</Text>}
    </Card.Content></Card>
  </ScrollView>;
}

const styles = StyleSheet.create({ container: { paddingHorizontal: 18, paddingTop: 28, paddingBottom: 110, backgroundColor: '#f4f6f3' }, title: { fontSize: 25, color: '#24432b', marginBottom: 14 }, card: { marginBottom: 16, borderRadius: 16, backgroundColor: '#fff', elevation: 1 }, input: { backgroundColor: '#f7f9f6', marginVertical: 8 }, copy: { color: '#647168', lineHeight: 21, marginBottom: 12 }, diagnostic: { color: '#59675d', lineHeight: 19, fontSize: 12, marginVertical: 12 }, preview: { height: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: '#31563a', marginVertical: 10, justifyContent: 'flex-end' }, previewImage: { resizeMode: 'cover' }, shade: { backgroundColor: 'rgba(0,0,0,0.42)', padding: 14 }, business: { color: '#e2f2e4', fontSize: 11, fontWeight: '700' }, previewTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 3 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dde4dc' }, info: { flex: 1 } });
