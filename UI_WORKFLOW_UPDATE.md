# FinanceTracker UI and trade-workflow update

Date: 21 October 2026

This update builds on the previous FinanceTracker data-integrity and release-hardening pass. It changes the project source, not just documentation.

## Implemented

### Compact transaction and inventory screens

- Moved the Trade sale form into a modal opened from **Process sale**.
- Kept the sales, product, and order lists flexed to the available space above the bottom navigation.
- Moved Income and Expense entry forms into modal dialogs, leaving the transactions list visible.
- Added reusable compact dropdown filters and an expandable search control. The product category filter now uses a dropdown instead of one permanently visible filter per category.
- Capped long selected filter labels visually while retaining the full label in accessibility text.

### Trade workflow

- Products may be saved without a barcode. A sale can locate a stocked product by exact name or through the searchable product picker.
- Added a per-sale **Unit selling price** override. It defaults to the inventory price but does not change the stored standard product price.
- Separated the numeric Discount (%) field from the customer payment currency picker and validated price, quantity, stock, and discount before saving.
- Added camera-ready/loading and mount-error states with a full-size preview; manual product selection remains available when the camera is denied or unavailable.
- Added receipt printing with business/workspace details where available, contact and registration/tax details, sale/date/payment identifiers, line items, discount, totals, barcode/SKU fallback, and narrow 80 mm thermal-paper styling.
- Added sale removal with confirmation. Removing a sale restores the sold quantity and removes its linked Trade income entry in the active ledger.

### Trade income integration

- Each Trade sale in the active personal or business workspace ledger creates a linked income entry in category **From Trade**, showing the product name and using the recorded sale currency and saved base amount.
- Sales in a business/organization workspace are linked to income in that same workspace and are not copied into the personal income ledger.
- Linked income cannot be edited or deleted independently. Users remove the original sale in Trade to keep sale, stock, and income records consistent.
- Local sale, inventory, and linked-income changes are committed through the local transaction journal before in-memory state is updated. This is still a device-local feature; it does not enable shared cloud ledger sync.

### Reporting

- Replaced the former printable report action with an offline, multi-sheet Excel-compatible SpreadsheetML workbook. It is written as `.xls` and shared using the device sharing sheet.
- The workbook includes Summary, Sales, Sales by Product, Income and Expenses, Inventory, and Orders sheets, with useful identifiers, currencies, saved base values, exchange-rate metadata, stock data, payment methods, and order balances.
- Export remains available if a live conversion cannot be calculated. In that case, summary totals are marked unavailable and raw detail records remain included rather than silently claiming a total.
- Rotated product labels vertically within their chart columns, with an outlined text style for visibility.

### Advertisement image URLs

- Added normalization of direct public HTTPS image URLs and common Google Drive file-sharing and Dropbox links.
- Google Drive file IDs and `id=` sharing URLs are converted to a view endpoint. Dropbox links use `raw=1` while preserving support for modern shared-file paths.
- Developer Studio validates that the currently edited image URL, not a previously previewed URL, is the one that successfully loaded before publishing.
- The dashboard uses the normalized URL, logs useful native image errors for diagnosis, and reduces the light overlay so the image remains visible behind the advert copy.
- Image URLs must still be publicly accessible and serve supported image bytes. Login-required, expiring, HTML-only, blocked, or unsupported-format URLs cannot be made reliable by URL normalization alone.

## Validation in this update

| Check | Result |
|---|---|
| `node scripts/self-check.js` | Passed, 111 assertions after workspace update |
| TypeScript transpile parser over app JavaScript/JSX | Passed, 56 files, no syntax/parser errors |
| Relative import resolution scan | Passed, 0 unresolved relative imports |
| Excel SpreadsheetML sample generation | Passed, two worksheets produced |
| XML parser check on generated workbook sample | Passed |

No application dependencies were added for the Excel export. The working project contains the original dependency lockfile.

## Tests still required before release

- A clean `npm ci` was attempted but could not complete because requests to the npm registry failed DNS resolution (`EAI_AGAIN`). Expo config/doctor checks and a full EAS Android production build were therefore not run in this update.
- Camera preview behavior needs physical Android-device testing, including first permission request, permission denied, camera already in use, and scanner cancellation.
- Test the receipt on the target printer/paper, especially whether its driver respects 80 mm sizing and margins.
- Confirm advert previews using the actual URLs intended for publication. URLs from services that return an HTML landing page or require authentication will still fail.
- Perform an end-to-end personal sale, verify its From Trade entry in Income and Reports, delete that sale, and confirm stock is restored and linked income removed. Repeat within an organization workspace, verify the same workspace’s Income and dashboard update, and confirm the personal ledger remains unchanged.
- Validate sales with no barcode, discounts including decimal values, per-sale prices above and below list price, multi-currency receipts, empty report periods, and offline conversion errors.
- Keep `CLOUD_SYNC_RELEASE_BLOCKED` enabled. This update does not implement or enable shared cloud ledger synchronization.


## Workspace scope and membership index follow-up (21 October 2026)

- Fixed the former personal-only sales-to-income link. Sales now create linked `From Trade` entries in the active ledger. Income, Expenses, the account summary, and the home dashboard all consume the transactions for the active storage scope.
- Older sales are reconciled by source sale ID on opening a scope, guarded by the per-account ledger mutation lock so migration cannot overwrite an income/expense saved at the same time.
- The home dashboard explicitly labels Personal versus the active business workspace. Changing workspaces changes all scoped local contexts, while personal records remain separate.
- Added collection-group indexes for `memberships.organizationId` and `memberships.status` and a project-specific deploy command, `npm run deploy:firestore-indexes`, which reads `EXPO_PUBLIC_FIREBASE_PROJECT_ID` from `.env`. The live Firebase project still needs an authenticated index deployment and time for index build completion.
- Workspace member index failures now show a database-setup title and a specific deploy action rather than only the generic “Could not load members” message.

Source checks after this follow-up: `node scripts/self-check.js` passed 111 assertions; TypeScript's parser and a static relative-import check passed across 58 JavaScript-family source files. No live Firebase deployment, EAS build, or device-level camera/receipt test was performed.
