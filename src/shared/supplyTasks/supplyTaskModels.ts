import { apparatusFromJson, type AdminApparatus } from '../../apparatusApi';
import { comboFromJson, orderProductFromJson, productionMapSavedFromJson } from '../../workerProductionMapSaved';
import { dartTrim, isAsciiCanonicalApparatusId } from '../dartApparatus';
import { MobileApiException } from '../mobileApiException';

type Obj = Record<string, unknown>;
const object = (raw: unknown): Obj | null => raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw as Obj : null;
const nonempty = (value: unknown): value is string => typeof value === 'string' && dartTrim(value).length > 0;
const uint = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === 'string';
const invalid = (resync = false) => new MobileApiException({ code: resync ? 'supply_tasks_resync' : 'supply_tasks_invalid',
  message: 'Vazifalar holatini qayta yuklang.' });
const invalidIf = (condition: unknown, resync = false): void => { if (condition) throw invalid(resync); };
const limits = new Set([5, 10, 20, 50]);
function freezeFresh<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) freezeFresh(child);
  return Object.freeze(value);
}
export type SupplyTaskKind = 'material' | 'qolip';
type Product = ReturnType<typeof orderProductFromJson>;
type Combo = ReturnType<typeof comboFromJson>;
export type SupplyTaskRow = Readonly<{ id: string; code: string; order_number: string; title: string; product_code: string;
  customer_name: string; image_id: string; position: number; apparatus_count: number; task_state: 'missing' | 'partial';
  combo: Combo; products: readonly Product[] }>;
export type SupplyTaskWindow = Readonly<{ kind: SupplyTaskKind; scope: string; epoch: string; revision: number; version: string;
  apparatus_id: string; limit: number; search: string; checked_count: number; missing_count: number;
  rows: readonly SupplyTaskRow[]; apparatus: readonly AdminApparatus[] }>;

type SupplyTaskCursor = { scope: string; epoch: string; revision: number; version: string };
export type SupplyTaskMessage =
  | { type: 'snapshot'; window: SupplyTaskWindow }
  | ({ type: 'ready' } & SupplyTaskCursor)
  | ({ type: 'delta'; base_revision: number; checked_count: number; missing_count: number;
      order_ids: readonly string[]; upsert: readonly SupplyTaskRow[]; remove: readonly string[] } & SupplyTaskCursor);

/** @v2 SupplyTaskRow.fromJson */
export function supplyTaskRowFromJson(raw: unknown): SupplyTaskRow {
  const row = object(raw);
  if (!row || !['id', 'code', 'order_number', 'title', 'product_code', 'customer_name', 'image_id'].every(key => text(row[key])) ||
      !nonempty(row.id) || !uint(row.position) || !uint(row.apparatus_count) || (row.task_state !== 'missing' && row.task_state !== 'partial')) {
    throw invalid();
  }
  const products = Array.isArray(row.products) ? row.products.filter(object).map(orderProductFromJson) : [];
  return freezeFresh({ id: row.id as string, code: row.code as string, order_number: row.order_number as string,
    title: row.title as string, product_code: row.product_code as string, customer_name: row.customer_name as string,
    image_id: row.image_id as string, position: row.position, apparatus_count: row.apparatus_count,
    task_state: row.task_state as 'missing' | 'partial', combo: comboFromJson(row.combo), products: Object.freeze(products) });
}

function validateRows(rows: readonly SupplyTaskRow[], checked: unknown, missing: unknown, limit: number, resync = false) {
  if (!uint(checked) || !uint(missing)) throw invalid(resync);
  invalidIf(checked > limit || missing > checked || rows.length > missing || new Set(rows.map(row => row.id)).size !== rows.length, resync);
  let previous = -1;
  for (const row of rows) {
    invalidIf(row.position <= previous || row.position >= checked, resync);
    previous = row.position;
  }
}

/** @v2 SupplyTaskWindow.fromJson */
export function supplyTaskWindowFromJson(raw: unknown): SupplyTaskWindow {
  const body = object(raw);
  if (!body || body.ok !== true || body.projection !== 'supply_tasks_v1' || (body.kind !== 'material' && body.kind !== 'qolip') ||
      !['scope', 'epoch', 'version'].every(key => nonempty(body[key])) || !uint(body.rev) || !uint(body.limit) || !limits.has(body.limit) ||
      !text(body.apparatus_id) || !text(body.search) || !Array.isArray(body.rows) || !Array.isArray(body.apparatus)) throw invalid();
  const rows = body.rows.map(supplyTaskRowFromJson);
  const apparatus = body.apparatus.map(value => {
    if (!object(value)) throw invalid();
    try {
      const parsed = apparatusFromJson(value);
      // Fail closed until Dart/Node/Hermes Unicode canonical-ID parity is verified.
      if (!isAsciiCanonicalApparatusId(parsed.id)) throw invalid();
      return freezeFresh(parsed);
    } catch { throw invalid(); }
  });
  const selected = body.apparatus_id;
  invalidIf(new Set(apparatus.map(item => item.id)).size !== apparatus.length ||
    (apparatus.length === 0 ? selected.length !== 0 : !apparatus.some(item => item.id === selected)));
  validateRows(rows, body.checked_count, body.missing_count, body.limit);
  invalidIf((body.search === '' && rows.length !== body.missing_count) ||
    (apparatus.length === 0 && (body.checked_count !== 0 || rows.length !== 0)));
  return Object.freeze({ kind: body.kind as SupplyTaskKind, scope: body.scope as string, epoch: body.epoch as string,
    revision: body.rev, version: body.version as string, apparatus_id: selected, limit: body.limit, search: body.search,
    checked_count: body.checked_count as number, missing_count: body.missing_count as number,
    rows: Object.freeze(rows), apparatus: Object.freeze(apparatus) });
}

function cursor(body: Obj): SupplyTaskCursor {
  if (!['scope', 'epoch', 'version'].every(key => nonempty(body[key])) || !uint(body.rev)) throw invalid();
  return { scope: body.scope as string, epoch: body.epoch as string, revision: body.rev, version: body.version as string };
}
function ids(raw: unknown): readonly string[] {
  if (!Array.isArray(raw) || raw.some(value => !nonempty(value)) || new Set(raw).size !== raw.length) throw invalid();
  return Object.freeze([...raw] as string[]);
}

/** @v2 SupplyTaskMessage.fromJson */
export function supplyTaskMessageFromJson(raw: unknown): SupplyTaskMessage {
  const body = object(raw);
  if (!body) throw invalid();
  if (body.ok !== true) throw new MobileApiException({ code: typeof body.error === 'string' ? body.error : 'supply_tasks_failed',
    message: 'Vazifalar oqimi uzildi.', statusCode: typeof body.status === 'number' && Number.isInteger(body.status) ? body.status : undefined });
  if (body.type === 'tasks_snapshot') {
    if (!object(body.window)) throw invalid();
    return Object.freeze({ type: 'snapshot', window: supplyTaskWindowFromJson(body.window) });
  }
  if (body.type === 'tasks_ready') {
    const value = cursor(body);
    if (body.resync !== false) throw invalid(true);
    return Object.freeze({ type: 'ready', ...value });
  }
  if (body.type === 'tasks_delta') {
    const value = cursor(body);
    if (!uint(body.base_rev) || value.revision <= body.base_rev || !uint(body.checked_count) || !uint(body.missing_count) ||
        !Array.isArray(body.upsert)) throw invalid();
    const upsert = body.upsert.map(supplyTaskRowFromJson);
    if (new Set(upsert.map(row => row.id)).size !== upsert.length) throw invalid();
    return Object.freeze({ type: 'delta', ...value, base_revision: body.base_rev, checked_count: body.checked_count,
      missing_count: body.missing_count, order_ids: ids(body.order_ids), upsert: Object.freeze(upsert), remove: ids(body.remove) });
  }
  throw invalid();
}

/** @v2 SupplyTaskMessage.applyTo */
export function applySupplyTaskMessage(message: SupplyTaskMessage, baseline: SupplyTaskWindow): SupplyTaskWindow {
  if (message.type === 'snapshot') {
    const next = message.window;
    invalidIf(next.kind !== baseline.kind || next.limit !== baseline.limit || next.search !== baseline.search ||
      (next.epoch === baseline.epoch && next.revision < baseline.revision), true);
    return next;
  }
  if (message.type === 'ready') {
    invalidIf(message.epoch !== baseline.epoch || message.scope !== baseline.scope || message.revision !== baseline.revision ||
      message.version !== baseline.version, true);
    return baseline;
  }
  invalidIf(message.epoch !== baseline.epoch || message.scope !== baseline.scope || message.base_revision !== baseline.revision ||
    message.revision <= baseline.revision, true);
  const next = new Map(baseline.rows.map(row => [row.id, row])), wanted = new Set(message.order_ids), removed = new Set(message.remove);
  const expectedRemoved = [...next.keys()].filter(id => !wanted.has(id));
  invalidIf(removed.size !== expectedRemoved.length || expectedRemoved.some(id => !removed.has(id)) ||
    message.upsert.some(row => !wanted.has(row.id) || removed.has(row.id)), true);
  for (const id of removed) next.delete(id);
  for (const row of message.upsert) next.set(row.id, row);
  invalidIf(next.size !== wanted.size || [...wanted].some(id => !next.has(id)), true);
  const rows = message.order_ids.map(id => next.get(id)!);
  validateRows(rows, message.checked_count, message.missing_count, baseline.limit, true);
  invalidIf(baseline.search === '' && rows.length !== message.missing_count, true);
  return Object.freeze({ ...baseline, scope: message.scope, epoch: message.epoch, revision: message.revision, version: message.version,
    checked_count: message.checked_count, missing_count: message.missing_count, rows: Object.freeze(rows) });
}

const shells = new WeakMap<SupplyTaskRow, ReturnType<typeof productionMapSavedFromJson>>();
const shellIdentities = new WeakSet<object>();
/** @v2 SupplyTaskRow.toPresentationOrder */
export function supplyTaskPresentationOrder(row: SupplyTaskRow): ReturnType<typeof productionMapSavedFromJson> {
  const existing = shells.get(row);
  if (existing) return existing;
  const shell = freezeFresh(productionMapSavedFromJson({ map: { id: row.id, code: row.code, order_number: row.order_number, title: row.title,
    product_code: row.product_code, customer_name: row.customer_name, image_id: row.image_id, combo: row.combo,
    products: row.products, nodes: [], edges: [] }, program: { map_id: row.id, product_code: row.product_code, operations: [] } }));
  shells.set(row, shell); shellIdentities.add(shell);
  return shell;
}
/** @v2 isSupplyTaskPresentationOrder */
export function isSupplyTaskPresentationOrder(value: object): boolean { return shellIdentities.has(value); }
