import type { WorkerQueue } from './workerApi';

type Obj = Record<string, any>;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** @v2 _busyOrderLabels */
export function workerOrderBusyTitle(queue: Pick<WorkerQueue, 'snapshot' | 'orders'> | null | undefined, apparatus: string, orderId: string): string {
  if (!queue) return '';
  const snapshot = queue.snapshot as Obj;
  const states = snapshot.queue_states?.[apparatus] ?? {};
  const controls = snapshot.queue_action_controls?.[apparatus] ?? {};
  const other = (id: string) => !!id.trim() && id.trim() !== orderId.trim();
  const busyId = Object.keys(states).find(id => other(id) && states[id] === 'in_progress') ??
    Object.keys(controls).find(id => other(id) && ['in_progress', 'freeze_requested'].includes(controls[id]?.interaction?.mode));
  if (!busyId) return '';
  const row = queue.orders[apparatus]?.find(order => order.id.trim() === busyId.trim());
  return text(row?.title) || text(row?.code);
}

/** @v2 _apparatusBusyDetailText */
export function workerOrderBusyText(reason: unknown, apparatus: string, order: string,
  p: (key: string, values?: Record<string, string>) => string): string {
  if (text(reason).toLowerCase() !== 'apparatus_busy') return '';
  const station = apparatus.trim(), title = order.trim();
  return station && title
    ? p('worker.waiting.apparatus_busy_detail', { apparatus: station, order: title })
    : p('worker.waiting.apparatus_busy');
}
