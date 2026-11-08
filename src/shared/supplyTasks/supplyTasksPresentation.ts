import { dartTrim } from '../dartApparatus';
import { productionText } from '../localization';
import type { SupplyTaskRow, SupplyTaskWindow } from './supplyTaskModels';

/** Compact task rows have no graph; never infer writes or detail data from them. */
export function materialTaskRowPresentation(row: SupplyTaskRow, locale: string) {
  const code = dartTrim(row.code), number = dartTrim(row.order_number), id = dartTrim(row.id);
  const fallback = id.startsWith('zakaz-') ? dartTrim(id.slice('zakaz-'.length)) : '';
  const customer = dartTrim(row.customer_name), productCode = dartTrim(row.product_code);
  const count = row.apparatus_count > 0 ? productionText('worker.queue.apparatus_count', locale, { count: row.apparatus_count }) : '';
  return { code: code || number || fallback, title: dartTrim(row.title) || productionText('worker.order.fallback', locale),
    subtitle: [customer || productCode, count].filter(Boolean).join(' • '), position: row.position + 1,
    status: row.task_state === 'partial' ? 'Qisman' : '' };
}

export function materialTaskSummary(window: SupplyTaskWindow): string {
  return `Tekshirilgan: ${window.checked_count} • Homashyo kutilmoqda: ${window.missing_count}`;
}

export function materialTaskEmptyMessage(window: SupplyTaskWindow, locale: string): string {
  if (window.checked_count > 0 && window.missing_count === 0) {
    return 'Tanlangan orderlarda sizning materiallaringiz bo‘yicha kutilayotgan homashyo yo‘q.';
  }
  return productionText(window.checked_count === 0 ? 'qolip.tasks.no_orders' :
    window.missing_count === 0 ? 'qolip.tasks.ready' : 'qolip.products.search_empty', locale);
}
