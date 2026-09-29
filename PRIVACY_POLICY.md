# ExpenseTracker Privacy Policy

**Status: publication draft.** The publisher requested that contact and URL fields remain placeholders for now. Replace every bracketed field, confirm the Firebase region and retention settings, and publish this text at a stable public URL before submitting the app to Google Play.

**Effective date:** [YYYY-MM-DD]  
**Publisher:** [Legal publisher name]  
**Contact:** [Privacy/support email]  
**Public URL:** [Privacy policy URL]

## Information the app handles

ExpenseTracker handles account details such as email address, display name, and optional phone number; financial entries; inventory, sales, orders, invoices, customer and supplier details; workspace membership and invitations; and profile or business images selected by the user.

Records are stored in app-private device storage. Record cloud sync is disabled in the current release; account sign-in, invitations, workspaces, and other explicitly used Firebase features may still process data in Firebase Authentication or Cloud Firestore. Users may export a JSON file or choose an Android document-provider folder for an external JSON backup. A restore imports local account data from a compatible ExpenseTracker file. That provider may be operated by Google Drive, Dropbox, or another third party under its own terms. The app does not need contacts access to enter invoice customer details manually.

Firebase configuration and processing are controlled by the publisher's Firebase project. Confirm the project's location, retention, access controls, and support contact before publication.

## Purposes

Data is used to provide sign-in, keep records on the device across sessions, support shared workspaces, create invoices and reports, and provide backups chosen by the user. The app does not sell personal information. The publisher must review any future analytics, advertising, or crash-reporting SDK before enabling it and update this notice and Play disclosures.

## Sharing

Data is shared with Firebase when sign-in or workspace features require it, with organization members according to their assigned roles, and with third-party apps only when the user chooses to share an invoice, report, or backup. Public developer advertisements may be downloaded by app users. Do not place personal information in public advertisements.

## Retention and deletion

Users can export and restore local records from Settings. Account deletion uses a publisher-hosted Firebase Function to remove supported account documents, owned public advertisements, and account-owned images before deleting the Firebase Authentication account. It is blocked when the account still owns an active organization; ownership must first be transferred or that organization must be deleted. If a deletion phase fails, the service records a retryable job and leaves sign-in available so deletion can be retried. Organization data is shared and is not automatically erased when a non-owner leaves. External-folder backups are outside the publisher's control and must be deleted by the user. Uninstalling removes app-private local data, but does not delete cloud or external-folder data.

If deletion fails, the app reports an error. Contact [Privacy/support email] to request help. The publisher should define and publish a completion period for manual deletion requests.

## Security

The app uses Firebase Authentication, Firestore access rules, device-private storage, and Android secure storage for the optional device PIN. No system can guarantee absolute security. Users should protect their device and external backups. The app PIN is local and is not an encryption key for database records.

## Children and changes

The app is intended for business and personal finance management and is not designed specifically for children. The publisher should update this notice when processing changes and state the effective date.
