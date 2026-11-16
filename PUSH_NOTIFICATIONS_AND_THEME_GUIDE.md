# Dark mode, Home shortcuts and push notifications

This update contains the Home summary transition for Today / This week / This month, a header avatar photo shortcut, the header quick-sale action, a three-dot Settings menu, a Budget tab in place of the Settings tab, theme support across major screens, and the first remote push-notification path.

## Dark mode and navigation

- The theme choice is stored locally under `expenseTracker.uiTheme`; it survives restarts and does not depend on the signed-in account.
- Use the Home header three-dot menu to switch light/dark mode or open the full Settings screen.
- The Settings tab was replaced by Budget / Spending Targets. Settings remains available from the header menu.
- Tapping the avatar opens the image picker directly. For a business workspace, photo updates are limited to workspace roles permitted by the app.
- The barcode icon in the Home header opens Trade and opens the Process sale form automatically.

## Push notification status

The client registers an Expo push token after the user enables notifications in Settings. The token is stored in the signed-in user's `users/{uid}/pushTokens/{tokenId}` record, and notifications received while the app is open are also added to the in-app notification inbox. Tapping a supported workspace invitation notification opens Workspaces. A local test notification is available from Settings, but that local test does not prove remote delivery.

The Firebase Functions code currently sends remote push notifications for new workspace invitations to a registered user. Sales, expenses and other ledger events are intentionally not sent as remote notifications because financial ledgers are still device-local in this release. Do not claim remote alerts for those records until cloud synchronization and secure server-side event processing are deliberately implemented.

## Required release setup

This release adds and configures `expo-notifications` as a native module and raises the app/runtime version to **1.0.4** (Android version code 5 in the checked-in project). An installed 1.0.3 or earlier binary cannot gain native notification support or the updated Android manifest through an OTA JavaScript update alone. Build and install a new binary before testing push.

1. In a shell with registry access, run `npm install` to refresh and validate the lock file, then run `npm ci`, `npm run check:self`, and `npm run check:expo`. The lockfile was edited in a network-restricted environment during this code pass, so a registry-backed lock refresh and a successful `npm ci` are required before release.
2. This repository includes a checked-in `android/` directory. EAS Build will not automatically regenerate that native project or apply all `app.json` config-plugin changes unless you run Prebuild yourself. I have therefore added the Android 13 `POST_NOTIFICATIONS` permission and a conditional Google Services Gradle plugin to the native files. Download `google-services.json` for the Firebase Android app whose package is exactly `com.masebba.ExpenseTracker`, and place it at `android/app/google-services.json`. The plugin is applied only when this file exists, so local builds without the file can still compile but will not have the required Android FCM app configuration for remote push. Review `android/build.gradle`, `android/app/build.gradle` and `AndroidManifest.xml` if you choose to run `npx expo prebuild --platform android`, because this repository contains custom release-signing and data-protection edits.
3. In EAS, configure the Google Service Account key for push notifications using FCM V1 for the intended production Android application. The client `google-services.json` is not an Admin service-account key; never commit a private service-account JSON key. The Gradle plugin version is set to `4.5.0` as documented by Firebase.
4. Verify the target Firebase project in `.env` and sign in to the Firebase CLI, then deploy the invitation trigger: `npx firebase-tools deploy --only functions:notifyWorkspaceInvitation --project YOUR_FIREBASE_PROJECT_ID`. Deploy `firestore.rules` only after checking them against the intended project.
5. Build a new Android production artifact with `npx eas-cli build --profile production --platform android`, install it on a physical Android device, enable Notifications in Settings, grant Android notification permission, schedule the local test alert, then invite that registered account to a workspace to verify remote push.
6. Verify the remote function logs and Expo push tickets. For a production release, add receipt handling and retry/monitoring for push ticket errors according to the official Expo push service documentation.

For Android remote delivery, Expo's current setup guide requires the notifications libraries, user permission, an Expo push token, FCM credentials and a build with native support. See [Expo push notification setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Android FCM V1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/), and [sending push notifications](https://docs.expo.dev/push-notifications/sending-notifications/).

## Not verified in this environment

No EAS build, Firebase deployment, EAS credentials change, Android camera/device test, system notification delivery test, or actual phone dark-mode regression test was run. Those steps require the developer's authenticated environment, FCM credentials and a physical device.
