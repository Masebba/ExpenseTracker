import React, { createContext, useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as firebaseSignOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase';
import { acceptOrganizationInvitation, createOrganization, inviteOrganizationMember, listenToInvitations, listenToMemberships, listOrganizationMembers, removeOrganizationMember, updateMemberRole } from './services/organizations';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState({ id: 'personal', name: 'Personal', type: 'personal', role: 'owner' });
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [developerAccessInfo, setDeveloperAccessInfo] = useState(null);
  const [profileImage, setProfileImage] = useState(null);

  useEffect(() => onAuthStateChanged(auth, async (firebaseUser) => {
    setUser(firebaseUser || null);
    setMemberships([]);
    setIsDeveloper(false);
    setDeveloperAccessInfo(null);
    setProfileImage(null);
    setActiveWorkspaceState({ id: 'personal', name: 'Personal', type: 'personal', role: 'owner' });
    if (firebaseUser) {
      await ensureProfile(firebaseUser);
      const [profile, localImage] = await Promise.all([
        AsyncStorage.getItem(`expenseTracker.${firebaseUser.uid}.profileImage`).catch(() => null),
      ]);
      setProfileImage(localImage || firebaseUser.photoURL || null);
    }
    setLoading(false);
  }), []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onSnapshot(doc(firestore, 'users', user.uid), (profile) => {
      const developerAdmin = profile.exists() && profile.data()?.developerAdmin === true;
      setIsDeveloper(developerAdmin);
      setDeveloperAccessInfo({ uid: user.uid, email: user.email || null, developerAdmin });
    }, (error) => {
      console.warn('Developer access profile listener failed:', error?.message || error);
      setIsDeveloper(false);
      setDeveloperAccessInfo({ uid: user.uid, email: user.email || null, error: error?.message || 'Permission denied reading the user profile.' });
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let mounted = true;
    AsyncStorage.getItem(`expenseTracker.${user.uid}.activeWorkspace`).then((saved) => {
      if (!mounted || !saved) return;
      const workspace = JSON.parse(saved);
      if (workspace.id === 'personal' || memberships.some((item) => item.id === workspace.id && item.status === 'active')) {
        setActiveWorkspaceState(workspace);
        if (workspace.id !== 'personal') AsyncStorage.getItem(`expenseTracker.${user.uid}.workspaceImage.${workspace.id}`).then((image) => {
          if (mounted && image) setActiveWorkspaceState((current) => current.id === workspace.id ? { ...current, photoURL: image } : current);
        }).catch(() => {});
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [user?.uid, memberships]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return listenToMemberships(user.uid, (items) => {
      const active = items.filter((item) => item.status === 'active');
      setMemberships(items);
      setActiveWorkspaceState((current) => current.id === 'personal' || active.some((item) => item.id === current.id)
        ? current : { id: 'personal', name: 'Personal', type: 'personal', role: 'owner' });
    }, (error) => console.warn('Workspace sync failed:', error?.message || error));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.email) return undefined;
    return listenToInvitations(user.email, (items) => setInvitations(items), (error) => console.warn('Invitation sync failed:', error?.message || error));
  }, [user?.email]);

  const syncProfile = async (firebaseUser, extra = {}) => {
    if (!firebaseUser) return;
    try {
      await setDoc(doc(firestore, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: firebaseUser.email || null,
        displayName: firebaseUser.displayName || '',
        photoURL: firebaseUser.photoURL || null,
        ...extra,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.warn('Profile cloud sync failed:', error?.message || error);
    }
  };

  const ensureProfile = async (firebaseUser, extra = {}) => {
    if (!firebaseUser) return;
    const profileRef = doc(firestore, 'users', firebaseUser.uid);
    try {
      const profile = await getDoc(profileRef);
      await setDoc(profileRef, {
        uid: firebaseUser.uid, email: firebaseUser.email || null,
        displayName: firebaseUser.displayName || '', photoURL: firebaseUser.photoURL || null,
        ...(profile.exists() ? profile.data() : {}), ...extra,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      if (profile.exists() && !profile.data()?.email && firebaseUser.email) {
        await updateDoc(profileRef, { email: firebaseUser.email.trim().toLowerCase() });
      }
    } catch (error) { console.warn('Profile cloud sync failed:', error?.message || error); }
  };

  const signIn = (email, password) => signInWithEmailAndPassword(auth, email.trim(), password);

  const signUp = async (email, password, displayName, phone = '') => {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(credential.user, { displayName: displayName.trim(), photoURL: null });
    await ensureProfile(credential.user, { phone: String(phone || '').trim(), email: credential.user.email?.trim().toLowerCase() || null, displayName: displayName.trim() });
    setUser(credential.user);
    return credential;
  };

  const signOut = () => firebaseSignOut(auth);
  const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());

  const createCompany = async (name, type = 'company') => {
    const workspace = await createOrganization(user?.uid, { name, type });
    setMemberships((current) => [...current.filter((item) => item.id !== workspace.id), workspace]);
    setActiveWorkspaceState(workspace);
    return workspace;
  };

  const inviteMember = (organizationId, email, role) => inviteOrganizationMember(user?.uid, organizationId, email, role);
  const acceptInvitation = async (invitation) => { await acceptOrganizationInvitation(user?.uid, user?.email, user?.displayName, invitation); setInvitations((current) => current.filter((item) => item.id !== invitation.id)); };
  const getMembers = (organizationId) => listOrganizationMembers(organizationId);
  const changeMemberRole = (organizationId, memberId, role) => updateMemberRole(user?.uid, organizationId, memberId, role);
  const removeMember = (organizationId, memberId) => removeOrganizationMember(user?.uid, organizationId, memberId);
  const refreshDeveloperAccess = async () => {
    if (!auth.currentUser) return { error: 'No Firebase user is currently signed in.' };
    const current = auth.currentUser;
    try {
      const profile = await getDoc(doc(firestore, 'users', current.uid));
      const developerAdmin = profile.exists() && profile.data()?.developerAdmin === true;
      const result = { uid: current.uid, email: current.email || null, developerAdmin, granted: developerAdmin };
      setIsDeveloper(developerAdmin);
      setDeveloperAccessInfo(result);
      return result;
    } catch (error) {
      const result = { uid: current.uid, email: current.email || null, error: error?.message || 'Could not read the user profile.' };
      setDeveloperAccessInfo(result);
      setIsDeveloper(false);
      return result;
    }
  };
  const updateProfileImage = async (uri) => {
    if (!user?.uid) return;
    await AsyncStorage.setItem(`expenseTracker.${user.uid}.profileImage`, uri);
    setProfileImage(uri);
  };
  const updateWorkspacePhoto = async (organizationId, photoURL) => {
    setActiveWorkspaceState((current) => current.id === organizationId ? { ...current, photoURL } : current);
    setMemberships((items) => items.map((item) => item.id === organizationId ? { ...item, photoURL } : item));
    await AsyncStorage.setItem(`expenseTracker.${user.uid}.workspaceImage.${organizationId}`, photoURL);
  };
  const setActiveWorkspace = (workspace) => {
    const next = workspace || { id: 'personal', name: 'Personal', type: 'personal', role: 'owner' };
    setActiveWorkspaceState(next);
    if (user?.uid && next.id !== 'personal') {
      AsyncStorage.getItem(`expenseTracker.${user.uid}.workspaceImage.${next.id}`).then((image) => {
        if (image) setActiveWorkspaceState((current) => current.id === next.id ? { ...current, photoURL: image } : current);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!user?.uid || !activeWorkspace) return;
    AsyncStorage.setItem(`expenseTracker.${user.uid}.activeWorkspace`, JSON.stringify(activeWorkspace)).catch(() => {});
  }, [activeWorkspace, user?.uid]);

  const updateUserProfile = async (updates) => {
    const current = auth.currentUser;
    if (!current) throw new Error('You are not signed in.');
    await updateProfile(current, updates);
    await syncProfile(current, updates);
    setUser(auth.currentUser);
  };

  const updateUserData = async (updates) => {
    const current = auth.currentUser;
    if (!current) throw new Error('You are not signed in.');
    await syncProfile(current, { phone: updates.phone || updates.phoneNumber || '', displayName: updates.displayName || current.displayName || '', photoURL: current.photoURL || null });
    setUser(Object.assign(Object.create(Object.getPrototypeOf(current)), current, updates));
  };

  return <AuthContext.Provider value={{ user, memberships, invitations, acceptInvitation, activeWorkspace, setActiveWorkspace, isDeveloper, developerAccessInfo, refreshDeveloperAccess, profileImage, updateProfileImage, createCompany, inviteMember, getMembers, changeMemberRole, removeMember, updateWorkspacePhoto, signIn, signUp, signOut, resetPassword, updateUserProfile, updateUserData }}>{!loading && children}</AuthContext.Provider>;
};
