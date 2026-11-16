import { supplierItemFromJson, type SupplierItem } from '../shared/catalogApi';
import { dartJsonString, dartPartialLower, dartTrim } from './dartJsonString';

/** @v2 AdminCustomerDetail */
export type AdminCustomerDetail = Readonly<{ ref: string; name: string; phone: string; avatar_url: string; code: string;
  code_locked: boolean; code_retry_after_sec: number; assigned_items: readonly SupplierItem[]; assigned_item_groups: readonly string[]; assigned_warehouses: readonly string[] }>;
export function adminCustomerDetailFromJson(value: unknown): AdminCustomerDetail {
  const row = adminCustomerDetailObject(value);
  const text = (value: unknown) => { if (value == null) return ''; if (typeof value !== 'string') throw new TypeError('Invalid customer detail string'); return value; };
  const bool = (value: unknown) => { if (value == null) return false; if (typeof value !== 'boolean') throw new TypeError('Invalid customer detail boolean'); return value; };
  const integer = (value: unknown) => { if (value == null) return 0; if (typeof value !== 'number' || !Number.isInteger(value)) throw new TypeError('Invalid customer retry seconds'); return value; };
  const list = (value: unknown) => { if (value == null) return []; if (!Array.isArray(value)) throw new TypeError('Invalid customer detail list'); return value; };
  return Object.freeze({ ref: text(row.ref), name: text(row.name), phone: text(row.phone), avatar_url: text(row.avatar_url), code: text(row.code),
    code_locked: bool(row.code_locked), code_retry_after_sec: integer(row.code_retry_after_sec), assigned_items: Object.freeze(list(row.assigned_items).map(supplierItemFromJson)),
    assigned_item_groups: Object.freeze(list(row.assigned_item_groups).map(dartJsonString)), assigned_warehouses: Object.freeze(list(row.assigned_warehouses).map(dartJsonString)) });
}
export function adminCustomerDetailObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid customer detail object'); return value as Record<string, unknown>;
}
/** @v2 _normalizedScopeValues and _normalizedAdminScopeValues */
export function adminCustomerScopeValues(values: Iterable<string>): string[] {
  const byKey = new Map<string, string>(); for (const value of values) { const normalized = dartTrim(value); if (normalized && !byKey.has(dartPartialLower(normalized))) byKey.set(dartPartialLower(normalized), normalized); }
  return [...byKey.values()].sort((a, b) => { const left = dartPartialLower(a), right = dartPartialLower(b); return left < right ? -1 : left > right ? 1 : 0; });
}
/** @v2 _sameScopeValues */
export function adminCustomerSameScope(left: Iterable<string>, right: Iterable<string>): boolean {
  const a = new Set(adminCustomerScopeValues(left).map(dartPartialLower)), b = new Set(adminCustomerScopeValues(right).map(dartPartialLower)); return a.size === b.size && [...a].every(key => b.has(key));
}
/** @v2 _operationErrorMessage */
export function adminCustomerOperationError(fallback: string, error: unknown): string {
  const message = dartTrim(String(error)); return !message || message.startsWith('Exception:') || dartPartialLower(message) === dartPartialLower(fallback) ? fallback : `${fallback}: ${message}`;
}
