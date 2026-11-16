import type { Session } from '../auth';
import type { SupplierItem } from '../shared/catalogApi';
import { MobileApiException } from '../shared/mobileApiException';
import { searchRelevanceScore } from '../qolip/qolipSearchRelevance';
import type { AdminUserCreateCustomer } from './adminUserCreateModel';
import { dartPartialLower, dartTrim } from './dartJsonString';
import { adminItemGroupRequiresCustomer, type AdminItemGroupTreeEntry } from './itemGroupModel';

export const adminItemCreatePageSize = 80, adminItemCreateLoadMoreExtent = 420, adminItemCreateSearchDelay = 220;
export type AdminItemCreateCustomer = AdminUserCreateCustomer;
export type AdminItemCreateDraft = Readonly<{ code: string; name: string; group: string; uom: string; customer: AdminItemCreateCustomer | null }>;
export type AdminItemCreateNotice = Readonly<{ serial: number; surface: 'top' | 'snackbar'; tone: 'success' | 'error'; key?: string; getter?: string; literal?: string; values?: Readonly<Record<string, unknown>> }>;
/** @v2 orderAdminItemGroupsByParent */
export function orderAdminItemCreateGroups(entries: readonly AdminItemGroupTreeEntry[]): readonly string[] {
  const names = new Set<string>(), parents = new Map<string, string>(), indexes = new Map<string, number>(), children = new Map<string, string[]>();
  entries.forEach((entry, index) => {
    const name = dartTrim(dartTrim(entry.item_group_name) ? entry.item_group_name : entry.name); if (!name || names.has(name)) return;
    names.add(name); indexes.set(name, index); const parent = dartTrim(entry.parent_item_group); parents.set(name, parent);
    if (parent && parent !== name) { const list = children.get(parent) ?? []; list.push(name); children.set(parent, list); }
  });
  const compare = (left: string, right: string) => (indexes.get(left) ?? 1 << 20) - (indexes.get(right) ?? 1 << 20);
  children.forEach(list => list.sort(compare)); const ordered: string[] = [], queue: string[] = [], visited = new Set<string>();
  const enqueue = (name: string) => { if (names.has(name) && !visited.has(name)) { visited.add(name); queue.push(name); } };
  if (names.has('All Item Groups')) enqueue('All Item Groups');
  [...names].filter(name => !parents.get(name) || parents.get(name) === name || !names.has(parents.get(name)!)).sort(compare).forEach(enqueue);
  for (let index = 0; index < queue.length; index++) { const name = queue[index]; ordered.push(name); (children.get(name) ?? []).forEach(enqueue); }
  names.forEach(enqueue); for (let index = ordered.length; index < queue.length; index++) ordered.push(queue[index]);
  return Object.freeze(ordered);
}
export function syncAdminItemCreateGroup(current: string, groups: readonly string[]): string {
  const name = dartTrim(current), match = name ? groups.find(group => dartPartialLower(dartTrim(group)) === dartPartialLower(name)) : undefined;
  return match ?? (groups.includes('All Item Groups') ? 'All Item Groups' : groups[0] ?? '');
}
export function syncAdminItemCreateUom(current: string, values: readonly string[]): string {
  if (!values.length) throw new Error('UOM katalogi bo‘sh');
  const normalized = dartPartialLower(dartTrim(current)); return dartTrim(values.find(value => dartPartialLower(dartTrim(value)) === normalized) ?? values[0]);
}
export const adminItemCreateCanSelect = (session: Session, hasSelectionCallback = true) => session.profile.role !== 'sales_manager' && hasSelectionCallback && session.capabilities.includes('catalog.item.bulk_move');
export const adminItemCreateCanUseAdminComponents = (session: Session) => session.capabilities.includes('admin.access') || session.profile.role === 'brigader' && session.capabilities.includes('brigader.access');
export function adminItemCreateFilterGroups(groups: readonly string[], current: string): readonly string[] {
  return Object.freeze([...new Set([...groups.filter(group => dartTrim(group)).map(dartTrim), ...(current ? [current] : [])])]);
}
export function adminItemCreateRow(item: SupplierItem) {
  return { title: dartTrim(item.name) ? item.name : item.code, subtitle: [item.code, item.uom, item.item_group].map(dartTrim).filter(Boolean).join(' • ') };
}
export function validateAdminItemCreate(draft: AdminItemCreateDraft, uoms: readonly string[], tree: readonly AdminItemGroupTreeEntry[], sales: boolean) {
  const selected = uoms.find(value => dartPartialLower(dartTrim(value)) === dartPartialLower(dartTrim(draft.uom)));
  if (selected === undefined) return { error: { key: 'item.uom_required' } } as const;
  const group = dartTrim(draft.group), finished = adminItemGroupRequiresCustomer(group, tree);
  if (sales && !finished) return { error: { literal: 'Faqat tayyor mahsulot qo‘shish mumkin' } } as const;
  if (finished && !dartTrim(draft.name)) return { error: { key: 'item.name_required' } } as const;
  if (finished && draft.customer === null) return { error: { key: 'item.customer_required' } } as const;
  return { group, finished, uom: dartTrim(selected) } as const;
}
export function adminItemCreateFailure(error: unknown): Pick<AdminItemCreateNotice, 'literal' | 'key'> {
  return error instanceof MobileApiException ? { literal: error.message } : { key: 'item.create_failed' };
}
export function adminItemCreateCustomerSubtitle(customer: AdminItemCreateCustomer) { return dartTrim(customer.phone) ? `${customer.ref} • ${customer.phone}` : customer.ref; }
export function adminItemCreateSortedPicker<T>(items: readonly T[], query: string, title: (item: T) => string, subtitle: (item: T) => string): readonly T[] {
  if (!dartTrim(query) || items.length < 2) return items;
  return items.map((item, index) => ({ item, index })).sort((left, right) => searchRelevanceScore(query, title(right.item), [subtitle(right.item)]) -
    searchRelevanceScore(query, title(left.item), [subtitle(left.item)]) || left.index - right.index).map(row => row.item);
}
