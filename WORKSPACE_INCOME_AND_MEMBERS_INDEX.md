# Workspace income and member-list fix

## What changes in the app

- Trade sales now add a read-only `From Trade` income entry to the currently selected ledger, whether that is Personal or a business workspace.
- Workspace Income, Expenses, and the Home dashboard read that workspace's own transaction list. A business workspace sale does not change the Personal ledger.
- When older sales are found without a linked income entry, FinanceTracker creates the missing link by sale ID. It does not add a second link if one already exists.
- Sale, stock, and linked income data are saved in a local journalled commit. Sale/reconciliation writes also share the local ledger mutation lock with income/expense writes.
- Workspace metadata, memberships, and invitations are administered through Firebase, but financial ledger records remain local to the current account/device in this release. This package does not enable multi-device live ledger synchronization.

## Fix the “Could not load members” database-index error

The app lists members using a Firestore collection-group query over `memberships` filtered by `organizationId`. Firestore requires the corresponding collection-group index; the repository contains indexes for `memberships.organizationId`, `memberships.status`, and the existing invitations query. Index configuration must be deployed to the same Firebase project used by the app.

1. Extract the ZIP and open a terminal in the project root.
2. Copy `.env.example` to `.env` if `.env` does not exist. Fill in the real Firebase application settings, especially `EXPO_PUBLIC_FIREBASE_PROJECT_ID`. Do not use the example placeholder.
3. Make sure Firebase CLI is authenticated with an account that has permission to deploy indexes to that project. For example, run `npx firebase-tools@latest login` if needed.
4. Run:

   ```bash
   npm run deploy:firestore-indexes
   ```

5. Check the project ID printed by the script before approving the deployment. Wait for the indexes to finish building in Firebase Console under Firestore indexes.
6. Close and reopen FinanceTracker, then switch to the workspace and retry the member list.

If the app still shows the database-setup message, confirm the project's ID and active Firebase project match the app's configuration, inspect the Firebase CLI output, and check the index state. Do not loosen Firestore security rules to work around a missing index.

## What has not been done automatically

The ZIP includes the code and deployment helper, but it cannot deploy a change to a live Firebase project without that project's credentials and deployment permission. No live database change is claimed. A full EAS build and physical-device regression test are still required before production release.
