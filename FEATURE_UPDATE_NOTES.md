# FinanceTracker feature update, version 1.0.4

## Included

- Home dashboard summary selector for Today, This week, and This month with a deliberate fade/vertical transition.
- Profile photo change from the Home header avatar. Settings no longer provides a separate photo upload entry.
- Header barcode shortcut opens Trade and pre-opens the Process sale form.
- Header three-dot menu gives access to profile details, currency, data and recovery, Terms of Service, Help Centre, dark mode, notification settings, all Settings, account deletion, and sign-out.
- Spending Targets/Budget occupies the former Settings tab position.
- Persistent light/dark mode across the app's theme context, navigation, React Native Paper surfaces, and themed screens.
- Workspace Terms of Service entry removed; Terms remain accessible from Settings.
- Push registration, notification permission flow, in-app notification inbox, local test notification, invitation push trigger, and notification tap routing.
- Android native notification permission and conditional Google Services Gradle plugin wiring for projects with their own `android/app/google-services.json`.

## Push notification limits and setup

The remote push function currently sends workspace invitation alerts. Trade and other financial records remain device-local in this release, so sales/expense push alerts are not sent by a server trigger. Do not state that they are enabled unless ledger synchronization and server-side event delivery are designed and deployed.

This source includes a checked-in Android native project. Expo documents that EAS Build will not run Prebuild when an `android/` directory is present, in order to avoid overwriting native changes. Native changes required for notification delivery are therefore represented directly in `android/app/src/main/AndroidManifest.xml`, `android/build.gradle`, and `android/app/build.gradle`.

Before a real remote push test:

1. On a machine with npm registry access, run `npm install` to refresh the lockfile and then `npm ci`, `npm run check:self`, and `npm run check:expo`.
2. Retrieve `google-services.json` for the Firebase Android app with package `com.masebba.ExpenseTracker`, place it at `android/app/google-services.json`, and verify it belongs to the same Firebase project used by the app.
3. Configure the FCM V1 service-account key through EAS credentials for the Android app. Never add a private service-account key to source control.
4. Deploy `functions:notifyWorkspaceInvitation` to the intended Firebase project and verify the Firestore rules allow an authenticated user to maintain only their own push-token records.
5. Build version 1.0.4 (runtime 1.0.4, Android version code 5), install it on a physical device, allow notification permissions, run the local test, then verify a remote invitation notification.
6. Check Firebase Function logs and Expo push tickets; consider adding delivery receipt handling and retry/monitoring before a broad production release.

Official references:
- Expo push setup: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Expo FCM credentials: https://docs.expo.dev/push-notifications/fcm-credentials/
- Expo sending notifications: https://docs.expo.dev/push-notifications/sending-notifications/
- Expo native project behavior: https://docs.expo.dev/workflow/continuous-native-generation/
- Firebase Google Services Gradle plugin: https://github.com/google/play-services-plugins/blob/main/google-services-plugin/README.md

## Validation performed in this environment

- `node scripts/self-check.js`: 127 assertions passed.
- `node scripts/self-check.js`: passed, 127 assertions.
- JavaScript/JSX syntax parse: 60 files parsed with zero syntax errors.
- Static relative-import check: 60 JavaScript files checked, zero unresolved relative imports.
- `node --check functions/index.js`: passed.
- JSON parsing: `package.json`, `package-lock.json`, `app.json`, `eas.json`, `firebase.json`, and `functions/package.json` parsed successfully.
- Android manifest and strings XML parsing: passed.
- Direct dependencies in `package.json` match the lockfile root dependency declarations.

## Not performed

No npm registry-backed dependency installation or `npm ci` was completed in this environment. No EAS/Gradle production build, Firebase deploy, EAS credential update, remote push delivery, camera test, physical printer test, or physical-device dark-mode regression test was performed. The ZIP intentionally does not include the project-specific `android/app/google-services.json`, `.env`, private service-account credentials, `.git`, or `node_modules`.
