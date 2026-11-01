import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { DEFAULT_QUEUE_LIMIT, type QueueLimit } from './workerQueueLimit';
import { completedOrderTone, workerOrderTone, type OrderCardTone } from './workerOrderAppearance';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export type Apparatus = { id: string; name: string; operation: string };
export type QueueOrder = { id: string; code: string; title: string; customer: string; state: string; imageId: string; cardTone: OrderCardTone };
export type CompletedOrder = QueueOrder & { apparatusId: string; completedAt: number; issueNote: string };
export type WorkerQueue = { machines: Apparatus[]; orders: Record<string, QueueOrder[]>; completed: CompletedOrder[]; snapshot: Record<string, unknown> };

export function canWorkOnApparatus(machine: Apparatus | undefined, assignedIds: readonly string[]): boolean {
  return !!machine && machine.operation === 'print' && assignedIds.includes(machine.id);
}

async function getJson(session: Session, path: string, resource: 'apparatus' | 'queue'): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await authorizedFetch(session, path, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Sessiya tugagan. Qayta kiring.');
      if (response.status === 403) {
        if (resource === 'queue' && !session.assigned_apparatus.length) {
          throw new Error('Hisobingizga aparat biriktirilmagan. Administratordan bosma aparatini biriktirishni so‘rang va qayta kiring.');
        }
        throw new Error(resource === 'apparatus'
          ? 'Server bu hisobga aparatlar ro‘yxatini ko‘rishga ruxsat bermadi.'
          : 'Server bu hisobga aparat navbatini ko‘rishga ruxsat bermadi. Hisob ruxsatlari va aparat biriktirilishini tekshiring.');
      }
      throw new Error(`Server xatosi (${response.status})`);
    }
    return await response.json();
  } finally { clearTimeout(timeout); }
}

export async function loadWorkerQueue(session: Session, search = '', queueLimit: QueueLimit = DEFAULT_QUEUE_LIMIT): Promise<WorkerQueue> {
  const query = new URLSearchParams({ worker_scope: 'true', projection: 'worker_list_v1', queue_limit: String(queueLimit), queue_positions: 'true' });
  if (search.trim()) query.set('queue_search', search.trim().slice(0, 120));
  const [catalogResult, queueResult] = await Promise.allSettled([
    getJson(session, '/v1/mobile/admin/apparatus?limit=200', 'apparatus'),
    getJson(session, `/v1/mobile/admin/production-maps/sequence?${query.toString()}`, 'queue'),
  ]);
  if (queueResult.status === 'rejected') throw queueResult.reason;
  if (catalogResult.status === 'rejected') throw catalogResult.reason;
  const catalog = catalogResult.value;
  const raw = queueResult.value;
  if (!Array.isArray(catalog)) throw new Error('Aparatlar ro‘yxati formati noto‘g‘ri.');
  const snapshot = object(raw);
  if (snapshot.projection !== 'worker_list_v1') throw new Error('Server navbat formati qo‘llab-quvvatlanmaydi.');
  const machines = workerMachinesFromSnapshot(catalog, snapshot, session.assigned_apparatus);
  return queueFromSnapshot(machines, snapshot, session.assigned_apparatus);
}

/** The server's worker scope decides whether unassigned machines may be watched. */
export function workerMachinesFromSnapshot(catalog: unknown[], snapshot: RecordValue, assignedIds: readonly string[]): Apparatus[] {
  const assigned = new Set(assignedIds);
  const showAll = snapshot.worker_show_all_apparatus_tabs === true;
  const machines = catalog.flatMap((item): Apparatus[] => {
    const outer = object(item);
    const projection = Object.keys(object(outer.runtime_projection)).length ? object(outer.runtime_projection) : outer;
    const id = string(projection.apparatus_id);
    const name = string(object(projection.display).display_name);
    const operation = string(object(projection.execution_profile).operation);
    if (!id || !name || (!showAll && !assigned.has(id))) return [];
    return [{ id, name, operation }];
  });
  const firstAssigned = machines.findIndex(machine => assigned.has(machine.id));
  if (firstAssigned > 0) machines.unshift(...machines.splice(firstAssigned, 1));
  return machines;
}

export function queueFromSnapshot(machines: Apparatus[], snapshot: Record<string, unknown>, assignedIds: readonly string[]): WorkerQueue {
  const rows = object(snapshot.worker_list_rows);
  const visible = object(snapshot.visible_order_ids);
  const sequences = object(snapshot.sequences);
  const states = object(snapshot.worker_display_states);
  const fallbackStates = object(snapshot.queue_states);
  const orderControls = object(snapshot.order_controls);
  const orders: Record<string, QueueOrder[]> = {};
  for (const machine of machines) {
    const ids = Array.isArray(visible[machine.id]) ? visible[machine.id] : sequences[machine.id];
    const machineStates = object(states[machine.id]);
    const fallback = object(fallbackStates[machine.id]);
    orders[machine.id] = (Array.isArray(ids) ? ids : []).flatMap((rawId): QueueOrder[] => {
      const id = string(rawId);
      const row = object(rows[id]);
      if (!id || !Object.keys(row).length) return [];
      const displayState = string(machineStates[id]);
      const queueState = string(fallback[id]);
      const state = displayState === 'in_progress' && queueState === 'paused' ? queueState : displayState || queueState;
      return [{ id, code: string(row.code), title: string(row.title) || 'Buyurtma', customer: string(row.customer_name), state, imageId: string(row.image_id), cardTone: workerOrderTone(displayState, queueState, string(object(orderControls[id]).state)) }];
    });
  }
  const assigned = new Set(assignedIds);
  const seen = new Set<string>();
  const completed: CompletedOrder[] = [];
  for (const raw of Array.isArray(snapshot.completed_orders) ? snapshot.completed_orders : []) {
    const item = object(raw);
    const apparatusId = string(item.apparatus);
    const id = string(item.order_id);
    const key = JSON.stringify([apparatusId, id]);
    const state = string(item.status) || 'completed';
    if (!id || !assigned.has(apparatusId) || seen.has(key) || state.toLowerCase() === 'frozen' || string(object(orderControls[id]).state).toLowerCase() === 'frozen') continue;
    const row = object(rows[id]);
    if (!Object.keys(row).length) continue;
    seen.add(key);
    completed.push({
      id, apparatusId, code: string(row.code), title: string(row.title) || 'Buyurtma',
      customer: string(row.customer_name), state, imageId: string(row.image_id),
      cardTone: completedOrderTone(state),
      completedAt: typeof item.completed_at_unix === 'number' ? item.completed_at_unix : 0,
      issueNote: string(item.issue_note),
    });
  }
  return { machines, orders, completed, snapshot };
}
