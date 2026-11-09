import { normalizeQolipSearch } from './qolipSearchEngine';

const compact = (value: string) => normalizeQolipSearch(value).replace(/[^a-z0-9]+/g, '');

function boundedLevenshtein(left: string, right: string, maximum: number): number | null {
  if (Math.abs(left.length - right.length) > maximum) return null;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 0; i < left.length; i++) {
    const current = Array<number>(right.length + 1).fill(0);
    current[0] = i + 1;
    let rowMin = current[0];
    for (let j = 0; j < right.length; j++) {
      current[j + 1] = Math.min(current[j] + 1, previous[j + 1] + 1, previous[j] + (left[i] === right[j] ? 0 : 1));
      if (current[j + 1] < rowMin) rowMin = current[j + 1];
    }
    if (rowMin > maximum) return null;
    previous = current;
  }
  return previous[right.length] <= maximum ? previous[right.length] : null;
}

function startsWithFuzzy(value: string, query: string): boolean {
  return value.length >= query.length && boundedLevenshtein(value.substring(0, query.length), query, 1) !== null;
}
function containsFuzzy(value: string, query: string): boolean {
  if (!query || value.length < query.length) return false;
  for (let start = 0; start <= value.length - query.length; start++) {
    if (boundedLevenshtein(value.substring(start, start + query.length), query, 1) !== null) return true;
  }
  return false;
}
function scoreField(normalizedQuery: string, compactQuery: string, value: string, primary: boolean): number {
  const normalizedValue = normalizeQolipSearch(value), compactValue = compact(value);
  if (!normalizedValue || !compactValue) return 0;
  const weight = primary ? 1000 : 0;
  if (compactValue === compactQuery) return weight + 9000;
  if (normalizedValue === normalizedQuery) return weight + 8800;
  if (compactValue.startsWith(compactQuery)) return weight + 8200;
  if (startsWithFuzzy(compactValue, compactQuery)) return weight + 7900;
  const tokens = normalizedValue.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some(token => token === compactQuery || token === normalizedQuery)) return weight + 7600;
  if (tokens.some(token => token.startsWith(compactQuery))) return weight + 7300;
  if (tokens.some(token => token.length >= compactQuery.length &&
      boundedLevenshtein(token.substring(0, compactQuery.length), compactQuery, 1) !== null)) return weight + 7000;
  if (compactValue.includes(compactQuery)) return weight + 6200;
  if (normalizedValue.includes(normalizedQuery)) return weight + 5800;
  if (containsFuzzy(compactValue, compactQuery)) return weight + 5400;
  return 0;
}

/** @v2 searchRelevanceScore */
export function searchRelevanceScore(query: string, primary: string, secondary: Iterable<string>): number {
  const normalizedQuery = normalizeQolipSearch(query), compactQuery = compact(query);
  if (!normalizedQuery || !compactQuery) return 0;
  let best = scoreField(normalizedQuery, compactQuery, primary, true);
  for (const value of secondary) best = Math.max(best, scoreField(normalizedQuery, compactQuery, value, false));
  return best;
}
