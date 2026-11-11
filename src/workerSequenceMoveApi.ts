import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { sequenceFingerprint } from './workerDelta';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const contract = (detail: string): never => { throw new WorkerControlException('production_map_snapshot_contract_invalid',
  `Production map navbati server shartnomasiga mos emas: ${detail}`); };
const versionPattern = /^[a-f0-9]{64}$/;

/** @v2 AdminProductionMapDeltaOp */
export function productionMapDeltaOpFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid production map delta operation');
  return { type: row.type == null ? '' : String(row.type), id: row.id == null ? '' : String(row.id),
    before_id: row.before_id == null ? null : String(row.before_id), after_id: row.after_id == null ? null : String(row.after_id) };
}
export function productionMapDeltaOpToJson(op: ReturnType<typeof productionMapDeltaOpFromJson>): Obj {
  const result: Obj = { type: op.type, id: op.id };
  if (op.before_id != null) result.before_id = op.before_id;
  if (op.after_id != null) result.after_id = op.after_id;
  return result;
}

function decodeMinimalSequenceMove(data: Obj, baseline: string[], orderId: string, expectedVersion: string, version: string): string[] {
  const ops = data.ops;
  if (data.base_version !== expectedVersion || !Array.isArray(ops) || ops.length > 1 ||
      !Number.isInteger(data.order_count) || data.order_count !== baseline.length || typeof data.order_hash !== 'string' ||
      !/^[0-9a-f]{16}$/.test(data.order_hash) || (data.revision != null &&
      (!Number.isInteger(data.revision) || (data.revision as number) < 0)) || (ops.length > 0 && data.revision == null) ||
      typeof data.epoch !== 'string' || !data.epoch) return contract('invalid minimal sequence move result');
  const result = [...baseline];
  if (!ops.length) {
    if (version !== expectedVersion) return contract('invalid no-op sequence version');
  } else {
    const op = object(ops[0]), position = result.indexOf(orderId);
    if (!op || op.type !== 'move' || op.id !== orderId || op.base_version !== expectedVersion || op.version !== version ||
        (op.before_id != null && typeof op.before_id !== 'string') || (op.after_id != null && typeof op.after_id !== 'string') || position < 0) {
      return contract('invalid canonical sequence move');
    }
    result.splice(position, 1);
    const before = op.before_id as string | null | undefined, after = op.after_id as string | null | undefined;
    const index = before != null ? result.indexOf(before) : after != null ? result.indexOf(after) + 1 : result.length === 0 ? 0 : -1;
    if (index < 0 || (after != null && !result.includes(after))) return contract('missing canonical sequence anchor');
    result.splice(index, 0, orderId);
    if ((before != null && (index + 1 >= result.length || result[index + 1] !== before)) ||
        (after != null && (index === 0 || result[index - 1] !== after))) return contract('inconsistent canonical sequence anchors');
  }
  if (data.order_count !== result.length || data.order_hash !== sequenceFingerprint(result)) return contract('minimal sequence result fingerprint mismatch');
  return result;
}

type Move = { apparatus: string; order_id: string; before_order_id?: string | null; after_order_id?: string | null;
  expected_version: string; idempotency_key: string; canonical_order_ids?: string[] | null };

/** @v2 adminMoveProductionMapSequence */
export async function adminMoveProductionMapSequence(session: Session, input: Move) {
  if (!isCanonicalApparatusId(input.apparatus.trim())) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  if (!versionPattern.test(input.expected_version)) {
    throw new WorkerControlException('queue_reorder_unavailable', 'Server navbatni xavfsiz surish uchun yangilanishi kerak.');
  }
  const baseline = input.canonical_order_ids == null ? null : [...input.canonical_order_ids];
  if (baseline && (!baseline.length || baseline.some(id => !id || id !== id.trim()) ||
      new Set(baseline).size !== baseline.length || !baseline.includes(input.order_id))) contract('invalid sequence move baseline');
  const body: Obj = { apparatus: input.apparatus, order_id: input.order_id };
  if (input.before_order_id != null) body.before_order_id = input.before_order_id;
  if (input.after_order_id != null) body.after_order_id = input.after_order_id;
  body.expected_version = input.expected_version;
  body.idempotency_key = input.idempotency_key;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (baseline) headers.Prefer = 'return=minimal';
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/sequence', { method: 'POST', headers, body: JSON.stringify(body) });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'production_map_sequence', response.headers);
  }
  const data = object(await response.json());
  if (!data || data.ok !== true || typeof data.version !== 'string' || !versionPattern.test(data.version) || typeof data.adjusted !== 'boolean') {
    return contract('invalid sequence move result');
  }
  let ids: string[];
  if (Array.isArray(data.order_ids)) {
    if (data.order_ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(data.order_ids).size !== data.order_ids.length ||
        !data.order_ids.includes(input.order_id)) return contract('invalid sequence move IDs');
    ids = [...data.order_ids] as string[];
  } else if (baseline && !Object.prototype.hasOwnProperty.call(data, 'order_ids')) {
    ids = decodeMinimalSequenceMove(data, baseline, input.order_id, input.expected_version, data.version);
  } else return contract('missing sequence move IDs');
  return { order_ids: ids, version: data.version, adjusted: data.adjusted,
    revision: typeof data.revision === 'number' ? Math.trunc(data.revision) : null, epoch: typeof data.epoch === 'string' ? data.epoch : '',
    ops: Array.isArray(data.ops) ? data.ops.filter(item => object(item)).map(productionMapDeltaOpFromJson) : [] };
}
