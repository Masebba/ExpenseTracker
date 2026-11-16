# Windows Firebase CLI filename conflict fix

## Why the popup kept appearing

On some Windows setups, launching the Firebase CLI while the current directory contains an app file named `firebase.js` can make Windows Script Host attempt to interpret that app module as a command. The resulting popup reports a JScript `Syntax error` against the project `firebase.js`. The previous deployment helper still launched `npx` from the app folder, so merely renaming the app module did not cover every route.

## What this update changes

- The app initialization module is `firebaseClient.js`, with app imports updated.
- Both deployment helpers now start the CLI from the Windows temporary directory and pass the project's absolute `firebase.json` path. This avoids command resolution against the app folder.
- `scripts/firebase-cli-login.ps1` logs in from the temporary directory too.

## Steps

1. Extract the project ZIP into a new folder, or apply the deployment-script patch over your existing project.
2. Ensure `.env` contains the correct `EXPO_PUBLIC_FIREBASE_PROJECT_ID`.
3. From PowerShell in the project root, run: `powershell -ExecutionPolicy Bypass -File .\scripts\firebase-cli-login.ps1`
4. Then run: `npm run deploy:firestore-indexes`
5. Check that the printed project ID is correct, and wait for the indexes to finish building in Firebase Console.

If browser login cannot open, run this directly from PowerShell after first changing to `$env:TEMP`: `npx --yes firebase-tools@latest login --no-localhost`.

Do not deploy if the printed project ID is not the project used by the app. Do not loosen Firestore rules to work around a missing index.
