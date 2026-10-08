# ExpenseTracker Privacy Policy

**Status: publication draft.** The publisher requested that contact and URL fields remain placeholders for now. Replace every bracketed field, confirm the Firebase region and retention settings, and publish this text at a stable public URL before submitting the app to Google Play.

**Effective date:** [YYYY-MM-DD]  
**Publisher:** [Legal publisher name]  
**Contact:** [Privacy/support email]  
**Public URL:** [Privacy policy URL]

## Information the app handles

ExpenseTracker handles account details such as email address, display name, and optional phone number; financial entries; inventory, sales, orders, invoices, customer and supplier details; workspace membership and invitations; and profile or business images selected by the user.

Users may start a local guest session without creating an account. Guest personal records are stored only in private app storage unless the user chooses export or an external backup. Users may later choose account access; at that point guest records are copied into the account's local data on that device, keeping existing account entries when record IDs overlap. Personal records are stored by default in private app storage on the device and are available offline. This is not a user-browsable folder. Removing the app may remove that local copy, so users should export it or configure a separate backup before uninstalling or changing devices. Record cloud sync is disabled in the current release: personal and organisation ledger records remain on the device and are not uploaded. Currency and date/time presentation use the device's regional locale and time zone; the app does not request precise location access. For signed-in accounts, the detected country/region code is stored with the Firebase account profile so that the same ledger currency is used across devices. Firebase Authentication and Cloud Firestore also process account/profile details and features users choose to use, including personal/business profile fields, organisation details, memberships, invitations, and public advertisements. Organisation names, invoice details, memberships, and invitations are stored in Firestore for workspace administration and sharing; organisation ledger entries are not included in this cloud data in the current release. The app's Terms of Service and data information is also stored in a public-readable Firestore document and can be updated only by the developer account. Users may export a JSON file or choose an Android document-provider folder for an external JSON backup of locally stored records and settings for the guest session or signed-in account. This folder backup does not include cloud organisation administration data; restore imports local data from a compatible ExpenseTracker file and does not restore that cloud data. A selected folder provider may be operated by Google Drive, Dropbox, or another third party under its own terms. The app does not need contacts access to enter invoice customer details manually.

Firebase configuration and processing are controlled by the publisher's Firebase project. Confirm the project's location, retention, access controls, and support contact before publication.

## Purposes

Data is used to provide sign-in, keep personal records on the device across sessions, support shared cloud workspaces when users choose those features, create invoices and reports, and provide backups chosen by the user. Firebase account and workspace records may also allow the publisher to administer accounts and memberships. Public adverts are downloaded from Firestore. The app does not currently document or enable a third-party ad-personalization or analytics SDK. The publisher must review any future analytics, advertising, or crash-reporting SDK before enabling it and update this notice and Play disclosures.

## Sharing

Account/profile fields and workspace administration metadata are shared with Firebase. Organisation ledger records stay on the device in the current release. Data is shared with third-party apps only when the user chooses to share an invoice, report, or backup. Folder backups may be stored with the user's chosen file-provider service. Public developer advertisements and the current Terms of Service may be downloaded by app users. Do not place personal information in public advertisements.

## Retention and deletion

Users can export and restore local records from Settings. Account deletion uses a publisher-hosted Firebase Function to remove supported account documents, owned public advertisements, and account-owned images before deleting the Firebase Authentication account. It is blocked when the account still owns an active organization; ownership must first be transferred or that organization must be deleted. If a deletion phase fails, the service records a retryable job and leaves sign-in available so deletion can be retried. Organization data is shared and is not automatically erased when a non-owner leaves. External-folder backups are outside the publisher's control and must be deleted by the user. Uninstalling removes app-private local data, but does not delete cloud or external-folder data.

If deletion fails, the app reports an error. Contact [Privacy/support email] to request help. The publisher should define and publish a completion period for manual deletion requests.

## Security

The app uses Firebase Authentication, Firestore access rules, device-private storage, and Android secure storage for the optional device PIN. No system can guarantee absolute security. Users should protect their device and external backups. The app PIN is local and is not an encryption key for database records.

## Children and changes

The app is intended for business and personal finance management and is not designed specifically for children. The publisher should update this notice when processing changes and state the effective date.
