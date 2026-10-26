// Classic blocking script, run before the first paint: applies the saved theme (and
// automatic accent), wallpaper, shade and blur so a new tab never flashes the default look.
// The storage key must match STORAGE_KEY in js/config.js.
(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('workspace.newtab.v2') || 'null');
    if (!saved || typeof saved !== 'object') return;
    const root = document.documentElement;
    if (/^[a-z]+$/.test(saved.theme)) root.dataset.theme = saved.theme;
    // "Dallo sfondo" theme: the accent extracted earlier from the wallpaper.
    const accent = saved.autoAccent?.color;
    if (saved.theme === 'auto' && /^#[0-9a-f]{6}$/i.test(accent)) root.style.setProperty('--accent', accent);
    if (saved.apps?.visible === false) root.setAttribute('data-apps-off', '');
    if (/^[a-z]+$/.test(saved.wallpaper)) {
      root.dataset.wallpaper = saved.wallpaper;
      if (saved.wallpaper !== 'custom') {
        root.style.setProperty('--wallpaper', `url("assets/${saved.wallpaper}.webp")`);
      }
    }
    const shade = Number(saved.shade);
    if (Number.isFinite(shade)) {
      root.style.setProperty('--shade', String(Math.min(75, Math.max(0, shade)) / 100));
    }
    const blur = Math.min(24, Math.max(0, Math.round(Number(saved.blur)))); // LIMITS.blur
    if (blur > 0) {
      root.style.setProperty('--blur', `${blur}px`);
      root.style.setProperty('--wallpaper-filter', `blur(${blur}px)`);
    }
  } catch {
    // Defaults from style.css apply.
  }
})();
