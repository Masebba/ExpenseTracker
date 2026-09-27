# ExpenseTracker

ExpenseTracker supports personal use and multi-organisation workspaces. A person can keep a private personal ledger, create or join multiple companies/organisations, and switch between workspaces. Each workspace has its own transactions, inventory, sales, and orders. Records are stored on the device in the app sandbox and mirrored under an `ExpenseTracker` folder. Cloud sync is off by default and can be enabled in Settings.

## Install

```bash
npm install
npx expo start
```

The project uses Expo SDK 57. Firebase JS SDK 12+ is required. Deploy `firestore.rules` before relying on cloud sync, organisation memberships, or developer adverts. Profile and organisation images stay on the device and do not require Storage deployment.

## Data model

Personal data stays under `users/{uid}`. Organisation data is scoped under `organizations/{organizationId}`. A membership document under `users/{uid}/memberships/{organizationId}` assigns `owner`, `admin`, `editor`, or `viewer` access. The workspace screen lets signed-in users:

- create any number of companies or organisations
- switch between personal records and organisation records
- add existing app users as members and assign an initial role
- let owners change member roles or revoke access

Each workspace stores:
- transactions
- products
- productCategories
- sales
- orders

The app keeps a device-local copy scoped to the signed-in user and workspace, so different organisation records remain separate on a device.

## Important

The Firebase project must have Authentication and Firestore enabled. Deploy the current `firestore.rules` for organisation membership, optional cloud sync, private invitations, and developer-only advert publishing. Profile and organisation images are copied to each device’s app folder; this app’s profile/logo features do not require Firebase Storage or Storage rules. Inviting a member currently requires that person to sign up first, using the same email address. Existing single-user business data remains under its original personal account; it is not automatically moved into a new organisation. The notification bell is an in-app activity inbox; push notifications require additional platform setup.

### Developer ad publishing

The Developer Studio has no public navigation entry. Access is controlled by the `developerAdmin` boolean on the signed-in account's Firestore profile document, `users/{uid}`. To grant access:

1. In Firebase Console, open **Firestore Database → Data → users → the document whose ID exactly matches the signed-in Firebase Auth UID**.
2. Add or edit the `developerAdmin` field. Set its type to **boolean** and its value to **true** (not the text string `"true"`).
3. Save the document. The app listens to this profile and should reveal the private Developer Studio route automatically; no sign-out, token refresh, or custom claim is needed.
4. If it does not appear, check that Firebase Authentication and the app use the same Firebase project, and that the document ID equals that account's UID. A `developerAdmin` field added to an unrelated user document has no effect.

Deploy `firestore.rules` after changing the developer authorization check; Firestore rules independently require `users/{uid}.developerAdmin == true` for publishing or removing public adverts. Organisation owners and staff cannot publish public adverts.
