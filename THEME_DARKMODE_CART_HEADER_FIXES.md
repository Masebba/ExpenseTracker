# FinanceTracker theme, scan-to-cart and layout update

## Included changes

- Dark-mode rendering now uses a single stable React Native Paper and React Navigation theme schema. The app waits for the saved appearance preference before mounting the main navigation tree. A theme-render error boundary safely restores light mode instead of leaving the application unusable, while logging the original error for diagnosis.
- The light green palette is brighter and more saturated without switching to a neon or washed-out green.
- A successful barcode scan adds the matching inventory item directly to the active sale cart using its inventory selling price and quantity one. Repeated scans aggregate compatible cart lines. Stock limits are checked, and scanned cart items can be removed before completing checkout. Manual product selection still supports custom unit price, quantity and discount through the manual add action.
- The Budget bottom tab applies the top safe-area inset and uses a stable page heading placement.
- Sales History chart columns are narrower, with reduced spacing.
- Reports, Transactions, Settings, Help Centre and Workspaces green title bars use a consistent 56-point content height. Home retains a larger 82-point header and removes the extra unused header height.
- Filter controls displayed on a green header use white high-contrast text and a subtle translucent surface.

## Validation

Run `npm run check:self` and `npm run check:expo`. The app still uses the existing package identifier, EAS project, production update channel and runtime version. No new native package was introduced.

## OTA notes

These are JavaScript and style changes, so an OTA update is expected to work for a currently installed binary that already uses runtime `1.0.4`, the same EAS project, and the `production` channel. A new binary is required only if the installed binary is not compatible with that runtime/channel or if a native configuration difference is introduced later. Test dark-mode switching on a physical device before relying on it.
