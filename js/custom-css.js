// Custom CSS (Settings → Custom CSS). The rules are wrapped in @scope (.customizable), the container
// of the wallpaper, the page and the Google apps: the settings button, the settings drawer, html and
// body are outside it, so whatever is written, the settings stay usable to fix it. js/boot.js
// applies the same wrapper and check before the first paint.
const SCOPE = '@scope (.customizable)';

// Rules that stay inside the scope. Any other at-rule (@property, @font-face, @counter-style…) is
// global even there: it would reach the settings too. js/boot.js keeps the same list.
const SCOPED_RULES = [
  'CSSStyleRule',
  'CSSNestedDeclarations',
  'CSSMediaRule',
  'CSSSupportsRule',
  'CSSContainerRule',
  'CSSLayerBlockRule',
  'CSSLayerStatementRule',
  'CSSScopeRule',
  'CSSStartingStyleRule',
  'CSSKeyframesRule', // the page's own animations all run inside the scope
  'CSSKeyframeRule',
];

export const scopeCSS = (css) => (css.trim() ? `${SCOPE} {\n${css}\n}` : '');

function globalRule(rules) {
  for (const rule of rules) {
    if (!SCOPED_RULES.includes(rule.constructor.name)) return rule;
    const inner = rule.cssRules && globalRule(rule.cssRules);
    if (inner) return inner;
  }
  return null;
}

/**
 * Parses the CSS the way Chrome will apply it. A stray "}" would close the scope early and let the
 * rest escape it, and a global at-rule would reach the settings: both are errors. Otherwise, the
 * number of rules Chrome kept.
 * @returns {{ rules: number } | { error: 'braces' } | { error: 'global', rule: string }}
 */
export function checkCSS(css) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(scopeCSS(css));
  if (sheet.cssRules.length > 1) return { error: 'braces' };
  const rules = sheet.cssRules[0]?.cssRules ?? [];
  const global = globalRule(rules);
  if (global) return { error: 'global', rule: global.cssText.match(/^@[\w-]+/)?.[0] ?? '@' };
  return { rules: rules.length };
}
