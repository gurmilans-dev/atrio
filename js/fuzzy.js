// Ranking for the command palette: prefix > word start > substring > in-order letters.
// Accents are ignored, so "citta" finds "Città". Returns -1 when there is no match.

const fold = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function fuzzyScore(query, text, { subsequence = true } = {}) {
  const needle = fold(query).trim();
  const haystack = fold(text);
  if (!needle) return 0;

  const index = haystack.indexOf(needle);
  if (index === 0) return 1000 - haystack.length;
  if (index > 0) return (/[\s\-_./:]/.test(haystack[index - 1]) ? 800 : 600) - index;
  if (!subsequence) return -1;

  let from = 0;
  let last = -1;
  let gaps = 0;
  for (const char of needle.replace(/\s+/g, '')) {
    const found = haystack.indexOf(char, from);
    if (found < 0) return -1;
    if (last >= 0) gaps += found - last - 1;
    last = found;
    from = found + 1;
  }
  return Math.max(1, 300 - gaps * 5);
}
