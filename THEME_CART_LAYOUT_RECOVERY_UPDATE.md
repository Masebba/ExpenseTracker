# FinanceTracker: dark-mode recovery, cart and layout refinement

## Included changes

### Dark appearance stability and recovery
- Light and dark navigation/Paper themes retain one consistent role schema; the app waits for the saved appearance preference before mounting the main navigation tree.
- The in-app theme error boundary catches render failures while dark mode is active, logs the original error and switches back to light mode rather than leaving the user in the failed screen.
- The root startup boundary is now a last-resort recovery layer. If an error escapes the theme boundary while the saved preference is dark, it changes the persisted appearance to light for the next launch. The startup screen explains that recovery and displays a short diagnostic with common credential and URL patterns redacted.
- This is defensive recovery, not a claim that every dark-mode component has been physically tested. If a dark-specific error still occurs, it should now be recoverable and provide a diagnostic message for follow-up.

### Appearance and navigation layout
- The main green is now a more saturated emerald (`#268451`) and the title/header green is `#267F4D`. The header shade maintains readable white title/filter text. Surface tints and borders are slightly greener, not pale mint.
- Home no longer uses a React Navigation title header behind the custom profile/action header. The custom profile, quick scan, notifications and menu row is mounted once in a fixed safe-area header, with a 74-point content height.
- Budget in the bottom tab has a fixed 56-point green title bar outside the scroll view. Its title remains visible while the budget form and figures scroll beneath it.
- Filter buttons on a green title bar use white text and a subtle translucent surface; filters on light page backgrounds use the normal dark foreground text.
- Sales History Graph columns are narrowed to 30 points with 20 points of spacing.

### Sale cart workflow
- A successful barcode scan adds the matching inventory product to the active sale cart automatically at its listed inventory price and quantity one. It does not require tapping an Add button.
- The scanner closes after a successful read to avoid reading the same barcode repeatedly. The operator can reopen scanning for the next item; manual product search and selection remain available for products without barcodes.
- The manual Add item button is shown only after a product was selected or entered manually. This path remains available to adjust quantity, selling price and discount before adding.
- Cart lines can be removed before checkout; existing one-order, one-receipt multi-item checkout is preserved.

## Validation performed
- `npm run check:self`: 158 assertions passed.
- TypeScript parser/transpiler syntax pass: 61 JavaScript/JSX files, no parse errors.
- Static import resolution: all 255 relative imports resolved.
- Project configuration JSON (`package.json`, `app.json`, `eas.json`, `firebase.json`, `firestore.indexes.json`) parsed successfully.
- No local `.env`, `google-services.json` or service-account JSON was included in the distribution archive.
- No Android native files, dependencies, package identifier, EAS project ID, channel or runtime version were changed.

## OTA update compatibility
This is a JavaScript/UI change and introduces no native dependency. The app configuration remains version `1.0.4`, runtime version `1.0.4`, Android package `com.masebba.ExpenseTracker`, existing EAS project ID, and production update channel. An OTA update should apply to an installed production binary that already matches this runtime and channel.

Before publishing, copy the user's local `.env` and `android/app/google-services.json` from their secured working project into the extracted project folder. The service-account key remains an EAS credential and should not be placed in the source tree. Do not commit these secrets.

From the updated project folder:

```powershell
npm ci
npm run check:self
npx eas-cli update --channel production --environment production --message "FinanceTracker: dark-mode recovery, cart workflow and layout polish"
```

The update command publishes to the EAS project configured in `app.json`. Verify the signed-in EAS account and project before publishing. Force-close and reopen the installed app to download the update; on the next reopen it should apply. No uninstall is required for a compatible OTA update.

## Not verified in this environment
- No `node_modules` directory was present, and no fresh dependency installation or `expo config` command was run.
- No EAS cloud update or production build was published from this environment.
- No physical Android device was available to verify dark/light switching, screen safe areas, printer output, or camera hardware. The dark-mode fallback and startup diagnostic should be tested on the user's phone before relying on dark mode in production.
