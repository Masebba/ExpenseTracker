# FinanceTracker sales, dashboard, chart and theme improvements

Prepared: 16 November 2026
Project version/runtime retained: 1.0.4

## Implemented

### Multi-item Trade checkout

- A checkout is now one sale/order with an `items` array containing one row per product, quantity, selling-price override, discount and saved currency-conversion/cost snapshots.
- Users can scan a barcode, type an exact product name or browse inventory products, including products without barcodes.
- Each cart line can be removed; the cart can be cleared; the user can set a quantity, selling price and discount for each selected product.
- The cart is completed once. Stock is validated and reduced for every product in a single journalled operation.
- The checkout creates one sale receipt/order and one linked `From Trade` income transaction for the total.
- Deleting the sale restores every affected product quantity and removes its linked `From Trade` income transaction.
- Historical single-item sales are still normalized for display, printing and reporting.
- Sales search now matches all product names and barcodes inside a multi-item sale.

### One consolidated receipt and 3 x 5 page

- One print action renders all cart line items under one receipt number, including quantities, unit prices, per-line discount values, line totals, aggregate subtotal, total discounts, final total, payment method and saved business details.
- The HTML page is requested at 216 x 360 pixels (72 PPI), with `@page size: 3in 5in`, so 3 x 5 inches is the default receipt document size.
- A long cart remains one sale and one receipt number. If it cannot fit on one 3 x 5 page, the print renderer may continue it onto another page of the same print job.
- The Android print service/printer must support custom 3 x 5 media. The app requests the page dimensions, but a printer driver can still constrain paper choices or margins. Confirm on the actual printer before relying on exact paper feeding.

### Sales History Graph

- Product names remain vertically oriented inside the chart tracks/bars.
- Labels use a separate high-contrast outline pass and fill pass for readability on both short and tall bars.
- Long product lists can still be browsed horizontally.

### Home mini-dashboard

- Today, This week and This month cycle automatically without requiring taps.
- The carousel holds each period for about 6.5 seconds, then fades/slides between periods over approximately one second.
- The summary surface has a 142-pixel minimum height and a subtle light/dark gradient.

### Budget and Home visual polish

- The Budget bottom tab now shows its own Budget page heading and subtitle.
- The Budget bottom-tab icon matches the Home Budget shortcut (`chart-donut`).
- The light green is softened to a cooler medium green, supported by pale distinct shortcut tints and a restrained gradient on the summary card.
- Personal profile subtitle is retained as `Personal account · Private ledger` (guest mode: `Guest account · Saved on this device`).

### Dark mode

- The dark palette uses explicit, contrasting background, card, input, text, border, header, tab and income/expense colors.
- React Native Paper's theme merges the base theme with explicit Material color roles and elevation levels, and React Navigation receives the corresponding dark palette.
- The theme choice continues to persist locally in AsyncStorage.

## Update compatibility

No native dependencies, Android manifest entries, Gradle files, package identifier, app version, runtime version, or EAS channel were changed for this update. The existing project already includes `expo-print`, `react-native-svg`, and `expo-updates`.

Current project configuration retained:

- Expo app version: `1.0.4`
- Runtime version: `1.0.4`
- Android package: `com.masebba.ExpenseTracker`
- EAS production channel: `production`
- EAS project ID: `e686eb7d-2e35-4e19-82e7-3d811f8a4cc1`

If the installed Android app was built from this runtime on the `production` channel and has Expo Updates enabled, publish the JavaScript/assets update from this exact project using:

```powershell
npx eas-cli update --channel production --environment production --message "FinanceTracker: multi-item sales, 3x5 receipts, dashboard and theme polish"
```

Then open FinanceTracker with an internet connection, allow it to download the update, close it fully and reopen. Depending on when the update is downloaded, a second cold launch may be needed to apply it.

Do not uninstall the existing app. An OTA update does not require uninstallation and does not normally clear local app data.

If the installed binary has a different runtime version, is on a different channel/EAS project, or does not have a working Expo Updates native client, an OTA update will not be applied. In that case create a new compatible APK/AAB and install it over the existing app. Keep the same package identifier and signing keystore; do not uninstall first, since that may erase local financial records.

## Validation performed

- `node scripts/self-check.js`: 146 assertions passed.
- `node --check` over JavaScript files: passed.
- Relative import check: 249 imports checked, zero unresolved relative paths.
- Core sales line-item helper smoke checks: passed for legacy single-line and new multi-line records.
- JSON project configuration files parsed successfully.
- ZIP archive integrity verified after packaging.

## Not performed

- No npm registry dependency installation or actual Expo bundle was run in this environment.
- No EAS Update was published to the user's Expo account.
- No EAS production build or Gradle build was performed.
- The Android camera/printer services, physical 3 x 5 paper feeding, multiple-page receipt behavior, visual chart rendering, and dark-mode device stability have not been verified on a physical Android device.
- The app's local financial records and cloud/Firebase configuration are not modified by this source package. Project-specific `.env`, `android/app/google-services.json`, private service-account keys, `.git`, and `node_modules` are not bundled.
