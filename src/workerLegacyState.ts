import type { Session } from './auth';
import { decodeCanonicalProductionMapSnapshot } from './productionMapSnapshot';
import { workerQueueContractError } from './workerQueueReadError';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw workerQueueContractError('object required');
  return value as Obj;
};
const names = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item)) throw workerQueueContractError('string list required');
  return value;
};
function field(before: unknown, raw: unknown): Obj {
  const next = { ...object(before ?? {}) }, patch = object(raw), upsert = object(patch.upsert), remove = names(patch.remove);
  for (const id of remove) delete next[id];
  for (const [id, value] of Object.entries(upsert)) { if (!id) throw workerQueueContractError('empty patch key'); next[id] = value; }
  return next;
}
function nested(before: unknown, raw: unknown): Obj {
  const original = object(before ?? {}), next = { ...original }, patch = object(raw), scopes = object(patch.scopes);
  for (const id of names(patch.remove)) delete next[id];
  for (const [id, value] of Object.entries(scopes)) next[id] = field(original[id] ?? {}, value);
  return next;
}

/** Keep the full wire model so subsequent v1 patches are not applied to a compact projection. */
export function decodeWorkerLegacySnapshot(raw: unknown, session?: Session): Obj {
  const value = object(raw);
  if (value.projection === 'worker_list_v1') throw workerQueueContractError('canonical worker snapshot required');
  decodeCanonicalProductionMapSnapshot(value, true, session);
  const revision = value.rev ?? value.revision;
  if (!Number.isSafeInteger(revision) || (revision as number) < 0 || typeof value.epoch !== 'string' || !value.epoch) {
    throw workerQueueContractError('versioned canonical snapshot required');
  }
  return { ...value, rev: revision, revision, scope: typeof value.scope === 'string' ? value.scope : '' };
}

/** @v2 AdminProductionMapLiveStateDelta.applyTo (state_delta_v1 canonical branch) */
export function applyWorkerLegacyDelta(snapshot: unknown, event: unknown, session?: Session): Obj | null {
  try {
    const before = object(snapshot), value = object(event), patch = object(value.patch);
    if (before.projection === 'worker_list_v1' || value.protocol !== 'state_delta_v1' || value.type !== 'state_delta' ||
      value.ok !== true || before.epoch !== value.epoch || (before.scope ?? '') !== (value.scope ?? '') ||
      (before.rev ?? before.revision) !== value.base_rev || !Number.isSafeInteger(value.rev) || (value.rev as number) < (value.base_rev as number)) return null;
    const flat = ['sequences', 'sequence_versions', 'sequence_revisions', 'visible_order_ids', 'queue_policies',
      'order_controls', 'order_customers', 'order_statuses', 'frozen_orders_by_apparatus'];
    const nestedFields = ['sequence_positions_by_apparatus', 'queue_states', 'stage_states', 'queue_action_controls'];
    const replace = ['stage_order_controls', 'completed_orders', 'completion_requests', 'completion_request_decisions'];
    if (Object.keys(patch).some(key => ![...flat, ...nestedFields, ...replace, 'maps', 'map_order'].includes(key))) return null;
    const next: Obj = { ...before, rev: value.rev, revision: value.rev };
    for (const key of flat) if (Object.hasOwn(patch, key)) {
      const original = key === 'queue_policies' ? Object.fromEntries((before.queue_policies as unknown[]).map(raw => {
        const item = object(raw); return [String(item.apparatus_id), item];
      })) : before[key] ?? {};
      const updated = field(original, patch[key]);
      next[key] = key === 'queue_policies' ? Object.values(updated) : updated;
    }
    for (const key of nestedFields) if (Object.hasOwn(patch, key)) next[key] = nested(before[key], patch[key]);
    for (const key of replace) if (Object.hasOwn(patch, key)) {
      if (!Array.isArray(patch[key])) return null;
      next[key] = patch[key];
    }
    if (Object.hasOwn(patch, 'maps') || Object.hasOwn(patch, 'map_order')) {
      const originals = (before.maps as unknown[]).map(raw => object(raw));
      const byId = Object.fromEntries(originals.map(saved => [String(object(saved.map).id), saved]));
      const updated = Object.hasOwn(patch, 'maps') ? field(byId, patch.maps) : byId;
      const order = Object.hasOwn(patch, 'map_order') ? names(patch.map_order)
        : [...originals.map(saved => String(object(saved.map).id)).filter(id => Object.hasOwn(updated, id)),
          ...Object.keys(updated).filter(id => !Object.hasOwn(byId, id))];
      if (new Set(order).size !== order.length || order.length !== Object.keys(updated).length || order.some(id => !Object.hasOwn(updated, id))) return null;
      next.maps = order.map(id => updated[id]);
    }
    return decodeWorkerLegacySnapshot(next, session);
  } catch { return null; }
}
