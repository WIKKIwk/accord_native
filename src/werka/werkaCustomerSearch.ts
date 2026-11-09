import lowercaseData from './werkaDartLowercaseData.json';
import type { CustomerDirectoryEntry } from './werkaArchiveBatchQr';
import { werkaDartTrim } from './werkaBatchTrim';

// Generated from standalone Dart 3.13.7's scalar String.toLowerCase. Unlike
// host JS lowercasing, Dart's mapping includes U+0130 -> i and is not contextual.
const lowercase = lowercaseData as Record<string, string>;
export function werkaDartLowercase(value: string): string {
  return [...value].map(char => lowercase[String(char.codePointAt(0))] ?? char).join('');
}

const cyrillic: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  қ: 'q', ғ: 'g', ҳ: 'h', ў: 'o',
};

/** Role-local projection of the f119 search normalizer; no shared store is read. */
export function werkaCustomerSearchNormalize(input: string): string {
  if (!werkaDartTrim(input)) return '';
  const mapped = [...werkaDartLowercase(input)].map(char => cyrillic[char] ?? char).join('');
  return werkaDartTrim(mapped.replace(/['`ʻʼ’]/g, '').replace(/x/g, 'h').replace(/\s+/g, ' '));
}

const compact = (input: string) => werkaCustomerSearchNormalize(input).replace(/[^a-z0-9]+/g, '');
// Every source fuzzy comparison uses equal-length compact ASCII slices. At
// distance <= 1, Levenshtein is equivalent to at most one differing byte.
function withinOne(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let differences = 0;
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index] && ++differences > 1) return false;
  return true;
}
function containsFuzzy(value: string, query: string): boolean {
  if (!query || value.length < query.length) return false;
  for (let start = 0; start <= value.length - query.length; start++) {
    if (withinOne(value.slice(start, start + query.length), query)) return true;
  }
  return false;
}

function scoreField(normalizedQuery: string, compactQuery: string, value: string, primary: boolean): number {
  const normalizedValue = werkaCustomerSearchNormalize(value), compactValue = compact(value);
  if (!normalizedValue || !compactValue) return 0;
  const weight = primary ? 1000 : 0;
  if (compactValue === compactQuery) return weight + 9000;
  if (normalizedValue === normalizedQuery) return weight + 8800;
  if (compactValue.startsWith(compactQuery)) return weight + 8200;
  if (compactValue.length >= compactQuery.length && withinOne(compactValue.slice(0, compactQuery.length), compactQuery)) return weight + 7900;
  const tokens = normalizedValue.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some(token => token === compactQuery || token === normalizedQuery)) return weight + 7600;
  if (tokens.some(token => token.startsWith(compactQuery))) return weight + 7300;
  if (tokens.some(token => token.length >= compactQuery.length && withinOne(token.slice(0, compactQuery.length), compactQuery))) return weight + 7000;
  if (compactValue.includes(compactQuery)) return weight + 6200;
  if (normalizedValue.includes(normalizedQuery)) return weight + 5800;
  if (containsFuzzy(compactValue, compactQuery)) return weight + 5400;
  return 0;
}

/** Source relevance for a supplied primary field and secondary fields. */
export function werkaCustomerSearchScore(query: string, primary: string, secondary: readonly string[] = []): number {
  const normalizedQuery = werkaCustomerSearchNormalize(query), compactQuery = compact(query);
  if (!normalizedQuery || !compactQuery) return 0;
  let best = scoreField(normalizedQuery, compactQuery, primary, true);
  for (const field of secondary) best = Math.max(best, scoreField(normalizedQuery, compactQuery, field, false));
  return best;
}

/** Source single-query order over the accumulated raw list; preserve ties and objects. */
export function werkaBatchCustomerSearchOrder<T extends Readonly<CustomerDirectoryEntry>>(query: string, customers: readonly T[]): T[] {
  const trimmed = werkaDartTrim(query);
  if (!trimmed || customers.length < 2) return [...customers];
  return customers.map((customer, index) => ({ customer, index,
    score: werkaCustomerSearchScore(trimmed, customer.name, [customer.phone]) }))
    .sort((left, right) => right.score - left.score || left.index - right.index).map(entry => entry.customer);
}
