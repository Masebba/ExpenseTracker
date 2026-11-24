# FinanceTracker ad, scanner and compact UI update

## Changes

- Home and Developer Studio now use the same advert image component and resize behavior.
- Advert records are normalized when loaded from Firestore. Legacy records without `publisherType` are treated as developer adverts because the `advertisements` collection is reserved for this feature. Explicit non-developer publisher types, inactive adverts and adverts outside their schedule remain excluded.
- Cloudinary HTTPS image URLs are preserved rather than rewritten. The supplied sample Cloudinary URL was checked and returned an image.
- The scanner uses one shared `CameraView` implementation. Products does not mount its scanner while its modal is hidden or its screen is blurred. Trade only mounts the scanner while Trade is focused. Camera mount errors are shown in the scanner with a retry action.
- Removed unnecessary explanatory paragraphs from Build sale, Reports and Developer Studio. Actual advert details, field labels, input validation and important exchange-rate warnings remain.
- Added self-checks for the advert data handling, scanner focus guards, compact copy and OTA metadata.

## OTA configuration review

- `app.json` runtime version is `1.0.4`.
- Native Android `expo_runtime_version` is also `1.0.4`.
- Native Android Expo Updates metadata is enabled and points to the same EAS project URL in `app.json`.
- The `production-apk` EAS build profile extends `production` and uses the `production` channel.

These settings support over-the-air delivery of JavaScript-only changes to a compatible installed production APK. They do not guarantee that a previous EAS asset-processing timeout has been resolved. Native dependency or native configuration changes still require a new APK.

## Validation performed

- `node scripts/self-check.js`: passed, 169 assertions.
- TypeScript parser syntax pass: 62 JavaScript/JSX files parsed without syntax diagnostics.
- Relative import scan: all 61 application JavaScript files resolve local imports.
- Advert helper runtime checks: the supplied Cloudinary URL is preserved; legacy records, active flags, publisher type and schedule boundaries behave as expected.

No Android device, emulator, EAS OTA upload or production APK build was run for this source update. Scanner behavior and image layout still need confirmation on the installed Android device.
