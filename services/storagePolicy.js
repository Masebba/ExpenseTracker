// Single source of truth for what the app stores in cloud services versus
// device-private storage. User-facing copy in Settings, Workspaces, and the
// privacy documentation is derived from these lists so the app cannot describe
// storage differently from what the code actually does.

// Written to Firestore for any signed-in account. Personal ledger records are
// NOT in this list: they stay on the device in this release.
export const ACCOUNT_CLOUD_PATHS = [
  { path: 'users/{uid}', label: 'Account profile fields, personal details, and business details' },
  { path: 'users/{uid}/memberships/{orgId}', label: 'Your organisation memberships and roles' },
  { path: 'organizations/{orgId}', label: 'Organisation name, type, owner, and invoice details' },
  { path: 'organizations/{orgId}/invitations/{email}', label: 'Organisation member invitations' },
  { path: 'advertisements/{adId}', label: 'Developer-published public adverts' },
];

// Workspace business records. These are the collections that would sync, and
// are what services/cloudSync.js writes when record sync is enabled. Record
// sync is release-blocked, so in this release they are device-local only.
export const WORKSPACE_RECORD_COLLECTIONS = [
  'transactions', 'products', 'productCategories', 'sales', 'orders',
  'customers', 'suppliers', 'invoices', 'purchases',
];

// Never leaves the device through Firebase, in any mode.
export const DEVICE_ONLY_DATA = [
  'Guest and personal ledger records in private app storage',
  'Exported files and document-provider backup folder contents',
  'Profile and organisation images copied into the app folder',
];

export const RECORD_SYNC_STATUS =
  'Workspace record sync is disabled in this release. Records stay on this device.';

export const describeWorkspaceStorage = (workspace) => {
  if (!workspace || workspace.id === 'personal') {
    return 'Personal records are stored on this device only. Nothing in your personal ledger is uploaded.';
  }
  return `Organisation details, your membership, and invitations are stored in the cloud so members can share this workspace. ${RECORD_SYNC_STATUS} Export before uninstalling or changing devices.`;
};