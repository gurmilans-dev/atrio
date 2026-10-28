// Classic blocking script, run before the first paint: applies the saved theme (and
// automatic accent), wallpaper, shade and blur so a new tab never flashes the default look.
// The storage key must match STORAGE_KEY in js/config.js.
(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('workspace.newtab.v2') || 'null');
    if (!saved || typeof saved !== 'object') return;
    const root = document.documentElement;
    // Strings only: a missing field would be tested as "undefined", which matches.
    const isWord = (value) => typeof value === 'string' && /^[a-z]+$/.test(value);
    // Wallpaper ids (WALLPAPERS in js/config.js) may join words with hyphens: "deep-space".
    const isId = (value) => typeof value === 'string' && /^[a-z]+(-[a-z]+)*$/.test(value);
    if (isWord(saved.theme)) root.dataset.theme = saved.theme;
    // Interface mode (LAYOUTS in js/config.js): an unknown one matches no rule, so the page keeps the
    // Developer layout until js/appearance.js sets the normalized value.
    if (isWord(saved.layout)) root.dataset.layout = saved.layout;
    // Visual style (VISUAL_STYLES in js/config.js), likewise: an unknown one draws the Classic look.
    if (isWord(saved.visualStyle)) root.dataset.style = saved.visualStyle;
    // Own wallpapers with the daily rotation (same rule as shownImage in js/rotation.js): the day's
    // image. Saves of the "every new tab" rotation, gone since, rotate daily (js/state.js).
    const images = Array.isArray(saved.customImages) ? saved.customImages : [];
    let shown = images.includes(saved.customImage) ? saved.customImage : images[0];
    if (saved.wallpaper === 'custom' && images.length > 1 && ['daily', 'tab'].includes(saved.rotation)) {
      let step = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
      if (Number.isSafeInteger(saved.rotationShift)) step += saved.rotationShift;
      shown = images[((step % images.length) + images.length) % images.length];
    }
    // Automatic theme: the accent extracted earlier from the wallpaper shown.
    const key = saved.wallpaper === 'custom' ? `custom:${shown}` : saved.wallpaper;
    const accent = saved.autoAccents?.[key];
    if (saved.theme === 'auto' && /^#[0-9a-f]{6}$/i.test(accent)) root.style.setProperty('--accent', accent);
    // Custom theme: the readable version of the picked color.
    const custom = saved.customAccent?.color;
    if (saved.theme === 'custom' && /^#[0-9a-f]{6}$/i.test(custom)) {
      root.style.setProperty('--accent', custom);
    }
    if (saved.apps?.visible === false) root.setAttribute('data-apps-off', '');
    // Parts of the page turned off in Settings → Page (SECTIONS in js/config.js).
    if (saved.show && typeof saved.show === 'object') {
      for (const [section, shown] of Object.entries(saved.show)) {
        if (shown === false && /^[a-z]+$/.test(section)) root.setAttribute(`data-hide-${section}`, '');
      }
    }
    if (isId(saved.wallpaper)) {
      root.dataset.wallpaper = saved.wallpaper;
      if (saved.wallpaper !== 'custom') {
        root.style.setProperty('--wallpaper', `url("assets/${saved.wallpaper}.webp")`);
      }
    }
    // Custom CSS, with the @scope and the check of js/custom-css.js: before the first paint, so what
    // it hides never flashes. Left out if a stray "}" or a global at-rule would reach the settings.
    if (typeof saved.customCSS === 'string' && saved.customCSS.trim()) {
      const text = `@scope (.customizable) {\n${saved.customCSS}\n}`;
      const scoped = [
        'CSSStyleRule',
        'CSSNestedDeclarations',
        'CSSMediaRule',
        'CSSSupportsRule',
        'CSSContainerRule',
        'CSSLayerBlockRule',
        'CSSLayerStatementRule',
        'CSSScopeRule',
        'CSSStartingStyleRule',
        'CSSKeyframesRule',
        'CSSKeyframeRule',
      ];
      const inScope = (rules) =>
        Array.from(rules).every(
          (rule) => scoped.includes(rule.constructor.name) && inScope(rule.cssRules || []),
        );
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      if (sheet.cssRules.length === 1 && inScope(sheet.cssRules[0].cssRules)) {
        const style = document.createElement('style');
        style.id = 'custom-css';
        style.textContent = text;
        document.head.append(style);
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
