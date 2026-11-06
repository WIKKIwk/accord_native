const cyrillic: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  қ: 'q', ғ: 'g', ҳ: 'h', ў: 'o',
};

/** @v2 normalizeForSearch */
export function normalizeForSearch(input: string): string {
  if (!input.trim()) return '';
  return [...input.toLowerCase()].map(char => cyrillic[char] ?? char).join('')
    .replace(/['`ʻʼ’]/g, '').replace(/x/g, 'h').replace(/\s+/g, ' ').trim();
}

const compact = (input: string) => normalizeForSearch(input).replace(/[^a-z0-9]+/g, '');

function containsFuzzy(value: string, token: string): boolean {
  if (!token || value.length < token.length) return false;
  for (let start = 0; start <= value.length - token.length; start++) {
    let differences = 0;
    for (let index = 0; index < token.length && differences <= 1; index++) {
      if (value[start + index] !== token[index]) differences++;
    }
    if (differences <= 1) return true;
  }
  return false;
}

/** @v2 searchMatches */
export function searchMatches(query: string, values: Iterable<string>): boolean {
  const needle = normalizeForSearch(query);
  if (!needle) return true;
  const normalized = [...values].map(normalizeForSearch).filter(Boolean);
  if (normalized.some(value => value.includes(needle))) return true;
  const tokens = needle.split(/[^a-z0-9]+/).filter(token => token.length >= 2);
  if (!tokens.length) return false;
  for (const token of tokens) {
    if (!normalized.some(value => {
      if (value.includes(token)) return true;
      const candidate = compact(value), part = compact(token);
      return !!part && (candidate.includes(part) || containsFuzzy(candidate, part));
    })) return false;
  }
  return tokens.length >= 2;
}
