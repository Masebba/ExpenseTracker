# Advert, palette and compact UI update

- Brand green: primary `#32A060`, header `#2B965B`.
- Home adverts now move through a smooth, clipped horizontal slide transition.
- Advert URL normalization uses Google Drive thumbnail URLs and Dropbox direct-download links where possible.
- The home summary no longer displays the `AUTO SLIDE` label.
- Login and sign-up explanatory paragraphs were removed; compact header menu item text and icon dimensions were reduced.

Validation: `node scripts/self-check.js` passed (158 assertions). This is source-level validation only; remote image hosts and device rendering have not been tested on a physical Android device.
