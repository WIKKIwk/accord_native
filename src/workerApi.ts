import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { DEFAULT_QUEUE_LIMIT, type QueueLimit } from './workerQueueLimit';
import { completedOrderTone, workerOrderTone, type OrderCardTone } from './workerOrderAppearance';
import type { QueueCursor } from './workerOrderLogic';
import { decodeWorkerListSnapshot } from './workerSnapshot';
import { workerProductionOrderDetail } from './workerDetailApi';
import { sessionReadScope } from './sessionReadScope';
import { adminApparatus } from './apparatusApi';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export type Apparatus = { id: string; name: string; operation: string; worker_material_assignment_allowed?: boolean };
export type QueueOrder = { id: string; code: string; title: string; customer: string; state: string; imageId: string; cardTone: OrderCardTone };
export type CompletedOrder = QueueOrder & { apparatusId: string; completedAt: number; issueNote: string };
export type WorkerQueue = { machines: Apparatus[]; orders: Record<string, QueueOrder[]>; completed: CompletedOrder[]; snapshot: Record<string, unknown>; catalog?: Apparatus[]; assignedIds: string[]; assignedLabels: string[] };
export type WorkerOrderDetail = {
  map: RecordValue;
  customer: string;
  stages: { id: string; apparatusId: string; title: string; state: string }[];
};

function orderDisplayPath(map: RecordValue) {
  const nodes = Array.isArray(map.nodes) ? map.nodes.map(object) : [];
  const start = nodes.find(node => node.kind === 'start' && string(node.id));
  if (!start) return nodes;
  const byId = new Map(nodes.map(node => [string(node.id), node]));
  const successors = new Map<string, RecordValue[]>();
  for (const value of Array.isArray(map.edges) ? map.edges : []) {
    const edge = object(value);
    const from = string(edge.from);
    const to = byId.get(string(edge.to));
    if (!byId.has(from) || !to) continue;
    const next = successors.get(from) ?? [];
    next.push(to);
    successors.set(from, next);
  }
  const assigned = new Map<string, Set<string>>();
  for (const node of nodes) {
    const group = string(node.alternative_group_id);
    const apparatus = string(node.alternative_assigned_apparatus_id);
    if (node.kind !== 'apparatus' || !group || !apparatus) continue;
    const groupAssignments = assigned.get(group) ?? new Set<string>();
    groupAssignments.add(apparatus);
    assigned.set(group, groupAssignments);
  }
  const path: RecordValue[] = [];
  const seen = new Set<RecordValue>();
  let current: RecordValue | undefined = start;
  while (current && !seen.has(current)) {
    path.push(current);
    seen.add(current);
    const candidates: RecordValue[] = successors.get(string(current.id)) ?? [];
    current = candidates.find(node => node.kind === 'apparatus' &&
      assigned.get(string(node.alternative_group_id))?.has(string(node.apparatus_id))) ?? candidates[0];
  }
  return path;
}

export function workerOrderDetailFromSnapshot(snapshot: RecordValue, orderId: string): WorkerOrderDetail {
  const map = object(object(Array.isArray(snapshot.maps) ? snapshot.maps[0] : null).map);
  const states = object(object(snapshot.stage_states)[orderId]);
  const queueStates = object(snapshot.queue_states);
  const stages = orderDisplayPath(map).flatMap(node => {
    const id = string(node.id);
    if (!id) return [];
    const apparatusId = node.kind === 'apparatus' ? string(node.alternative_assigned_apparatus_id) || string(node.apparatus_id) : '';
    return [{
      id, apparatusId,
      title: string(node.alternative_assigned_title) || string(node.title),
      state: string(states[id]) || string(object(queueStates[apparatusId])[orderId]),
    }];
  });
  return { map, customer: string(object(snapshot.order_customers)[orderId]) || string(map.customer_name), stages };
}

export async function readWorkerOrderDetail(session: Session, apparatusId: string, orderId: string,
  cursor: QueueCursor | null, signal: AbortSignal): Promise<WorkerOrderDetail> {
  const scope = sessionReadScope(session);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  signal.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Scoped order detail timed out'));
      controller.abort();
    }, 5000);
  });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const snapshot = await Promise.race([workerProductionOrderDetail(session, apparatusId, orderId, controller.signal), deadline]);
      if (scope !== sessionReadScope(session)) throw new Error('Sessiya o‘zgardi. Qayta urining.');
      const valid = (!cursor?.epoch || snapshot.epoch === cursor.epoch) &&
        (typeof cursor?.rev !== 'number' || snapshot.rev >= cursor.rev);
      if (!valid) continue;
      return workerOrderDetailFromSnapshot(snapshot, orderId);
    }
    throw new Error('Buyurtma holati yangilandi. Qayta urining.');
  } finally {
    clearTimeout(timer!);
    signal.removeEventListener('abort', abort);
  }
}

/** @v2 _isAssignedWatchApparatus */
export function canWorkOnApparatus(machine: Apparatus | undefined, assignedIds: readonly string[]): boolean {
  const id = machine?.id.trim();
  return !!id && assignedIds.some(assigned => assigned.trim() === id);
}

const workerOrderControl = (snapshot: RecordValue | undefined, orderId: string): string => {
  const value = object(snapshot?.order_controls)[orderId.trim()];
  return string(typeof value === 'string' ? value : object(value).state);
};

/** @v2 _workerOrderIsFrozen */
export function workerOrderIsFrozen(snapshot: RecordValue | undefined, orderId: string): boolean {
  return workerOrderControl(snapshot, orderId).toLowerCase() === 'frozen' ||
    string(object(object(snapshot?.order_statuses)[orderId.trim()]).order_status).toLowerCase() === 'frozen';
}

async function getJson(session: Session, path: string, resource: 'queue' | 'profile'): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await authorizedFetch(session, path, {
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Sessiya tugagan. Qayta kiring.');
      if (response.status === 403) {
        if (resource === 'queue' && !session.assigned_apparatus.length) {
          throw new Error('Hisobingizga aparat biriktirilmagan. Administratordan bosma aparatini biriktirishni so‘rang va qayta kiring.');
        }
        throw new Error(resource === 'profile' ? 'Profilni yangilab bo‘lmadi.'
          : 'Server bu hisobga aparat navbatini ko‘rishga ruxsat bermadi. Hisob ruxsatlari va aparat biriktirilishini tekshiring.');
      }
      throw new Error(`Server xatosi (${response.status})`);
    }
    return await response.json();
  } finally { clearTimeout(timeout); }
}

export async function loadWorkerQueue(session: Session, search = '', queueLimit: QueueLimit = DEFAULT_QUEUE_LIMIT): Promise<WorkerQueue> {
  const query = new URLSearchParams({ worker_scope: 'true', projection: 'worker_list_v1', queue_limit: String(queueLimit), queue_positions: 'true' });
  if (search.trim()) query.set('queue_search', search.trim());
  const [catalogResult, queueResult, profileResult] = await Promise.allSettled([
    adminApparatus(session, { limit: 200 }),
    getJson(session, `/v1/mobile/admin/production-maps/sequence?${query.toString()}`, 'queue'),
    getJson(session, '/v1/mobile/profile', 'profile'),
  ]);
  if (queueResult.status === 'rejected') throw queueResult.reason;
  if (catalogResult.status === 'rejected') throw catalogResult.reason;
  const catalog = catalogResult.value;
  const raw = queueResult.value;
  if (!Array.isArray(catalog)) throw new Error('Aparatlar ro‘yxati formati noto‘g‘ri.');
  const snapshot = decodeWorkerListSnapshot(raw);
  const assignments = workerAssignmentsFromProfile(session, profileResult.status === 'fulfilled' ? profileResult.value : null);
  const assignedIds = assignments?.ids ?? session.assigned_apparatus;
  const assignedLabels = assignments?.labels ?? session.assigned_apparatus_labels;
  const machines = workerMachinesFromSnapshot(catalog, snapshot, assignedIds);
  return queueFromSnapshot(machines, snapshot, assignedIds, assignedLabels, workerApparatusCatalog(catalog));
}

/** Accept assignment changes only from the active account's current profile. */
export function workerAssignmentsFromProfile(session: Session, value: unknown): { ids: string[]; labels: string[] } | null {
  const profile = object(value);
  if (!string(profile.ref) || string(profile.ref) !== string(session.profile.ref) ||
      !string(profile.role) || string(profile.role) !== string(session.profile.role) ||
      !Array.isArray(profile.assigned_apparatus) || profile.assigned_apparatus.some(id => typeof id !== 'string' || !id.trim())) return null;
  const ids = [...new Set(profile.assigned_apparatus.map(id => id.trim()))];
  const labels = Array.isArray(profile.assigned_apparatus_labels) && profile.assigned_apparatus_labels.every(label => typeof label === 'string')
    ? profile.assigned_apparatus_labels.map(label => label.trim()).filter(Boolean) : session.assigned_apparatus_labels;
  return { ids, labels };
}

/** The server's worker scope decides whether unassigned machines may be watched. */
export function workerMachinesFromSnapshot(catalog: unknown[], snapshot: RecordValue, assignedIds: readonly string[]): Apparatus[] {
  const assigned = new Set(assignedIds);
  const showAll = snapshot.worker_show_all_apparatus_tabs === true;
  const machines = workerApparatusCatalog(catalog).filter(machine => showAll || assigned.has(machine.id));
  const firstAssigned = assignedIds.map(id => machines.findIndex(machine => machine.id === id)).find(index => index >= 0) ?? -1;
  if (firstAssigned > 0) machines.unshift(...machines.splice(firstAssigned, 1));
  return machines;
}

/** Keep catalog labels for QR guidance without changing which tabs can be watched. */
export function workerApparatusCatalog(catalog: unknown[]): Apparatus[] {
  return catalog.flatMap((item): Apparatus[] => {
    const outer = object(item);
    const projection = Object.keys(object(outer.runtime_projection)).length ? object(outer.runtime_projection) : outer;
    const id = string(projection.apparatus_id) || string(outer.id);
    const name = string(object(projection.display).display_name) || string(outer.name);
    const operation = string(object(projection.execution_profile).operation) || string(outer.operation);
    if (!id || !name) return [];
    return [{ id, name, operation, ...(projection.worker_material_assignment_allowed === true || outer.worker_material_assignment_allowed === true ? { worker_material_assignment_allowed: true } : {}) }];
  });
}

export function queueFromSnapshot(machines: Apparatus[], snapshot: Record<string, unknown>, assignedIds: readonly string[], assignedLabels: readonly string[] = [], catalog?: Apparatus[]): WorkerQueue {
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
      const displayState = string(machineStates[id]);
      const queueState = string(fallback[id]);
      const state = displayState === 'in_progress' && queueState === 'paused' ? queueState : displayState || queueState;
      return [{ id, code: string(row.code), title: string(row.title) || 'Buyurtma', customer: string(row.customer_name), state, imageId: string(row.image_id), cardTone: workerOrderTone(displayState, queueState, workerOrderControl(snapshot, id)) }];
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
    if (!id || !assigned.has(apparatusId) || seen.has(key) || state.toLowerCase() === 'frozen' || workerOrderIsFrozen(snapshot, id)) continue;
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
  return { machines, orders, completed, snapshot, ...(catalog ? { catalog } : {}), assignedIds: [...assignedIds], assignedLabels: [...assignedLabels] };
}
