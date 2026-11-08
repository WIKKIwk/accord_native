import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';
import { trimDart } from './qolipApiCommon';
import { filterQolipSearch, normalizeQolipSearch, QolipSearchDocument } from './qolipSearchEngine';
import { qolipManagedSets, type QolipManagedSet } from './qolipSetsApi';

const setDocuments = new WeakMap<QolipManagedSet, QolipSearchDocument>();
const setNameDocuments = new WeakMap<QolipManagedSet, QolipSearchDocument>();
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

function searchRelevanceScore(query: string, primary: string, secondary: Iterable<string>): number {
  const normalizedQuery = normalizeQolipSearch(query), compactQuery = compact(query);
  if (!normalizedQuery || !compactQuery) return 0;
  let best = scoreField(normalizedQuery, compactQuery, primary, true);
  for (const value of secondary) best = Math.max(best, scoreField(normalizedQuery, compactQuery, value, false));
  return best;
}
const compare = (left: string, right: string) => left === right ? 0 : left < right ? -1 : 1;

/** @v2 searchQolipSets */
export async function searchQolipSets(sets: Iterable<QolipManagedSet>, query: string, options: {
  includeMoldCodes?: boolean; isCurrent?: () => boolean;
} = {}): Promise<QolipManagedSet[]> {
  const includeMoldCodes = options.includeMoldCodes ?? true;
  const documents = includeMoldCodes ? setDocuments : setNameDocuments;
  function* nonempty() { for (const entry of sets) if (entry.set.members.length > 0) yield entry; }
  const matches = await filterQolipSearch(nonempty(), query, entry => {
    let document = documents.get(entry);
    if (!document) {
      document = new QolipSearchDocument([entry.name, entry.set.id,
        ...(includeMoldCodes ? entry.set.members.map(mold => mold.qolip_code) : [])]);
      documents.set(entry, document);
    }
    return document;
  }, { isCurrent: options.isCurrent });
  if (matches === null) return [];
  const needle = trimDart(query).toLowerCase();
  const score = (entry: QolipManagedSet) => {
    if (entry.set.id.toLowerCase() === needle ||
        (includeMoldCodes && entry.set.members.some(mold => mold.qolip_code.toLowerCase() === needle))) return 100000;
    if (entry.name.toLowerCase() === needle) return 90000;
    return searchRelevanceScore(query, entry.name,
      [entry.set.id, ...(includeMoldCodes ? entry.set.members.map(mold => mold.qolip_code) : [])]);
  };
  return matches.sort((a, b) => score(b) - score(a) ||
    compare(a.display_name.toLowerCase(), b.display_name.toLowerCase()) || compare(a.set.id, b.set.id));
}

/** @v2 QolipSetLookup */
export class QolipSetLookup {
  private scope: string | null = null;
  private future: Promise<QolipManagedSet[]> | null = null;
  constructor(private readonly session: Session) {}
  private get currentScope(): string { return `${this.session.baseUrl}|${sessionReadScope(this.session)}`; }
  get isCurrent(): boolean { return this.scope === this.currentScope; }

  load(refresh = false): Promise<QolipManagedSet[]> {
    const scope = this.currentScope;
    if (refresh || this.scope !== scope) { this.scope = scope; this.future = null; }
    return this.future ??= this.read(scope);
  }
  private async read(scope: string): Promise<QolipManagedSet[]> {
    try {
      const sets = await qolipManagedSets(this.session);
      if (scope !== this.currentScope) throw new MobileApiException({ code: 'session_scope_changed', message: 'session_scope_changed' });
      return sets;
    } catch (error) {
      if (this.scope === scope) this.future = null;
      throw error;
    }
  }
}
