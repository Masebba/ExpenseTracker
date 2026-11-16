# Google Play release checklist

## Before the first production release

## Completed hardening (code changes in this working copy)

- [x] `screens/OfflineScreen.js` now renders the shared `RECORD_SYNC_STATUS` instead of claiming Firestore record sync.
- [x] Local profile/workspace images fall back to placeholders when their stored `file://` URI no longer belongs to this install (`utils/appUtils.js:isUsableLocalImage`, used by Settings, Workspaces, and the header).
- [x] Reports and account summary filter totals to the selected currency and report how many records were excluded.
- [x] Invitation lookup normalizes email input before querying Firestore.
- [x] Missing Firebase build config now shows a startup recovery screen instead of crashing (`index.js` error boundary).
- [x] Added dependency-free `npm run check:self` (`scripts/self-check.js`) for money parsing, backup key scoping, and release-gate copy.
- [x] Added a Firestore collection-group composite index for invitation lookup and wired it into `firebase.json`.
- [x] Made the EAS production environment explicit in `eas.json`.
- [x] Changed Expo runtime-version policy to follow the app version and aligned the checked-in Android runtime string to the current app version. Keep the Android string aligned manually while the native `android/` project is checked in.
- [x] Changed startup module loading so errors thrown while importing `App` can be caught by the startup error boundary.
- [x] Changed Android release signing to fail closed for release tasks when credentials are missing or incomplete, rather than silently producing an unsigned artifact or using the debug key.
- [x] Made workspace creation atomic and added owner-only callable functions for transfer/deletion; deploy functions before relying on these controls.
- [x] Added local multi-key transaction recovery, persistence-failure blocking, currency-separated balances, and strict backup validation.

## Remaining release blockers (not code-complete)

- [ ] Replace all placeholders in `PRIVACY_POLICY.md`, publish it at a public URL, and add that URL to the Play listing.
- [ ] Complete Google Play Data safety, content rating, target audience, app access, ads, and financial features declarations based on the actual production build and Firebase configuration.
- [ ] After confirming `.env` has the correct `EXPO_PUBLIC_FIREBASE_PROJECT_ID` and Firebase CLI login has permission, run `npm run deploy:firestore-indexes`; wait until the `memberships` collection-group indexes are enabled before retrying the workspace member list.
- [ ] Confirm Firebase production project, Authentication providers, Firestore rules/indexes, backup/monitoring setup, billing limits, and support ownership. The current advert-image field accepts a public HTTPS image URL, not an uploaded image, so Firebase Storage is not required for that feature. Deploy rules from this repository only after reviewing them against production data.
- [ ] Deploy and test `deleteMyAccount`, `transferOrganizationOwnership`, and `deleteOrganization` Firebase Functions. Verify ownership checks and retry after partial failures; confirm account authentication is deleted only after cleanup phases complete.
- [ ] Keep `CLOUD_SYNC_RELEASE_BLOCKED` enabled. Production record sync is a blocker until offline edit/delete queues, conflict resolution, retry behavior, and two-device QA are designed and reviewed.
- [ ] Configure EAS production environment values for every `EXPO_PUBLIC_FIREBASE_*` key, then verify with `eas env:list --environment production`. These Firebase client values are embedded in the app and are not server secrets; enforce security with Firebase rules.
- [ ] Set the final app name, package ID, icon/adaptive icon, splash screen, screenshots, store description, support email, and publisher identity.
- [ ] Confirm EAS has a valid Android production keystore and the Gradle release-signing properties are injected. Build an Android App Bundle with `npm run build:android:production`; verify the artifact certificate and Play App Signing before uploading to internal testing.
- [ ] Install the Play internal build on physical Android devices. Check fresh install, upgrade, account creation/sign-in/reset, no-network use, permission denial, data export, account deletion, navigation, keyboard, and small-screen behavior.
- [ ] On physical Android devices, validate offline use; personal and multi-workspace switching; sync status and conflict scenarios; account deletion including retry after partial failure; keyboard visibility; smallest supported screen; and backup export, restore, malformed file, wrong-account file, and interrupted restore recovery.
- [ ] Verify search and filters with large transaction, product, customer, supplier, invoice, sale, and order lists.
- [ ] Review crash reports and Firebase usage during internal testing. Confirm no development logs expose user details.
- [ ] Promote through closed testing as required by the Play account, then submit production only after all blockers are closed.

## Release commands

```bash
npm ci
npm run check:expo
npm run build:android:production
npm run submit:android:internal
```

The submit profile uploads to **internal** testing by design. Select the intended track explicitly in EAS/Play Console before promotion.

Physical-device QA is pending: `adb devices -l` returned no connected Android devices in the implementation environment. Do not mark the device checks above complete until the scenarios have been exercised on the Play internal build.

## UI, Trade, export and advert follow-up checks

- [ ] Verify Trade, Products, Orders, Income and Expense list screens show the list through to the bottom navigation; open and dismiss each add/edit modal on a narrow screen and with the keyboard open.
- [ ] Confirm product category and period filters use compact dropdowns, and expanding/clearing search does not hide the primary action button.
- [ ] Record a sale using a named product without a barcode; repeat with an exact-name lookup and the scanner.
- [ ] Enter a manual selling price above the standard product price and a percentage discount. Confirm the stored product price does not change and the final amount is correct.
- [ ] In a personal ledger, make a Trade sale and confirm it appears once in Income as **From Trade** and in the Excel workbook. Delete the sale and confirm stock is restored and the linked income is removed.
- [ ] Make a sale in an organization workspace and confirm its linked **From Trade** income appears in that workspace Income screen and dashboard, while the personal Income screen remains unchanged. Record an expense in the workspace and verify the active workspace dashboard and Expense screen include it. Confirm historical sales are linked once only.
- [ ] Generate the detailed workbook, open it in Excel or LibreOffice, and inspect all six sheets. Test with an empty period and with currency conversion unavailable.
- [ ] Print a receipt on the intended device/printer and confirm the business details, paper width, line wrapping, discount, and totals.
- [ ] Preview and publish a public HTTPS advert image. Test an ordinary direct JPEG/PNG, a public Google Drive file link, a Dropbox shared link, and a link that requires login. Confirm failures remain understandable and the home screen displays the selected image.


## Dark mode and push notification follow-up

- [ ] Confirm the stored light/dark preference survives a cold app restart and that the login, dashboard, Trade screens, Workspaces, Income/Expense, Reports, Settings and Help Centre remain readable in both modes.
- [ ] Confirm the Home summary transitions between Today, This week and This month with reduced motion acceptable to the target device.
- [ ] Confirm tapping the avatar opens the device photo picker and that a profile photo can be changed without opening Settings.
- [ ] Confirm the header barcode action opens Trade directly into the Process sale form and the three-dot menu can navigate to every Settings section.
- [ ] Before building version 1.0.4, run `npm install` or `npx expo install expo-notifications expo-constants` on a machine with registry access and confirm `package-lock.json` is refreshed and `npm ci` succeeds.
- [ ] Add the matching Firebase client configuration as `android/app/google-services.json`. The project includes native Android files, so EAS will not automatically apply every `app.json` config-plugin change; inspect the native Gradle and manifest configuration before rebuilding. Never commit a private FCM service-account JSON key.
- [ ] Configure the FCM V1 service-account credential through EAS credentials for the same Firebase Android app. Keep all private service-account key files out of source control.
- [ ] Deploy `functions:notifyWorkspaceInvitation` to the intended Firebase project, verify Firestore token-write rules, and test a workspace invitation on a physical production-like Android build with notifications enabled.
- [ ] Verify in-app notification inbox behavior when a push arrives in the foreground and verify tapping an invitation notification opens Workspaces.
- [ ] Rebuild the Android production binary. This release adds the native `expo-notifications` module and bumps runtime version to `1.0.4`, so an OTA JavaScript update alone cannot add its native module to an older installed binary.
- [ ] Remember that Trade and ledger data remain device-local in this release. Remote push triggers currently cover workspace invitations, not sales, expenses or other offline ledger edits.
