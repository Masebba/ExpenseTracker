import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  View,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import {
  Button,
  Card,
  Dialog,
  Portal,
  RadioButton,
  Text,
  TextInput,
  Title,
} from "react-native-paper";
import { AuthContext } from "../AuthContext";
import { AppFeaturesContext } from "../AppFeaturesContext";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  saveImageLocally,
  contentWidthStyle,
  isUsableLocalImage,
} from "../utils/appUtils";
import { userFacingError } from "../utils/userFacingErrors";
import { ThemeContext } from '../ThemeContext';

const emptyDetails = {
  legalName: "",
  email: "",
  phone: "",
  alternatePhone: "",
  address: "",
  city: "",
  country: "",
  taxId: "",
  registrationNumber: "",
  website: "",
  contactName: "",
  contactTitle: "",
  paymentMethod: "",
  paymentDetails: "",
};
const detailLabels = {
  legalName: "Registered legal name",
  email: "Business email",
  phone: "Business phone",
  alternatePhone: "Alternate business phone",
  address: "Business address",
  city: "City or town",
  country: "Country",
  taxId: "Tax identification number",
  registrationNumber: "Business registration number",
  website: "Website",
  contactName: "Invoice contact person",
  contactTitle: "Contact person role",
  paymentMethod: "Preferred payment method",
  paymentDetails: "Payment instructions or account details",
};

export default function WorkspacesScreen({ navigation }) {
  const { palette, isDark } = useContext(ThemeContext);
  const {
    user,
    memberships,
    invitations,
    acceptInvitation,
    activeWorkspace,
    setActiveWorkspace,
    createCompany,
    inviteMember,
    getMembers,
    changeMemberRole,
    removeMember,
    transferWorkspaceOwnership,
    deleteWorkspace,
    isDeveloper,
    developerAccessInfo,
    updateWorkspacePhoto,
    updateWorkspaceDetails,
    businessProfile,
    updatePersonalBusinessProfile,
  } = useContext(AuthContext);
  const { ads, addAd, removeAd } = useContext(AppFeaturesContext);
  const [name, setName] = useState("");
  const [newDetails, setNewDetails] = useState(emptyDetails);
  const [editDetails, setEditDetails] = useState(emptyDetails);
  const [personalBusinessDetails, setPersonalBusinessDetails] = useState({
    ...emptyDetails,
  });
  const [type, setType] = useState("company");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [adTitle, setAdTitle] = useState("");
  const [adBusiness, setAdBusiness] = useState("");
  const [adDescription, setAdDescription] = useState("");
  const [adImageUrl, setAdImageUrl] = useState("");
  const [adLinkUrl, setAdLinkUrl] = useState("");
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showCreateOrganization, setShowCreateOrganization] = useState(false);
  const current = memberships.find((item) => item.id === activeWorkspace?.id);
  useEffect(() => {
    setEditDetails({ ...emptyDetails, ...(current?.details || {}) });
  }, [current?.id, current?.details]);
  useEffect(() => {
    setPersonalBusinessDetails({ ...emptyDetails, ...(businessProfile || {}) });
  }, [businessProfile]);

  const refreshMembers = useCallback(async () => {
    if (!current || !["owner", "admin"].includes(current.role)) {
      setMembers([]);
      return;
    }
    try {
      setMembers(await getMembers(current.id));
    } catch (error) {
      const needsIndexUpdate = /index|collection[_ -]?group/i.test(String(error?.message || '')) || (String(error?.code || '').toLowerCase().includes('failed-precondition') && /index/i.test(String(error?.message || '')));
      Alert.alert(needsIndexUpdate ? "Workspace database setup needed" : "Could not load members", userFacingError(error, "We could not load workspace members. Check your connection and try again."));
    }
  }, [current?.id, current?.role, getMembers]);

  useEffect(() => {
    refreshMembers();
  }, [refreshMembers]);

  const perform = async (action, success) => {
    setBusy(true);
    try {
      const result = await action();
      const message = typeof success === "function" ? success(result) : success;
      if (message) Alert.alert("Done", message);
    } catch (error) {
      Alert.alert(
        "Could not complete action",
        userFacingError(error, "Check your connection and try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  const invite = () =>
    perform(async () => {
      const emailToInvite = inviteEmail.trim();
      await inviteMember(current.id, emailToInvite, inviteRole);
      setInviteEmail("");
    }, "Invitation sent. The person must sign in with that email and accept it in Workspaces.");

  const publishAd = () =>
    perform(async () => {
      await addAd({
        title: adTitle,
        businessName: adBusiness,
        description: adDescription,
        imageUrl: adImageUrl,
        linkUrl: adLinkUrl,
      });
      setAdTitle("");
      setAdBusiness("");
      setAdDescription("");
      setAdImageUrl("");
      setAdLinkUrl("");
    }, "Advert published for app users.");

  const chooseWorkspaceImage = async () => {
    if (!current || current.role !== "owner") return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Allow photo access to choose an organisation image.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await perform(async () => {
      const localImage = await saveImageLocally(
        result.assets[0].uri,
        `${user.uid}-${current.id}-workspace`,
      );
      await updateWorkspacePhoto(current.id, localImage);
    }, "Organisation image updated.");
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.safeArea, { backgroundColor: palette.header }]} >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.pageHeader, { backgroundColor: palette.header }]} >
          <Title style={[styles.title, { color: palette.headerText }]}>Personal & organisations</Title>
        </View>
        <ScrollView
          contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {!!invitations?.length && (
            <Card style={[styles.card, { backgroundColor: palette.surface }]} >
              <Card.Title title="Organisation invitations" />
              <Card.Content>
                {invitations.map((invitation) => (
                  <View key={invitation.id} style={styles.member}>
                    <View style={styles.memberInfo}>
                      <Text>{invitation.organizationName}</Text>
                      <Text style={[styles.copy, { color: palette.textMuted }]}>
                        Invited as {invitation.role}
                      </Text>
                    </View>
                    <Button
                      mode="contained"
                      loading={busy}
                      onPress={() =>
                        perform(
                          () => acceptInvitation(invitation),
                          "Invitation accepted.",
                        )
                      }
                    >
                      Accept
                    </Button>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}
          <Card style={[styles.card, { backgroundColor: palette.surface }]} >
            <Card.Title title="Your workspaces" />
            <Card.Content>
              {[
                {
                  id: "personal",
                  name: "Personal",
                  type: "personal",
                  role: "owner",
                },
                ...memberships.filter((m) => m.status === "active"),
              ].map((workspace) => (
                <View key={workspace.id} style={styles.workspaceBlock}>
                  <Button
                    mode={
                      activeWorkspace?.id === workspace.id
                        ? "contained"
                        : "outlined"
                    }
                    style={styles.workspaceButton}
                    onPress={() => setActiveWorkspace(workspace)}
                  >
                    {workspace.name} ·{" "}
                    {workspace.id === "personal"
                      ? "Personal"
                      : `${workspace.role} · ${workspace.type === "company" ? "Company" : "Organisation"}`}
                  </Button>
                </View>
              ))}
              {!memberships.some((m) => m.status === "active") && (
                <Text style={[styles.copy, { color: palette.textMuted }]}>
                  You haven’t joined an organisation yet.
                </Text>
              )}
            </Card.Content>
          </Card>
          {isDeveloper && (
            <Card style={[styles.card, { backgroundColor: palette.surface }]} >
              <Card.Title
                title="Developer Studio"
                subtitle="Manage adverts shown across the app."
              />
              <Card.Content>
                <Button
                  mode="contained"
                  icon="bullhorn-outline"
                  onPress={() => navigation.navigate("DeveloperStudio")}
                >
                  Open Studio
                </Button>
              </Card.Content>
            </Card>
          )}
          {!!developerAccessInfo?.error && (
            <Card style={[styles.card, { backgroundColor: palette.surface }]} >
              <Card.Title title="Workspace profile unavailable" />
              <Card.Content>
                <Text style={[styles.copy, { color: palette.textMuted }]}>
                  We could not load this account’s workspace profile. Check your connection and try again. If the problem continues, contact support.
                </Text>
                
              </Card.Content>
            </Card>
          )}
          <Card style={[styles.card, { backgroundColor: palette.surface }]} >
            <Card.Content>
              <Button
                mode="outlined"
                icon={showCreateOrganization ? "chevron-up" : "plus"}
                onPress={() => setShowCreateOrganization((visible) => !visible)}
              >
                {showCreateOrganization
                  ? "Close organisation form"
                  : "Create an organisation"}
              </Button>
              {showCreateOrganization && (
                <>
                  <TextInput
                    label="Company or organisation name"
                    value={name}
                    onChangeText={setName}
                    style={[styles.input, { backgroundColor: palette.input }]}
                  />
                  {Object.keys(emptyDetails).map((key) => (
                    <TextInput
                      key={key}
                      label={detailLabels[key]}
                      value={newDetails[key]}
                      onChangeText={(value) =>
                        setNewDetails((item) => ({ ...item, [key]: value }))
                      }
                      style={[styles.input, { backgroundColor: palette.input }]}
                    />
                  ))}
                  <RadioButton.Group value={type} onValueChange={setType}>
                    <RadioButton.Item label="Company" value="company" />
                    <RadioButton.Item
                      label="Organisation"
                      value="organization"
                    />
                  </RadioButton.Group>
                  <Button
                    mode="contained"
                    loading={busy}
                    disabled={busy || !name.trim()}
                    onPress={() =>
                      perform(async () => {
                        await createCompany(name, type, newDetails);
                        setName("");
                        setNewDetails(emptyDetails);
                        setShowCreateOrganization(false);
                      }, "Your new workspace is ready.")
                    }
                  >
                    Create workspace
                  </Button>
                </>
              )}
            </Card.Content>
          </Card>
          {user && activeWorkspace?.id === "personal" && (
            <Card style={[styles.card, { backgroundColor: palette.surface }]} >
              <Card.Title
                title="Personal workspace invoice details"
                subtitle="Used when you create an invoice from your personal workspace."
              />
              <Card.Content>
                {Object.keys(emptyDetails).map((key) => (
                  <TextInput
                    key={key}
                    label={detailLabels[key]}
                    value={personalBusinessDetails[key] || ""}
                    onChangeText={(value) =>
                      setPersonalBusinessDetails((item) => ({
                        ...item,
                        [key]: value,
                      }))
                    }
                    style={[styles.input, { backgroundColor: palette.input }]}
                  />
                ))}
                <Button
                  mode="contained"
                  disabled={busy}
                  loading={busy}
                  onPress={() =>
                    perform(
                      () =>
                        updatePersonalBusinessProfile(personalBusinessDetails),
                      "Personal invoice details saved.",
                    )
                  }
                >
                  Save invoice details
                </Button>
              </Card.Content>
            </Card>
          )}
          {current && (
            <Card style={[styles.card, { backgroundColor: palette.surface }]} >
              <Card.Title
                title="Organisation profile"
                subtitle={current.name}
              />
              <Card.Content>
                {current.photoURL &&
                  isUsableLocalImage(
                    current.photoURL,
                    FileSystem.documentDirectory,
                  ) && (
                    <Card.Cover
                      source={{ uri: current.photoURL }}
                      style={{ marginBottom: 10, borderRadius: 12 }}
                    />
                  )}
                <Button
                  icon="image-edit-outline"
                  mode="outlined"
                  disabled={current.role !== "owner" || busy}
                  onPress={chooseWorkspaceImage}
                >
                  Change organisation image
                </Button>
                <Text style={styles.section}>
                  Invoice and organisation details
                </Text>
                {Object.keys(emptyDetails).map((key) => (
                  <TextInput
                    key={key}
                    label={detailLabels[key]}
                    value={editDetails[key] || ""}
                    onChangeText={(value) =>
                      setEditDetails((item) => ({ ...item, [key]: value }))
                    }
                    style={[styles.input, { backgroundColor: palette.input }]}
                  />
                ))}
                <Button
                  mode="contained"
                  disabled={busy || current.role !== "owner"}
                  loading={busy}
                  onPress={() =>
                    perform(
                      () => updateWorkspaceDetails(current.id, editDetails),
                      "Organisation details saved.",
                    )
                  }
                >
                  Save organisation details
                </Button>
              </Card.Content>
            </Card>
          )}
          {current && (
            <Card style={[styles.card, { backgroundColor: palette.surface }]} >
              <Card.Title
                title={`Manage ${current.name}`}
                subtitle={`Your role: ${current.role}`}
              />
              <Card.Content>
                {["owner", "admin"].includes(current.role) ? (
                  <>
                    <Text style={styles.section}>Add an existing user</Text>
                    <Text style={[styles.copy, { color: palette.textMuted }]}>
                      The person must sign up first using this same email
                      address.
                    </Text>
                    <TextInput
                      label="Member email"
                      value={inviteEmail}
                      onChangeText={setInviteEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      returnKeyType="done"
                      blurOnSubmit
                      style={[styles.input, { backgroundColor: palette.input }]}
                    />
                    <RadioButton.Group
                      value={inviteRole}
                      onValueChange={setInviteRole}
                    >
                      <RadioButton.Item
                        label="Admin · invite and manage workspace"
                        value="admin"
                      />
                      <RadioButton.Item
                        label="Editor · manage business records"
                        value="editor"
                      />
                      <RadioButton.Item
                        label="Viewer · view business records"
                        value="viewer"
                      />
                    </RadioButton.Group>
                    <Button
                      mode="contained"
                      loading={busy}
                      disabled={busy || !inviteEmail.trim()}
                      onPress={invite}
                    >
                      Add member
                    </Button>
                    <Text style={styles.section}>Members</Text>
                    {members.map((member) => (
                      <View key={member.id} style={styles.member}>
                        <View style={styles.memberInfo}>
                          <Text>
                            {member.displayName ||
                              member.email ||
                              `Member ${member.id.slice(0, 6)}`}
                          </Text>
                          <Text style={[styles.copy, { color: palette.textMuted }]}>
                            {member.email || member.id} · {member.role} ·{" "}
                            {member.status}
                          </Text>
                        </View>
                        {current.role === "owner" &&
                          member.role !== "owner" &&
                          member.status === "active" && (
                            <Button
                              compact
                              onPress={() => setSelectedId(member.id)}
                            >
                              Manage
                            </Button>
                          )}
                      </View>
                    ))}
                    {!members.length && (
                      <Text style={[styles.copy, { color: palette.textMuted }]}>No members to show yet.</Text>
                    )}
                  </>
                ) : (
                  <Text style={[styles.copy, { color: palette.textMuted }]}>
                    Only an organisation owner or admin can invite members and
                    manage access.
                  </Text>
                )}
                {current.role === "owner" && (
                  <View style={{ marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e2e7e1", paddingTop: 14 }}>
                    <Text style={styles.section}>Ownership and deletion</Text>
                    <Text style={[styles.copy, { color: palette.textMuted }]}>
                      Transfer ownership to another active member before leaving this organisation. Deleting the organisation permanently removes its cloud records and member access.
                    </Text>
                    <Button
                      mode="outlined"
                      textColor="#b3261e"
                      disabled={busy}
                      loading={busy}
                      onPress={() => Alert.alert(
                        "Delete this organisation?",
                        `This permanently deletes ${current.name}, its cloud invitations and memberships, and any organisation records stored in Firestore. FinanceTracker keeps ledger records locally in this release, so this device's organisation records and image will be removed, but unsynced local copies on other devices may remain. This cannot be undone. Personal records outside this organisation are not deleted.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Delete organisation", style: "destructive", onPress: () => perform(async () => {
                            const deletion = await deleteWorkspace(current.id);
                            setSelectedId(null);
                            setMembers([]);
                            return deletion;
                          }, (deletion) => deletion?.localCleanupComplete === false
                            ? "The online organisation was deleted and your personal workspace is active, but some organisation files may remain on this device. Export your personal records, then contact support before clearing app storage."
                            : "Organisation deleted. You are now in your personal workspace.") },
                        ],
                      )}
                    >
                      Delete organisation permanently
                    </Button>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}
          <Text style={styles.footer}>
            Signed in as {user?.email || "your account"}
          </Text>
          <Portal>
            <Dialog
              visible={!!selectedId}
              onDismiss={() => setSelectedId(null)}
            >
              <Dialog.Title>Manage member access</Dialog.Title>
              <Dialog.Content>
                <Text>
                  Choose a role or remove this person from the workspace.
                </Text>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setSelectedId(null)}>Cancel</Button>
                {current?.role === "owner" && (
                  <Button
                    textColor="#267F4D"
                    disabled={busy}
                    onPress={() => {
                      const target = members.find((member) => member.id === selectedId);
                      Alert.alert(
                        "Transfer workspace ownership?",
                        `Make ${target?.displayName || target?.email || "this member"} the owner? You will become an admin and can no longer delete the organisation unless ownership is transferred back.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Transfer ownership", onPress: () => perform(async () => {
                            await transferWorkspaceOwnership(current.id, selectedId);
                            setSelectedId(null);
                            await refreshMembers();
                          }, "Workspace ownership transferred. Your role is now admin.") },
                        ],
                      );
                    }}
                  >
                    Make owner
                  </Button>
                )}
                <Button
                  disabled={busy}
                  onPress={() =>
                    perform(async () => {
                      await changeMemberRole(current.id, selectedId, "viewer");
                      setSelectedId(null);
                      await refreshMembers();
                    })
                  }
                >
                  Make viewer
                </Button>
                <Button
                  disabled={busy}
                  onPress={() =>
                    perform(async () => {
                      await changeMemberRole(current.id, selectedId, "editor");
                      setSelectedId(null);
                      await refreshMembers();
                    })
                  }
                >
                  Make editor
                </Button>
                <Button
                  textColor="#b3261e"
                  disabled={busy}
                  onPress={() =>
                    perform(async () => {
                      await removeMember(current.id, selectedId);
                      setSelectedId(null);
                      await refreshMembers();
                    })
                  }
                >
                  Remove
                </Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#267F4D" },
  pageHeader: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 0,
    backgroundColor: "#267F4D",
  },
  container: {
    ...contentWidthStyle,
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
    backgroundColor: "#f4f6f3",
  },
  title: { textAlign: "left", fontSize: 22, color: "#ffffff", margin: 0 },
  copy: { color: "#647168", lineHeight: 21, marginBottom: 12 },
  diagnostic: { color: "#59675d", fontSize: 12, lineHeight: 18 },
  card: {
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: "#fff",
    elevation: 1,
  },
  input: { backgroundColor: "#f7f9f6", marginVertical: 8 },
  workspaceButton: { marginBottom: 8, borderRadius: 22 },
  workspaceBlock: { marginBottom: 4 },
  section: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
    color: "#2b4931",
  },
  member: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dde4dc",
  },
  memberInfo: { flex: 1 },
  footer: { color: "#777", textAlign: "center", marginVertical: 12 },
});
