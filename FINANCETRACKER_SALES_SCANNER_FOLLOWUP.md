# FinanceTracker Sales Barcode Scanner Rebuild

Prepared: 22 November 2026  
Base: `FinanceTracker-sales-scanner-menu-ad-text-fix.zip`  
App/runtime version retained: `1.0.4`

## Scope

This update replaces only the barcode-scanning subsystem used by `Trade > Sales > Build sale`. The scanner used by `Products & Inventory > Add product` remains in `BarcodeScannerComponent.js` and `ProductsScreen.js`, unchanged.

## Sales scanner architecture

- Sales now uses a dedicated `SalesBarcodeScanner` component built on the already-installed `expo-camera` `CameraView` API.
- The camera opens in its own full-screen React Native native modal, not as a second React Native Paper modal nested in the sale form's `Portal`.
- The Build sale Paper modal is hidden while scanning and restored when scanning is cancelled or completed. Its field values, currency, and existing cart remain in the Sales screen state.
- The new scanner owns its permission request, camera-ready state, mount-error state, retry action, barcode formats, duplicate-scan guard, and cancel/close controls.
- On a successful scan, Sales first closes and unmounts the camera. Product lookup and cart updates happen only after the scan screen has closed.
- A matching inventory product follows the existing stock check, selling-price validation, currency conversion, and multi-item cart flow. A non-matching barcode is returned to the barcode input and the user receives an actionable message.
- The shared Inventory scanner and the Products screen have not been edited.

## Native dependencies and app identity

No new package was introduced. The implementation uses the `expo-camera` version already declared by the project. The existing app version, runtime version, Android package identifier, EAS project ID, and production channel settings are retained. This is a source update, not a published EAS Update or an Android build.

## Source validation

The project self-check now includes regression assertions for the independent Sales scanner, full-screen native modal, hidden/restored sale form, deferred product lookup, duplicate-scan protection, and continued use of the original Inventory scanner. Run:

```powershell
npm run check:self
```

A JavaScript/JSX syntax and import-resolution check should also be run from the extracted project before building.

## Required Android device test

Source checks cannot verify native camera preview rendering on the user's device. Before treating this as fixed, test on the same Android phone:

1. Open `Trade > Products`, choose `Add product`, and confirm the existing Inventory scanner still opens and scans as before. Do not save a duplicate test product.
2. Open `Trade > Sales > Process sale` and tap the barcode icon.
3. Confirm the Sales scanner opens with a live camera image, not a white/blank preview.
4. Scan a barcode belonging to an existing Inventory product.
5. Confirm the camera closes, the Build sale form returns, and the scanned product appears in the current sale cart exactly once.
6. Scan a product with zero stock and confirm the stock validation message appears without freezing the app.
7. Scan an unknown barcode and confirm the barcode is placed in the input with a product-not-found message.
8. Cancel scanning and reopen it. Confirm the camera starts again, then use Android Back to close it.
9. Complete a test sale only if appropriate, then verify the sale and inventory stock update through the normal workflow.

If the scanner still shows a white preview or freezes after this update, capture the Android device model, Android version, installed app version, and the exact point of failure. Do not repeatedly publish the same OTA update as a substitute for a device test.

## Deployment caution

A new JavaScript update may be delivered over the existing EAS Update channel only when the installed app's EAS project, channel, runtime version, and Expo Updates configuration match this source. A native rebuild is not implied by this patch because no new native dependency or configuration was added. If the installed build does not include a compatible `expo-camera` native module, a new development/production build may still be required.
