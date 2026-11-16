# Android release signing fix for EAS Build

## Why the previous build failed

The release block in `android/app/build.gradle` required all four `MYAPP_UPLOAD_*` Gradle properties and threw an exception if they were not present. EAS Build normally supplies its managed Android app-signing credentials through the EAS build integration (`credentials.json` and the generated `android/app/eas-build.gradle`), rather than setting these four custom local Gradle properties. The project-level exception fired before EAS could apply the managed signing setup.

## What changed

- `android/app/build.gradle` now accepts all four custom properties when you explicitly use local Gradle signing.
- If only some local signing properties are present, Gradle still fails with a clear error.
- If none are present, the Gradle script does not abort project configuration. EAS Build can apply its managed signing configuration later in the build process.
- It still uses `signingConfigs.release` for the release build and does not fall back to the debug keystore.
- The self-check now verifies this EAS compatibility behavior.

## What to do

1. Use this corrected project source in the repository/project that you actually build. If building from Git, copy the changed `android/app/build.gradle` and `scripts/self-check.js` into that working tree, review the diff, commit and push it to the same branch EAS uses.
2. Do not add your FCM service-account private key to the repository. EAS push credentials and Android app-signing credentials are separate.
3. In the EAS build prompt, keep the existing Android app-signing keystore if one is already associated with the app. Do not generate a different signing keystore casually, since Android updates normally need a compatible signing certificate.
4. Run `npm run check:self` and `npm run check:expo` from the project root.
5. Retry the build: `npx eas-cli build --profile production --platform android`.

If EAS asks whether to configure Android application signing credentials, choose the existing credentials for FinanceTracker where available. If no credentials exist, follow EAS's prompt to generate/manage them and retain a secure backup.

## Security notes

- Never put keystore passwords or private service-account JSON values in source control.
- The `google-services.json` file is an Android Firebase client configuration file; it is not the service-account private key and it does not solve app-release signing by itself.
- This fix addresses the exact Gradle failure in the supplied log. A successful production build still depends on the project dependencies, EAS project credentials, environment variables, and Firebase/native setup being valid.
