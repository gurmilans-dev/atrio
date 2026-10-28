# Chrome Web Store submission

What to upload and what to fill in the Developer Dashboard for Atrio 3.2.0. Texts in quotes are ready to paste. Items
marked **Decide** or **Check** cannot be settled from the code and are the maintainer's call.

## Package

- Version `3.2.0` (`manifest.json`). It must be higher than any version already uploaded to the item: **Check** the
  Dashboard's package history.
- The ZIP holds the runtime files only, with `manifest.json` at its root:

  ```powershell
  Compress-Archive -Force -DestinationPath atrio-3.2.0.zip -Path manifest.json, index.html, style.css, background.js, js, assets, _locales, LICENSE
  ```

  Not included: `docs/`, `tests/`, `scripts/`, `.github/`, `README.md`, `CHANGELOG.md`, `PRIVACY.md`, `package.json`,
  `eslint.config.js`. `*.zip` is ignored by git.

- `manifest.json` has no `key` field, and is uploaded that way: the Store assigns the item's ID. If `npm run apply-key`
  was used for local development, upload a manifest without the `key`.
- Before zipping: `npm run check`, `npm run test:e2e` and `npm run test:extension` all pass.

## Store listing

- **Name:** Atrio (from the manifest).
- **Summary:** the localized `appDescription` in `_locales/` (English 129, Italian 131 characters; limit 132).
- **Category:** Developer Tools.
- **Languages:** English (default) and Italian.
- **Icon:** `assets/icons/icon-128.png`.
- **Screenshots:** `docs/store/*.jpg`, 1280 × 800 JPEG, demo data only (`npm run screenshots -- --store`). `apps.jpg`
  shows the Google apps launcher with drawings close to Google product icons: **Decide** after the trademark check
  below; until then, upload the others.
- **Detailed description** (English):

  > Atrio replaces the new tab page with a calm workspace for developers.
  >
  > - Search with your browser's search engine, or open URLs, `localhost` ports and site prefixes (`gh`, `npm`, `mdn`
  >   and your own) straight from the search box.
  > - Developer tools in the search box, all local: JSON, JWT (decoded, not verified), Base64, URL encoding, UUIDs,
  >   SHA-256, timestamps, cron, HTTP status codes and a calculator.
  > - A command palette, quick links with keyboard shortcuts, a focus timer with an activity heatmap, tasks and notes.
  > - Themes, your own wallpapers, custom CSS, English and Italian.
  >
  > Your data stays in your browser: Atrio has no server, no analytics and no ads. Online search suggestions are off by
  > default; if you turn them on, what you type is sent to Google or DuckDuckGo, as your browser's address bar does.
  >
  > Atrio is not affiliated with Google.

- **Detailed description** (Italian):

  > Atrio sostituisce la nuova scheda con uno spazio di lavoro tranquillo per sviluppatori.
  >
  > - Cerca con il motore di ricerca del browser, oppure apri URL, porte `localhost` e prefissi di siti (`gh`, `npm`,
  >   `mdn` e i tuoi) direttamente dalla casella di ricerca.
  > - Strumenti per sviluppatori nella ricerca, tutti in locale: JSON, JWT (decodificato, non verificato), Base64,
  >   codifica URL, UUID, SHA-256, timestamp, cron, codici di stato HTTP e calcolatrice.
  > - Palette dei comandi, collegamenti rapidi con scorciatoie, timer focus con heatmap delle attività, attività e note.
  > - Temi, sfondi personali, CSS personale, italiano e inglese.
  >
  > I tuoi dati restano nel browser: Atrio non ha server, statistiche d'uso o pubblicità. I suggerimenti di ricerca
  > online sono spenti in partenza; se li attivi, quello che scrivi viene inviato a Google o DuckDuckGo, come fa la
  > barra degli indirizzi.
  >
  > Atrio non è affiliato a Google.

## Privacy practices

- **Single purpose:**

  > "Atrio replaces the new tab page with a workspace for developers: web search through the browser's default search
  > provider, quick links, developer tools in the search box, a focus timer, tasks and notes."

- **Permission justifications:**

  | Permission                                                                       | Justification                                                                                                                                                                                            |
  | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `search`                                                                         | "A web search typed in the new tab runs with the user's default search provider, through chrome.search.query."                                                                                           |
  | `alarms`                                                                         | "Schedules the end of a focus timer session, so the user is notified even when no new tab is open."                                                                                                      |
  | `notifications`                                                                  | "Tells the user that a focus session or a break has ended."                                                                                                                                              |
  | `favicon`                                                                        | "Shows the icons of the user's quick links from Chrome's local favicon cache, without network requests."                                                                                                 |
  | Optional hosts `https://suggestqueries.google.com/*`, `https://duckduckgo.com/*` | "Requested only when the user turns on online search suggestions in Settings, to fetch suggestions from the engine they chose, Google or DuckDuckGo. The permission is removed when they turn them off." |

- **Remote code:** "No, I am not using remote code." Every script is in the package; the CSP is `script-src 'self'`.
- **Data usage. Decide**, reading the definitions shown in the Dashboard. The facts:
  - The developer receives no user data: no server, no analytics, no telemetry.
  - Everything else stays in the browser (`localStorage`, IndexedDB), as listed in `PRIVACY.md`.
  - Only with online suggestions turned on (off by default, behind an optional permission), the text typed in the
    search box is sent from the browser to Google or DuckDuckGo, as it is typed.

  If that transmission counts as collection under the Dashboard's definitions, the closest category is **User
  activity**, which covers keystrokes. Declaring it is the conservative choice. The three certifications hold either
  way: no selling or transfer outside the approved uses, no use unrelated to the single purpose, no use for
  creditworthiness or lending.

- **Privacy policy URL:** `https://github.com/gurmilans-dev/atrio/blob/main/PRIVACY.md`. **Check** that it opens
  while signed out, once pushed.

## Assets and trademarks

- **Wallpapers** (`assets/city.webp`, `assets/workstation.webp`): the author's own images, as stated by the
  maintainer. **Check:** keep the source files, and how they were made, as a record.
- **Google apps launcher** (`js/google-apps.js`): simplified drawings in each product's colors, made for this project.
  The README and the description say that Atrio is not affiliated with Google. **Decide** after reviewing
  [Google's brand guidance](https://about.google/brand-resource-center/guidance/) and the Store's
  [impersonation and intellectual property policy](https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property).
  If the use is unclear, the minimal fallback is generic glyphs or monograms with the text names. Atrio's own name and
  logo do not resemble Google's.

## Account

- **Check:** 2-Step Verification is on for the developer account, as required to publish.
