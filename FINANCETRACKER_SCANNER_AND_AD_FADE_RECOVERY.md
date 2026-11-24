# FinanceTracker scanner and advert image regression fix

Prepared: 21 November 2026  
Base: the latest `FinanceTracker-scanner-ad-fade-recovery` source package  
App/runtime version retained: `1.0.4`

## Regression findings

The latest recovery package had drifted from the earlier compatibility implementation in two places:

1. **Sales scanner:** `screens/SalesScreen.js` had switched back to a separately mounted `CameraView` even though the earlier Sales compatibility package used `BarcodeScannerComponent`, the same camera/permission component used by Products & Inventory. The direct preview path replaced a known-good shared implementation and is the first source regression to remove.
2. **Advert image:** `screens/HomeDashboard.js` had dropped the previously used `components/AdvertImage.js` (`ImageBackground`) renderer and replaced it with a raw absolutely positioned `Image`. The shared image renderer is retained, and the carousel now uses the requested smooth horizontal slide transition.

These code differences are confirmed by comparing the supplied source packages. They are strong regression candidates, but a physical Android test is still required to confirm the device-specific symptom is gone.

## Scanner corrections

- Sales now imports and renders the same `BarcodeScannerComponent` used by Products & Inventory.
- The existing Sales lookup remains unchanged: the scanned barcode is matched against `ProductsContext`, then the matching product is added to the multi-item cart through the existing validation and stock checks.
- The existing `scanLockRef` guard remains in the Sales lookup flow.
- Sales closes the scanner when its tab loses focus.
- The shared scanner now prevents duplicate scan callbacks with a ref, shows a visible retry state when the native camera reports a mount error, and remounts the preview when the user retries.
- Removed the separate Sales-only `CameraView` and camera-permission hook. Permission prompting remains in the shared scanner component.
- Inventory's scanner continues to mount only while its scanner modal is open and the Products tab is focused.

## Advert corrections

- Reinstated `components/AdvertImage.js`, the `ImageBackground` renderer used in the earlier working advert carousel.
- Home uses that renderer for both the advert banner and its detail view.
- The banner now slides the next advert in beside the outgoing advert inside a clipped viewport, avoiding a blank/fade interval.
- The renderer retains all supported stored image field names: `imageUrl`, `imageURL`, `image_url`, and `image`.
- Image-load errors are still logged and use the existing fallback display. A previously failed image state is cleared after a successful load.
- The advert list is now guarded against a missing/non-array value before filtering.

## Source validation performed

| Check | Result |
|---|---|
| `node scripts/self-check.js` | Passed, 178 assertions |
| TypeScript parser over JS/JSX/TS source | Passed, 62 files, zero parser errors |
| Relative import scan | Passed, 62 files, zero unresolved relative imports |
| ZIP integrity | Checked after packaging |

## Not performed

- No physical Android camera test was possible in this environment.
- No test against the user's live advert image URL was possible because that URL was not supplied in the source package as a test fixture.
- No EAS Update was published and no Android binary was built.

## Deployment notes

This patch does not add or change native dependencies, the Android package ID, app version, runtime version, EAS project ID, channel, or signing configuration. It is intended for an OTA update only when the installed Android app was built for runtime `1.0.4`, the same EAS project, and the `production` channel, with Expo Updates enabled.

Before publishing, copy the existing project `.env` and `android/app/google-services.json` into the extracted project folder if required by the user's setup. Keep private service-account credentials outside the source archive.

Run these commands from the extracted project directory that contains `package.json`:

```powershell
npm ci
npm run check:self
npx eas-cli whoami
npx eas-cli update --channel production --environment production --platform android --message "FinanceTracker: restore shared scanner and smooth advert slide"
```

Do not uninstall the installed app. If the runtime, EAS project, channel, or native update client does not match, do not force an OTA update; build a compatible release using the existing package ID and signing key. Preserve app data before any installation change.
