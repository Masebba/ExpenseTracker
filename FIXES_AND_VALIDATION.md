# FinanceTracker remediation and validation report

**Prepared:** 21 October 2026  
**Source:** `ExpenseTracker(3).zip`  
**Scope:** High- and medium-priority source findings from `finance_tracker_deep_analysis.md`

> **Latest update, 23 October 2026:** this project now includes the Home dashboard animation, Home-header shortcuts and menu, persistent light/dark mode, notification registration/handling, the workspace invitation push trigger, and additional Android native notification wiring. The app/runtime version is now **1.0.4**, Android version code **5**. For the latest validation results and push setup, read [FEATURE_UPDATE_NOTES.md](./FEATURE_UPDATE_NOTES.md) and [PUSH_NOTIFICATIONS_AND_THEME_GUIDE.md](./PUSH_NOTIFICATIONS_AND_THEME_GUIDE.md). Earlier assertion/file counts in this report describe the 21-22 October remediation passes and are historical, not the latest run.

## Summary

The source has been updated to address the high- and medium-priority findings wherever a safe, verifiable source-level fix was possible. The main themes are financial data durability, currency-safe balances, recovery/backup integrity, deletion cleanup, owner lifecycle controls, safer security rules, localization transparency, and dependable local checks.

**Important limitation:** this remediation is not a claim of production certification. The app has not been built with EAS/Gradle, exercised on a physical device, or tested against a deployed Firebase Functions/rules environment during this pass. The updated Functions and Firestore rules must be deployed and tested before their owner-transfer, workspace-deletion, and security behavior is available in production.

## Implemented changes

### Local data durability and transaction consistency

- Added a per-account local write queue so ordinary saves, multi-key changes, restore operations, account/workspace cleanup, and external backup snapshots cannot race each other silently.
- Added a local before-image journal for related writes. Sale creation/deletion now stores the sale list and matching stock changes together, with rollback and startup recovery for interrupted local writes.
- Made local persistence failures visible and rejected failed saves instead of treating in-memory state as durable. An unrecoverable ledger hydration now blocks writes rather than letting the app replace unreadable records with an empty collection.
- Serialized persistence and connected backup/hydration flows to avoid snapshots or reloads observing only one side of a related write.

### Currency correctness and report transparency

- Customer and supplier outstanding amounts are displayed grouped by currency rather than summed as though unlike currencies were interchangeable.
- Credit-limit checks explicitly convert each open balance into the saved limit currency and stop if a required conversion is unavailable.
- Exchange rates can be reused offline for up to seven days; cached conversions are marked stale and the app reports when a displayed result is an estimate.
- Reporting UI now states that using the latest quote can change historical totals when viewed in another reporting currency.
- Invoice numbering includes a random suffix to reduce collisions between offline devices. It reduces, but does not mathematically eliminate, collisions in a future shared-ledger system.

### Backup and account/workspace lifecycle

- Backup restore validates backup format, account scope, supported datasets and record shapes before writing; it restores previous values on a failed primary write and refreshes the recovery mirror after success.
- Fixed backup/export serialization for parsed values and excludes internal recovery journal/baseline keys from backups.
- Guest-to-account migration preserves the manual currency preference.
- Local deletion now removes account/workspace-scoped AsyncStorage values, the private JSON recovery mirrors, and UID/workspace-owned local images. External document-provider backups remain under the user's control; the app clears its local folder reference and does not claim it can erase user-owned copies.
- Added owner-only workspace ownership transfer and workspace deletion paths. Organization creation uses a Firestore batch for the organization and initial owner membership; server-side workspace deletion uses a retryable operation claim to handle partial failures and prevent a concurrent transfer/deletion race.
- Account profile initialization provides `createdAt` for new accounts, supporting recent-account metrics.
- Profile image hydration checks whether local file references are usable and falls back when they are stale.

### Security, localization, advertisements and release checks

- Firestore rules disallow direct root user-profile deletion and protect immutable identity/scope fields in existing records.
- Regional defaults use device time zone and locale as an estimate; they do not use GPS and cannot reliably prove the user's physical country. Weekly reporting respects the locale's configured first day of the week.
- Advertisement imagery is documented and presented as a direct public HTTPS image URL workflow. The app does not claim that image upload is implemented.
- Updated the built-in self-check to inspect Gradle source correctly and to check important remediation invariants.
- Updated README, production/deployment guidance, stability notes and the release checklist to explain device-local ledgers, workspace limitations, and remaining deployment steps.

## Validation performed in this pass

| Check | Result | What it establishes |
|---|---|---|
| `node scripts/self-check.js` | Passed, 111 assertions | The bundled currency and source-invariant checks complete successfully. |
| TypeScript parser over project source | Passed, 58 source files | No JS/JSX/TS/TSX/MJS/CJS syntax/parser diagnostics were found. |
| AST-based relative import resolution check | Passed, 58 source files | All statically detected relative imports resolve to a file or directory entry. |
| EAS/Gradle production build | Not run | Android toolchain and installed project dependencies are not available in this work session. |
| Firebase Functions deployment | Not run | Requires the configured Firebase project, deploy permissions and deployed configuration. |
| Firestore emulator/security tests | Not run | Security rules still need emulator tests for owner/admin/editor/viewer/former-member and unauthenticated users. |
| Physical-device regression tests | Not run | Must be completed on Android before release, especially backup/restore, account deletion, offline sales and interrupted writes. |
| Fresh `npm audit` | Not run | Historical audit snapshots in the uploaded archive are not current dependency-verification evidence. |

## Remaining external/product blockers

These items cannot responsibly be marked complete through a code-only source edit:

1. **Public privacy policy publication:** `PRIVACY_POLICY.md` still contains `[YYYY-MM-DD]`, `[Legal publisher name]`, `[Privacy/support email]`, and `[Privacy policy URL]`. The publisher must provide real legal/contact details and publish the policy before release.
2. **Collaborative ledger synchronization:** `services/cloudSync.js` deliberately keeps ledger sync blocked. Organization membership/admin operations are cloud-backed, but a member's local transactions, sales, invoices, products and other financial ledgers are not automatically shared across devices. This remains disabled because enabling it without conflict resolution, merge/tombstone semantics, and two-device tests could lose or resurrect financial records.
3. **Firebase backend deployment:** owner transfer/deletion callables and tightened Firestore rules need deployment and environment-specific tests. The local source archive alone cannot update a live Firebase project.
4. **Native release verification:** production signing, Expo/EAS build, installation, offline behavior, storage interruption, backup restoration and account/workspace deletion all need real environment/device tests.
5. **Location certainty and data normalization:** automatic region inference uses system time zone/locale as a suggestion, not physical geolocation. A timezone can be manually set or differ from physical location, and a generic local-formatting layer does not yet guarantee region-specific normalization of every phone/address field throughout the app.
6. **External backups:** an Android document-provider backup is a separate readable JSON file owned by the user. The app can clear its local URI reference but cannot promise to erase external copies that the user or provider controls.

## Recommended release gate

1. Supply/publish the privacy policy with real publisher details.
2. Configure and deploy Firebase Functions and Firestore rules, then test owner-transfer and workspace-deletion retries and all membership security cases in an emulator.
3. On an Android device, test interrupted sale persistence, stock rollback, backup restore from valid/invalid files, account deletion, workspace deletion, offline rates, and a device with low storage.
4. Run a clean dependency installation, a fresh vulnerability audit, `npm run check:self`, and a complete EAS production build/signing verification.
5. Keep shared ledger synchronization blocked until concurrent/offline multi-device writes and deletions have explicit conflict semantics and passing tests.

## Second pass: UI and trade workflows (21 October 2026)

See [`UI_WORKFLOW_UPDATE.md`](UI_WORKFLOW_UPDATE.md) for the implementation details and release tests. This update adds compact dropdown filters and collapsible searches, modal entry forms, manual product lookup and price overrides, a more detailed receipt, Excel-compatible multi-sheet export, linked From Trade income, and public advert-image URL normalization. The following workspace pass makes Trade sales create linked income in every active ledger, reconciles historical unlinked sales once, labels the active ledger on the home income/expense summary, serializes sale changes with transaction changes, adds the memberships status collection-group index, and includes `npm run deploy:firestore-indexes` for deployment to the Firebase project identified in `.env`. The current source-level self-check passes 111 assertions; the parser and relative-import scan passed for 58 source files. No live Firebase deployment, EAS build, or physical-device test was run in this pass.


## Workspace ledger and member-index update (21 October 2026)

- Every saved Trade sale creates a read-only `From Trade` income entry in the currently active personal or organisation ledger in the same journalled local commit as the sale and stock update. Removing the sale removes that income entry and restores stock. The personal ledger is not modified when the active workspace is an organisation.
- Existing sales are reconciled by source sale ID when a ledger is opened, so older sales receive a linked income entry without duplicate entries. Sales reconciliation uses the same per-user ledger mutation lock as manual income/expense writes to avoid overwriting a recent transaction.
- Income and Expense lists already read the active `TransactionsContext` storage scope; the workspace subtitle and home dashboard caption now show the active scope, and home totals are calculated from that scope's transactions.
- `firestore.indexes.json` defines collection-group ascending single-field indexes for both `memberships.organizationId` and `memberships.status`; the invitations composite index remains. `npm run deploy:firestore-indexes` reads the exact `EXPO_PUBLIC_FIREBASE_PROJECT_ID` from `.env` and runs Firebase CLI against that project. This source change does **not** deploy to the user's live Firebase project. An authenticated account with deployment permission must run the command and wait for indexes to finish building.
- Firestore index errors now tell the administrator to deploy the bundled index configuration rather than showing the raw database exception.

### Latest source validation

| Check | Result |
|---|---|
| `node scripts/self-check.js` | Passed, 111 assertions. |
| JS/JSX parsing and relative import scan | Passed across 58 source files, zero syntax errors and zero unresolved relative imports. |
| Live Firestore index status | Not checked or deployed, requires Firebase credentials and project access. |
| Expo/EAS build and Android camera/device tests | Not run in this environment. |


## Dropdown crash fix and directory guidance (22 October 2026)

- Fixed a runtime `ReferenceError` in `components/CompactFilterMenu.js`: `fullLabel` and `displayLabel` were referenced by the rendered filter button but had never been declared. Since Trade, Transactions, Reports, Products, and Orders share this component, rendering any of those screens could trigger the app-wide error boundary and show the generic startup message.
- The filter now safely handles empty/non-array options, defines the full accessibility label and compact visible label, and truncates unusually long visible category names while retaining the complete label for accessibility.
- The app-level error boundary now displays the caught error message in development builds only, while retaining a generic message in production builds. This makes future render failures diagnosable without exposing developer details to production users.
- Added self-check assertions specifically for declared filter labels, safe options handling, and long-label truncation.
- Added `PROJECT_DIRECTORY_AND_GIT_GUIDE.md`: the new ZIP is an independent copy and does not sync with the former folder. Existing commits remain in the original local repository if its `.git` directory remains intact. This archive deliberately excludes `.git` history.

### Latest verification for this fix

| Check | Result | Notes |
|---|---|---|
| `node scripts/self-check.js` | Passed, 113 assertions | Includes regression guards for the dropdown's previously undefined label variables. |
| Relative import/require scan | Passed for application source | The scan excludes `scripts/self-check.js`, which contains a literal test fixture that resembles an import path but is not a runtime import. All application relative imports resolve. |
| JSON configuration parsing | Passed, 7 files | `package.json`, `package-lock.json`, `app.json`, `eas.json`, `firebase.json`, `firestore.indexes.json`, and `functions/package.json`. |
| EAS build / device regression test | Not run | A new bundle/build must be tested on the device. Stop old Metro processes and start Metro from the intended project directory. |
