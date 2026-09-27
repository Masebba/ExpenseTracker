import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Portal, RadioButton, Text, TextInput, Title } from 'react-native-paper';
import { AuthContext } from '../AuthContext';
import { AppFeaturesContext } from '../AppFeaturesContext';
import * as ImagePicker from 'expo-image-picker';
import { saveImageLocally } from '../utils/appUtils';

export default function WorkspacesScreen({ navigation }) {
  const { user, memberships, invitations, acceptInvitation, activeWorkspace, setActiveWorkspace, createCompany, inviteMember, getMembers, changeMemberRole, removeMember, isDeveloper, developerAccessInfo, updateWorkspacePhoto } = useContext(AuthContext);
  const { ads, addAd, removeAd } = useContext(AppFeaturesContext);
  const [name, setName] = useState('');
  const [type, setType] = useState('company');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [adTitle, setAdTitle] = useState('');
  const [adBusiness, setAdBusiness] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adLinkUrl, setAdLinkUrl] = useState('');
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const current = memberships.find((item) => item.id === activeWorkspace?.id);

  const refreshMembers = useCallback(async () => {
    if (!current || !['owner', 'admin'].includes(current.role)) { setMembers([]); return; }
    try { setMembers(await getMembers(current.id)); } catch (error) { Alert.alert('Could not load members', error.message); }
  }, [current?.id, current?.role, getMembers]);

  useEffect(() => { refreshMembers(); }, [refreshMembers]);

  const perform = async (action, success) => {
    setBusy(true);
    try { await action(); if (success) Alert.alert('Done', success); }
    catch (error) { Alert.alert('Could not complete action', error.message || 'Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  const invite = () => perform(async () => {
    await inviteMember(current.id, inviteEmail, inviteRole);
    setInviteEmail('');
    await refreshMembers();
  }, 'Invitation sent. The person must sign in with that email and accept it in Workspaces.');

  const publishAd = () => perform(async () => {
    await addAd({ title: adTitle, businessName: adBusiness, description: adDescription, imageUrl: adImageUrl, linkUrl: adLinkUrl });
    setAdTitle(''); setAdBusiness(''); setAdDescription(''); setAdImageUrl(''); setAdLinkUrl('');
  }, 'Advert published for app users.');

  const chooseWorkspaceImage = async () => {
    if (!current || current.role !== 'owner') return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permission required', 'Allow photo access to choose an organisation image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;
    await perform(async () => {
      const localImage = await saveImageLocally(result.assets[0].uri, `${user.uid}-${current.id}-workspace`);
      await updateWorkspacePhoto(current.id, localImage);
    }, 'Organisation image updated.');
  };

  return <ScrollView contentContainerStyle={styles.container}>
    <Title style={styles.title}>Personal & organisations</Title>
    <Text style={styles.copy}>Your personal workspace stays private. Create or join as many organisations as you need, then switch workspace to see its separate transactions, inventory, sales, and orders.</Text>
    {!!invitations?.length && <Card style={styles.card}>
      <Card.Title title="Organisation invitations" />
      <Card.Content>{invitations.map((invitation) => <View key={invitation.id} style={styles.member}>
        <View style={styles.memberInfo}><Text>{invitation.organizationName}</Text><Text style={styles.copy}>Invited as {invitation.role}</Text></View>
        <Button mode="contained" loading={busy} onPress={() => perform(() => acceptInvitation(invitation), 'Invitation accepted.')}>Accept</Button>
      </View>)}</Card.Content>
    </Card>}
    <Card style={styles.card}>
      <Card.Title title="Your workspaces" />
      <Card.Content>
        {[{ id: 'personal', name: 'Personal', type: 'personal', role: 'owner' }, ...memberships.filter((m) => m.status === 'active')].map((workspace) => (
          <Button key={workspace.id} mode={activeWorkspace?.id === workspace.id ? 'contained' : 'outlined'} style={styles.workspaceButton} onPress={() => setActiveWorkspace(workspace)}>
            {workspace.name} · {workspace.id === 'personal' ? 'Personal' : `${workspace.role} · ${workspace.type === 'company' ? 'Company' : 'Organisation'}`}
          </Button>
        ))}
        {!memberships.some((m) => m.status === 'active') && <Text style={styles.copy}>You haven’t joined an organisation yet.</Text>}
      </Card.Content>
    </Card>
    {isDeveloper && <Card style={styles.card}>
      <Card.Title title="Developer Studio" subtitle="Manage adverts shown across the app." />
      <Card.Content><Button mode="contained" icon="bullhorn-outline" onPress={() => navigation.navigate('DeveloperStudio')}>Open Studio</Button></Card.Content>
    </Card>}
    {!!developerAccessInfo?.error && <Card style={styles.card}>
      <Card.Title title="Workspace profile unavailable" />
      <Card.Content><Text style={styles.copy}>The app could not read this account’s profile. Check the Firestore `users` document and deployed rules, then reopen Workspaces.</Text><Text selectable style={styles.diagnostic}>UID: {developerAccessInfo.uid}{'\n'}{developerAccessInfo.error}</Text></Card.Content>
    </Card>}
    <Card style={styles.card}>
      <Card.Title title="Create an organisation" />
      <Card.Content>
        <TextInput label="Company or organisation name" value={name} onChangeText={setName} style={styles.input} />
        <RadioButton.Group value={type} onValueChange={setType}>
          <RadioButton.Item label="Company" value="company" />
          <RadioButton.Item label="Organisation" value="organization" />
        </RadioButton.Group>
        <Button mode="contained" loading={busy} disabled={busy || !name.trim()} onPress={() => perform(async () => { await createCompany(name, type); setName(''); }, 'Your new workspace is ready.')}>Create workspace</Button>
      </Card.Content>
    </Card>
    {current && <Card style={styles.card}>
      <Card.Title title="Organisation profile" subtitle={current.name} />
      <Card.Content><Button icon="image-edit-outline" mode="outlined" disabled={current.role !== 'owner' || busy} onPress={chooseWorkspaceImage}>Change organisation image</Button></Card.Content>
    </Card>}
    {current && <Card style={styles.card}>
      <Card.Title title={`Manage ${current.name}`} subtitle={`Your role: ${current.role}`} />
      <Card.Content>
        {['owner', 'admin'].includes(current.role) ? <>
          <Text style={styles.section}>Add an existing user</Text>
          <Text style={styles.copy}>The person must sign up first using this same email address.</Text>
          <TextInput label="Member email" value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <RadioButton.Group value={inviteRole} onValueChange={setInviteRole}>
            <RadioButton.Item label="Admin · invite and manage workspace" value="admin" />
            <RadioButton.Item label="Editor · manage business records" value="editor" />
            <RadioButton.Item label="Viewer · view business records" value="viewer" />
          </RadioButton.Group>
          <Button mode="contained" loading={busy} disabled={busy || !inviteEmail.trim()} onPress={invite}>Add member</Button>
          <Text style={styles.section}>Members</Text>
          {members.map((member) => <View key={member.id} style={styles.member}>
            <View style={styles.memberInfo}><Text>{member.displayName || member.email || `Member ${member.id.slice(0, 6)}`}</Text><Text style={styles.copy}>{member.email || member.id} · {member.role} · {member.status}</Text></View>
            {current.role === 'owner' && member.role !== 'owner' && member.status === 'active' && <Button compact onPress={() => setSelectedId(member.id)}>Manage</Button>}
          </View>)}
          {!members.length && <Text style={styles.copy}>No members to show yet.</Text>}
        </> : <Text style={styles.copy}>Only an organisation owner or admin can invite members and manage access.</Text>}
      </Card.Content>
    </Card>}
    <Text style={styles.footer}>Signed in as {user?.email || 'your account'}</Text>
    <Portal><Dialog visible={!!selectedId} onDismiss={() => setSelectedId(null)}>
      <Dialog.Title>Manage member access</Dialog.Title>
      <Dialog.Content><Text>Choose a role or remove this person from the workspace.</Text></Dialog.Content>
      <Dialog.Actions>
        <Button onPress={() => setSelectedId(null)}>Cancel</Button>
        <Button onPress={() => perform(async () => { await changeMemberRole(current.id, selectedId, 'viewer'); setSelectedId(null); await refreshMembers(); })}>Make viewer</Button>
        <Button onPress={() => perform(async () => { await changeMemberRole(current.id, selectedId, 'editor'); setSelectedId(null); await refreshMembers(); })}>Make editor</Button>
        <Button textColor="#b3261e" onPress={() => perform(async () => { await removeMember(current.id, selectedId); setSelectedId(null); await refreshMembers(); })}>Remove</Button>
      </Dialog.Actions>
    </Dialog></Portal>
  </ScrollView>;
}

const styles = StyleSheet.create({ container: { paddingHorizontal: 18, paddingTop: 38, paddingBottom: 120, backgroundColor: '#f4f6f3' }, title: { textAlign: 'left', fontSize: 25, color: '#24432b', marginBottom: 10 }, copy: { color: '#647168', lineHeight: 21, marginBottom: 12 }, diagnostic: { color: '#59675d', fontSize: 12, lineHeight: 18 }, card: { marginBottom: 14, borderRadius: 16, backgroundColor: '#fff', elevation: 1 }, input: { backgroundColor: '#f7f9f6', marginVertical: 8 }, workspaceButton: { marginBottom: 8, borderRadius: 22 }, section: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 8, color: '#2b4931' }, member: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dde4dc' }, memberInfo: { flex: 1 }, footer: { color: '#777', textAlign: 'center', marginVertical: 12 } });
