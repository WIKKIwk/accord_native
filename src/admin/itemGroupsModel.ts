import { searchRelevanceScore } from '../qolip/qolipSearchRelevance';
import { dartPartialLower, dartTrim } from './dartJsonString';
import type { AdminItemGroupTreeEntry } from './itemGroupModel';
export type ItemGroupsTreeNode = { entry: AdminItemGroupTreeEntry; children: ItemGroupsTreeNode[] };
/** V2 admin_item_group_tree_panel.dart _buildNodes. */
export function itemGroupsTree(entries: readonly AdminItemGroupTreeEntry[]): ItemGroupsTreeNode[] {
  const nodes = new Map<string, ItemGroupsTreeNode>();
  for (const entry of entries) { const name = dartTrim(entry.name); if (name && !nodes.has(name)) nodes.set(name, { entry, children: [] }); }
  const roots: ItemGroupsTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = dartTrim(node.entry.parent_item_group), owner = nodes.get(parent);
    if (!parent || parent === node.entry.name || !owner) roots.push(node); else owner.children.push(node);
  }
  return roots;
}
export function itemGroupsMerge(groups: readonly string[], optimistic: readonly string[] = []): string[] {
  return [...new Set([...groups, ...optimistic].map(dartTrim).filter(Boolean))];
}
export function itemGroupsCreateParent(groups: readonly string[], current: string | null): string | null {
  return current && groups.includes(dartTrim(current)) ? current : groups.includes('All Item Groups') ? 'All Item Groups' : groups[0] || current;
}
export function itemGroupsMoveChoices(groups: readonly string[], group: string | null) {
  const normalized = itemGroupsMerge(groups);
  return { groups: normalized.filter(value => value !== 'All Item Groups').sort(), parents: normalized.filter(value => value !== dartTrim(group ?? '')).sort() };
}
export function itemGroupsPickerPage(groups: readonly string[], query: string, limit = 50, rankingQuery = query) {
  const q = dartPartialLower(dartTrim(query)), filtered = groups.filter(value => !q || dartPartialLower(value).includes(q));
  const loaded = filtered.slice(0, limit).map((value, index) => ({ value, index, score: searchRelevanceScore(rankingQuery, value, ['']) }));
  if (dartTrim(rankingQuery)) loaded.sort((a, b) => b.score - a.score || a.index - b.index);
  return { items: loaded.map(row => row.value), hasMore: filtered.length >= limit };
}
export function itemGroupsVisibleTree(roots: readonly ItemGroupsTreeNode[], expanded: ReadonlySet<string>, depth = 0): { node: ItemGroupsTreeNode; depth: number }[] {
  return roots.flatMap(node => [{ node, depth }, ...(expanded.has(node.entry.name) ? itemGroupsVisibleTree(node.children, expanded, depth + 1) : [])]);
}
