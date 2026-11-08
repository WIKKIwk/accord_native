type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid item group');
  return value as ObjectValue;
}
function nullableString(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid item group string');
  return value;
}
function nullableBool(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== 'boolean') throw new TypeError('Invalid item group boolean');
  return value;
}
function nullableInt(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new TypeError('Invalid item group count');
  return value;
}
function nullableStringList(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new TypeError('Invalid item codes');
  return value;
}

/** @v2 AdminItemGroupTreeEntry */
export type AdminItemGroupTreeEntry = { name: string; item_group_name: string; parent_item_group: string; is_group: boolean };
/** @v2 AdminItemGroup */
export type AdminItemGroup = AdminItemGroupTreeEntry;
export function adminItemGroupFromJson(value: unknown): AdminItemGroup {
  const row = object(value);
  return { name: nullableString(row.name), item_group_name: nullableString(row.item_group_name),
    parent_item_group: nullableString(row.parent_item_group), is_group: nullableBool(row.is_group) };
}

/** @v2 AdminItemGroupBulkMoveResult */
export type AdminItemGroupBulkMoveResult = { item_group: string; requested_count: number; updated_count: number;
  failed_count: number; updated_item_codes: string[]; failed_item_codes: string[] };
export function adminItemGroupBulkMoveResultFromJson(value: unknown): AdminItemGroupBulkMoveResult {
  const row = object(value);
  return { item_group: nullableString(row.item_group), requested_count: nullableInt(row.requested_count),
    updated_count: nullableInt(row.updated_count), failed_count: nullableInt(row.failed_count),
    updated_item_codes: nullableStringList(row.updated_item_codes), failed_item_codes: nullableStringList(row.failed_item_codes) };
}

/** @v2 adminItemGroupRequiresCustomer */
export function adminItemGroupRequiresCustomer(itemGroup: string, groups: readonly AdminItemGroupTreeEntry[]): boolean {
  let current = itemGroup.trim();
  const seen = new Set<string>();
  while (current && !seen.has(current.toLowerCase())) {
    const normalized = current.toLowerCase();
    seen.add(normalized);
    if (normalized === 'tayyor mahsulot') return true;
    const matched = groups.find(group => {
      const name = group.item_group_name.trim() || group.name.trim();
      return name.toLowerCase() === normalized || group.name.trim().toLowerCase() === normalized;
    });
    if (!matched) break;
    current = matched.parent_item_group.trim();
  }
  return false;
}
