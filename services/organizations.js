import { addDoc, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { firestore } from '../firebase';
import { auth } from '../firebase';

const membershipsFor = (uid) => collection(firestore, 'users', uid, 'memberships');
const membershipRef = (uid, orgId) => doc(firestore, 'users', uid, 'memberships', orgId);

export const createOrganization = async (uid, { name, type }) => {
  const cleanName = String(name || '').trim();
  if (!uid || !cleanName) throw new Error('Enter an organisation name.');
  const org = await addDoc(collection(firestore, 'organizations'), {
    name: cleanName, type: type === 'company' ? 'company' : 'organization', ownerId: uid,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await setDoc(membershipRef(uid, org.id), {
    organizationId: org.id, organizationName: cleanName, email: auth.currentUser?.email || '', displayName: auth.currentUser?.displayName || '', role: 'owner', status: 'active', createdAt: serverTimestamp(),
  });
  return { id: org.id, name: cleanName, type: type === 'company' ? 'company' : 'organization', role: 'owner', status: 'active' };
};

export const listenToMemberships = (uid, callback, onError) => onSnapshot(membershipsFor(uid), async (snapshot) => {
  const memberships = await Promise.all(snapshot.docs.map(async (item) => {
    const membership = { id: item.id, ...item.data() };
    if (membership.status === 'active') {
      try {
        const org = await getDoc(doc(firestore, 'organizations', item.id));
        if (org.exists()) Object.assign(membership, { ...org.data(), id: item.id, role: membership.role, status: membership.status });
      } catch { /* Show membership cache when offline. */ }
    }
    return membership;
  }));
  callback(memberships);
}, onError);

export const inviteOrganizationMember = async (uid, organizationId, email, role = 'viewer') => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail.includes('@')) throw new Error('Enter a valid email address.');
  if (!['admin', 'editor', 'viewer'].includes(role)) throw new Error('Choose a valid role.');
  const caller = await getDoc(membershipRef(uid, organizationId));
  if (!caller.exists() || !['owner', 'admin'].includes(caller.data().role) || caller.data().status !== 'active') {
    throw new Error('Only an organisation owner or admin can invite members.');
  }
  const org = await getDoc(doc(firestore, 'organizations', organizationId));
  if (!org.exists()) throw new Error('Organisation not found.');
  const invitationId = cleanEmail;
  await setDoc(doc(firestore, 'organizations', organizationId, 'invitations', invitationId), {
    email: cleanEmail, organizationId, organizationName: org.data().name, role, status: 'pending',
    invitedBy: uid, createdAt: serverTimestamp(),
  });
  return { email: cleanEmail };
};

export const listenToInvitations = (email, callback, onError) => {
  if (!email) return () => {};
  const invitations = collectionGroup(firestore, 'invitations');
  return onSnapshot(query(invitations, where('email', '==', email.trim().toLowerCase()), where('status', '==', 'pending')),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })), snapshot.docs.map((item) => item.ref)), onError);
};

export const acceptOrganizationInvitation = async (uid, email, displayName, invitation) => {
  const userEmail = String(email || '').trim().toLowerCase();
  if (!userEmail || invitation.email !== userEmail) throw new Error('Sign in using the email address the invitation was sent to.');
  await setDoc(membershipRef(uid, invitation.organizationId), {
    organizationId: invitation.organizationId, organizationName: invitation.organizationName,
    email: userEmail, displayName: displayName || '', role: invitation.role, status: 'active', invitedBy: invitation.invitedBy, createdAt: serverTimestamp(),
  });
  await deleteDoc(doc(firestore, 'organizations', invitation.organizationId, 'invitations', invitation.id));
};

export const listOrganizationMembers = async (organizationId) => {
  if (!organizationId) return [];
  const snapshot = await getDocs(query(collectionGroupMemberships(), where('organizationId', '==', organizationId)));
  return snapshot.docs.map((item) => ({ id: item.ref.parent.parent.id, ...item.data() }));
};

const collectionGroupMemberships = () => collectionGroup(firestore, 'memberships');

export const updateMemberRole = async (uid, organizationId, memberId, role) => {
  if (!['admin', 'editor', 'viewer'].includes(role)) throw new Error('Choose a valid role.');
  const caller = await getDoc(membershipRef(uid, organizationId));
  if (!caller.exists() || caller.data().role !== 'owner' || caller.data().status !== 'active') throw new Error('Only the organisation owner can change member roles.');
  const target = await getDoc(membershipRef(memberId, organizationId));
  if (!target.exists() || target.data().role === 'owner' || target.data().role === role) throw new Error('Choose a different role for a non-owner member.');
  await setDoc(target.ref, { role, updatedAt: serverTimestamp() }, { merge: true });
};

export const removeOrganizationMember = async (uid, organizationId, memberId) => {
  const caller = await getDoc(membershipRef(uid, organizationId));
  if (!caller.exists() || caller.data().role !== 'owner' || caller.data().status !== 'active') throw new Error('Only the organisation owner can remove members.');
  const target = await getDoc(membershipRef(memberId, organizationId));
  if (!target.exists() || target.data().role === 'owner') throw new Error('The owner cannot be removed.');
  await setDoc(target.ref, { status: 'revoked', updatedAt: serverTimestamp() }, { merge: true });
};
