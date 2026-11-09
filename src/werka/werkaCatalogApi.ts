import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { searchActivityStore, supplierItemFromJson, type SupplierItem } from '../shared/catalogApi';
import { searchMatches } from '../shared/searchNormalizer';
import type { CustomerDirectoryEntry, CustomerItemOption } from './werkaArchiveBatchQr';
import { werkaCustomers } from './werkaDirectoryApi';

type Obj = Record<string, unknown>;
type Page = { query?: string; limit?: number; offset?: number };
const object = (value: unknown): Obj => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid customer item');
  return value as Obj;
};
const string = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid customer item string');
  return value;
};
const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
function compareCustomerNames(left: string, right: string): number {
  const l = left.trim().toLowerCase(), r = right.trim().toLowerCase();
  return (l === 'saidamin' ? 1 : 0) - (r === 'saidamin' ? 1 : 0) || compare(l, r);
}
function compareItems(left: SupplierItem, right: SupplierItem): number {
  return compare(left.name.toLowerCase(), right.name.toLowerCase()) || compare(left.code.toLowerCase(), right.code.toLowerCase());
}
function compareOptions(left: CustomerItemOption, right: CustomerItemOption): number {
  return compare(left.itemName.toLowerCase(), right.itemName.toLowerCase()) ||
    compareCustomerNames(left.customerName, right.customerName) || compare(left.itemCode.toLowerCase(), right.itemCode.toLowerCase());
}
function pagePath(path: string, options: Page, defaultLimit: number, identity?: [string, string]): string {
  const query = new URLSearchParams(), limit = options.limit ?? defaultLimit, offset = options.offset ?? 0;
  if (identity) query.set(identity[0], identity[1]);
  if (options.query?.trim()) query.set('q', options.query.trim());
  if (limit > 0) query.set('limit', String(limit));
  if (offset > 0) query.set('offset', String(offset));
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}
async function list(response: Response): Promise<unknown[]> {
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new TypeError('Invalid catalog list');
  return data;
}
/** @v2 CustomerItemOption */
export function customerItemOptionFromJson(value: unknown): CustomerItemOption {
  const row = object(value);
  return { customerRef: string(row.customer_ref), customerName: string(row.customer_name), customerPhone: string(row.customer_phone),
    itemCode: string(row.item_code), itemName: string(row.item_name), uom: string(row.uom), warehouse: string(row.warehouse) };
}
const customerMatches = (customer: CustomerDirectoryEntry, query: string) =>
  searchMatches(query, [customer.name, customer.phone, customer.ref]);
const optionMatches = (option: CustomerItemOption, query: string) =>
  searchMatches(query, [option.itemName, option.itemCode, option.customerName, option.customerPhone, option.customerRef]);

async function itemPage(session: Session, path: string, identity: [string, string], options: Page, error: string): Promise<SupplierItem[]> {
  const response = await authorizedFetch(session, pagePath(path, options, 100, identity));
  if (response.status !== 200) throw new Error(error);
  return searchActivityStore.sortByItemCode(session, (await list(response)).map(supplierItemFromJson), item => item.code, compareItems);
}
/** @v2 werkaSupplierItems */
export async function werkaSupplierItems(session: Session, supplierRef: string, options: Page = {}): Promise<SupplierItem[]> {
  return itemPage(session, '/v1/mobile/werka/supplier-items', ['supplier_ref', supplierRef], options, 'Werka supplier items failed');
}
/** @v2 werkaCustomerItems */
export async function werkaCustomerItems(session: Session, customerRef: string, options: Page = {}): Promise<SupplierItem[]> {
  return itemPage(session, '/v1/mobile/werka/customer-items', ['customer_ref', customerRef], options, 'Werka customer items failed');
}

async function fallbackCustomerItemOptions(session: Session, query: string): Promise<CustomerItemOption[]> {
  const customers = await werkaCustomers(session), normalized = query.toLowerCase();
  const groups = await Promise.all(customers.map(async customer => {
    const matches = normalized !== '' && customerMatches(customer, normalized);
    const items = await werkaCustomerItems(session, customer.ref, { query: matches ? '' : query });
    return items.map(item => ({ customerRef: customer.ref, customerName: customer.name, customerPhone: customer.phone,
      itemCode: item.code, itemName: item.name, uom: item.uom, warehouse: item.warehouse }));
  }));
  const seen = new Set<string>(), filtered: CustomerItemOption[] = [];
  for (const options of groups) for (const option of options) {
    if (normalized && !optionMatches(option, normalized)) continue;
    const key = `${option.customerRef}|${option.itemCode}`;
    if (seen.has(key)) continue;
    seen.add(key); filtered.push(option);
  }
  return searchActivityStore.sortByItemCode(session, filtered, option => option.itemCode, compareOptions);
}

/** @v2 werkaCustomerItemOptions */
export async function werkaCustomerItemOptions(session: Session, options: Page = {}): Promise<CustomerItemOption[]> {
  const query = options.query?.trim() ?? '';
  const response = await authorizedFetch(session, pagePath('/v1/mobile/werka/customer-item-options', { ...options, query }, 200));
  if (response.status !== 200) return fallbackCustomerItemOptions(session, query);
  return searchActivityStore.sortByItemCode(session, (await list(response)).map(customerItemOptionFromJson), option => option.itemCode, compareOptions);
}

/** @v2 werkaCustomersForItem */
export async function werkaCustomersForItem(session: Session, input: Page & { itemCode: string; itemName?: string }): Promise<CustomerDirectoryEntry[]> {
  const code = input.itemCode.trim(), name = input.itemName?.trim() ?? '', candidates: CustomerDirectoryEntry[] = [], seen = new Set<string>();
  const collect = async (lookup: string) => {
    if (!lookup.trim()) return;
    const options = await werkaCustomerItemOptions(session, { query: lookup, limit: 200, offset: 0 });
    for (const option of options) {
      if (code && option.itemCode.trim().toLowerCase() !== code.toLowerCase()) continue;
      const customer = { ref: option.customerRef, name: option.customerName, phone: option.customerPhone }, key = customer.ref.trim();
      if (seen.has(key)) continue;
      seen.add(key); candidates.push(customer);
    }
  };
  await collect(code);
  if (!candidates.length && name) await collect(name);
  const query = input.query?.trim().toLowerCase() ?? '';
  const filtered = (query ? candidates.filter(customer => customerMatches(customer, query)) : candidates)
    .sort((left, right) => compareCustomerNames(left.name, right.name));
  const offset = input.offset ?? 0, limit = input.limit ?? 200;
  if (offset >= filtered.length) return [];
  const end = Math.min(offset + limit, filtered.length);
  if (!Number.isInteger(offset) || !Number.isInteger(end) || offset < 0 || end < offset) throw new RangeError('Invalid customer page');
  return filtered.slice(offset, end);
}
