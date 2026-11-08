import { normalizeForSearch } from '../shared/searchNormalizer';

// Dart's native trim includes U+0085. Reuse the shared normalizer and apply
// Dart's final trim without changing search behavior in other roles.
export function normalizeQolipSearch(value: string): string {
  return normalizeForSearch(value).replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');
}

const separators = /[^a-z0-9]+/g;
const compact = (value: string) => value.replace(separators, '');
const tokens = (value: string) => value.split(separators).filter(Boolean);
const fields = new Map<string, { normalized: string; compact: string }>();

function prepareField(value: string) {
  const cached = fields.get(value);
  if (cached) {
    fields.delete(value);
    fields.set(value, cached);
    return cached;
  }
  const normalized = normalizeQolipSearch(value);
  const prepared = { normalized, compact: compact(normalized) };
  if (fields.size >= 2048) fields.delete(fields.keys().next().value!);
  fields.set(value, prepared);
  return prepared;
}

/** @v2 QolipSearchDocument */
export class QolipSearchDocument {
  readonly normalized: string[] = [];
  readonly compact: string[];

  constructor(values: Iterable<string>) {
    const compactFields = new Set<string>();
    for (const value of values) {
      const field = prepareField(value);
      if (!field.normalized) continue;
      this.normalized.push(field.normalized);
      if (field.compact) compactFields.add(field.compact);
    }
    this.compact = [...compactFields];
  }
}

type SearchVariant = { value: string; allowFuzzy: boolean; compact: string; tokens: string[] };

function queryVariants(query: string): SearchVariant[] {
  const variants: SearchVariant[] = [];
  const add = (value: string, allowFuzzy: boolean) => {
    const normalized = normalizeQolipSearch(value);
    if (normalized && !variants.some(variant => variant.value === normalized)) {
      variants.push({ value: normalized, allowFuzzy, compact: compact(normalized),
        tokens: tokens(normalized).filter(token => token.length >= 2) });
    }
  };
  add(query, true);

  let latin = 0;
  let cyrillic = 0;
  for (const character of query.toLowerCase()) {
    const rune = character.codePointAt(0)!;
    if (rune >= 0x61 && rune <= 0x7a) latin++;
    else if (rune >= 0x0400 && rune <= 0x04ff) cyrillic++;
  }
  if (!/[0-9]/.test(query)) {
    if (latin >= 4 && cyrillic === 0) add(mapKeyboard(query, latinKeyboard, cyrillicKeyboard), false);
    else if (cyrillic >= 4 && latin === 0) add(mapKeyboard(query, cyrillicKeyboard, latinKeyboard), false);
  }
  return variants;
}

const latinKeyboard = 'qwertyuiopasdfghjklzxcvbnm';
const cyrillicKeyboard = 'йцукенгшщзфывапролдячсмить';

function mapKeyboard(input: string, from: string, to: string): string {
  return [...input.toLowerCase()].map(character => {
    const index = from.indexOf(character);
    return index < 0 ? character : to[index];
  }).join('');
}

function canFuzzyMatch(query: string): boolean {
  return query.length >= 3 && !/[0-9]/.test(query);
}

function fuzzyContains(value: string, query: string): boolean {
  const tolerance = query.length <= 6 ? 1 : query.length <= 10 ? 2 : 3;
  if (value.length < query.length - tolerance) return false;
  const width = query.length + 1;
  let previousPrevious = Array<number>(width).fill(0);
  let previous = Array.from({ length: width }, (_, index) => index);
  let current = Array<number>(width).fill(0);
  for (let i = 1; i <= value.length; i++) {
    current[0] = 0;
    const character = value.charCodeAt(i - 1);
    for (let j = 1; j < width; j++) {
      const cost = character === query.charCodeAt(j - 1) ? 0 : 1;
      let distance = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && character === query.charCodeAt(j - 2) &&
          value.charCodeAt(i - 2) === query.charCodeAt(j - 1)) {
        distance = Math.min(distance, previousPrevious[j - 2] + 1);
      }
      current[j] = distance;
    }
    if (current[width - 1] <= tolerance) return true;
    [previousPrevious, previous, current] = [previous, current, previousPrevious];
  }
  return false;
}

/** @v2 QolipSearchQuery */
export class QolipSearchQuery {
  private readonly variants: SearchVariant[];
  private readonly fuzzyCache = new Map<string, boolean>();

  constructor(query: string) {
    this.variants = queryVariants(query);
  }

  get isEmpty(): boolean {
    return this.variants.length === 0;
  }

  matches(document: QolipSearchDocument): boolean {
    if (this.isEmpty) return true;
    for (const variant of this.variants) {
      if (document.normalized.some(value => value.includes(variant.value)) ||
          (variant.compact && document.compact.some(value => value.includes(variant.compact)))) return true;
    }
    for (const variant of this.variants) {
      if (!variant.compact) continue;
      if (variant.allowFuzzy && canFuzzyMatch(variant.compact) &&
          document.compact.some(value => this.fuzzy(value, variant.compact))) return true;
      if (variant.tokens.length >= 2 && variant.tokens.every(token => document.compact.some(value =>
        value.includes(token) || (variant.allowFuzzy && canFuzzyMatch(token) && this.fuzzy(value, token))))) return true;
    }
    return false;
  }

  private fuzzy(value: string, query: string): boolean {
    const key = JSON.stringify([value, query]);
    const cached = this.fuzzyCache.get(key);
    if (cached !== undefined) return cached;
    const result = fuzzyContains(value, query);
    if (this.fuzzyCache.size < 4096) this.fuzzyCache.set(key, result);
    return result;
  }
}

/** @v2 filterQolipSearch */
export async function filterQolipSearch<T>(items: Iterable<T>, query: string,
  documentFor: (item: T) => QolipSearchDocument, options: { isCurrent?: () => boolean } = {}): Promise<T[] | null> {
  const prepared = new QolipSearchQuery(query);
  const result: T[] = [];
  let sliceStart = performance.now();
  for (const item of items) {
    if (options.isCurrent && !options.isCurrent()) return null;
    if (prepared.isEmpty || prepared.matches(documentFor(item))) result.push(item);
    if (performance.now() - sliceStart >= 2) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      sliceStart = performance.now();
    }
  }
  return !options.isCurrent || options.isCurrent() ? result : null;
}
