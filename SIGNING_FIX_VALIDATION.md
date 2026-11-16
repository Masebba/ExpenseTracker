# FinanceTracker EAS release-signing fix: validation

## Failure reproduced from the supplied log

Gradle failed while evaluating `android/app/build.gradle` with:

`Release signing credentials are missing. Configure all four MYAPP_UPLOAD_* properties before building a release.`

The previous release-signing block threw when the four custom properties were absent. That conflicts with EAS Build's managed Android signing flow, which injects signing configuration separately.

## Changes made

- Removed the fatal missing-properties branch from `android/app/build.gradle`.
- Kept support for all four `MYAPP_UPLOAD_*` properties for local/manual Gradle signing.
- Kept a clear failure if only some of those manual properties are set.
- Kept release builds assigned to `signingConfigs.release`; no debug-key fallback was added.
- Updated `scripts/self-check.js` to guard against reintroducing the EAS-incompatible missing-properties exception.
- Added `ANDROID_RELEASE_SIGNING_FIX.md` with next steps and credential safety notes.

## Checks run

- `node scripts/self-check.js`: passed, 128 assertions.
- Parsed `app.json`, `eas.json`, and `package.json` as JSON: passed.
- Checked that the release Gradle block no longer throws just because the optional `MYAPP_UPLOAD_*` values are absent: passed.
- ZIP archive integrity: passed.

## Not run

A remote EAS/Gradle release build was not run here. The fix addresses the exact configuration exception in the supplied log, but successful signing still depends on the EAS project having the correct Android app-signing credentials. A production build must be retried to verify end-to-end behavior.

## Important when applying this fix

Use the modified source in the same folder/branch that EAS actually builds. The ZIP deliberately does not contain private `.env` files or your locally downloaded `android/app/google-services.json`; preserve those files separately and do not overwrite them with an empty or stale copy.
