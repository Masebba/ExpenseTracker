# FinanceTracker

FinanceTracker supports account-free personal use and multi-organisation workspaces. A person can start a private local ledger without creating an account, then optionally sign in or register for account features such as creating or joining companies/organisations. Guest and signed-in personal ledger records are stored locally in private app storage and are available offline. This is not a user-browsable folder, and uninstalling may remove the local copy. When a guest chooses account access, the app copies guest records into the signed-in account's local data on that device, preserving existing account records when IDs overlap. Users can export a JSON file or select an Android document-provider folder for an additional backup; this folder is optional and controlled by the user. Folder backups contain local records and settings for the guest session or signed-in account, not cloud workspace records. Workspace names, invitations, and member roles are cloud-backed, but ledger records are saved locally on each device and are not shared live between members in this release. Record cloud sync stays disabled until conflict resolution for offline edits, deletions, and concurrent devices is implemented and tested.

## Install

The source archive intentionally omits the machine-specific `.env` file. Create it from the template and fill in the client configuration for your Firebase project before starting the app:

```powershell
Copy-Item .env.example .env
npm ci
npm run check:self
npx expo start
```

Use the Android EAS development build for native-module testing. Firebase `EXPO_PUBLIC_*` values are client configuration, not private server credentials. Never add service-account files or release-signing passwords to this project archive.

The project uses Expo SDK 57. Firebase JS SDK 12+ is required. Deploy `firestore.rules` before relying on cloud sync, organisation memberships, developer adverts, or administrator-published Terms of Service. Developer Studio accepts a direct public HTTPS advert-image URL; it does not upload advert images. Profile and organisation images stay on the device.

The app chooses its initial base currency from the device's regional locale, falling back to its time-zone region when the locale has no country. Users can change the preferred base currency in Settings, and can select a separate currency for each income, expense, sale, order, invoice, or bill where appropriate. Monetary values use the shared `Intl.NumberFormat` currency formatter. Transactions retain their original amount and currency alongside the base-currency amount, rate, and quote timestamp captured when recorded; changing the preferred base currency does not rewrite those historical records. Reports convert the stored historical base amount into the selected reporting currency as needed.

Exchange rates are provided by the open.er-api.com USD reference-rate endpoint. USD-based rates are cross-calculated for each currency pair and cached per base/target pair on-device for 12 hours. When offline, cached quotes up to 7 days old can be used for continuity, with records marked as using a stale rate; values converted from stale quotes should be treated as estimates. If no cached quote is usable, foreign-currency writes fail with an explicit conversion-unavailable message and keep the user's entered form values. Base-currency writes do not require network access.

## Data model

Personal data stays under `users/{uid}`. Organisation data is scoped under `organizations/{organizationId}`. A membership document under `users/{uid}/memberships/{organizationId}` assigns `owner`, `admin`, `editor`, or `viewer` access. The workspace screen lets signed-in users:

- create any number of companies or organisations
- switch between personal records and organisation records
- add existing app users as members and assign an initial role
- let owners change member roles or revoke access

Each workspace's local ledger can contain transactions, products, product categories, sales, orders, customers, suppliers, invoices, and purchases. The app keeps each copy scoped to the signed-in user and workspace on that device. A Trade sale creates a linked, read-only `From Trade` income entry in the same active ledger, so workspace Income, Expenses, and daily dashboard totals reflect that workspace's sales and expenses without copying sales into Personal. The app also reconciles older sales that have no linked income entry, avoiding duplicates by sale ID. Personal and organisation ledger records remain local in this release; deleting a workspace cannot remotely erase an unsynchronized local copy stored on another device. Organization metadata, membership, profile fields, and invitations use Firebase for administration. Review [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) for the current data flow and limitations. For the Trade-to-income behavior and one-time member-index deployment, see [WORKSPACE_INCOME_AND_MEMBERS_INDEX.md](./WORKSPACE_INCOME_AND_MEMBERS_INDEX.md).

See [PUSH_NOTIFICATIONS_AND_THEME_GUIDE.md](./PUSH_NOTIFICATIONS_AND_THEME_GUIDE.md) for the current dark-mode, Home shortcut, notification registration, required FCM/EAS setup, and binary rebuild instructions. Because this repository checks in its native `android/` project, the guide also explains where to place `android/app/google-services.json`; the app build applies Google Services Gradle configuration only when that file is present.

## Important

The Firebase project must have Authentication and Firestore enabled. After setting `EXPO_PUBLIC_FIREBASE_PROJECT_ID` in `.env` and authenticating the Firebase CLI, run `npm run deploy:firestore-indexes` to deploy the collection-group indexes required to list workspace members; wait until the indexes are enabled. Deploy the current `firestore.rules` for organisation membership, private invitations, developer-only advert publishing, and public read/developer-only write access to the Terms of Service document. Developer Studio lets the developer account publish the terms shown in Workspaces and Settings. Developer adverts store a direct public HTTPS image URL; the current app does not upload image files to Firebase Storage. The image host must allow public image delivery. Profile and organisation images are copied to each device's app folder. Inviting a member currently requires that person to sign up first, using the same email address. Existing single-user business data remains under its original personal account; it is not automatically moved into a new organisation. The notification bell is an in-app activity inbox; push notifications require additional platform setup. `services/cloudSync.js` contains the explicit `CLOUD_SYNC_RELEASE_BLOCKED` gate; do not remove it until offline edits/deletions and concurrent-device conflict behavior are designed and verified.

### Developer ad publishing

The Developer Studio has no public navigation entry. Access is controlled by the `developerAdmin` boolean on the signed-in account's Firestore profile document, `users/{uid}`. To grant access:

1. In Firebase Console, open **Firestore Database → Data → users → the document whose ID exactly matches the signed-in Firebase Auth UID**.
2. Add or edit the `developerAdmin` field. Set its type to **boolean** and its value to **true** (not the text string `"true"`).
3. Save the document. The app listens to this profile and should reveal the private Developer Studio route automatically; no sign-out, token refresh, or custom claim is needed.
4. If it does not appear, check that Firebase Authentication and the app use the same Firebase project, and that the document ID equals that account's UID. A `developerAdmin` field added to an unrelated user document has no effect.

Publish the repository's `firestore.rules` to the same Firebase project configured in `.env` before using workspace administration or advert publishing. From a terminal with Firebase CLI installed and this project selected, run `firebase deploy --only firestore:rules,functions`; alternatively paste the Firestore rules into **Firebase Console → Firestore Database → Rules → Publish** and deploy the updated callable functions. The current advert UI accepts a direct HTTPS image URL, not a media upload. Publishing writes is rejected by design while the project's deployed Firestore rules are old. The Firestore rules check `users/{uid}.developerAdmin == true` and prevent users from setting that field through the app. Only an administrator changing the profile in Firebase Console can grant this access. Organisation owners and staff cannot publish public adverts.

Customer and supplier profiles, invoices, and supplier purchase bills are stored locally per account and workspace. Cloud sync for app records is disabled in this release. Organization Firestore rules include the `customers`, `suppliers`, `invoices`, and `purchases` collections for a future sync release.

### Data export, account deletion, and release

Settings includes **Export my data**, **Restore or import backup**, and **Delete account and personal data**. Restore accepts the app's JSON export or external-folder backup for the currently signed-in account. It replaces matching local keys, rolls back failed writes, and signs out afterward so providers reload restored data. Cloud and organization data are not restored by this local recovery flow. External-folder backups are controlled by the user and are not deleted by account deletion.

Account deletion requires the callable `deleteMyAccount` Firebase Function in `functions/`. Deploy it with `firebase deploy --only functions` before offering deletion in a release. The function records resumable phases, refuses accounts that still own active organizations, removes the user's data and owned adverts/files, and deletes Firebase Authentication last. Workspace owners can now transfer ownership to an active member or use the owner-only permanent deletion action in Workspaces. Because ledger data is device-local in this release, deletion can only remove local records from the device performing the action; other unsynchronized device copies may remain and must be handled on those devices. If any phase fails, the user remains signed in to retry. Do not restore client-side Firestore deletion as a fallback.

See [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) for the publisher-completion draft and [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) for the Google Play release steps. Publication fields remain placeholders at the publisher's request. Fill and publish the policy before submission. The production EAS profile builds an Android App Bundle; submissions default to internal testing.

### Native modules and development builds

The app uses native Expo modules, including `expo-sharing` for PDF sharing and `expo-document-picker` for backup import. When adding/updating a native module or changing its Expo config plugin, JavaScript reloads and OTA updates are not enough: rebuild and reinstall the development app. For a connected Android device with Android tooling installed, run `npx expo run:android`. Or build an installable EAS development APK with `npm run android:development-build`, install that APK, then restart Metro with `npm run start:clear`. For iOS, use `npx expo run:ios` locally or `npm run ios:development-build` through EAS. Sharing and document picking load only when their actions are requested, so an older binary can still open the rest of the app and show a recovery message.


### Latest crash fix and project-folder workflow

The 22 October 2026 update fixes a shared dropdown filter runtime error that could make Trade, Transactions, Reports, Products, or Orders display the generic app startup error. See [FIXES_AND_VALIDATION.md](./FIXES_AND_VALIDATION.md) for checks and [PROJECT_DIRECTORY_AND_GIT_GUIDE.md](./PROJECT_DIRECTORY_AND_GIT_GUIDE.md) for instructions on choosing a canonical source folder and preserving the original Git history. The new ZIP is a copy, not a live-synced folder, and intentionally excludes `.git`.
