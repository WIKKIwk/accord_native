import type { closedProductionOrderFromJson } from '../workerClosedOrders';
import type { AdminWorkMapPage } from './adminWorkMapController';
import { dartTrim } from './dartJsonString';

export type AdminWorkMapClosedOrder = ReturnType<typeof closedProductionOrderFromJson>;
export type AdminWorkMapClosedRow = { id: string; historyVersion: string; position: string; headline: string; supporting: string };

/** V2's local dd.MM.yyyy HH:mm formatter, with no timestamp for nonpositive seconds. */
export function adminWorkMapClosedTime(unixSeconds: number): string {
  if (unixSeconds <= 0) return '';
  const date = new Date(unixSeconds * 1000), two = (value: number) => String(value).padStart(2, '0');
  if (!Number.isFinite(date.getTime())) throw new RangeError('Buyurtmalar sahifasi noto‘g‘ri. Qayta yuklang.');
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
export function adminWorkMapClosedCode(order: AdminWorkMapClosedOrder): string {
  const number = dartTrim(order.order_number), id = dartTrim(order.order_id);
  return number || (id.startsWith('zakaz-') ? dartTrim(id.slice(6)) || id : id);
}
export function adminWorkMapClosedActor(order: AdminWorkMapClosedOrder): string {
  return dartTrim(order.closed_by_display_name) || dartTrim(order.closed_by_ref) || dartTrim(order.closed_by_role) || 'Noma’lum ijrochi';
}
/** Source summary content only. No expandable/history or mutation action is supplied. */
export function adminWorkMapClosedRows(orders: readonly AdminWorkMapClosedOrder[]): AdminWorkMapClosedRow[] {
  return orders.map((order, index) => {
    const code = adminWorkMapClosedCode(order), title = dartTrim(order.title) || 'Zakaz';
    return { id: order.order_id, historyVersion: order.history_version, position: String(index + 1), headline: code ? `${code} • ${title}` : title,
      supporting: [order.logs.some(log => log.action === 'close_early') ? 'Erta yopilgan' : '', dartTrim(order.product_code),
        `Yopdi: ${adminWorkMapClosedActor(order)}`, adminWorkMapClosedTime(order.completed_at_unix)].filter(Boolean).join(' • ') };
  });
}
export function adminWorkMapClosedPages(pages: readonly AdminWorkMapPage[]): AdminWorkMapClosedOrder[] {
  for (const page of pages) {
    if (page.projection !== '' || page.order_ids.length || page.pending_ids.length || page.pending_orders.length || page.workflow_audit ||
        (page.snapshot?.maps.length ?? 0) > 0) throw new Error('Buyurtmalar sahifasi noto‘g‘ri. Qayta yuklang.');
  }
  const orders = pages.flatMap(page => page.closed_orders);
  if (new Set(orders.map(order => order.order_id)).size !== orders.length) throw new Error('Buyurtmalar sahifasi noto‘g‘ri. Qayta yuklang.');
  // Validate source-derived display values before publishing, so malformed dates cannot crash a native render.
  adminWorkMapClosedRows(orders);
  return orders;
}
