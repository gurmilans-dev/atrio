# Chrome Web Store audit: fixes and release status

Status of the fifteen findings of the Chrome Web Store audit (ATR-01 to ATR-15) after the fixes for Atrio 3.2.0, as of
28 October 2026. What to fill in the Dashboard is in [CHROME_WEB_STORE_LISTING.md](CHROME_WEB_STORE_LISTING.md).

## Verdict

**Conditional go.** Every finding that the code can fix is fixed and covered by a test; the P0 and P1 bugs were
reproduced before the fix and no longer occur after it. Publishing still depends on checks outside the repository:
the privacy policy URL being live, the Dashboard forms, the trademark review of the Google apps launcher and the
developer account. See [Manual checks](#manual-checks).

## Findings

| ID     | Problem                                                      | Fix                                                                                                                                               | Tests                                                                                | Status       | Commit    |
| ------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------ | --------- |
| ATR-01 | Web searches went to Google, ignoring the browser's provider | Default engine "Chrome" through `chrome.search.query` (`search` permission); Google, DuckDuckGo, GitHub as explicit choices; old saves migrated   | Unit (search, state), e2e, extension: Google in Chrome, Bing in Edge                 | Fixed        | `3ffe5e9` |
| ATR-02 | Two tabs saving at once lost a change                        | Store commits under a Web Lock, on top of the latest saved state; failed changes kept and retried                                                 | `tests/store.test.js`, e2e with two documents in one task                            | Fixed        | `1c56439` |
| ATR-03 | A restore that could not be saved deleted the wallpapers     | Backup images staged under new ids, state replaced all at once, old images removed only after; same rule for reset                                | e2e with storage really full, e2e reset with a write error                           | Fixed        | `3768b29` |
| ATR-04 | A JWT or other tool input could be searched by accident      | `Enter` on a tool's input brings its rows back; only `Shift + Enter` searches, never remembered                                                   | e2e (Esc, →, blur), extension (real navigation)                                      | Fixed        | `18947b3` |
| ATR-05 | `:scope { display: none }` made the settings unreachable     | Scope root `.customizable` without the settings; gear last, top z-index; global at-rules (`@property`, `@font-face`…) refused; same check at boot | e2e (`:scope`, overlays, `@property`, boot), `tests/boot.test.js`                    | Fixed        | `385bea8` |
| ATR-06 | Notes said "saved" when storage was full                     | Status follows the store's result: "not saved" with Retry, draft kept, "saved" once a save goes through                                           | e2e with storage really full (Retry, save along another change)                      | Fixed        | `49620fa` |
| ATR-07 | No privacy policy                                            | `PRIVACY.md`, English and Italian, linked from the README                                                                                         | Review                                                                               | Manual check | `8149b8f` |
| ATR-08 | "Everything stays local" in the descriptions                 | Descriptions and Settings → Data note qualified (129 and 131 characters)                                                                          | Unit: descriptions within 132 characters                                             | Fixed        | `8149b8f` |
| ATR-09 | A paused or muted timer could keep its alarm                 | Alarm syncs serialized under a Web Lock, each applying the latest timer                                                                           | `tests/platform.test.js`, extension (real `chrome.alarms`)                           | Fixed        | `0028a43` |
| ATR-10 | Custom CSS could load images from any server                 | CSP: `img-src 'self' data: blob:`, `font-src 'self'`, `media-src 'none'`, `connect-src` limited to the two suggestion services                    | Extension: loopback server gets no request; favicons, `blob:` wallpaper, accent load | Fixed        | `cd730f1` |
| ATR-11 | Tests never ran in the real extension                        | `npm run test:extension`: unpacked extension in headless Chrome or Edge via `Extensions.loadUnpacked`                                             | 6 checks, Chrome and Edge                                                            | Mitigated    | `dc83096` |
| ATR-12 | `ts 1970-01-01T00:00:00Z` was not a date                     | Only `NaN` means "not a date"                                                                                                                     | Unit                                                                                 | Fixed        | `c6b6ff0` |
| ATR-13 | No screenshots at the Store's size                           | `npm run screenshots -- --store`: 1280 × 800 JPEG, now in `docs/store/3.2.0/`                                                                     | Size and alpha checked; images reviewed                                              | Fixed        | `b14ca94` |
| ATR-14 | Provenance of the wallpapers and Google icons not documented | README: the wallpapers are the author's own images; launcher icons left to a trademark review                                                     | None                                                                                 | Manual check | `405ebf1` |
| ATR-15 | Changes under "Unreleased" with version 3.1.0                | Version 3.2.0 in `manifest.json` and `package.json`, changelog dated                                                                              | `npm run check`                                                                      | Fixed        | `f246db7` |

### Not fully closed

- **ATR-07:** the policy exists in the repository; its URL is live only once the branch is pushed, and the Dashboard
  field has to point to it.
- **ATR-11:** CI still runs unit tests, lint and formatting only. The browser suites were not added to the workflow,
  because they could not be run on a GitHub Actions runner from here; they are run locally.
- **ATR-14:** whether the launcher's drawings may be used is a trademark question for the maintainer. Until it is
  settled, `docs/store/3.2.0/apps.jpg` is better left out of the listing.
- **ATR-15:** 3.2.0 is higher than 3.1.0; the Dashboard's package history was not seen.

## Tests run

On Windows 11, Chrome 155 and Edge 155, at the commit before this document:

| Command                                          | Result                                  |
| ------------------------------------------------ | --------------------------------------- |
| `npm test`                                       | 167 passed                              |
| `npm run lint`                                   | No problems                             |
| `npm run format:check`                           | All files formatted                     |
| `npm run test:e2e` (Chrome)                      | 48 of 48 passed                         |
| `npm run test:extension` (Chrome)                | 6 of 6 passed                           |
| `npm run test:extension` (Edge)                  | 6 of 6 passed                           |
| `npm run test:extension` on the unzipped package | 6 of 6 passed (49 files, 659,122 bytes) |

Before and after each fix, the audit's scenario was also run against the previous commit:

| Finding | Before                                             | After                                        |
| ------- | -------------------------------------------------- | -------------------------------------------- |
| ATR-02  | One of two concurrent tasks lost                   | Both kept                                    |
| ATR-03  | The current wallpaper deleted, backup not imported | Wallpaper and data unchanged, message shown  |
| ATR-05  | `body` hidden, settings 0 × 0, also after a reload | `body` shown, settings 420 × 900             |
| ATR-06  | "saved" shown, 8 characters in storage             | "not saved" with Retry, draft of 10,000 kept |
| ATR-09  | Stale alarm in 3 runs of 3 (real extension)        | No alarm                                     |
| ATR-10  | 5 requests reached the server                      | None                                         |

Not run: the browser suites on Linux or macOS and in CI; Chrome's permission prompt for online suggestions (accept
and deny); a real upload to the Store; a screen reader review.

## Manual checks

1. Push, then open `https://github.com/gurmilans-dev/atrio/blob/main/PRIVACY.md` signed out.
2. In the Dashboard, check that no version higher than 3.2.0 was uploaded; build the ZIP as described in the listing
   document and upload it.
3. Fill the listing and the privacy practices from [CHROME_WEB_STORE_LISTING.md](CHROME_WEB_STORE_LISTING.md),
   choosing the data usage category with the Dashboard's definitions in front of you.
4. Decide on the Google apps launcher icons after the trademark review, and whether `apps.jpg` goes in the listing.
5. Keep a record of how the two wallpapers were made.
6. Turn on 2-Step Verification on the developer account.
7. In a normal Chrome profile: turn online suggestions on (accept, then deny, the permission prompt), turn them off
   and check that the permission is gone; let a short focus session end and see the system notification; search with
   a default engine other than Google.
