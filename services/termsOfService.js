import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import {
  ACCOUNT_CLOUD_PATHS,
  DEVICE_ONLY_DATA,
  RECORD_SYNC_STATUS,
} from './storagePolicy';

export const TERMS_OF_SERVICE_PATH = ['appContent', 'termsOfService'];
export const TERMS_OF_SERVICE_MAX_LENGTH = 20000;

export const DEFAULT_TERMS_OF_SERVICE = [
  'ExpenseTracker — Terms of Service and Data Information',
  '',
  'Using the app',
  'ExpenseTracker provides personal and organisation workspaces for recording business activity. Keep your account credentials private and review entries before relying on reports or exports.',
  '',
  'Personal and organisation records',
  'Your personal ledger stays in private app storage on this device and is available offline. Guest records also stay on this device. In this release, organisation ledger records such as transactions, products, sales, orders, customers, suppliers and invoices are not uploaded; workspace record sync is disabled. Organisation membership and workspace administration are separate from those ledger records.',
  '',
  'Information stored in Firebase',
  ...ACCOUNT_CLOUD_PATHS.map(({ label }) => `• ${label}`),
  '',
  'Information kept on this device',
  ...DEVICE_ONLY_DATA.map((item) => `• ${item}`),
  '',
  'Backups and uninstalling',
  'You can export local records and settings or choose an external backup folder on Android. Backups contain device-local records; they do not include cloud organisation administration data. A folder provider may be operated by another company and its own terms and privacy practices apply. App-private data may be removed when the app is uninstalled or the device is changed, so keep a separate backup of anything you need.',
  '',
  'Account and organisation controls',
  'You can request account deletion from Settings. Supported personal cloud data is deleted with the account. An organisation you own must first be transferred or deleted; organisation data is shared with its members and is not automatically removed when a non-owner leaves.',
  '',
  'These details describe the current app behavior and may be updated as features change. The latest version shown in the app is the version that applies.',
  '',
  RECORD_SYNC_STATUS,
].join('\n');

export function subscribeToTermsOfService(onTerms, onError) {
  const termsRef = doc(firestore, ...TERMS_OF_SERVICE_PATH);
  return onSnapshot(
    termsRef,
    (snapshot) => {
      const data = snapshot.data();
      onTerms({
        body:
          typeof data?.body === 'string' && data.body.trim()
            ? data.body
            : DEFAULT_TERMS_OF_SERVICE,
        updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : null,
      });
    },
    onError,
  );
}

export async function publishTermsOfService(body, userId) {
  const normalizedBody = typeof body === 'string' ? body.trim() : '';
  if (!normalizedBody) {
    throw new Error('Enter the terms before publishing.');
  }
  if (normalizedBody.length > TERMS_OF_SERVICE_MAX_LENGTH) {
    throw new Error(
      `Terms must be ${TERMS_OF_SERVICE_MAX_LENGTH} characters or fewer.`,
    );
  }
  if (!userId) {
    throw new Error('Sign in with a developer account to publish terms.');
  }

  await setDoc(doc(firestore, ...TERMS_OF_SERVICE_PATH), {
    body: normalizedBody,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  });
}
