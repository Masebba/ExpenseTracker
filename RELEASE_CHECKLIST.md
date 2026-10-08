# Google Play release checklist

## Before the first production release

## Completed hardening (code changes in this working copy)

- [x] `screens/OfflineScreen.js` now renders the shared `RECORD_SYNC_STATUS` instead of claiming Firestore record sync.
- [x] Local profile/workspace images fall back to placeholders when their stored `file://` URI no longer belongs to this install (`utils/appUtils.js:isUsableLocalImage`, used by Settings, Workspaces, and the header).
- [x] Reports and account summary filter totals to the selected currency and report how many records were excluded.
- [x] Invitation lookup normalizes email input before querying Firestore.
- [x] Missing Firebase build config now shows a startup recovery screen instead of crashing (`index.js` error boundary).
- [x] Added dependency-free `npm run check:self` (`scripts/self-check.js`) for money parsing, backup key scoping, and release-gate copy.

## Remaining release blockers (not code-complete)

- [ ] Replace all placeholders in `PRIVACY_POLICY.md`, publish it at a public URL, and add that URL to the Play listing.
- [ ] Complete Google Play Data safety, content rating, target audience, app access, ads, and financial features declarations based on the actual production build and Firebase configuration.
- [ ] Confirm Firebase production project, Authentication providers, Firestore and Storage rules, billing limits, backups, monitoring, and support ownership. Deploy rules from this repository only after reviewing them against production data.
- [ ] Deploy the resumable `deleteMyAccount` Firebase Function, verify ownership blocks and retry after injected failures, and confirm Auth is deleted only after all cleanup phases complete.
- [ ] Keep `CLOUD_SYNC_RELEASE_BLOCKED` enabled. Production record sync is a blocker until offline edit/delete queues, conflict resolution, retry behavior, and two-device QA are designed and reviewed.
- [ ] Configure EAS production environment values for every `EXPO_PUBLIC_FIREBASE_*` key. These Firebase client values are embedded in the app and are not server secrets; enforce security with Firebase rules.
- [ ] Set the final app name, package ID, icon/adaptive icon, splash screen, screenshots, store description, support email, and publisher identity.
- [ ] Build an Android App Bundle with `npm run build:android:production`; verify Play App Signing and upload it to the internal testing track.
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
