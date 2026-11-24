# FinanceTracker scanner, forms and advert carousel update

This update retains the password visibility icons, collapsible workspace/developer forms, and horizontal advert carousel introduced in the preceding update.

## Scanner correction superseding the earlier Google Code Scanner implementation

The first implementation used Expo Camera's Android `launchScanner()` native Google Code Scanner. On the user's Android device, Expo reported that the Google barcode scanner was unavailable, despite the inventory scanner working normally.

The current follow-up removes that dependency from Sales and reuses `BarcodeScannerComponent`, the same camera preview component already used by Products & Inventory. It passes the scanned barcode into Sales' existing product lookup and automatic cart-add flow. See `FINANCETRACKER_SALES_SCANNER_FOLLOWUP.md`.

## Other retained changes

- Login and signup password visibility controls use React Native Paper `TextInput.Icon` with the correct `icon` prop.
- Invoice, terms and advert editing forms remain collapsible as implemented in the previous update.
- Home advert carousel uses horizontal snap scrolling and periodic auto-advance.

## Validation

The follow-up self-check verifies that Sales imports and renders the shared scanner component and does not invoke the Google native scanner API. It also verifies that the removed Build sale instructional paragraphs do not reappear.

Physical Android scanner testing is still required. This source reuses the component the user reports already works in Inventory, but this environment cannot test the user's phone camera.
