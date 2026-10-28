# Chrome Web Store submission

What to upload and what to fill in the Developer Dashboard for Atrio 3.3.0. Texts in quotes are ready to paste. Items
marked **Decide** or **Check** cannot be settled from the code and are the maintainer's call; the
[checklist](#dashboard-checklist) at the end lists them in order.

## Package

- Version `3.3.0` (`manifest.json`, `package.json`). It must be higher than any version already uploaded to the item:
  **Check** the Dashboard's package history (3.2.0 may or may not have been uploaded; this repository cannot tell).
- Build it with `npm run package`. It writes `atrio-3.3.0.zip` at the root of the repository (`*.zip` is ignored by
  git), then reads it back, extracts it to a new temporary folder and checks it:
  - only the runtime files: `manifest.json`, `index.html`, `style.css`, `background.js`, `LICENSE`, `js/`, `assets/`
    (the six wallpapers and the icons) and `_locales/`, with `manifest.json` at the root of the ZIP;
  - not included: `docs/`, `tests/`, `scripts/`, `.github/`, `node_modules/`, `README.md`, `CHANGELOG.md`,
    `PRIVACY.md`, `package.json`, `eslint.config.js`, the wallpapers' PNG originals, keys and backups;
  - the manifest has no `key` (the script drops one added by `npm run apply-key`): the Store assigns the item's ID;
  - every file the manifest and the page name is there, the version matches `package.json`, and nothing else but
    scripts, styles, images and locales is in it.

  The same files always give the same ZIP: the SHA-256 the script prints identifies the package.

- Then run the smoke checks on the extracted copy: `npm run test:extension -- "<folder printed by the script>"`
  (`CHROME_PATH` picks Edge or another Chrome). Before packaging: `npm run check`, `npm run test:e2e` and
  `npm run test:extension` all pass.

## Store listing

- **Name:** Atrio (from the manifest).
- **Summary:** the localized `appDescription` in `_locales/` (limit 132 characters):
  - English (129): "A keyboard-first new tab for developers: smart search, quick links, focus timer and tasks. Local data, opt-in
    online suggestions."
  - Italian (131): "Nuova scheda per developer: ricerca intelligente, collegamenti, timer focus e attività. Dati locali,
    suggerimenti online opzionali."
- **Category:** Developer Tools.
- **Languages:** English (default) and Italian.
- **Store icon:** `assets/icons/icon-128.png` (also in the package).
- **Screenshots** (at least one, at most five; 1280 × 800): `docs/store/3.3.0/`, in this order:
  1. `1-developer-classic.jpg`: the Developer mode, Classic style: search, links, focus timer and heatmap, tasks.
  2. `2-developer-glass-tools.jpg`: the Glass style, a demo JWT decoded in the search box.
  3. `3-minimal-classic.jpg`: the Minimal mode.
  4. `4-minimal-glass.jpg`: Minimal in the Glass style, Mocha theme, Sunrise Lake wallpaper.
  5. `5-appearance.jpg`: the settings: visual styles, themes, the six built-in wallpapers.

  They come from the page itself with demo data (`npm run screenshots -- --store`): a made-up token, sample tasks,
  the default links, shown as initials because site icons need the installed extension. The Google apps launcher is
  turned off in them, through its own setting, so they show Atrio's own features. The 3.2.0 set, kept in
  `docs/store/3.2.0/`, is not for upload.

- **Small promo tile** (440 × 280, optional): `docs/store/3.3.0/promo-440x280.png`, a 24-bit PNG without alpha, made
  from Atrio's own icon, name and colors (`scripts/promo-tile.html`). Without one, the Store shows the item without its
  tile; there is no marquee image (1400 × 560, also optional).
- **Detailed description** (English):

  > Atrio replaces the new tab page with a calm, keyboard-first workspace for developers.
  >
  > TWO MODES, TWO STYLES
  >
  > - Developer: the full workspace, with search, quick links, a focus timer and its heatmap, tasks and notes.
  > - Minimal: a large clock, the search box and your links as icons. Tasks, notes and the timer stay one key away.
  > - Classic or Glass: Glass turns the panels, cards and menus into translucent surfaces over the blurred wallpaper.
  >
  > SEARCH AND DEVELOPER TOOLS
  >
  > - Searches go to the search engine set in Chrome; Google, DuckDuckGo or GitHub can be picked instead.
  > - Open addresses, localhost ports, local network addresses and chrome:// pages from the search box. Site prefixes
  >   (gh, npm, mdn, yt and more) search a site directly, and you can add your own.
  > - Developer tools in the search box, all local: JSON check and formatting, JWT decoding (the signature is not
  >   verified), Base64 and URL encoding, UUIDs, passwords, SHA-256, timestamps, cron expressions in words, HTTP status
  >   codes, naming styles, color conversion and a calculator.
  > - A command palette for your links and every command.
  >
  > FOCUS
  >
  > - Quick links, opened with the keys 1 to 9.
  > - A focus timer (25/5, 50/10 or your own durations) with a notification when a session ends, a 20-week activity
  >   heatmap and your streak.
  > - Tasks, and a plain-text notes pad.
  >
  > MAKE IT YOURS
  >
  > - Six themes, among them a light one, one that takes its color from your wallpaper and one in any color you pick.
  > - Six built-in wallpapers (Workstation, City, Deep Space, Warm Sand, Sunrise Lake, Liquid Glass) or up to eight of
  >   your own images, optionally a different one every day; dim and blur.
  > - Show or hide each part of the page, a 12- or 24-hour clock, your own CSS.
  > - English and Italian. Backups to a JSON file.
  >
  > PRIVACY
  >
  > Your data stays in your browser: Atrio has no server, no account, no analytics and no ads. Online search
  > suggestions are off by default; if you turn them on, what you type in the search box is sent to Google or
  > DuckDuckGo, whichever is your search engine, as your browser's address bar does. The searches you run and the links
  > you open go to the sites you chose.
  >
  > Atrio is not affiliated with Google.

- **Detailed description** (Italian):

  > Atrio sostituisce la nuova scheda con uno spazio di lavoro tranquillo per sviluppatori, pensato per la tastiera.
  >
  > DUE MODALITÀ, DUE STILI
  >
  > - Developer: lo spazio di lavoro completo, con ricerca, collegamenti rapidi, timer focus con la sua heatmap,
  >   attività e note.
  > - Minimal: un orologio grande, la casella di ricerca e i collegamenti come icone. Attività, note e timer restano a
  >   un tasto di distanza.
  > - Classic o Glass: Glass rende pannelli, schede e menu superfici traslucide sopra lo sfondo sfocato.
  >
  > RICERCA E STRUMENTI PER SVILUPPATORI
  >
  > - Le ricerche usano il motore di ricerca impostato in Chrome; in alternativa puoi scegliere Google, DuckDuckGo o
  >   GitHub.
  > - Apri indirizzi, porte localhost, indirizzi di rete locale e pagine chrome:// dalla casella di ricerca. I prefissi
  >   (gh, npm, mdn, yt e altri) cercano direttamente in un sito, e puoi aggiungerne di tuoi.
  > - Strumenti per sviluppatori nella ricerca, tutti in locale: verifica e formattazione JSON, decodifica JWT (la firma
  >   non viene verificata), codifica Base64 e URL, UUID, password, SHA-256, timestamp, espressioni cron spiegate,
  >   codici di stato HTTP, stili di nomenclatura, conversione dei colori e calcolatrice.
  > - Una palette dei comandi per i tuoi collegamenti e ogni comando.
  >
  > CONCENTRAZIONE
  >
  > - Collegamenti rapidi, aperti con i tasti da 1 a 9.
  > - Un timer focus (25/5, 50/10 o le tue durate) con una notifica a fine sessione, una heatmap delle attività di 20
  >   settimane e la tua serie di giorni.
  > - Attività, e un blocco note in testo semplice.
  >
  > PERSONALIZZAZIONE
  >
  > - Sei temi, tra cui uno chiaro, uno che prende il colore dallo sfondo e uno nel colore che scegli.
  > - Sei sfondi integrati (Postazione, Città, Spazio profondo, Sabbia calda, Lago all'alba, Vetro liquido) o fino a
  >   otto immagini tue, volendo una diversa ogni giorno; oscuramento e sfocatura.
  > - Mostra o nascondi ogni parte della pagina, orologio a 12 o 24 ore, CSS personale.
  > - Italiano e inglese. Backup in un file JSON.
  >
  > PRIVACY
  >
  > I tuoi dati restano nel browser: Atrio non ha server, account, statistiche d'uso o pubblicità. I suggerimenti di
  > ricerca online sono spenti in partenza; se li attivi, quello che scrivi nella casella di ricerca viene inviato a
  > Google o DuckDuckGo, a seconda del motore scelto, come fa la barra degli indirizzi. Le ricerche che fai e i
  > collegamenti che apri vanno ai siti che hai scelto.
  >
  > Atrio non è affiliato a Google.

  Plain text, as the Store shows it: the capitalized lines are headings. The Google apps launcher is left out of both
  texts, which describe Atrio's own features.

## Privacy practices

- **Single purpose:**

  > "Atrio replaces the new tab page with a workspace for developers: web search through the browser's default search
  > provider, quick links, developer tools in the search box, a focus timer, tasks and notes."

- **Permission justifications** (the four permissions of the manifest, and the two optional hosts):

  | Permission                                                                       | Justification                                                                                                                                                                                            |
  | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `search`                                                                         | "A web search typed in the new tab runs with the user's default search provider, through chrome.search.query."                                                                                           |
  | `alarms`                                                                         | "Schedules the end of a focus timer session, so the user is notified even when no new tab is open."                                                                                                      |
  | `notifications`                                                                  | "Tells the user that a focus session or a break has ended."                                                                                                                                              |
  | `favicon`                                                                        | "Shows the icons of the user's quick links from Chrome's local favicon cache, without network requests."                                                                                                 |
  | Optional hosts `https://suggestqueries.google.com/*`, `https://duckduckgo.com/*` | "Requested only when the user turns on online search suggestions in Settings, to fetch suggestions from the engine they chose, Google or DuckDuckGo. The permission is removed when they turn them off." |

- **Remote code:** "No, I am not using remote code." Every script is in the package; the CSP is `script-src 'self'`.
- **Data usage.** What the code does, as observed (`js/suggest.js` makes the page's only request to a server; the CSP
  allows no other):

  | Data                                                                                                                                       | What happens to it                                                                                                                                                                                        |
  | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Settings, the optional name for the greeting, links, prefixes, tasks, notes, custom CSS, timer statistics, recent searches, own wallpapers | Stored in the browser (`localStorage`, IndexedDB) on the device, as `PRIVACY.md` details. Never sent anywhere; the developer receives nothing.                                                            |
  | Text typed in the search box, with online suggestions on                                                                                   | Off by default, behind an optional host permission. When on, sent as it is typed to `suggestqueries.google.com` or `duckduckgo.com` (the engine chosen), without cookies or referrer, to get suggestions. |
  | A search run with Enter, a link opened                                                                                                     | A navigation the user starts: to Chrome's default provider (through `chrome.search.query`), or to the engine, prefix or link chosen. Atrio receives nothing.                                              |
  | Site icons of the links                                                                                                                    | Read from Chrome's local favicon cache (`favicon` permission); no request.                                                                                                                                |
  | Text given to the local tools (JWT, JSON, Base64…)                                                                                         | Processed in the page; not sent, and not kept among the recent searches.                                                                                                                                  |

  **Decide**, with the Dashboard's definitions in front of you:
  - whether the suggestions (typed text sent to Google or DuckDuckGo, when turned on) count as collection. If so, the
    closest category is **User activity** (it covers keystrokes); declaring it is the conservative choice;
  - the other categories (personally identifiable information, health, financial, authentication, personal
    communications, location, web history, website content) match nothing observed: the name stays on the device,
    and Atrio reads no history, cookies or page content.

  The three certifications hold either way: no selling or transfer outside the approved uses, no use unrelated to the
  single purpose, no use for creditworthiness or lending.

- **Privacy policy URL:** `https://github.com/gurmilans-dev/atrio/blob/main/PRIVACY.md` (answered 200 to a request
  without login on 28 October 2026). It describes 3.3.0 as it is: no change was needed for this version.

## Assets and trademarks

- **Wallpapers** (`assets/city.webp`, `assets/workstation.webp`): the author's own images, as stated by the
  maintainer. **Check:** keep the source files, and how they were made, as a record.
- **Wallpapers added in 3.3.0** (`assets/deep-space.webp`, `warm-sand.webp`, `sunrise-lake.webp`,
  `liquid-glass.webp`): generated with AI in ChatGPT for Atrio on 28 October 2026, and shipped as delivered, 1600 × 900
  WebP files. Their provenance note is kept as delivered in [IMAGE_PROVENANCE.txt](IMAGE_PROVENANCE.txt): generated
  for this request, not copied from a stock-photo source; no brands, logos or third-party characters intentionally
  included; use and rights governed by the applicable OpenAI terms and laws; provenance information, not a legal
  guarantee. The PNG exports of the same images carry signed C2PA Content Credentials (created with ChatGPT,
  `gpt-image`, digital source type `trainedAlgorithmicMedia`, claim signed by OpenAI); the WebP files carry no
  metadata. No license or clearance beyond that is claimed for them. **Check:** keep the PNG files, with their
  credentials, outside the repository as a record (they are not part of the package), and that the OpenAI terms allow
  this use.
- **Google apps launcher** (`js/google-apps.js`): since 3.3.0 each service is shown with a generic symbol of what it
  does (an envelope for Gmail, a folder for Drive, a grid for Sheets…), drawn in Atrio's accent color like the links'
  initials: none of Google's product icons, shapes or colors. The services keep their names, in text, and their
  addresses, to say where each tile leads. The README and the description say that Atrio is not affiliated with
  Google; the screenshots and the promo tile do not show the launcher. **Check**, if in doubt, against
  [Google's brand guidance](https://about.google/brand-resource-center/guidance/) and the Store's
  [impersonation and intellectual property policy](https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property).
  Atrio's own name and logo do not resemble Google's.

## Account

- **Check:** the developer account is registered, and 2-Step Verification is on, as required to publish.

## Dashboard checklist

1. Open the item (or create it) and check the package history: no version 3.3.0 or higher already uploaded.
2. Upload `atrio-3.3.0.zip`, built by `npm run package`; compare its SHA-256 with the one the script printed.
3. Store listing: summary (from the package), detailed description in English and Italian (above), category
   Developer Tools, languages, store icon, the five screenshots in order, the promo tile.
4. Privacy practices: single purpose, the four permission justifications and the optional hosts, remote code "No",
   data usage (**Decide**: User activity for the suggestions), the three certifications, the privacy policy URL.
5. Distribution: visibility and regions, as you prefer.
6. Optionally, review the launcher's use of Google's product names (its icons are generic since 3.3.0).
7. Submit for review. When it is published, put the date next to 3.3.0 in `CHANGELOG.md`.
