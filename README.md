# ExpenseTracker

ExpenseTracker supports personal use and multi-organisation workspaces. A person can keep a private personal ledger, create or join multiple companies/organisations, and switch between workspaces. Each workspace has its own transactions, inventory, sales, and orders. Records are stored on the device in the app sandbox and can be backed up to a user-selected folder. Record cloud sync is deliberately disabled in this release until conflict resolution for offline edits and deletions is implemented.

## Install

```bash
npm install
npx expo start
```

The project uses Expo SDK 57. Firebase JS SDK 12+ is required. Deploy `firestore.rules` before relying on cloud sync, organisation memberships, or developer adverts. Profile and organisation images stay on the device and do not require Storage deployment.

## Data model

Personal data stays under `users/{uid}`. Organisation data is scoped under `organizations/{organizationId}`. A membership document under `users/{uid}/memberships/{organizationId}` assigns `owner`, `admin`, `editor`, or `viewer` access. The workspace screen lets signed-in users:

- create any number of companies or organisations
- switch between personal records and organisation records
- add existing app users as members and assign an initial role
- let owners change member roles or revoke access

Each workspace stores:
- transactions
- products
- productCategories
- sales
- orders

The app keeps a device-local copy scoped to the signed-in user and workspace, so different organisation records remain separate on a device.

## Important

The Firebase project must have Authentication and Firestore enabled. Deploy the current `firestore.rules` for organisation membership, private invitations, and developer-only advert publishing. Profile and organisation images are copied to each device’s app folder; this app’s profile/logo features do not require Firebase Storage or Storage rules. Inviting a member currently requires that person to sign up first, using the same email address. Existing single-user business data remains under its original personal account; it is not automatically moved into a new organisation. The notification bell is an in-app activity inbox; push notifications require additional platform setup. `services/cloudSync.js` contains the explicit `CLOUD_SYNC_RELEASE_BLOCKED` gate; do not remove it until offline edits/deletions and concurrent-device conflict behavior are designed and verified.

### Developer ad publishing

The Developer Studio has no public navigation entry. Access is controlled by the `developerAdmin` boolean on the signed-in account's Firestore profile document, `users/{uid}`. To grant access:

1. In Firebase Console, open **Firestore Database → Data → users → the document whose ID exactly matches the signed-in Firebase Auth UID**.
2. Add or edit the `developerAdmin` field. Set its type to **boolean** and its value to **true** (not the text string `"true"`).
3. Save the document. The app listens to this profile and should reveal the private Developer Studio route automatically; no sign-out, token refresh, or custom claim is needed.
4. If it does not appear, check that Firebase Authentication and the app use the same Firebase project, and that the document ID equals that account's UID. A `developerAdmin` field added to an unrelated user document has no effect.

Publish the repository's `firestore.rules` to the same Firebase project configured in `.env` before using ad publishing. From a terminal with Firebase CLI installed and this project selected, run `firebase deploy --only firestore:rules`; alternatively paste the complete rules file into **Firebase Console → Firestore Database → Rules → Publish**. Publishing writes is rejected by design while the project's deployed rules are old. The rules check `users/{uid}.developerAdmin == true` and prevent users from setting that field through the app. Only an administrator changing the profile in Firebase Console can grant this access. Organisation owners and staff cannot publish public adverts.

Customer and supplier profiles, invoices, and supplier purchase bills are stored locally per account and workspace. Cloud sync for app records is disabled in this release. Organization Firestore rules include the `customers`, `suppliers`, `invoices`, and `purchases` collections for a future sync release.

### Data export, account deletion, and release

Settings includes **Export my data**, **Restore or import backup**, and **Delete account and personal data**. Restore accepts the app's JSON export or external-folder backup for the currently signed-in account. It replaces matching local keys, rolls back failed writes, and signs out afterward so providers reload restored data. Cloud and organization data are not restored by this local recovery flow. External-folder backups are controlled by the user and are not deleted by account deletion.

Account deletion requires the callable `deleteMyAccount` Firebase Function in `functions/`. Deploy it with `firebase deploy --only functions` before offering deletion in a release. The function records resumable phases, refuses accounts that own active organizations, removes the user's data and owned adverts/files, and deletes Firebase Authentication last. If any phase fails, the user remains signed in to retry. Do not restore client-side Firestore deletion as a fallback.

See [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) for the publisher-completion draft and [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) for the Google Play release steps. Publication fields remain placeholders at the publisher's request. Fill and publish the policy before submission. The production EAS profile builds an Android App Bundle; submissions default to internal testing.

### Native modules and development builds

The app uses native Expo modules, including `expo-sharing` for PDF sharing and `expo-document-picker` for backup import. When adding/updating a native module or changing its Expo config plugin, JavaScript reloads and OTA updates are not enough: rebuild and reinstall the development app. For a connected Android device with Android tooling installed, run `npx expo run:android`. Or build an installable EAS development APK with `npm run android:development-build`, install that APK, then restart Metro with `npm run start:clear`. For iOS, use `npx expo run:ios` locally or `npm run ios:development-build` through EAS. Sharing and document picking load only when their actions are requested, so an older binary can still open the rest of the app and show a recovery message.
