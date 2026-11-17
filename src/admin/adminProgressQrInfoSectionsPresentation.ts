import { dartTrim } from './dartJsonString';
import { adminProgressQrDisplayNumber } from './adminProgressQrTechnicalMaterialPresentation';
import type { AdminProgressQrRowsSection, AdminProgressQrInfoSectionRow, AdminProgressQrOrderDetailsProps, AdminProgressQrQueueStatesProps } from './AdminProgressQrInfoSectionsTypes';

/** @v2 _OrderDetailsSection / _InfoRow */
export function adminProgressQrOrderDetails(order: AdminProgressQrOrderDetailsProps['order'], p: (key: string) => string): AdminProgressQrRowsSection | null {
  if (order === null) return null;
  const rows: AdminProgressQrInfoSectionRow[] = [];
  const add = (id: string, key: string, value: string) => { if (dartTrim(value)) rows.push(Object.freeze({ id, label: p(key), value })); };
  const number = (value: number | null) => value === null ? '' : adminProgressQrDisplayNumber(value);
  add('order-number', 'worker.qr.report.order_number', order.order_number);
  add('product', 'worker.qr.report.product', order.title);
  add('product-code', 'worker.qr.report.product_code', order.product_code);
  add('customer', 'worker.qr.report.customer', order.customer_name);
  add('roll-count', 'worker.qr.report.roll_count', number(order.roll_count));
  add('width', 'worker.qr.report.width', number(order.width_mm));
  add('planned-weight', 'worker.qr.report.planned_weight', number(order.order_kg));
  add('planned-length', 'worker.qr.report.planned_length', number(order.base_length));
  return Object.freeze({ id: 'order', title: p('worker.qr.report.product_order'), rows: Object.freeze(rows) });
}
/** @v2 _stateLabel
 * The QR label dictionary is distinct from the worker queue stage dictionary. */
export function adminProgressQrQueueStateLabel(value: string, p: (key: string) => string): string {
  const keys: Readonly<Record<string, string>> = {
    start: 'worker.qr.status.started', pause: 'worker.action.pause', detach_roll: 'worker.qr.status.roll_removed', resume: 'worker.qr.status.resumed',
    complete: 'worker.qr.status.finished', pending: 'worker.qr.status.waiting_start', in_progress: 'worker.qr.status.in_progress', active: 'worker.qr.status.in_progress',
    paused: 'worker.qr.status.paused', roll_detached: 'worker.qr.status.roll_removed', completed: 'worker.qr.status.completed', waiting: 'worker.qr.status.waiting_work',
    in_use: 'worker.qr.status.in_progress', processed: 'worker.qr.status.used', consumed_by_next_stage: 'worker.qr.status.used', free_wip: 'worker.qr.status.waiting_stock',
    finished_pending_acceptance: 'worker.qr.status.waiting_stock', accepted_to_stock: 'worker.qr.status.accepted_stock', waiting_next_stage: 'worker.qr.status.waiting_next',
  };
  const normalized = dartTrim(value); return Object.hasOwn(keys, normalized) ? p(keys[normalized]) : value;
}
/** @v2 _QueueStatesSection / _canonicalApparatusLabel / _InfoRow
 * The actual report parent separately gates OUTER map nonemptiness; this leaf keeps a titled card even with zero visible rows. */
export function adminProgressQrQueueStates(queue: AdminProgressQrQueueStatesProps['queueStates'], names: ReadonlyMap<string, string>, p: (key: string) => string): AdminProgressQrRowsSection {
  const rows: AdminProgressQrInfoSectionRow[] = [];
  let index = 0;
  for (const [apparatus, orders] of queue) {
    for (const [order, state] of orders) {
      const normalized = dartTrim(apparatus), name = normalized ? dartTrim(names.get(normalized) ?? '') : '';
      const value = adminProgressQrQueueStateLabel(state, p);
      if (dartTrim(value)) rows.push(Object.freeze({ id: String(index), label: `${name || normalized} • ${order}`, value }));
      index++;
    }
  }
  return Object.freeze({ id: 'queue', title: p('worker.qr.report.queue_status'), rows: Object.freeze(rows) });
}
