<p align="center">
  <img src="assets/icons/icon-128.png" width="88" height="88" alt="" />
</p>

<h1 align="center">Atrio</h1>

<p align="center">
  A keyboard-first new tab for developers. Fast, local, zero dependencies.
</p>

<p align="center">
  <a href="https://github.com/gurmilans-dev/atrio/actions/workflows/ci.yml"><img src="https://github.com/gurmilans-dev/atrio/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-4285f4" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/dependencies-0-success" alt="Zero dependencies" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

![Atrio: clock, smart search, quick links, focus timer with heatmap, tasks](docs/home.webp)

Atrio replaces Chrome's new tab page with a calm place to start from: a search box that understands code and
dev URLs, a command palette, quick links, a focus timer with a GitHub-style activity heatmap, tasks and notes, and a
Google apps launcher. It is plain HTML, CSS and JavaScript modules: no framework, no build step, no tracking, and no
network requests unless you turn on online search suggestions.

> The interface is in English and Italian. It follows the browser language; you can also pick one in
> **Settings → General**.

## Features

- **Search that knows code from URLs.** Web searches go to the search engine set in Chrome (through Chrome's Search
  API), unless you pick Google, DuckDuckGo or GitHub in the settings. `console.log`, `next.js` or `README.md` are
  searched, not opened as domains.
  `localhost:5173`, LAN IPs, `[::1]` and `*.test` open over `http://`. Prefixes search a site directly (`yt lofi`,
  `npm zod`; also `gh`, `mdn`, `so`, `py`, `ciu`, `dd`) and, typed alone, open it (`yt` → YouTube). Add your own
  in Settings with `%s` where the text goes: `jira 123` → your Jira ticket, `pr 42` → a pull request of your repo.
  `chrome://` pages work, `Shift + Enter` always searches.
- **Recent searches** come back as you type, and on an empty box, like in the address bar; `Shift + Delete`
  forgets one. They stay in your browser and can be turned off.
- **Command palette.** While you type, matching links, Google apps and commands appear under the box. `>` (or
  `Ctrl + Shift + P`) lists every command; `+ some text` adds a task without leaving the search.
- **Developer tools in the search box**, all local; `Enter` copies the result:
  - calculator: `= sqrt(144) * 2^10`, `0xff + 0b11`, or just `1024*3`, with hex and binary for integers;
  - timestamps both ways: `ts`, `ts 1730000000`, `ts 2026-10-26 14:00`;
  - `uuid` (or `uuid 5`), `pw` / `pw 32` for random passwords;
  - `b64` / `b64d` and `url` / `urld` to encode and decode text;
  - `jwt <token>`, or just paste a token: payload, header, expiry and issue dates (the signature is not checked);
  - `sha256 <text>` for a hex digest;
  - `json <text>`, or just paste an object or array: says whether it is valid (and where it breaks if not), copies it
    formatted or minified;
  - `case user profile id` gives `userProfileId`, `UserProfileId`, `user_profile_id`, `user-profile-id`,
    `USER_PROFILE_ID` and a URL slug, from text written in any of those styles;
  - `http 429` explains a status code; `http 40` lists 400–409, `http too many` searches them;
  - `cron */15 9-18 * * 1-5` (or just the expression, or `@daily`) in words, with the next three runs;
  - colors: `#7aa2f7`, `rgb(…)` or `hsl(…)` converted to the other formats, with a swatch.
- **Focus timer.** 25/5, 50/10 or your own durations, a system notification when a session ends (even with no tab
  open), the countdown in the tab title, a 20-week heatmap and your current streak.
- **Tasks and notes.** Undo for deletions; a plain-text scratchpad that saves while you type.
- **Google apps launcher.** 24 apps with editable favorites (drag, or `Ctrl + ←/→`), and a switch for people signed
  in to several Google accounts.
- **Make it yours.** Six themes: three dark ones, a light one, one that takes its accent color from your wallpaper,
  one with any color you pick (adjusted if needed to stay readable), each in two visual styles, Classic or Glass.
  Six built-in wallpapers (Workstation, City, Deep Space, Warm Sand, Sunrise Lake, Liquid Glass), or up to eight of
  your own (downscaled to WebP on your machine), changing every day if you like; dim and blur. Hide the
  parts you do not use (greeting, clock, date, links, focus panel, heatmap, tasks): with both side panels off the page
  becomes one calm, centered column. A 24- or 12-hour clock, with or without seconds. Optional mouse effects (link
  borders that light up near the cursor, a slight lift, wallpaper parallax), off by default. And for anything else,
  your own CSS.
- **Keyboard everywhere** and **backups** to a JSON file, your wallpapers included.

| Developer tools        | Google apps         | Mocha theme and notes |
| ---------------------- | ------------------- | --------------------- |
| ![](docs/palette.webp) | ![](docs/apps.webp) | ![](docs/mocha.webp)  |

## Two interface modes

**Settings → Appearance → Interface mode** switches between two layouts of the same page:

- **Developer**, the full workspace shown above: search, links with their names, focus timer and heatmap, tasks and
  notes.
- **Minimal**, a quiet new tab: a large clock and the date, the search box, and your links as a row of icons (their
  favicons, or their initials), each name shown on hover. Past eight links, a `+n` icon lists the others.

![Atrio in Minimal mode: clock, date, search box and links as icons](docs/minimal.webp)

A mode is a layout, not a profile. Themes, wallpapers and the parts chosen in Settings → Page apply to both, and
switching loses nothing: the links, tasks, notes, timer and settings are the same in both. Minimal keeps every feature:
the search, the command palette and the developer tools work as in Developer, and the tasks, notes and timer stay one
key away (`T`, `N` and `P` open their panel over the page, `Esc` closes it). The mode is saved with the other settings,
follows in the tabs already open, and comes back with a backup.

## Two visual styles

**Settings → Appearance → Visual style** changes how the surfaces are drawn, in either mode and with any theme:

- **Classic**, Atrio's original look, as in the screenshots above.
- **Glass**: the panels, link cards, search box, menus and popovers turn translucent over the blurred wallpaper, with
  thin bright edges, a soft sheen, diffuse shadows and softer corners.

![Atrio in the Glass style, in Developer mode on the Liquid Glass wallpaper](docs/glass.webp)

The glass is smoked: what shows through is dimmed and its colors saturated, so the wallpaper glows behind the surfaces
while their text stays readable, even on bright wallpapers (measured on every theme and built-in wallpaper, the muted
text on Glass's surfaces stays at 4.5:1 or more). When the system asks for less transparency or more contrast, Glass
keeps Classic's fills and drops the blur.

Mode, style, theme and wallpaper are four separate settings: every combination works, and changing one never changes
the others. Classic is the default, and saves from earlier versions open in it; the style is saved with the other
settings, follows in the tabs already open, and comes back with a backup.

## Install

1. Clone or download this repository and keep the folder somewhere permanent.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the folder.
3. Open a new tab. Chrome puts the cursor in the address bar: click the page to use the shortcuts.

Chrome 118 or later. Edge works too.

<details>
<summary>Keep the same extension ID when moving the folder</summary>

Chrome derives the ID of an unpacked extension from its folder path, and the ID owns the saved data. To pin it:
export a backup (**Settings → Data → Export backup**), run `npm run apply-key`, remove and load the extension
again, then import the backup. From then on the ID no longer depends on where the folder lives.

</details>

## Keyboard shortcuts

| Key                       | Action                                   |
| ------------------------- | ---------------------------------------- |
| `/` or `Ctrl + K`         | Focus the search                         |
| `>` or `Ctrl + Shift + P` | Command palette                          |
| `↑` `↓` `Enter` `Esc`     | Move through suggestions, run, close     |
| `Shift + Enter`           | Search even if the text looks like a URL |
| `Shift + Delete`          | Forget the highlighted recent search     |
| `1` … `9`                 | Open quick link 1–9                      |
| `G`                       | Google apps                              |
| `T` / `N`                 | New task / notes                         |
| `P`                       | Start or pause the timer                 |
| `S` / `?`                 | Settings / shortcut list                 |

## Privacy and permissions

Your data stays in the browser (`localStorage` and IndexedDB): Atrio has no server, no analytics and no telemetry. It
makes no network requests of its own: it only navigates when you search or open a link. The one exception is opt-in: with **online search suggestions** turned on
(Settings → General, off by default), what you type in the search box is sent to Google or DuckDuckGo, whichever is
your engine, without cookies, as Chrome's address bar does.

The extension's content security policy holds the page to this: images only from the extension itself (and local
`data:`/`blob:` images), no fonts or media from the web, and connections only to those two suggestion services. Custom
CSS, including CSS from an imported backup, cannot make the page load anything from a server.

The full [privacy policy](PRIVACY.md) (English and Italian) details what is stored, for how long, and how to delete
it.

| Permission                                              | Why                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `search`                                                | Search with the engine set in Chrome (Chrome's Search API)             |
| `alarms`                                                | Schedule the end of a focus session, even when no tab is open          |
| `notifications`                                         | Tell you when the session is over                                      |
| `favicon`                                               | Show site icons for quick links from Chrome's local cache (no network) |
| Optional: `suggestqueries.google.com`, `duckduckgo.com` | Online search suggestions, asked only when you turn them on            |

## How it works

- **No flash on open.** A tiny blocking script (`js/boot.js`) applies theme, interface mode, visual style, wallpaper,
  dim and blur before the first paint; the ES modules load after.
- **Two modes, one page.** The interface mode is a `data-layout` attribute on the root element: Minimal is a set of
  CSS rules over the same HTML, the same components and the same state, so neither mode can drift from the other.
  Panels hidden in Minimal stay in the page; `js/layout.js` floats one when its shortcut asks for it.
- **Glass in CSS alone.** The visual style is a `data-style` attribute, apart from `data-layout` and `data-theme`.
  Glass is a few custom properties (fill, edge, sheen, shadow, blur) drawn over the theme's own colors, on the surfaces
  that need them; nothing else is blurred, nothing animates, and Classic's rules are untouched. The search box draws
  its glass on a pseudo-element: an element that blurs its backdrop confines the blur of everything inside it, and the
  suggestions under the box must blur the page. In headless Chrome, a frame with thirty glass link cards took under
  2 ms to draw (95th percentile; Classic 0.3 ms).
- **One store, many tabs.** All state lives in one validated object (`js/state.js`). Every open new tab listens to the
  `storage` event, so tabs never overwrite each other with stale data. A corrupted save is backed up, not discarded.
- **A timer that survives throttling.** Sessions store an absolute end time; ticks align to the displayed second while
  visible and drop to once a minute when hidden. The service worker only wakes up for the end-of-session alarm.
- **Idle means idle.** Nothing runs while the page is still: measured at about 0.03% of one CPU core (around 0.15%
  with the clock's seconds shown, one text update per second). With the mouse
  effects off (the default) no pointer listener exists and hover states change instantly, so moving the mouse costs
  about what the browser itself needs (~4% of a core in headless Chrome, versus ~17% with the effects on). When on,
  the spotlight restyles one small layer per element (custom properties inherit, so setting them on a panel would
  restyle all its content), and everything switches off with `prefers-reduced-motion`.
- **Two languages without a framework.** Every text lives in `js/i18n.js`. The static ones are marked in the HTML
  with `data-i18n` attributes, and the page stays hidden for the moment it takes to fill them in. Dates, numbers and
  ordinals use `Intl` in the chosen language, and the end-of-session notification follows it too. A test checks that
  both languages have the same keys and placeholders.
- **Suggestions that do not get in the way.** They are requested after a 150 ms pause in typing, every keystroke
  cancels the previous request, answers are cached, and rows are never inserted while you are moving through the
  list. Offline, the box works as if they were off.
- **Custom CSS that cannot lock you out.** Your rules are wrapped in `@scope (.customizable)`, the container of the
  wallpaper, the page and the Google apps. The settings button and the settings drawer sit outside it, and the button
  stays above anything the CSS can place over it, so even `:scope { display: none }` leaves the settings usable to fix
  a mistake. The CSS is parsed in a constructable stylesheet first, in the settings and before the first paint: a stray
  `}` that would let rules escape the scope, or an at-rule that is global even inside it (`@property`,
  `@font-face`…), is caught and the CSS is not applied.
- **A calculator without `eval`.** The palette's math goes through a small recursive-descent parser: `eval` would be
  unsafe and is blocked by the extension's content security policy anyway.
- **Pure logic, tested.** Search resolution, state validation, timer, stats, color extraction and ranking are pure
  modules covered by `node --test`; a CDP-driven suite checks the real page in headless Chrome.

## Development

Requires Node.js 22+. There is nothing to install: the tools run through `npx`.

| Command                  | What it does                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`               | Unit tests (`node --test`)                                                                                                                                                      |
| `npm run test:e2e`       | End-to-end checks in headless Chrome (set `CHROME_PATH` if needed)                                                                                                              |
| `npm run test:extension` | Smoke checks of the real extension, loaded unpacked in headless Chrome or Edge; `-- <folder>` checks another copy                                                               |
| `npm run lint`           | ESLint                                                                                                                                                                          |
| `npm run format`         | Prettier                                                                                                                                                                        |
| `npm run check`          | Unit tests, lint and formatting check (what CI runs)                                                                                                                            |
| `npm run screenshots`    | Regenerate the images in `docs/` with demo data; `-- --store` for the Chrome Web Store set in `docs/store/<version>/`: five 1280 × 800 screenshots and the 440 × 280 promo tile |
| `npm run icons`          | Render the PNG icons from `assets/icons/icon.svg`                                                                                                                               |
| `npm run package`        | Build `atrio-<version>.zip` for the Chrome Web Store (runtime files only, no `key`), extract it to a temporary folder and check it                                              |

To work on the UI without reloading the extension, serve the folder (e.g. `npx serve .`) and open `index.html`: the
page runs outside the extension too, just without notifications, site icons, online suggestions and `chrome://`
pages. `npm run test:e2e` checks the page that way; `npm run test:extension` loads the extension itself (through the
DevTools protocol, which branded Chrome allows with `--enable-unsafe-extension-debugging`) for what only it has: the
manifest's permissions and content security policy, Chrome's Search API, alarms and the service worker.

```
manifest.json        Manifest V3
index.html, style.css
background.js        service worker: end-of-session notifications
js/boot.js           blocking script applied before the first paint
js/main.js           entry point, cross-tab sync
js/config.js         themes, engines, prefixes, presets, limits
js/state.js          schema, validation, migrations
js/i18n.js           interface texts in English and Italian, formatters
js/search.js         text → URL, search or prefix
js/timer.js, js/stats.js, js/color.js, js/fuzzy.js   pure logic
js/google-apps.js    launcher catalog and icons
js/*.js              UI modules (links, tasks, notes, focus, apps, settings, effects…)
_locales/            extension description for the Chrome Web Store and chrome://extensions
tests/               unit tests; tests/e2e/ browser checks; tests/extension/ the real extension
scripts/             icons, screenshots, extension key, Store package
```

## License

[MIT](LICENSE). The Workstation and City wallpapers are the author's own images. Deep Space, Warm Sand, Sunrise Lake and
Liquid Glass were generated with AI for Atrio, not taken from a stock library; see
[their provenance note](docs/IMAGE_PROVENANCE.txt) and
[the Chrome Web Store notes](docs/CHROME_WEB_STORE_LISTING.md#assets-and-trademarks). Atrio is not affiliated with
Google. Google product names belong to their owners; the launcher icons are simplified drawings made for this project.
