# Changelog

## Unreleased

### Added

- **English interface** alongside Italian. It follows the browser language, or can be set in Settings → General.
  Dates, numbers, Google app names and the end-of-session notification follow the chosen language. Palette commands
  and apps can be found by typing in either language.
- **Personal search prefixes** (Settings → Search prefixes): an address with `%s` where the text goes, so
  `jira 123` opens your Jira ticket and `pr 42` a pull request of your repo. Typed alone, the prefix opens the site,
  like the built-in ones. Names already used by Atrio (`gh`, `yt`, `uuid`…) are refused.
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
  (`url` / `urld`), JWT decoding (`jwt <token>` or a pasted token: payload, header, expiry), SHA-256 (`sha256`), JSON check and formatting (`json` or pasted JSON: formatted, minified, or where it breaks), naming styles (`case`: camelCase,
  PascalCase, snake_case, kebab-case, CONSTANT_CASE, URL slug), HTTP status codes explained (`http 429`,
  `http 40`, `http too many`),
  color conversion (`#hex`, `rgb()`, `hsl()`). Hovering a result shows it in full when it is too long for the row.

### Changed

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

- Typing `constructor` in the search box broke the suggestions: the prefix lookup reached `Object.prototype`.
- A saved state without theme or wallpaper made the page request `assets/undefined.webp` before the first paint.
- A JWT whose `exp` or `iat` no date can hold (such as `1e20`) broke the suggestions, and `Enter` could then run a
  stale row. Those dates are now skipped, and a failing tool can no longer break the search box.
- Importing a backup or resetting the settings changed the saved language without reloading the page, which stayed
  in the old one until the next new tab.
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
