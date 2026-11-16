# FinanceTracker Stability Patch — 13 October 2026

This is a source-file overlay for the existing FinanceTracker project. It deliberately excludes `package.json`, `package-lock.json`, `.env`, `node_modules`, and native Android project files so it does not overwrite the npm dependency remediation you just ran or your local Firebase configuration.

## Included changes

- Adds the Firestore single-field collection-group index for `memberships.organizationId` under `fieldOverrides`.
- Adds shared user-facing error translation and replaces raw Firebase/Firestore/storage messages in key client screens with clear messages. Technical details are retained in developer logs where useful.
- Replaces the blank authentication initialization view with a FinanceTracker logo and a loading indicator.
- Uses device time zone before locale for region detection and automatically applies detected currency unless the user explicitly selected a currency in Settings.
- Requires advert images to use a direct, public HTTPS image URL, shows a more specific preview failure message, and prevents publishing until an image preview succeeds.
- Keeps the private JSON recovery mirror consistent after a restore, removes restored keys whose backup value is null, and schedules an update to the selected external backup folder.
- Makes Settings explicit that transaction/business-record cloud sync is unavailable in this release and that JSON backups do not include locally stored image files.
- Updates privacy and deployment documentation.

## Apply the patch

1. Back up your current project or commit it to version control.
2. Extract this ZIP directly into `D:\PILATUS\Projects\ExpenseTracker`, allowing files to merge/overwrite. Do not replace your `package.json`, `package-lock.json`, `.env`, or native Android files with files from any older archive.
3. From the project folder run:

```powershell
node scripts/self-check.js
npx expo-doctor
npx expo export --platform android
```

4. Deploy the Firestore index using a Firebase CLI account with permission to deploy to the same Firebase project as the app:

```powershell
firebase deploy --only firestore:indexes
```

Wait until the `memberships` collection-group index is built, then test the member list again. The source patch cannot deploy a Firebase index to your project on your behalf.

5. Test on a real Android device: sign in, load members, create/edit an advert with a public image URL, save a transaction, export JSON, restore a test backup, and confirm the connected external folder receives the new backup.

## Important limitations that still require configuration or a follow-up change

- **Advert image hosting:** the existing feature saves an image URL; it does not upload image bytes. Existing broken adverts must be edited to use a direct public HTTPS image URL that allows unauthenticated image delivery. To support in-app image picking and upload, implement a separate secure upload flow. Never put private upload secrets in `EXPO_PUBLIC_*` variables.
- **Physical location:** this patch uses the device time zone first and locale second. It does not request GPS permission or reverse-geocode coordinates. If a phone has a stale/manual time zone and locale, the app cannot independently determine the physical country. A true GPS-based country default needs an Expo location module, explicit user permission, and reverse geocoding.
- **Phone-number formatting:** existing phone fields remain user-entered text. Locale-aware phone validation/formatting across profiles, customers, suppliers and invoices needs a dedicated phone-number library and a migration/validation decision; this patch does not rewrite saved numbers.
- **Cloud ledger sync:** transactions, sales, products, orders, customers, suppliers, invoices and purchases remain device-local. Cloud sync remains deliberately release-blocked. The user can export JSON or connect an Android document-provider folder, but that is backup, not shared cloud sync.
- **Media in backups:** JSON backup/restore covers local records and settings, not the actual photo files stored in app-private storage. Photos may need to be selected again on a new device.
- **Verification:** the source self-check passed 64 assertions and all JS/JSX files passed a syntax parse in the patch environment. This environment did not have the user's `.env`, live Firebase project, npm registry access, or an Android device, so a live index deployment, actual advert URL test, and fresh signed Android build must still be performed locally.


## Workspace income and member-index follow-up (21 October 2026)

- Trade sales now link to a `From Trade` income transaction in the active personal or organisation ledger. The sale, inventory change and income link are committed together, and the historic-sale reconciler adds missing links without duplicating known source sale IDs.
- The home dashboard labels its active scope and uses the active ledger's transactions for daily income and expense totals. Workspace expenses remain separate from the personal ledger.
- Sale mutations, income changes and historical reconciliation use the shared per-account local ledger lock so a concurrent transaction is not overwritten.
- Added Firestore collection-group indexes for `memberships.organizationId` and `memberships.status`. Member-list errors now explain the one-time index deployment and the project includes `npm run deploy:firestore-indexes`. It reads the project ID from `.env`, but it does not deploy automatically.
- Validation: `node scripts/self-check.js` passed 111 assertions; 58 source files passed syntax and relative-import checks. Live Firebase index deployment, a fresh EAS build and physical-device tests remain pending.
