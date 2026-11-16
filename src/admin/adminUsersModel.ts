import { adminText } from '../shared/localization';
import { appRoutes } from '../shared/appRoutes';
import { isCanonicalApparatusId } from '../workerControlsApi';
import { dartJsonString, dartPartialLower, dartTrim } from './dartJsonString';

/** @v2 AdminUserKind; 052655a adds Metalayzer after the pinned f119 role choices. */
export type AdminUserKind = 'supplier' | 'werka' | 'customer' | 'worker' | 'qolipchi' | 'boyoqchi' |
  'tayyorlovMasteri' | 'materialTaminotchi' | 'homashyoRezkachi' | 'salesManager' | 'brigader' | 'rezkaMaster' | 'metalayzer';
export type AdminUserPrincipalRole = 'supplier' | 'werka' | 'customer' | 'aparatchi' | 'qolipchi' | 'boyoqchi' |
  'tayyorlov_masteri' | 'material_taminotchi' | 'admin' | 'homashyo_rezkachi' | 'sales_manager' | 'brigader' | 'rezka_master' | 'metalayzer';
/** @v2 _adminUserTabKinds; the new role stays local to Admin list data, not authentication. */
export const adminUserKinds: readonly AdminUserKind[] = Object.freeze(['werka', 'customer', 'supplier', 'materialTaminotchi',
  'worker', 'qolipchi', 'boyoqchi', 'tayyorlovMasteri', 'homashyoRezkachi', 'salesManager', 'brigader', 'rezkaMaster', 'metalayzer']);
const kindRole: Record<AdminUserKind, string> = { supplier: 'supplier', werka: 'werka', customer: 'customer', worker: 'worker',
  qolipchi: 'qolipchi', boyoqchi: 'boyoqchi', tayyorlovMasteri: 'tayyorlov_masteri', materialTaminotchi: 'material_taminotchi',
  homashyoRezkachi: 'homashyo_rezkachi', salesManager: 'sales_manager', brigader: 'brigader', rezkaMaster: 'rezka_master', metalayzer: 'metalayzer' };
const roles = new Set<AdminUserPrincipalRole>(['supplier', 'werka', 'customer', 'aparatchi', 'qolipchi', 'boyoqchi',
  'tayyorlov_masteri', 'material_taminotchi', 'admin', 'homashyo_rezkachi', 'sales_manager', 'brigader', 'rezka_master', 'metalayzer']);
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid admin user object');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid admin user string');
  return value;
}
function bool(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== 'boolean') throw new TypeError('Invalid admin user boolean');
  return value;
}
function list(value: unknown): readonly unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Invalid admin user list');
  return value;
}
/** @v2 userRoleFromJson, scoped to Admin list data so authentication role acceptance is unchanged. */
export function adminUserPrincipalRoleFromJson(value: unknown): AdminUserPrincipalRole {
  const raw = dartPartialLower(dartTrim(text(value))), normalized = raw === 'omborchi' ? 'werka' : raw;
  if (!roles.has(normalized as AdminUserPrincipalRole)) throw new TypeError(`Unsupported user role: ${dartJsonString(value ?? null)}`);
  return normalized as AdminUserPrincipalRole;
}
/** @v2 AdminUserListEntry */
export type AdminUserListEntry = Readonly<{ id: string; name: string; phone: string; kind: AdminUserKind;
  avatar_url: string; principal_role: AdminUserPrincipalRole; blocked: boolean; role_label: string | null;
  apparatus_display: string; apparatus_id: string }>;
export type AdminUserListPage = Readonly<{ items: readonly AdminUserListEntry[]; has_more: boolean }>;
/** @v2 AdminUserListEntry.fromJson, current 052655a (Metalayzer has first kind precedence). */
export function adminUserListEntryFromJson(value: unknown): AdminUserListEntry {
  const row = object(value), source = dartPartialLower(dartTrim(text(row.source)));
  const role = adminUserPrincipalRoleFromJson(row.principal_role ?? source);
  const kind: AdminUserKind = role === 'metalayzer' ? 'metalayzer' : role === 'rezka_master' ? 'rezkaMaster' :
    role === 'brigader' ? 'brigader' : role === 'sales_manager' ? 'salesManager' : role === 'homashyo_rezkachi' ? 'homashyoRezkachi' :
    role === 'tayyorlov_masteri' ? 'tayyorlovMasteri' : source === 'worker' ? 'worker' : source === 'werka' || role === 'werka' ? 'werka' :
    role === 'material_taminotchi' ? 'materialTaminotchi' : source === 'customer' || role === 'customer' ? 'customer' :
    role === 'qolipchi' ? 'qolipchi' : role === 'boyoqchi' ? 'boyoqchi' : 'supplier';
  return Object.freeze({ id: dartTrim(text(row.entity_ref)) || dartTrim(text(row.id)), name: text(row.name), phone: text(row.phone), kind,
    avatar_url: text(row.avatar_url), principal_role: role, blocked: bool(row.blocked), role_label: row.role_label == null ? null : text(row.role_label),
    apparatus_display: dartTrim(text(row.apparatus_display)), apparatus_id: dartTrim(text(row.apparatus_id)) });
}
/** @v2 AdminUserListPage.fromJson */
export function adminUserListPageFromJson(value: unknown): AdminUserListPage {
  const row = object(value);
  return Object.freeze({ items: Object.freeze(list(row.items).map(adminUserListEntryFromJson)), has_more: bool(row.has_more) });
}
/** @v2 AdminRoleAssignment */
export type AdminRoleAssignment = Readonly<{ principal_role: AdminUserPrincipalRole; principal_ref: string; role_id: string;
  assigned_apparatus: readonly string[]; assigned_item_groups: readonly string[] }>;
export function adminRoleAssignmentFromJson(value: unknown): AdminRoleAssignment {
  const row = object(value), apparatus: string[] = [];
  for (const item of list(row.assigned_apparatus)) {
    const id = dartTrim(dartJsonString(item));
    if (!isCanonicalApparatusId(id)) throw new TypeError('Canonical apparatus ID list is invalid');
    if (!apparatus.includes(id)) apparatus.push(id);
  }
  return Object.freeze({ principal_role: adminUserPrincipalRoleFromJson(row.principal_role), principal_ref: text(row.principal_ref), role_id: text(row.role_id),
    assigned_apparatus: Object.freeze(apparatus), assigned_item_groups: Object.freeze(list(row.assigned_item_groups).map(item => {
      if (typeof item !== 'string') throw new TypeError('Invalid assigned item group'); return item;
    })) });
}
/** @v2 _adminUserKindRoleQuery */
export const adminUserKindRoleQuery = (kind: AdminUserKind): string => kindRole[kind];
/** @v2 _adminUserKindUsesWorkers; intentionally false even for worker in f119 and 052. */
export const adminUserKindUsesWorkers = (_kind: AdminUserKind | null): false => false;
/** @v2 _adminUserKindLabel */
export function adminUserKindLabel(kind: AdminUserKind, locale: string): string {
  const keys: Partial<Record<AdminUserKind, string>> = { werka: 'werka', customer: 'customer', supplier: 'supplier',
    materialTaminotchi: 'material_supplier', worker: 'worker', qolipchi: 'mold_maker', boyoqchi: 'painter' };
  const key = keys[kind];
  return key ? adminText(`users.kind.${key}`, locale) : fixedRoleLabel(kind)!;
}
function fixedRoleLabel(kind: AdminUserKind): string | undefined {
  return ({ metalayzer: 'Metalayzer', rezkaMaster: 'Rezka master', brigader: 'Brigader', salesManager: 'Sotuv manageri',
    tayyorlovMasteri: 'Tayyorlov masteri', homashyoRezkachi: 'Homashyo rezkachisi' } as Partial<Record<AdminUserKind, string>>)[kind];
}
/** @v2 AdminUserListEntry.roleLabel */
export function adminUserRoleLabel(item: AdminUserListEntry): string {
  const fixed = fixedRoleLabel(item.kind); if (fixed) return fixed;
  const override = dartTrim(item.role_label ?? ''), apparatus = dartTrim(item.apparatus_display);
  const display = apparatus && !apparatus.includes(':') && !apparatus.startsWith('apparatus') ? apparatus : '';
  if (override) return display && !dartPartialLower(override).startsWith(dartPartialLower(display)) ? `${display} ${override}` : override;
  const workerRoleLabels: Record<AdminUserPrincipalRole, string> = { supplier: "Ta'minotchi", werka: 'Werka', customer: 'Haridor',
    aparatchi: 'Aparatchi', qolipchi: 'Qolipchi', boyoqchi: 'Bo‘yoqchi', tayyorlov_masteri: 'Tayyorlov masteri',
    material_taminotchi: "Material ta'minotchisi", admin: 'Admin', homashyo_rezkachi: 'Homashyo rezkachisi',
    sales_manager: 'Sotuv manageri', brigader: 'Brigader', rezka_master: 'Rezka master', metalayzer: 'Metalayzer' };
  return item.kind === 'werka' ? 'Werka' : item.kind === 'customer' ? 'Customer' : item.kind === 'qolipchi' ? 'Qolipchi' :
    item.kind === 'boyoqchi' ? 'Bo‘yoqchi' : item.kind === 'materialTaminotchi' ? 'Material taminotchisi' :
    item.kind === 'worker' ? `${display ? `${display} ` : ''}${workerRoleLabels[item.principal_role]}` : 'Supplier';
}
/** @v2 _matchesLocalSearch */
export function adminUserMatchesSearch(item: AdminUserListEntry, query: string): boolean {
  const needle = dartPartialLower(dartTrim(query));
  return !needle || [item.name, item.phone, item.id, adminUserRoleLabel(item)].some(value => dartPartialLower(value).includes(needle));
}
/** @v2 _visibleItems; role assignment refs compare case-insensitively for material membership. */
export function adminUsersVisibleItems(items: readonly AdminUserListEntry[], assignments: readonly AdminRoleAssignment[],
  kind: AdminUserKind | null, locale: string): readonly AdminUserListEntry[] {
  if (kind === null) return [];
  const material = (item: AdminUserListEntry) => item.kind === 'materialTaminotchi' || item.principal_role === 'material_taminotchi' ||
    assignments.some(assignment => dartPartialLower(dartTrim(assignment.principal_ref)) === dartPartialLower(dartTrim(item.id)) &&
      (assignment.principal_role === 'material_taminotchi' || dartTrim(assignment.role_id) === 'material_taminotchi'));
  return items.filter(item => kind === 'materialTaminotchi' ? material(item) : kind === 'customer' ? item.kind === kind && !material(item) : item.kind === kind)
    .map(item => kind !== 'materialTaminotchi' || (item.kind === kind && item.principal_role === 'material_taminotchi') ? item : Object.freeze({
      ...item, kind: 'materialTaminotchi' as const, principal_role: 'material_taminotchi' as const,
      role_label: adminText('users.kind.material_supplier', locale), apparatus_display: '', apparatus_id: '' }));
}
/** @v2 _openUser; pure target metadata only, no route exposure. */
export function adminUserDetailRoute(item: AdminUserListEntry): string {
  return ['worker', 'qolipchi', 'boyoqchi', 'tayyorlovMasteri', 'homashyoRezkachi', 'salesManager', 'brigader', 'rezkaMaster', 'metalayzer'].includes(item.kind)
    ? appRoutes.adminWorkerDetail : item.kind === 'werka' ? appRoutes.adminWerka :
      item.kind === 'customer' || item.kind === 'materialTaminotchi' ? appRoutes.adminCustomerDetail : appRoutes.adminSupplierDetail;
}
/** @v2 _buildLoadedUserList showFooter excludes all system-user kinds, including Metalayzer in 052. */
export function adminUsersShowFooter(kind: AdminUserKind | null, visibleCount: number, loadingMore: boolean, hasMore: boolean): boolean {
  return kind !== null && !['qolipchi', 'boyoqchi', 'tayyorlovMasteri', 'homashyoRezkachi', 'salesManager', 'brigader', 'rezkaMaster', 'metalayzer'].includes(kind) &&
    visibleCount > 0 && (loadingMore || hasMore);
}
