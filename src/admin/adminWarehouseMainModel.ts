import type { RawMaterialStock } from '../shared/printApi';
import type { AdminRawMaterialAssignment } from '../workerRawMaterials';
import type { qolipProductFromJson } from '../qolipCatalogApi';
import { dartPartialLower, dartTrim } from './dartJsonString';
const normalized = (value: string) => dartPartialLower(dartTrim(value));
export function adminWarehouseMainUniqueNames(values: Iterable<string>): string[] {
  const seen = new Set<string>(), names: string[] = [];
  for (const value of values) { const name = dartTrim(value), key = normalized(name); if (key && !seen.has(key)) { seen.add(key); names.push(name); } }
  return names;
}
/** @v2 _isQolipWarehouseName + _warehouseNameMatches */
export function adminWarehouseMainIsQolip(warehouse: string | null, names: readonly string[], adminScoped: boolean): boolean {
  const name = normalized(warehouse ?? ''); return adminScoped && !!name &&
    (name === 'qolip ombor' || name === 'qolip ombori' || names.some(value => normalized(value) === name));
}
export function adminWarehouseMainIsReserved(stock: RawMaterialStock): boolean { return !!dartTrim(stock.reserved_order_id) || ['reserved', 'band'].includes(normalized(stock.status)); }
export function adminWarehouseMainAvailableStock(stock: readonly RawMaterialStock[]): RawMaterialStock[] {
  return stock.filter(row => normalized(row.status) === 'available' && !adminWarehouseMainIsReserved(row));
}
export function adminWarehouseMainReservedStock(stock: readonly RawMaterialStock[]): RawMaterialStock[] { return stock.filter(adminWarehouseMainIsReserved); }
export function adminWarehouseMainReservedCount(stock: readonly RawMaterialStock[], reservations: readonly AdminRawMaterialAssignment[]): number {
  return reservations.length || adminWarehouseMainReservedStock(stock).length;
}
export function adminWarehouseMainCanEditStock(stock: RawMaterialStock, reservations: readonly AdminRawMaterialAssignment[]): boolean {
  const barcode = normalized(stock.barcode);
  return !!barcode && normalized(stock.status) === 'available' && !dartTrim(stock.reserved_order_id) && !reservations.some(row => normalized(row.barcode) === barcode);
}
type Product = ReturnType<typeof qolipProductFromJson>;
export type AdminWarehouseMainQolipGroup = { code: string; name: string; itemGroup: string; qolips: Product[] };
/** @v2 _groupAdminQolipProducts */
export function adminWarehouseMainQolipGroups(products: readonly Product[]): AdminWarehouseMainQolipGroup[] {
  const groups = new Map<string, AdminWarehouseMainQolipGroup>();
  for (const product of products) {
    const code = dartTrim(product.code), name = dartTrim(product.name), key = normalized(code || name), qolip = normalized(product.qolip_code);
    if (!key || !qolip) continue;
    let group = groups.get(key); if (!group) { group = { code, name, itemGroup: dartTrim(product.item_group), qolips: [] }; groups.set(key, group); }
    if (!group.qolips.some(row => normalized(row.qolip_code) === qolip)) group.qolips.push(product);
  }
  const label = (group: AdminWarehouseMainQolipGroup) => normalized(group.name || group.code);
  return [...groups.values()].sort((left, right) => label(left) < label(right) ? -1 : label(left) > label(right) ? 1 : 0);
}
