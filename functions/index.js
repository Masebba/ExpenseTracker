const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
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
