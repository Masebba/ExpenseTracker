# FinanceTracker Build Sale scanner, advert copy and header menu correction

Prepared: 21 November 2026  
Base: `FinanceTracker-scanner-ad-fade-recovery.zip`  
App/runtime version: `1.0.4`

## Build Sale scanner regression

The original Sales scanner correction reused `BarcodeScannerComponent` in a Paper `Portal` modal. Device testing showed that Sales still displayed a white camera preview and froze, so that shared-component approach was not retained for Sales.

The current implementation is the dedicated `SalesBarcodeScanner` component. It uses the project's already-installed Expo Camera `CameraView`, but owns a separate full-screen React Native native modal, permission handling, camera-ready and mount-error states, retry controls, and duplicate-scan protection. The Build sale Paper modal is hidden while scanning and restored on cancellation or completion, preserving the in-progress form and cart state. After a barcode is read, Sales closes and unmounts the scanner before looking up the inventory item and adding it through the existing stock, price, currency-conversion, and cart logic. The Products Add product scanner and its shared `BarcodeScannerComponent` remain unchanged.

## Advert copy readability

The image remains visible across the upper portion of the advert. A translucent text band is applied only to the lower area containing the business name, title and description. The light theme uses a white overlay at 84% opacity; dark theme uses a dark green overlay at 82% opacity, with the existing high-contrast text colours retained. The advert now transitions with a smooth horizontal slide and retains the shared image renderer.

## Header menu and profile subtitle

- Removed leading icons from the items in the three-dot menu.
- Removed the Delete account menu item. Account deletion remains in All settings.
- Changed the signed-in personal-account subtitle from `Personal account · Private ledger` to `Private ledger`.
- Guest-account and workspace labels are unchanged.

## Source validation

| Check | Result |
|---|---|
| `npm run check:self` | Passed, 188 assertions |
| TypeScript parser over JS/JSX/TS source | Passed, 63 files, 0 syntax errors |
| Relative import resolution | Passed, 251 imports, 0 unresolved |
| ZIP integrity | Verified |
| Dependency manifest | No package dependencies changed |

## Not performed

- No physical Android camera test was possible in this environment. The new Sales camera lifecycle is source-validated only; the user's phone must still confirm that the independent native modal opens a live camera preview, reads an inventory barcode, closes cleanly, and returns to Build sale. See `FINANCETRACKER_SALES_SCANNER_FOLLOWUP.md` for the required device test.
- No EAS Update was published and no production APK/AAB was built.
- The live advertisement URL was not available for a device/network image-load test. The text-band styling is source-validated only.

## Deployment precautions

This is a source update only. The app version/runtime, Android package identifier, EAS project and production channel are retained. Publish an OTA update only if the installed application uses the same runtime, EAS project and `production` channel, and has Expo Updates enabled. Copy the user's existing `.env` and Android `google-services.json` into the extracted project if needed. Never include Firebase service-account private keys in the project archive. Do not uninstall the existing app to apply an OTA update.
