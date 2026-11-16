import { supplierItemFromJson, type SupplierItem } from '../shared/catalogApi';

/** @v2 AdminSupplierDetail */
export type AdminSupplierDetail = Readonly<{ ref: string; name: string; phone: string; avatar_url: string; code: string;
  blocked: boolean; removed: boolean; code_locked: boolean; code_retry_after_sec: number; assigned_items: readonly SupplierItem[] }>;
export function adminSupplierDetailFromJson(value: unknown): AdminSupplierDetail {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid supplier detail');
  const row = value as Record<string, unknown>;
  const text = (value: unknown) => { if (value == null) return ''; if (typeof value !== 'string') throw new TypeError('Invalid supplier detail string'); return value; };
  const bool = (value: unknown) => { if (value == null) return false; if (typeof value !== 'boolean') throw new TypeError('Invalid supplier detail boolean'); return value; };
  const integer = (value: unknown) => { if (value == null) return 0; if (typeof value !== 'number' || !Number.isInteger(value)) throw new TypeError('Invalid supplier retry seconds'); return value; };
  const items = row.assigned_items ?? []; if (!Array.isArray(items)) throw new TypeError('Invalid supplier assigned items');
  return Object.freeze({ ref: text(row.ref), name: text(row.name), phone: text(row.phone), avatar_url: text(row.avatar_url), code: text(row.code),
    blocked: bool(row.blocked), removed: bool(row.removed), code_locked: bool(row.code_locked), code_retry_after_sec: integer(row.code_retry_after_sec),
    assigned_items: Object.freeze(items.map(supplierItemFromJson)) });
}
