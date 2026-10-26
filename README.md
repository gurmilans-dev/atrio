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
Google apps launcher. It is plain HTML, CSS and JavaScript modules: no framework, no build step, no network requests,
no tracking.

> The interface is in Italian.

## Features

- **Search that knows code from URLs.** `console.log`, `next.js` or `README.md` are searched, not opened as domains.
  `localhost:5173`, LAN IPs, `[::1]` and `*.test` open over `http://`. Prefixes search a site directly (`yt lofi`,
  `npm zod`; also `gh`, `mdn`, `so`, `py`, `ciu`, `dd`) and, typed alone, open it (`yt` → YouTube). `chrome://`
  pages work, `Shift + Enter` always searches.
- **Command palette.** While you type, matching links, Google apps and commands appear under the box. `>` (or
  `Ctrl + Shift + P`) lists every command; `+ some text` adds a task without leaving the search.
- **Developer tools in the search box**, all local; `Enter` copies the result:
  - calculator: `= sqrt(144) * 2^10`, `0xff + 0b11`, or just `1024*3`, with hex and binary for integers;
  - timestamps both ways: `ts`, `ts 1730000000`, `ts 2026-10-26 14:00`;
  - `uuid` (or `uuid 5`), `pw` / `pw 32` for random passwords;
  - `b64` / `b64d` and `url` / `urld` to encode and decode text;
  - colors: `#7aa2f7`, `rgb(…)` or `hsl(…)` converted to the other formats, with a swatch.
- **Focus timer.** 25/5 or 50/10 sessions, a system notification when a session ends (even with no tab open), the
  countdown in the tab title, a 20-week heatmap and your current streak.
- **Tasks and notes.** Undo for deletions; a plain-text scratchpad that saves while you type.
- **Google apps launcher.** 24 apps with editable favorites (drag, or `Ctrl + ←/→`), and a switch for people signed in
  to several Google accounts.
- **Make it yours.** Four themes, one of which takes its accent color from your wallpaper; your own wallpaper
  (downscaled to WebP on your machine); dim and blur; link borders that light up near the cursor; optional parallax.
- **Keyboard everywhere** and **backups** to a JSON file, wallpaper included.

| Developer tools        | Google apps         | Mocha theme and notes |
| ---------------------- | ------------------- | --------------------- |
| ![](docs/palette.webp) | ![](docs/apps.webp) | ![](docs/mocha.webp)  |

## Install

1. Clone or download this repository and keep the folder somewhere permanent.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the folder.
3. Open a new tab. Chrome puts the cursor in the address bar: click the page to use the shortcuts.

Chrome 117 or later. Edge works too.

<details>
<summary>Keep the same extension ID when moving the folder</summary>

Chrome derives the ID of an unpacked extension from its folder path, and the ID owns the saved data. To pin it:
export a backup (**Impostazioni → Dati → Esporta backup**), run `npm run apply-key`, remove and load the extension
again, then import the backup. From then on the ID no longer depends on where the folder lives.

</details>

## Keyboard shortcuts

| Key                       | Action                                   |
| ------------------------- | ---------------------------------------- |
| `/` or `Ctrl + K`         | Focus the search                         |
| `>` or `Ctrl + Shift + P` | Command palette                          |
| `↑` `↓` `Enter` `Esc`     | Move through suggestions, run, close     |
| `Shift + Enter`           | Search even if the text looks like a URL |
| `1` … `9`                 | Open quick link 1–9                      |
| `G`                       | Google apps                              |
| `T` / `N`                 | New task / notes                         |
| `P`                       | Start or pause the timer                 |
| `S` / `?`                 | Settings / shortcut list                 |

## Privacy and permissions

Everything stays in the browser (`localStorage` and IndexedDB). Atrio makes no network requests of its own: it only
navigates when you search or open a link.

| Permission      | Why                                                                    |
| --------------- | ---------------------------------------------------------------------- |
| `alarms`        | Schedule the end of a focus session, even when no tab is open          |
| `notifications` | Tell you when the session is over                                      |
| `favicon`       | Show site icons for quick links from Chrome's local cache (no network) |

## How it works

- **No flash on open.** A tiny blocking script (`js/boot.js`) applies theme, wallpaper, dim and blur before the first
  paint; the ES modules load after.
- **One store, many tabs.** All state lives in one validated object (`js/state.js`). Every open new tab listens to the
  `storage` event, so tabs never overwrite each other with stale data. A corrupted save is backed up, not discarded.
- **A timer that survives throttling.** Sessions store an absolute end time; ticks align to the displayed second while
  visible and drop to once a minute when hidden. The service worker only wakes up for the end-of-session alarm.
- **Cheap effects.** Nothing runs while the page is still: measured at about 0.03% of one CPU core. Spotlight and
  parallax run only while the mouse moves; the spotlight restyles one small layer per element (custom properties
  inherit, so setting them on a panel would restyle all its content), and all effects switch off with
  `prefers-reduced-motion`.
- **A calculator without `eval`.** The palette's math goes through a small recursive-descent parser: `eval` would be
  unsafe and is blocked by the extension's content security policy anyway.
- **Pure logic, tested.** Search resolution, state validation, timer, stats, color extraction and ranking are pure
  modules covered by `node --test`; a CDP-driven suite checks the real page in headless Chrome.

## Development

Requires Node.js 22+. There is nothing to install: the tools run through `npx`.

| Command               | What it does                                                       |
| --------------------- | ------------------------------------------------------------------ |
| `npm test`            | Unit tests (`node --test`)                                         |
| `npm run test:e2e`    | End-to-end checks in headless Chrome (set `CHROME_PATH` if needed) |
| `npm run lint`        | ESLint                                                             |
| `npm run format`      | Prettier                                                           |
| `npm run check`       | Unit tests, lint and formatting check (what CI runs)               |
| `npm run screenshots` | Regenerate the images in `docs/` with demo data                    |
| `npm run icons`       | Render the PNG icons from `assets/icons/icon.svg`                  |

To work on the UI without reloading the extension, serve the folder (e.g. `npx serve .`) and open `index.html`: the
page runs outside the extension too, just without notifications, site icons and `chrome://` pages.

```
manifest.json        Manifest V3
index.html, style.css
background.js        service worker: end-of-session notifications
js/boot.js           blocking script applied before the first paint
js/main.js           entry point, cross-tab sync
js/config.js         themes, engines, prefixes, presets, limits
js/state.js          schema, validation, migrations
js/search.js         text → URL, search or prefix
js/timer.js, js/stats.js, js/color.js, js/fuzzy.js   pure logic
js/google-apps.js    launcher catalog and icons
js/*.js              UI modules (links, tasks, notes, focus, apps, settings, effects…)
tests/               unit tests; tests/e2e/ browser checks
scripts/             icons, screenshots, extension key
```

## License

[MIT](LICENSE). Atrio is not affiliated with Google. Google product names belong to their owners; the launcher icons
are simplified drawings made for this project.
