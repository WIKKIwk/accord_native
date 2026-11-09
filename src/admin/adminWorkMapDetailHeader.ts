import type { AdminWorkMapRow } from './adminWorkMapController';
import { dartTrim } from './dartJsonString';

type HeaderMap = { id: string; code?: string; order_number?: string; title?: string; customer_name?: string;
  nodes?: readonly { kind?: string; title?: string }[] };
const clean = (value: unknown) => typeof value === 'string' ? dartTrim(value) : '';
/** Source display shell is provisional; once hydrated, code and product come from that snapshot alone. */
export function adminWorkMapDetailHeader(row: AdminWorkMapRow, map: HeaderMap | null, customer: string | null | undefined, fallback: string) {
  const source: HeaderMap = map ?? { id: row.id, code: row.code, title: row.title, customer_name: row.customer, nodes: [] };
  const id = clean(source.id), suffix = id.startsWith('zakaz-') ? clean(id.slice('zakaz-'.length)) : '';
  const code = clean(source.code) || clean(source.order_number) || suffix || '-';
  const title = clean(source.title), product = title || clean(source.nodes?.find(node => node.kind === 'end' && clean(node.title))?.title) || fallback;
  const buyer = clean(customer ?? source.customer_name), label = [buyer, clean(product)].filter(Boolean).join(' • ');
  return { code, label: label || '-' };
}
