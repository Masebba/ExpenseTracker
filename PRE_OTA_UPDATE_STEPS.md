# Publish this FinanceTracker update without reinstalling

1. Extract the ZIP into a new project folder.
2. Copy your existing `.env` into the project root and `google-services.json` into `android/app/`. Do not copy the Firebase service-account private key into the project. EAS already stores that separately if the credential upload succeeded.
3. Open PowerShell in the folder containing `package.json`.
4. Run `npm ci`.
5. Run `npm run check:self`. It should report 158 passed assertions.
6. Confirm EAS is signed in to the account that owns the existing FinanceTracker project:

   ```powershell
   npx eas-cli whoami
   ```

7. Publish to the existing production update channel:

   ```powershell
   npx eas-cli update --channel production --environment production --message "FinanceTracker: dark-mode recovery, cart workflow and layout polish"
   ```

8. Keep the existing app installed. Connect the phone to the internet, force-close FinanceTracker, reopen it to download the update, then close and reopen once more to apply it.

The project retains runtime version `1.0.4`, the existing EAS project ID and the `production` channel. OTA will work only if the app installed on the phone was built with that same runtime/channel. If it was not, build and install a compatible APK/AAB using the same signing key; do not uninstall first, because local financial data may be lost.

For dark-mode testing, switch to dark mode and open Home, Trade, Transactions, Reports and Budget. If the app encounters a theme rendering error, it should return to light mode. If the root startup screen appears, copy the `Diagnostic:` line and share it for targeted debugging.
