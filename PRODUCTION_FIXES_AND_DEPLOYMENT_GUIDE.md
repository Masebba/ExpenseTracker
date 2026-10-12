# FinanceTracker: code fixes and production deployment guide

This package contains code-side hardening that can be applied without access to your Firebase or EAS accounts. The remaining account, cloud and store tasks are listed separately below. A successful build is not by itself proof that the Firebase backend, Android signing, account deletion, or store compliance is ready.

## Code changes included

1. **Invitation Firestore index**: added `firestore.indexes.json` for the `collectionGroup('invitations')` query on `email` + `status`, and connected it to `firebase.json`.
2. **Explicit EAS production environment**: `eas.json` now specifies `"environment": "production"` for the production profile. The six `EXPO_PUBLIC_FIREBASE_*` variables must still exist in the EAS production environment.
3. **Safer startup error handling**: `index.js` now loads `App` inside a child component rendered under the startup error boundary. This allows module-initialization errors to be rendered by the boundary rather than happening before it mounts.
4. **Update compatibility**: `app.json` now uses `runtimeVersion: { "policy": "appVersion" }`. Because this repository checks in the native `android/` directory, Android's `android/app/src/main/res/values/strings.xml` must also be kept aligned with the app version. It is currently set to `1.0.1`.
5. **Release signing safety**: `android/app/build.gradle` no longer silently uses the debug keystore for release builds. It requires the standard `MYAPP_UPLOAD_*` Gradle properties, which should be supplied by EAS when a production keystore is configured. If a release build now fails at signing, configure the EAS Android credentials rather than restoring debug signing.
6. **Self-check coverage**: `scripts/self-check.js` now checks the index configuration, explicit EAS environment, runtime-version policy, startup error boundary and release-signing guard.

## Run local checks

From the project folder:

```bash
npm ci
npm run check:self
npm run check:expo
```

The self-check passed in the prepared working copy with 53 assertions. A complete native Android release build and on-device QA were not run in this environment.

## Tasks to complete from your side

### A. Configure EAS production variables

Run:

```bash
eas env:list --environment production
```

Ensure all six values are present and match the Firebase project intended for production:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

If missing, add them in the Expo dashboard under Project > Environment variables, selecting the `production` environment, or use the EAS CLI environment-variable commands. These are client configuration values, not server secrets. Never put Firebase Admin SDK service-account credentials in `EXPO_PUBLIC_*` variables or in the app bundle.

### B. Deploy the Firestore index

From the project folder, with Firebase CLI authenticated to the correct project:

```bash
firebase use <your-production-project-id>
firebase deploy --only firestore:indexes
```

Wait for the `invitations` collection-group index on `email` and `status` to show as enabled in Firebase Console > Firestore > Indexes. Confirm that the active Firebase project is the correct production project before deploying anything.

### C. Verify Firebase Storage

The bundled logs previously showed `storage/bucket-not-found`. In Firebase Console, confirm that Storage is initialized and that the bucket name matches `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` exactly. Confirm billing/plan eligibility for the Storage features you use, then review and deploy `storage.rules` only after checking them against your real user data and intended access model:

```bash
firebase deploy --only storage
```

Do not just suppress the missing-bucket error. Profile, organization and advertisement upload flows should be tested after Storage is correctly configured.

### D. Deploy and test account deletion

The app calls the `deleteMyAccount` callable Firebase Function in `functions/index.js`. Deploy it from the project root after confirming the selected Firebase project and function dependencies:

```bash
cd functions
npm ci
cd ..
firebase deploy --only functions
```

Then test with a non-owner test account first. Confirm recent reauthentication is required, the function refuses to delete an account that owns an active organization, data/files are cleaned up, and a failed cleanup can be retried. Do not test destructive deletion using your primary account.

### E. Confirm production signing

The Gradle release build now refuses to use the Android debug signing key. In the Expo dashboard, open the project's Android credentials and confirm a production/upload keystore exists. EAS normally injects the release signing properties during a managed EAS build. If the build reports missing `MYAPP_UPLOAD_*` properties, fix the EAS credentials configuration and do not remove the guard.

For an already-built AAB, use Android build tools to inspect the signer or inspect the artifact through Play Console. Verify that the upload key and Play App Signing setup match the intended application. Keep keystore files and passwords out of this source ZIP and source control.

### F. Keep Expo Updates compatible

The project includes a native Android folder. Until the project moves back to a fully generated native workflow, keep these values aligned for every native release:

- `expo.version` in `app.json`
- `expo.runtimeVersion` policy in `app.json`
- `expo_runtime_version` in `android/app/src/main/res/values/strings.xml`
- Android `versionCode` in `app.json` and the native Gradle configuration, unless your release process deliberately delegates versioning to EAS

When changing native dependencies or native configuration, build a new native binary. Do not publish an OTA update that expects native modules absent from installed builds.

### G. Finish public release requirements

- Replace the placeholders in `PRIVACY_POLICY.md`, publish it at a stable public URL, and use that URL in the Play listing.
- Ensure privacy wording matches actual behaviour, especially local-only ledger records, cloud-stored workspace administration data, analytics/adverts, currency formatting, and account deletion.
- Complete Google Play Data safety, financial features, target audience, content rating, app access and advertising declarations based on the real production app.
- Review Firestore rules, Storage rules, Firebase usage alerts/billing, backups, error monitoring and a support contact.
- Complete physical-device tests for sign-in/signup/password reset, offline mode, workspace membership/invitations, data export/import, currency conversion, storage uploads, account deletion, app upgrade and cold launch.

## Important known limitation

`CLOUD_SYNC_RELEASE_BLOCKED` remains `true` intentionally. Personal and organization ledger records are not synchronized between devices in this release. Do not disable that gate until offline edit/delete queues, conflict resolution, retry semantics, and two-device testing have been implemented and reviewed. This package does not pretend to solve those product-level synchronization requirements.

## Suggested UX/UI improvements for the next iteration

1. **Dashboard clarity**: prioritize a compact period summary, income/expense/net figures, and one clear primary action such as Add transaction. Avoid making every metric compete for attention.
2. **Empty states**: replace blank lists with short explanations and contextual actions such as Add your first product, Record a sale, or Create an invoice.
3. **Currency transparency**: display the selected currency consistently and make it clear when an amount is converted, including the rate date/source. Never imply that changing display currency changes the original transaction amount.
4. **Offline and sync status**: keep a persistent, plain-language status that differentiates local saving, cloud workspace administration, and ledger sync being unavailable. Offer export/backup access near this notice.
5. **Destructive actions**: use confirmation text that states exactly what is deleted, what remains, and whether the action is reversible. Keep account deletion separate from clearing local records.
6. **Forms and keyboard**: use numeric keyboards for amounts and quantities, inline validation, preserved form values after recoverable errors, and safe-area/keyboard testing on small Android screens.
7. **Accessibility**: check contrast, touch targets, labels for icon-only buttons, screen-reader order, and text scaling. Do not communicate success/error only by colour.
8. **Performance**: test long lists with pagination or virtualization, avoid recalculating reports on every render, and monitor release-mode startup time and memory on lower-end Android devices.

These UX items are recommendations for a separate UI iteration, not claims that all screens have been visually redesigned in this package.


## FinanceTracker product naming and UX update (2026-10-12)

- The Android launcher/display name and Expo display name are now FinanceTracker. The Android application ID remains `com.masebba.ExpenseTracker` intentionally, so the updated app can be installed as an update over existing installations. Do not change the application ID unless you intend to publish a separate app.
- Added a first-use Home dashboard guide when no business records exist, with direct actions to start trading, add customers/suppliers, and record income, expenses, or invoices.
- Added a more helpful Transactions empty state with direct actions to record income or expenses.
- Currency converter now displays the exact indicative rate, quote timestamp, and settlement-rate disclaimer. If the user edits the rate manually, the screen explicitly labels it as manual. Transaction rows expose stored reporting currency amount, exchange rate, and quote timestamp when available.
- Settings now distinguish on-device/offline persistence from a separate backup, and explicitly warn that ledger cloud sync is disabled. The offline screen uses the same language.
- New backup files use the FinanceTracker label; the restore parser continues accepting legacy ExpenseTracker backup formats. Local storage keys and private image directories remain unchanged to preserve existing data.

These are source/configuration changes. Rebuild and test on a physical Android device before release. No Firebase deployment or EAS artifact build was performed as part of this UX pass.
