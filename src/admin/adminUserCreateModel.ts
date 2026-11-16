import { searchRelevanceScore } from '../qolip/qolipSearchRelevance';
import { MobileApiException } from '../shared/mobileApiException';
import { adminUserPrincipalRoleFromJson, type AdminUserPrincipalRole } from './adminUsersModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

export type AdminUserCreateRole = Readonly<{ id: string; label: string; base_role: AdminUserPrincipalRole | null; capability_codes: readonly string[]; system: boolean }>;
export type AdminUserCreateKind = 'werka' | 'customer' | 'supplier' | 'material' | 'custom';
export type AdminUserCreateChoice = Readonly<{ kind: AdminUserCreateKind; role: AdminUserCreateRole | null }>;
export type AdminUserCreateCustomer = Readonly<{ ref: string; name: string; phone: string }>;
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid user create object'); return value as Record<string, unknown>; };
const text = (value: unknown) => { if (value == null) return ''; if (typeof value !== 'string') throw new TypeError('Invalid user create string'); return value; };
const listText = (value: unknown) => { if (typeof value !== 'string') throw new TypeError('Invalid user create list string'); return value; };
const bool = (value: unknown) => { if (value == null) return false; if (typeof value !== 'boolean') throw new TypeError('Invalid user create boolean'); return value; };
const list = (value: unknown): unknown[] => { if (value == null) return []; if (!Array.isArray(value)) throw new TypeError('Invalid user create list'); return value; };
/** @v2 AdminRoleDefinition */
export function adminUserCreateRoleFromJson(value: unknown): AdminUserCreateRole {
  const row = object(value); return Object.freeze({ id: text(row.id), label: text(row.label), base_role: row.base_role == null ? null : adminUserPrincipalRoleFromJson(text(row.base_role)),
    capability_codes: Object.freeze(list(row.capability_codes).map(listText)), system: bool(row.system) });
}
/** @v2 CustomerDirectoryEntry; existing native directory parser is private to the Werka adapter. */
export function adminUserCreateCustomerFromJson(value: unknown): AdminUserCreateCustomer {
  const row = object(value); return Object.freeze({ ref: text(row.ref), name: text(row.name), phone: text(row.phone) });
}
/** @v2 AdminSupplier */
export function adminUserCreateSupplierFromJson(value: unknown) {
  const row = object(value), count = row.assigned_item_count;
  if (count != null && (typeof count !== 'number' || !Number.isInteger(count))) throw new TypeError('Invalid supplier assigned count');
  return Object.freeze({ ...adminUserCreateCustomerFromJson(row), code: text(row.code), blocked: bool(row.blocked), removed: bool(row.removed),
    assigned_item_codes: Object.freeze(list(row.assigned_item_codes).map(listText)), assigned_item_count: count == null ? 0 : count as number });
}
export const adminUserCreateIsMaterial = (role: AdminUserCreateRole) => role.id === 'material_taminotchi' || role.base_role === 'material_taminotchi';
export function adminUserCreateKind(role: AdminUserCreateRole): AdminUserCreateKind {
  return adminUserCreateIsMaterial(role) ? 'material' : role.base_role === 'supplier' ? 'supplier' : role.base_role === 'customer' ? 'customer' :
    role.capability_codes.includes('supplier.access') ? 'supplier' : role.capability_codes.includes('customer.access') ? 'customer' : role.capability_codes.includes('werka.access') ? 'werka' : 'custom';
}
const fallbackMaterial: AdminUserCreateRole = Object.freeze({ id: 'material_taminotchi', label: 'Material taminotchisi', base_role: 'material_taminotchi',
  capability_codes: Object.freeze(['gscale.catalog.read', 'gscale.print', 'rps.batch.manage', 'catalog.item.create', 'raw_material.assign']), system: true });
const fallbackBoyoqchi: AdminUserCreateRole = Object.freeze({ id: 'boyoqchi', label: 'Bo‘yoqchi', base_role: 'boyoqchi', capability_codes: Object.freeze(['boyoqchi.access', 'returned_paint.request.read']), system: true });
const custom = (role: AdminUserCreateRole): AdminUserCreateChoice => Object.freeze({ kind: adminUserCreateKind(role), role });
export const adminUserCreateCustomerChoice: AdminUserCreateChoice = Object.freeze({ kind: 'customer', role: null });
/** @v2 _loadRoleChoices; fallback custom metadata survives but is disabled because V2 null-asserts its missing role. */
export function adminUserCreateChoices(roles: readonly AdminUserCreateRole[] | null, principalRole: string, capabilities: readonly string[]): readonly AdminUserCreateChoice[] {
  const assignable = (roles ?? []).filter(role => (!role.system || !['admin', 'werka', 'supplier', 'customer'].includes(role.id)) &&
    (principalRole !== 'brigader' || role.system || role.capability_codes.every(code => capabilities.includes(code))));
  const material = assignable.filter(adminUserCreateIsMaterial), others = assignable.filter(role => !adminUserCreateIsMaterial(role));
  return Object.freeze([...material.map(custom), ...(material.length ? [] : [custom(fallbackMaterial)]), ...others.map(custom),
    ...(assignable.some(role => role.id === 'boyoqchi') ? [] : [custom(fallbackBoyoqchi)]), ...(['werka', 'customer', 'supplier', 'custom'] as const).map(kind => Object.freeze({ kind, role: null }))]);
}
type Text = (key: string, values?: Record<string, unknown>) => string;
const kindKey: Record<AdminUserCreateKind, string> = { werka: 'warehouse_worker', customer: 'customer', supplier: 'supplier', material: 'material_supplier', custom: 'custom_role' };
export const adminUserCreateChoiceLabel = (choice: AdminUserCreateChoice, a: Text) => choice.role?.label ?? a(`user.${kindKey[choice.kind]}`);
export const adminUserCreateChoiceSubtitle = (choice: AdminUserCreateChoice, a: Text) => a(`user.${kindKey[choice.kind]}_subtitle`);
export const adminUserCreateChoiceEnabled = (choice: AdminUserCreateChoice) => choice.kind !== 'custom' || choice.role !== null;
export function adminUserCreateVisibleChoices(choices: readonly AdminUserCreateChoice[], query: string, a: Text) {
  const normalized = dartPartialLower(dartTrim(query));
  const matches = choices.map((choice, index) => ({ choice, index, title: adminUserCreateChoiceLabel(choice, a), subtitle: adminUserCreateChoiceSubtitle(choice, a) }))
    .filter(row => !normalized || dartPartialLower(row.title).includes(normalized) || dartPartialLower(row.subtitle).includes(normalized));
  if (normalized && matches.length > 1) matches.sort((l, r) => searchRelevanceScore(query, r.title, [r.subtitle]) - searchRelevanceScore(query, l.title, [l.subtitle]) || l.index - r.index);
  return matches;
}
export const adminUserCreateGroups = (values: Iterable<string>): readonly string[] => Object.freeze([...new Set([...values].map(dartTrim).filter(Boolean))].sort());
/** Predicates follow current052; Metalayzer is local Admin data, without broadening authentication role acceptance. */
export function adminUserCreateSystemRole(role: AdminUserCreateRole): AdminUserPrincipalRole | null {
  return ['metalayzer', 'rezka_master', 'brigader', 'sales_manager', 'homashyo_rezkachi', 'tayyorlov_masteri'].includes(role.base_role ?? '') ? role.base_role :
    role.id === 'boyoqchi' ? 'boyoqchi' : role.id === 'qolipchi' ? 'qolipchi' : null;
}
export function adminUserCreatePrincipalRole(role: AdminUserCreateRole): AdminUserPrincipalRole {
  return adminUserCreateIsMaterial(role) ? 'material_taminotchi' : role.id === 'aparatchi' ? 'aparatchi' : role.id === 'qolipchi' ? 'qolipchi' : role.id === 'boyoqchi' ? 'boyoqchi' : role.base_role ?? 'customer';
}
export function adminUserCreateError(error: unknown, a: Text): string { return error instanceof MobileApiException && dartTrim(error.message) ? dartTrim(error.message) : a('user.create_failed'); }
export function adminUserCreateCustomerError(error: unknown, name: string, a: Text): string {
  const code = error instanceof MobileApiException ? error.code : '', key = code === 'invalid phone' ? 'user.phone_invalid' : code === 'phone already exists' ? 'user.phone_exists' : code === 'customer name is required' ? 'user.name_required' : null;
  return a('user.customer_create_failed', { name: dartTrim(name) }) + (key ? `\n${a(key)}` : '');
}
