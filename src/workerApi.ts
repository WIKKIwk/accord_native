import type { Session } from './auth';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export type Apparatus = { id: string; name: string };
export type QueueOrder = { id: string; code: string; title: string; customer: string; state: string };
export type WorkerQueue = { machines: Apparatus[]; orders: Record<string, QueueOrder[]> };

async function getJson(session: Session, path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${session.baseUrl.replace(/\/+$/, '')}${path}`, {
      headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Sessiya tugagan. Qayta kiring.');
      if (response.status === 403) throw new Error('Navbatni ko‘rish uchun ruxsat yo‘q.');
      throw new Error(`Server xatosi (${response.status})`);
    }
    return await response.json();
  } finally { clearTimeout(timeout); }
}

export async function loadWorkerQueue(session: Session, search = ''): Promise<WorkerQueue> {
  const query = new URLSearchParams({ worker_scope: 'true', projection: 'worker_list_v1', queue_limit: '20', queue_positions: 'true' });
  if (search.trim()) query.set('queue_search', search.trim().slice(0, 120));
  const [catalog, raw] = await Promise.all([
    getJson(session, '/v1/mobile/admin/apparatus?limit=0'),
    getJson(session, `/v1/mobile/admin/production-maps/sequence?${query.toString()}`),
  ]);
  if (!Array.isArray(catalog)) throw new Error('Aparatlar ro‘yxati formati noto‘g‘ri.');
  const assigned = new Set(session.assigned_apparatus);
  const machines = catalog.flatMap((item): Apparatus[] => {
    const outer = object(item);
    const projection = Object.keys(object(outer.runtime_projection)).length ? object(outer.runtime_projection) : outer;
    const id = string(projection.apparatus_id);
    const name = string(object(projection.display).display_name);
    const operation = string(object(projection.execution_profile).operation);
    if (!id || !name || operation !== 'print' || !assigned.has(id)) return [];
    return [{ id, name }];
  });
  const snapshot = object(raw);
  if (snapshot.projection !== 'worker_list_v1') throw new Error('Server navbat formati qo‘llab-quvvatlanmaydi.');
  const rows = object(snapshot.worker_list_rows);
  const visible = object(snapshot.visible_order_ids);
  const sequences = object(snapshot.sequences);
  const states = object(snapshot.worker_display_states);
  const fallbackStates = object(snapshot.queue_states);
  const orders: Record<string, QueueOrder[]> = {};
  for (const machine of machines) {
    const ids = Array.isArray(visible[machine.id]) ? visible[machine.id] : sequences[machine.id];
    const machineStates = object(states[machine.id]);
    const fallback = object(fallbackStates[machine.id]);
    orders[machine.id] = (Array.isArray(ids) ? ids : []).flatMap((rawId): QueueOrder[] => {
      const id = string(rawId);
      const row = object(rows[id]);
      if (!id || !Object.keys(row).length) return [];
      return [{ id, code: string(row.code), title: string(row.title) || 'Buyurtma', customer: string(row.customer_name), state: string(machineStates[id]) || string(fallback[id]) }];
    });
  }
  return { machines, orders };
}
