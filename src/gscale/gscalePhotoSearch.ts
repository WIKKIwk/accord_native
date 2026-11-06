import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { normalizeForSearch } from '../shared/searchNormalizer';

export type GScalePhotoSuggestion = { displayQuery: string; backgroundQueries: string[]; visibleText: string };

/** @v2 werkaAiSearchSuggestion */
export async function gscalePhotoSearchSuggestion(session: Session, bytes: Uint8Array, filename: string): Promise<GScalePhotoSuggestion> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let boundary = 'dart-http-boundary-';
  while (boundary.length < 70) boundary += chars[Math.floor(Math.random() * chars.length)];
  const name = (filename.trim() || 'werka-ai-search.jpg').replace(/\r\n|\r|\n/g, '%0D%0A').replace(/"/g, '%22');
  const encoder = new TextEncoder();
  const head = encoder.encode(`--${boundary}\r\ncontent-type: application/octet-stream\r\ncontent-disposition: form-data; name="image"; filename="${name}"\r\n\r\n`);
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`), body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head); body.set(bytes, head.length); body.set(tail, head.length + bytes.length);
  const response = await authorizedFetch(session, '/v1/mobile/werka/ai-search-suggestion', {
    method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body,
  }, undefined, null);
  let payload: Record<string, unknown> = {};
  try { const value: unknown = await response.json(); if (value && typeof value === 'object' && !Array.isArray(value)) payload = value as Record<string, unknown>; }
  catch { /* V2 uses an empty object for an invalid response. */ }
  if (response.status !== 200) throw new MobileApiException({ code: typeof payload.code === 'string' ? payload.code.trim() : 'werka_ai_search_failed',
    message: typeof payload.error === 'string' ? payload.error.trim() : 'Werka AI search failed', statusCode: response.status });
  const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const seen = new Set<string>(), backgroundQueries = (Array.isArray(payload.background_queries) ? payload.background_queries : [])
    .map(clean).filter(value => { const key = value.toLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  const displayQuery = clean(payload.display_query) || backgroundQueries[0] || '';
  if (!displayQuery && !backgroundQueries.length) throw new MobileApiException({ code: 'no_result', message: 'no_result' });
  return { displayQuery, backgroundQueries, visibleText: clean(payload.visible_text) };
}

const generic = new Set(['mahsulotlari', 'products', 'продукты', 'молочные', 'dairy', 'milk', 'sut', 'noodles',
  'instant', 'spicy', 'achchiq', 'курица', 'острая', 'kuritsa', 'ostraya', 'tovuq', 'snack', 'halal']);

/** Remote query expansion from M3AsyncPickerSheet._effectiveRemoteQueries. */
export function gscalePhotoRemoteQueries(queries: string[]): string[] {
  if (queries.length <= 1) return queries;
  const first: string[] = [], family: string[] = [], core: string[] = [], specific: string[] = [], seen = new Set<string>();
  const add = (value: string, target: string[]) => {
    const clean = value.trim(), key = clean.toLowerCase();
    if (clean && !seen.has(key)) { seen.add(key); target.push(clean); }
  };
  for (const query of queries) {
    const tokens = query.split(/[^A-Za-z0-9А-Яа-яЁёЎўҚқҒғҲҳ]+/).filter(Boolean);
    if (!tokens.length) continue;
    if (tokens[0].length >= 5 && !generic.has(tokens[0].toLowerCase())) add(tokens[0], first);
    if (tokens.length === 1 && tokens[0].length >= 4 && !generic.has(tokens[0].toLowerCase())) add(tokens[0], core);
    else if (tokens.length === 2) add(tokens.slice(0, 2).join(' '), family);
    else if (tokens.length >= 3) { add(tokens.slice(0, 2).join(' '), family); add(tokens.slice(0, 3).join(' '), specific); }
  }
  return [...first, ...family, ...core, ...specific, ...queries].slice(0, 6);
}

function differsByAtMostOne(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let changes = 0;
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index] && ++changes > 1) return false;
  return true;
}
function fuzzyContains(value: string, query: string): boolean {
  if (!query || value.length < query.length) return false;
  for (let index = 0; index <= value.length - query.length; index++) {
    if (differsByAtMostOne(value.slice(index, index + query.length), query)) return true;
  }
  return false;
}
function fieldScore(query: string, compactQuery: string, raw: string, primary: boolean): number {
  const value = normalizeForSearch(raw), compact = value.replace(/[^a-z0-9]+/g, ''), weight = primary ? 1000 : 0;
  if (!value || !compact) return 0;
  if (compact === compactQuery) return weight + 9000;
  if (value === query) return weight + 8800;
  if (compact.startsWith(compactQuery)) return weight + 8200;
  if (compact.length >= compactQuery.length && differsByAtMostOne(compact.slice(0, compactQuery.length), compactQuery)) return weight + 7900;
  const tokens = value.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some(token => token === compactQuery || token === query)) return weight + 7600;
  if (tokens.some(token => token.startsWith(compactQuery))) return weight + 7300;
  if (tokens.some(token => token.length >= compactQuery.length && differsByAtMostOne(token.slice(0, compactQuery.length), compactQuery))) return weight + 7000;
  if (compact.includes(compactQuery)) return weight + 6200;
  if (value.includes(query)) return weight + 5800;
  if (fuzzyContains(compact, compactQuery)) return weight + 5400;
  return 0;
}

/** Relevance ordering from the V2 async picker. */
export function gscalePickerRelevance(query: string, title: string, subtitle = ''): number {
  const value = normalizeForSearch(query), compact = value.replace(/[^a-z0-9]+/g, '');
  return !value || !compact ? 0 : Math.max(fieldScore(value, compact, title, true), fieldScore(value, compact, subtitle, false));
}
