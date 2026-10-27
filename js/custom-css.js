// Custom CSS (Settings → Custom CSS). The rules are wrapped in @scope so they reach everything on
// the page except html, body and the settings drawer: whatever is written, the settings stay
// usable to fix it. js/boot.js applies the same wrapper before the first paint.
const SCOPE = '@scope (body) to (#settings)';

export const scopeCSS = (css) => (css.trim() ? `${SCOPE} {\n${css}\n}` : '');

/**
 * Parses the CSS the way Chrome will apply it. A stray "}" would close the scope early and let the
 * rest escape it: that is an error. Otherwise, the number of rules Chrome kept.
 * @returns {{ rules: number } | { error: 'braces' }}
 */
export function checkCSS(css) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(scopeCSS(css));
  if (sheet.cssRules.length > 1) return { error: 'braces' };
  return { rules: sheet.cssRules[0]?.cssRules.length ?? 0 };
}
