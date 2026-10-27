// Online search suggestions (Settings → General, off by default): what is typed in the search box
// is sent to the engine's suggestion service, as the browser's address bar does. Extension pages
// need host access for that, declared as optional in manifest.json and asked for when the switch
// is turned on. Requests carry no cookies. Parsing is pure, see tests/suggest.test.js.

/** Suggestion services by engine id (ENGINES in config.js); GitHub has none. */
export const SUGGEST_SOURCES = {
  google: {
    origin: 'https://suggestqueries.google.com/*',
    // ie/oe: UTF-8 both ways, otherwise accented letters come back as ISO-8859-1.
    url: (query, language) =>
      'https://suggestqueries.google.com/complete/search?client=chrome&ie=utf-8&oe=utf-8' +
      `&hl=${language}&q=${encodeURIComponent(query)}`,
  },
  ddg: {
    origin: 'https://duckduckgo.com/*',
    url: (query) => `https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(query)}`,
  },
};
export const SUGGEST_ORIGINS = Object.values(SUGGEST_SOURCES).map((source) => source.origin);
export const hasSuggestions = (engine) => Object.hasOwn(SUGGEST_SOURCES, engine);

const MAX_SUGGESTIONS = 5;
const CACHE_SIZE = 100;
const cache = new Map(); // going back with Backspace does not ask again

/** Both services answer [query, [suggestion, …], …]: keeps distinct strings other than the query. */
export function parseSuggestions(data, query, max = MAX_SUGGESTIONS) {
  if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
  const seen = new Set([query.trim().toLowerCase()]);
  const suggestions = [];
  for (const item of data[1]) {
    if (typeof item !== 'string') continue;
    const text = item.trim().slice(0, 200);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    suggestions.push(text);
    if (suggestions.length === max) break;
  }
  return suggestions;
}

const cacheKey = (engine, query) => `${engine}\n${query}`;
export const cachedSuggestions = (engine, query) => cache.get(cacheKey(engine, query));

/** Fetches (once per engine and query) the suggestions; rejects when offline or aborted. */
export async function fetchSuggestions(engine, query, language, signal) {
  const key = cacheKey(engine, query);
  if (cache.has(key)) return cache.get(key);
  const response = await fetch(SUGGEST_SOURCES[engine].url(query, language), {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  const suggestions = response.ok ? parseSuggestions(await response.json(), query) : [];
  cache.set(key, suggestions);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
  return suggestions;
}
