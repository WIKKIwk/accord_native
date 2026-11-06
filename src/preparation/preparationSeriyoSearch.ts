import { normalizeForSearch } from '../shared/searchNormalizer';
import type { PreparationMaterial } from './preparationLogic';

function fuzzyAt(value: string, query: string, start: number) {
  let differences = 0;
  for (let index = 0; index < query.length; index++) {
    if (value[start + index] !== query[index] && ++differences > 1) return false;
  }
  return true;
}

function relevance(query: string, name: string) {
  const normalizedQuery = normalizeForSearch(query), normalizedName = normalizeForSearch(name);
  const compactQuery = normalizedQuery.replace(/[^a-z0-9]+/g, ''), compactName = normalizedName.replace(/[^a-z0-9]+/g, '');
  if (!compactQuery || !compactName) return 0;
  if (compactName === compactQuery) return 10000;
  if (normalizedName === normalizedQuery) return 9800;
  if (compactName.startsWith(compactQuery)) return 9200;
  if (compactName.length >= compactQuery.length && fuzzyAt(compactName, compactQuery, 0)) return 8900;
  const tokens = normalizedName.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some(token => token === compactQuery || token === normalizedQuery)) return 8600;
  if (tokens.some(token => token.startsWith(compactQuery))) return 8300;
  if (tokens.some(token => token.length >= compactQuery.length && fuzzyAt(token, compactQuery, 0))) return 8000;
  if (compactName.includes(compactQuery)) return 7200;
  if (normalizedName.includes(normalizedQuery)) return 6800;
  for (let start = 0; start <= compactName.length - compactQuery.length; start++) {
    if (fuzzyAt(compactName, compactQuery, start)) return 6400;
  }
  return 0;
}

export function preparationSeriyoSearch(materials: readonly PreparationMaterial[], query: string, limit: number) {
  const needle = query.trim().toLowerCase();
  const matches = materials.filter(item => item.can_receive && `${item.name} ${item.code}`.toLowerCase().includes(needle));
  const items = matches.slice(0, limit).map((item, index) => ({ item, index, score: relevance(query, item.name) }));
  if (needle) items.sort((a, b) => b.score - a.score || a.index - b.index);
  return { items: items.map(entry => entry.item), hasMore: matches.length > limit };
}
