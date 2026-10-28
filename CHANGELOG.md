# Changelog

## 3.2.0 — 2026-10-28

### Added

- **A privacy policy**, [PRIVACY.md](PRIVACY.md), in English and Italian: what Atrio stores and for how long, when
  anything leaves the device, and how to delete it.
- **English interface** alongside Italian. It follows the browser language, or can be set in Settings → General.
  Dates, numbers, Google app names and the end-of-session notification follow the chosen language. Palette commands
  and apps can be found by typing in either language.
- **Personal search prefixes** (Settings → Search prefixes): an address with `%s` where the text goes, so
  `jira 123` opens your Jira ticket and `pr 42` a pull request of your repo. Typed alone, the prefix opens the site,
  like the built-in ones. Names already used by Atrio (`gh`, `yt`, `uuid`…) are refused.
- **Custom timer durations** (Settings → Timer): next to 25/5 and 50/10, a preset with your own focus and break
  minutes (1–180 and 1–60). As with the others, a session already started keeps its length.
- **Clock options** (Settings → Page): 24- or 12-hour with AM/PM, seconds, and the date can be hidden. Seconds and
  AM/PM sit beside the big digits, smaller, so the layout keeps its shape; with seconds shown the clock updates once
  a second while the tab is visible (about 0.15% of a CPU core).
- **Custom CSS** (Settings → Custom CSS), applied before the first paint. The rules reach the wallpaper, the page and
  the Google apps, never the settings or the button that opens them, which always stay usable to fix them: even
  `:scope { display: none }` hides only the page. A stray `}` that would let rules escape, or an at-rule that is
  global anyway (`@property`, `@font-face`…), is caught and the CSS is not applied.
- **Several wallpapers of your own** (up to eight), each with its tile in Settings → Wallpaper, and an optional
  **rotation** through them: every day (the same image in every tab) or with every new tab (tabs already open keep
  theirs). The automatic theme keeps one extracted accent per image, so tabs showing different images never
  overwrite each other's. Backups carry all the images; the single image of earlier versions is picked up
  automatically.
- **Light theme**: dark text on frosted white panels, over a light veil strong enough for the night wallpapers too;
  the dim slider becomes a lighten slider. Native controls and scrollbars turn light as well.
- **Custom theme with any accent color** (Settings → Appearance), with a live preview while the picker moves. Hue and
  saturation are kept; a color too dark or too light for the dark theme is adjusted, by perceived luminance, just
  enough for text in it and dark text on it to stay readable. Applied before the first paint.
- **Show or hide each part of the page** (Settings → Page): greeting, clock, date, links, focus panel, its heatmap,
  tasks and notes. With both side panels off the page becomes a single centered column. Applied before the first
  paint; the shortcuts and commands of a hidden part do nothing.
- The settings are reorganized, from general to specific: General, Appearance, Wallpaper, Page, Search, Search
  prefixes, Links, Timer, Shortcuts, Data.
- **Recent searches** in the search box: those containing what you type appear under it, and the latest ones
  show on an empty box (none preselected, so `Enter` on an empty box still does nothing). `Shift + Delete` forgets
  the highlighted one. Kept only in this browser; Settings → General turns them off (which also clears them) or
  clears them.
- **Online search suggestions** as you type, from Google or DuckDuckGo (whichever is the engine), off by default.
  Turning them on in Settings → General asks Chrome for access to those two sites (an optional permission, so
  installing Atrio still shows no warning); turning them off gives it back. Requests wait for a pause in typing, carry
  no cookies and are cancelled by the next keystroke.
- A **×** in the search box clears it and keeps the cursor there; it shows only while there is text.
- **Developer tools in the search box**, local, `Enter` copies the result: calculator (`= …` or plain arithmetic,
  with hex/binary), timestamps both ways (`ts`), `uuid`, passwords (`pw`), Base64 (`b64` / `b64d`), URL encoding
  (`url` / `urld`), JWT decoding (`jwt <token>` or a pasted token: payload, header, expiry), SHA-256 (`sha256`),
  JSON check and formatting (`json` or pasted JSON: formatted, minified, or where it breaks), naming styles (`case`:
  camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, URL slug), HTTP status codes explained (`http 429`,
  `http 40`, `http too many`), cron expressions in words with the next runs (`cron`, or the expression alone),
  color conversion (`#hex`, `rgb()`, `hsl()`). Hovering a result shows it in full when it is too long for the row.

### Changed

- **Web searches use the search engine set in Chrome** by default, through Chrome's Search API (new `search`
  permission, no install warning), as the Chrome Web Store requires for a new tab page. Google, DuckDuckGo and
  GitHub stay available as explicit choices in Settings → Search; saves that used Google as the old implicit default
  switch to Chrome's engine. Prefixes (`yt`, `npm`, your own…) are unchanged. Online suggestions need Google or
  DuckDuckGo as the engine, since Atrio does not know which provider Chrome uses.
- Chrome 118 or later is required (was 117), for the `@scope` that keeps custom CSS away from the settings.
- The extension description and the note in Settings → Data no longer say that everything stays local: the data
  does, but online suggestions, when turned on, send what you type to Google or DuckDuckGo.
- **The page cannot contact other servers.** Its content security policy now allows images only from the extension
  itself (and local `data:`/`blob:` images), no web fonts or media, and connections only to the two suggestion
  services. Custom CSS, including CSS from an imported backup, can no longer make it load something from the web.

- A search prefix typed alone opens its site: `yt` → YouTube, `gh` → GitHub, `npm` → npmjs.com. Previously it was
  searched as text. `Shift + Enter` still searches.
- **Mouse effects are one optional switch**, off by default (Settings → General): spotlight borders, the lift of
  the hovered link and the wallpaper parallax. Existing setups start with it off.
- The search-engine menu moved from the search bar to **Settings → General**.
- The spotlight lights only the quick links and the search box, without the inner glow, and from a shorter distance.

### Performance

- With the mouse effects off no pointer listener is attached and hover states change instantly instead of animating:
  moving the mouse over the page went from ~14% to ~4% of a CPU core in headless Chrome, about the browser's own cost.
- When the effects are on they are lighter than before: the spotlight updates one small layer per element instead of
  restyling whole panels, element positions are cached, the parallax target is updated about ten times a second.
- The page uses ~0.03% of a core when still.

### Fixed

- **Two tabs saving at the same moment could lose a change.** Each tab saved its own copy of the whole state, so the
  last write erased the other's change. Changes are now applied at once in the tab, then saved under a lock shared
  by every tab, on top of the latest saved state. A change that cannot be saved stays in the tab and is retried.
- **A backup that could not be saved deleted the current wallpapers.** The restore removed the images before
  knowing whether the new state fit in storage, so with storage full the wallpapers were gone and the backup not
  imported. Now the backup's images are stored under new ids, the state is replaced all at once, and only then are
  the previous images removed; if anything fails, the new images go and everything stays as it was. A reset that
  cannot be saved likewise deletes nothing.
- **The notes said "saved" when storage was full.** Only a short-lived message reported the failure, and a reload
  lost the text. Now the notes say "saved" only once storage holds them; otherwise they show "not saved" with a
  **Retry** button until a save goes through (Retry, the next edit or any other change), and the text stays in the
  page meanwhile.
- **A paused timer could still notify.** Starting and pausing quickly (or turning notifications off right after a
  start) let the start's alarm be created after the pause had cleared the alarms. Alarm updates now run one at a
  time, in every tab, and each applies the latest state of the timer.
- **A local tool's input could be searched on the web by accident.** After `Esc` (or a click on →, or a click
  elsewhere) closed the rows of a JWT, JSON, Base64 or a sum, `Enter` sent the text to the search engine and kept it
  among the recent searches. Now `Enter` brings the rows back; only `Shift + Enter` searches such text, and it is
  never remembered.
- Typing `constructor` in the search box broke the suggestions: the prefix lookup reached `Object.prototype`.
- `ts 1970-01-01T00:00:00Z`, the epoch itself, was reported as not a date (it is timestamp 0).
- A saved state without theme or wallpaper made the page request `assets/undefined.webp` before the first paint.
- A JWT whose `exp` or `iat` no date can hold (such as `1e20`) broke the suggestions, and `Enter` could then run a
  stale row. Those dates are now skipped, and a failing tool can no longer break the search box.
- Importing a backup or resetting the settings changed the saved language without reloading the page, which stayed
  in the old one until the next new tab. Only a change of the language choice reloads the page: if the browser's own
  language changes while a tab is open (as Edge does a moment after starting with a new profile), the next new tab
  follows it, instead of a click reloading the current one.
- Italian dates had every word capitalized ("26 Ottobre"); only the first letter is now.

### Removed

- Migration from the versions before the first public release: the v1 save (`devstart.v1`, with its base64
  wallpaper) and the v2 session counter. Backups exported as "Workspace" still import.

## 3.1.0 — 2026-10-26

First public release, under the new name **Atrio** (previously "Workspace").

### Added

- **Google apps launcher** (grid button in the top-right corner, or `G`): 24 apps, editable favorites reordered by
  drag or keyboard, choice of Google account (1st–4th), apps searchable from the palette.
- **Command palette** in the search box: links, apps and commands while typing, `>` (or `Ctrl + Shift + P`) for
  commands only, `+ text` to add a task; `↑` `↓` `Enter` `Esc` to navigate.
- **Focus heatmap** in the style of GitHub's contribution graph (last 20 weeks) and **streak** of consecutive days.
- **"Dallo sfondo" theme**: the accent color is extracted from the current wallpaper, uploaded ones included.
- **Notes**: second tab of the tasks panel, saved while typing (`N`).
- **Greeting** based on the time of day, with an optional name.
- **Spotlight borders** following the cursor on links and panels; slight lift on hover.
- **Parallax** wallpaper, can be turned off.
- **Celebration** glow when a session ends.
- **Blur** slider for the wallpaper (0–24 px), applied before the first paint like the dim.
- New logo: a keycap with an "A" (keyboard-first), drawn as SVG and rendered to PNG by Chrome.
- End-to-end checks in headless Chrome (`npm run test:e2e`), reproducible screenshots (`npm run screenshots`), CI.

### Changed

- The top bar is gone: settings open from a small button in the bottom-right corner (or `S`).
- Backups are exported as `atrio-backup-*.json`; backups from "Workspace" still import.

### Code

- New pure modules `stats.js`, `color.js`, `fuzzy.js`, `google-apps.js`, covered by tests (58 unit tests).
- Every effect honors `prefers-reduced-motion`.

## 3.0.0 — 2026-10-25

### Fixed

- **Data loss with several new tabs open**: each tab rewrote the whole state with its stale copy. Tabs now sync
  through the `storage` event and `pageshow` (back/forward cache).
- **Code mistaken for URLs**: `console.log`, `next.js`, `os.path.join`, `README.md` opened non-existent domains. Only
  hosts with a real top-level domain, local hosts and IPs become URLs now.
- **IPs and dev hosts**: `192.168.x.x:8080`, `0.0.0.0:8000`, `[::1]:3000`, `*.test`, `*.localhost` open over `http://`
  instead of being searched.
- **Default wallpaper flashing** on every new tab when a custom or non-default wallpaper was selected.
- **Wallpaper upload unreachable by keyboard** (hidden input with a non-focusable label).
- **Incomplete themes**: some parts stayed blue with Mocha or Terminal; every color is now a theme token.
- **v1 save never deleted**, with a base64 image eating the `localStorage` quota.
- **One corrupted entry reset everything**: each item is validated on its own, and unreadable JSON is kept in
  `workspace.newtab.v2.corrupt` instead of being overwritten.
- **Tasks without an `id`** (old data): deleting one deleted them all.
- **Tasks beyond 200 silently dropped** on load; the limit now also applies when adding.
- **Changing the preset reset the running session.**
- **The timer skipped seconds**; ticks are now aligned to the displayed second.
- **Custom wallpaper unreachable** after choosing a bundled one.

### Added

- System notification when a session ends (`chrome.alarms` + service worker), can be turned off.
- When a session ends the timer readies the next phase (focus → break → focus).
- Remaining time in the tab title; today's session count (total in the tooltip).
- Search prefixes `g`, `ddg`, `gh`, `npm`, `mdn`, `so`, `py`, `ciu`, `dd`, `yt`, with a hint of the destination.
- `Shift + Enter` always searches; `chrome://` pages open from the search box.
- Shortcuts `1`–`9` (links), `T` (task), `P` (timer), `?` (shortcut list).
- Links: edit, reorder, custom monogram, URLs without `https://`, real site icons.
- Undo after removing links and tasks.
- JSON backup export / import, custom wallpaper included.
- "Personale" wallpaper tile and a button to remove the uploaded image.
- AVIF support; upload limit raised to 25 MB.
- Script to pin the extension ID (`npm run apply-key`).
- Extension icons and favicon.

### Performance

- Uploaded images are downscaled to the screen resolution and stored as WebP: less space and less memory on every new
  tab.
- Theme and wallpaper applied before the first paint; only the selected wallpaper is loaded.
- The progress bar uses `transform` instead of `width`: no layout every second.
- Links and tasks re-render only when they change.
- One IndexedDB connection reused instead of reopened for every operation.

### Accessibility

- Settings drawer as a native modal `<dialog>`: focus trap, inert background, `Esc`, focus restored.
- Focus stays on the right control after toggling, deleting and reordering.
- Clicking a task's text toggles it; `aria-pressed` on choices, `aria-keyshortcuts` on shortcuts.

### Code

- `app.js` split into ES modules with clear responsibilities; shared lists (themes, engines, presets, wallpapers) in
  one file.
- Unit tests with `node --test`, ESLint and Prettier through `npx`, no installed dependencies.
- Manifest: `minimum_chrome_version`, icons, explicit CSP (`object-src 'none'; base-uri 'none'`).
