import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { sessionReadScope } from '../sessionReadScope';
import { preparationGuard, preparationResponse, withQuery } from './preparationRequest';

export const materialStockTabs = ['available', 'receipts', 'issues'] as const;
export type MaterialStockTab = typeof materialStockTabs[number];
export type MaterialStockRow = { id: string; barcode: string; has_qr: boolean; kg: string; created_at: string;
  event_type: string; actor_name: string; order_code: string; width_mm: string | null; micron: string | null; length_m: string | null };
export type MaterialStockSummary = { available_kg: string; receipt_kg: string; issue_kg: string;
  available_count: number; receipt_count: number; issue_count: number };
export type MaterialStockPage = { item_code: string; item_name: string; warehouse: string; tab: MaterialStockTab;
  summary: MaterialStockSummary; rows: MaterialStockRow[]; offset: number; limit: number; has_more: boolean };

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid material stock object');
  return value as Record<string, unknown>;
};
const text = (value: unknown): string => { if (typeof value !== 'string') throw new TypeError('Invalid material stock text'); return value; };
const quantity = (value: unknown): string => {
  const result = text(value); if (!/^\d+(?:\.\d+)?$/.test(result)) throw new TypeError('Invalid material stock quantity'); return result;
};
const count = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid material stock count'); return value;
};
export function materialStockPageFromJson(value: unknown): MaterialStockPage {
  const row = object(value), summary = object(row.summary);
  if (!materialStockTabs.includes(row.tab as MaterialStockTab) || !Array.isArray(row.rows) || typeof row.has_more !== 'boolean')
    throw new TypeError('Invalid material stock page');
  const result: MaterialStockPage = { item_code: text(row.item_code), item_name: text(row.item_name), warehouse: text(row.warehouse), tab: row.tab as MaterialStockTab,
    summary: { available_kg: quantity(summary.available_kg), receipt_kg: quantity(summary.receipt_kg), issue_kg: quantity(summary.issue_kg),
      available_count: count(summary.available_count), receipt_count: count(summary.receipt_count), issue_count: count(summary.issue_count) },
    rows: row.rows.map(value => {
      const item = object(value);
      if (typeof item.has_qr !== 'boolean') throw new TypeError('Invalid material stock QR');
      return { id: text(item.id), barcode: text(item.barcode), has_qr: item.has_qr, kg: quantity(item.kg), created_at: text(item.created_at),
        event_type: text(item.event_type), actor_name: text(item.actor_name), order_code: text(item.order_code),
        width_mm: item.width_mm == null ? null : quantity(item.width_mm), micron: item.micron == null ? null : quantity(item.micron),
        length_m: item.length_m == null ? null : quantity(item.length_m) };
    }), offset: count(row.offset), limit: count(row.limit), has_more: row.has_more };
  if (!result.limit || result.rows.length > result.limit || (result.has_more && result.rows.length !== result.limit) ||
      result.rows.some(item => !item.id) || new Set(result.rows.map(item => item.id)).size !== result.rows.length)
    throw new TypeError('Invalid material stock window');
  return result;
}

export async function preparationMaterialStock(session: Session, warehouse: string, itemCode: string, tab: MaterialStockTab, offset = 0) {
  if (!warehouse.trim() || !itemCode.trim() || !materialStockTabs.includes(tab) || !Number.isSafeInteger(offset) || offset < 0)
    throw new Error('Ombor yoki homashyo tanlanmagan');
  const scope = sessionReadScope(session), accountGuard = preparationGuard(session);
  const guard = () => { accountGuard(); if (scope !== sessionReadScope(session)) throw new Error('Akkaunt o‘zgargan'); };
  const response = await authorizedFetch(session, withQuery('/v1/mobile/preparation/material-stock', {
    warehouse: warehouse.trim(), item_code: itemCode.trim(), tab, offset: String(offset), limit: '50',
  }), {}, guard);
  guard();
  const page = materialStockPageFromJson(await preparationResponse(response));
  if (page.item_code.toLowerCase() !== itemCode.trim().toLowerCase() || page.warehouse.toLowerCase() !== warehouse.trim().toLowerCase() || page.tab !== tab || page.offset !== offset)
    throw new Error('Homashyo ro‘yxati mos kelmadi');
  return page;
}
