const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');

initializeApp();
const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

exports.deleteMyAccount = onCall({ timeoutSeconds: 540, memory: '512MiB' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to delete your account.');
  const authenticatedAt = Number(request.auth.token.auth_time || 0);
  if (!authenticatedAt || Date.now() / 1000 - authenticatedAt > 5 * 60) {
    throw new HttpsError('failed-precondition', 'Re-enter your password and retry account deletion.');
  }
  const jobRef = db.collection('accountDeletionJobs').doc(uid);
  const membershipSnapshot = await db.collection('users').doc(uid).collection('memberships').get();
  const ownerWorkspaces = membershipSnapshot.docs.filter((item) => item.get('role') === 'owner' && item.get('status') === 'active');
  if (ownerWorkspaces.length) throw new HttpsError('failed-precondition', 'Transfer ownership or delete each organization you own before deleting this account.');

  const markPhase = async (phase) => jobRef.set({ uid, phase, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  try {
    await markPhase('deleting-user-data');
    await db.recursiveDelete(db.collection('users').doc(uid));
    await markPhase('deleting-public-ads');
    const ads = await db.collection('advertisements').where('createdBy', '==', uid).get();
    const pendingInvitations = request.auth.token.email
      ? await db.collectionGroup('invitations').where('email', '==', request.auth.token.email.toLowerCase()).get()
      : { docs: [] };
    for (const invitation of pendingInvitations.docs) await invitation.ref.delete();
    for (let index = 0; index < ads.docs.length; index += 400) {
      const batch = db.batch();
      ads.docs.slice(index, index + 400).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
    await markPhase('deleting-user-files');
    const bucket = storage.bucket();
    await bucket.deleteFiles({ prefix: `users/${uid}/ads/` });
    await bucket.deleteFiles({ prefix: `users/${uid}/` });
    await markPhase('deleting-auth-account');
    await jobRef.delete();
    try { await auth.deleteUser(uid); }
    catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    return { deleted: true };
  } catch (error) {
    logger.error('Account deletion paused; retry safely repeats idempotent cleanup phases.', { uid, message: error.message });
    await jobRef.set({ uid, phase: 'retry-required', lastError: String(error.message || 'Unknown error').slice(0, 500), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
    throw new HttpsError('internal', 'Deletion is incomplete. Your account remains available for a safe retry. Contact support if another retry fails.');
  }
});

// Aggregate adoption counts for the developer account. Returns counts only:
// no email addresses, no record contents, no per-user identifiers, and no
// device or advertising identifiers. Firestore rules are not used here because
// this function uses the Admin SDK, so the developerAdmin check below is the
// only authorization gate and must stay in place.

// Owner-controlled workspace operations use the Admin SDK so the ownership
// change and role documents cannot be partially updated by client-side writes.
exports.transferOrganizationOwnership = onCall({ timeoutSeconds: 120, memory: '256MiB' }, async (request) => {
  const uid = request.auth?.uid;
  const organizationId = String(request.data?.organizationId || '').trim();
  const newOwnerUid = String(request.data?.newOwnerUid || '').trim();
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to transfer ownership.');
  if (!organizationId || !newOwnerUid || newOwnerUid === uid) {
    throw new HttpsError('invalid-argument', 'Choose another active workspace member as the new owner.');
  }
  const organizationRef = db.collection('organizations').doc(organizationId);
  const currentMembershipRef = db.collection('users').doc(uid).collection('memberships').doc(organizationId);
  const newMembershipRef = db.collection('users').doc(newOwnerUid).collection('memberships').doc(organizationId);
  const deletionJobRef = db.collection('users').doc(uid).collection('workspaceDeletionJobs').doc(organizationId);
  await db.runTransaction(async (transaction) => {
    const [organization, currentMembership, newMembership, deletionJob] = await Promise.all([
      transaction.get(organizationRef), transaction.get(currentMembershipRef), transaction.get(newMembershipRef), transaction.get(deletionJobRef),
    ]);
    if (!organization.exists || organization.get('ownerId') !== uid) {
      throw new HttpsError('permission-denied', 'Only the current workspace owner can transfer ownership.');
    }
    if (!currentMembership.exists || currentMembership.get('role') !== 'owner' || currentMembership.get('status') !== 'active') {
      throw new HttpsError('permission-denied', 'Your workspace owner access is not active.');
    }
    if (!newMembership.exists || newMembership.get('status') !== 'active' || newMembership.get('role') === 'owner') {
      throw new HttpsError('failed-precondition', 'The new owner must already be an active member of this workspace.');
    }
    if (deletionJob.exists && deletionJob.get('status') === 'deleting') {
      throw new HttpsError('failed-precondition', 'Workspace deletion is already in progress. Retry it before transferring ownership.');
    }
    const timestamp = FieldValue.serverTimestamp();
    transaction.update(organizationRef, { ownerId: newOwnerUid, updatedAt: timestamp });
    transaction.update(currentMembershipRef, { role: 'admin', updatedAt: timestamp });
    transaction.update(newMembershipRef, { role: 'owner', updatedAt: timestamp });
  });
  return { transferred: true, organizationId, newOwnerUid };
});

exports.deleteOrganization = onCall({ timeoutSeconds: 540, memory: '512MiB' }, async (request) => {
  const uid = request.auth?.uid;
  const organizationId = String(request.data?.organizationId || '').trim();
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to delete this workspace.');
  if (!organizationId) throw new HttpsError('invalid-argument', 'Choose a workspace to delete.');

  const organizationRef = db.collection('organizations').doc(organizationId);
  const ownerMembershipRef = db.collection('users').doc(uid).collection('memberships').doc(organizationId);
  const deletionJobRef = db.collection('users').doc(uid).collection('workspaceDeletionJobs').doc(organizationId);
  let alreadyComplete = false;

  // Claim the destructive action transactionally. This prevents a concurrent
  // ownership transfer from racing the start of deletion and creates a retry
  // record that survives even if the owner membership is removed near the end.
  await db.runTransaction(async (transaction) => {
    alreadyComplete = false;
    const [job, organization, ownerMembership] = await Promise.all([
      transaction.get(deletionJobRef), transaction.get(organizationRef), transaction.get(ownerMembershipRef),
    ]);
    if (job.exists && job.get('ownerUid') === uid && job.get('status') === 'complete') {
      alreadyComplete = true;
      return;
    }
    const canResume = job.exists && job.get('ownerUid') === uid && job.get('status') === 'deleting';
    if (canResume) {
      if (organization.exists && organization.get('ownerId') !== uid) {
        throw new HttpsError('permission-denied', 'You are no longer the owner of this workspace.');
      }
      return;
    }
    if (!ownerMembership.exists || ownerMembership.get('role') !== 'owner' || ownerMembership.get('status') !== 'active') {
      throw new HttpsError('permission-denied', 'Only an active workspace owner can delete this workspace.');
    }
    if (organization.exists && organization.get('ownerId') !== uid) {
      throw new HttpsError('permission-denied', 'You are no longer the owner of this workspace.');
    }
    transaction.set(deletionJobRef, {
      ownerUid: uid,
      organizationId,
      status: 'deleting',
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  if (alreadyComplete) return { deleted: true, organizationId, alreadyDeleted: true };

  try {
    await db.recursiveDelete(organizationRef);
    const remainingMemberships = await db.collectionGroup('memberships').where('organizationId', '==', organizationId).get();
    const otherMemberships = remainingMemberships.docs.filter((item) => item.ref.path !== ownerMembershipRef.path);
    for (let index = 0; index < otherMemberships.length; index += 400) {
      const batch = db.batch();
      otherMemberships.slice(index, index + 400).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
    // Delete the owner's membership last. If any earlier phase fails, the
    // owner can retry. If the response is lost after this final delete, the
    // per-owner job still lets the same UID confirm/finish the operation.
    await ownerMembershipRef.delete();
    await deletionJobRef.set({
      ownerUid: uid,
      organizationId,
      status: 'complete',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { deleted: true, organizationId };
  } catch (error) {
    logger.error('Workspace deletion incomplete; retry is safe.', { uid, organizationId, message: error.message });
    await deletionJobRef.set({
      ownerUid: uid,
      organizationId,
      status: 'deleting',
      lastError: String(error.message || 'Unknown error').slice(0, 500),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
    throw new HttpsError('internal', 'Workspace deletion did not finish. Its data may be partially removed, and the owner can retry safely.');
  }
});

exports.getAdoptionCounts = onCall({ timeoutSeconds: 120, memory: '256MiB' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to view adoption counts.');
  const profile = await db.collection('users').doc(uid).get();
  if (!profile.exists || profile.get('developerAdmin') !== true) {
    throw new HttpsError('permission-denied', 'Adoption reporting is restricted to the developer account.');
  }
  const since = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Firestore requires an index for createdAt range queries. If one is not
  // deployed these degrade to null and are reported as unavailable rather
  // than failing the whole report.
  const registeredWithin = async (days) => {
    try {
      return (await db.collection('users').where('createdAt', '>=', since(days)).count().get()).data().count;
    } catch {
      return null;
    }
  };

  const organizationsWithin = async (days) => {
    try {
      return (await db.collection('organizations').where('createdAt', '>=', since(days)).count().get()).data().count;
    } catch {
      return null;
    }
  };

  try {
    const [users, organizations, memberships, activeMemberships, advertisements, newUsers7, newUsers30, newOrganizations30] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('organizations').count().get(),
      db.collectionGroup('memberships').count().get(),
      db.collectionGroup('memberships').where('status', '==', 'active').count().get(),
      db.collection('advertisements').count().get(),
      registeredWithin(7),
      registeredWithin(30),
      organizationsWithin(30),
    ]);
    return {
      registeredAccounts: users.data().count,
      organizationsCreated: organizations.data().count,
      memberships: memberships.data().count,
      activeMemberships: activeMemberships.data().count,
      publishedAdverts: advertisements.data().count,
      registeredAccountsLast7Days: newUsers7,
      registeredAccountsLast30Days: newUsers30,
      organizationsCreatedLast30Days: newOrganizations30,
      newAccountTrendAvailable: newUsers30 !== null && newOrganizations30 !== null,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Adoption counts failed', { uid, message: error.message });
    throw new HttpsError('internal', 'Could not read adoption counts for this project.');
  }
});


// Remote push notifications are currently sent for workspace invitations.
// Ledger transactions remain device-local in this release, so they cannot be
// used as server-side triggers until shared ledger sync is deliberately enabled.
exports.notifyWorkspaceInvitation = onDocumentCreated('organizations/{organizationId}/invitations/{invitationId}', async (event) => {
  const invitation = event.data?.data();
  const recipientEmail = String(invitation?.email || event.params?.invitationId || '').trim().toLowerCase();
  if (!recipientEmail || invitation?.status !== 'pending') return;

  let recipient;
  try {
    recipient = await auth.getUserByEmail(recipientEmail);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return;
    logger.warn('Could not resolve invitation recipient for push notification.', { recipientEmail, message: error?.message });
    return;
  }

  const tokenSnapshot = await db.collection('users').doc(recipient.uid).collection('pushTokens').where('enabled', '==', true).get();
  if (tokenSnapshot.empty) return;
  const workspaceName = String(invitation.organizationName || 'a workspace').trim();
  const tokenEntries = tokenSnapshot.docs
    .map((snapshot) => ({ ref: snapshot.ref, token: snapshot.get('token') }))
    .filter((item) => typeof item.token === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(item.token))
    .slice(0, 100);
  const messages = tokenEntries.map((item) => ({
      to: item.token,
      title: 'Workspace invitation',
      body: `You have been invited to join ${workspaceName}. Open FinanceTracker to review it.`,
      sound: 'default',
      priority: 'default',
      channelId: 'default',
      data: { type: 'workspace_invitation', organizationId: event.params.organizationId },
    }));
  if (!messages.length) return;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      logger.error('Expo push gateway rejected workspace invitations.', { status: response.status, recipientUid: recipient.uid });
      return;
    }
    const payload = await response.json();
    const tickets = Array.isArray(payload?.data) ? payload.data : [payload?.data];
    const batch = db.batch();
    let changed = false;
    tickets.forEach((ticket, index) => {
      if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
        const tokenRecord = tokenEntries[index];
        if (tokenRecord) {
          batch.set(tokenRecord.ref, { enabled: false, lastError: 'DeviceNotRegistered', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          changed = true;
        }
      }
    });
    if (changed) await batch.commit();
    logger.info('Workspace invitation push queued.', { recipientUid: recipient.uid, attemptedTokens: messages.length });
  } catch (error) {
    logger.error('Workspace invitation push failed.', { recipientUid: recipient.uid, message: error?.message || error });
  }
});
