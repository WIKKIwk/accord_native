import { decodeWorkerListSnapshot } from './workerSnapshot';

// The worker list's state_delta_v2 contract mirrors V2's scoped cursor and
// compact sequence validation. Failure is atomic: callers must fetch a snapshot.
type Obj = Record<string, unknown>;
const object = (v: unknown): Obj => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('object expected'); return v as Obj; };
const names = (v: unknown): string[] => { if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || !x)) throw new Error('string list expected'); return v; };
const ownKeys = (value: Obj, allowed: string[]) => { if (Object.keys(value).some(k => !allowed.includes(k))) throw new Error('unknown patch key'); };
const validInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
export function workerSnapshotCursor(value: unknown): {epoch: string; scope: string; rev: number} | null {
  try {
    const s = object(value);
    if (s.projection !== 'worker_list_v1' || typeof s.epoch !== 'string' || !s.epoch || typeof s.scope !== 'string' || !s.scope || !validInt(s.rev)) return null;
    return {epoch:s.epoch, scope:s.scope, rev:s.rev};
  } catch { return null; }
}
function patchMap(before: unknown, raw: unknown, validator?: (v: unknown) => void): Obj {
  const result = {...object(before)};
  const p = object(raw);
  const upsert = object(p.upsert); const remove = names(p.remove);
  for (const key of remove) delete result[key];
  for (const [key, val] of Object.entries(upsert)) { if (!key) throw new Error('empty key'); validator?.(val); result[key] = val; }
  return result;
}
function patchNested(before: unknown, raw: unknown): Obj {
  const b = object(before); const p = object(raw);
  const scopes = object(p.scopes); const remove = names(p.remove); const result = {...b};
  for (const key of remove) delete result[key];
  for (const [key, val] of Object.entries(scopes)) { if (!key) throw new Error('invalid scope'); result[key] = patchMap(b[key] ?? {}, val); }
  return result;
}
export function sequenceFingerprint(values: string[]): string {
  let hi = 0xcbf29ce4, lo = 0x84222325;
  const byte = (v:number) => { lo = (lo ^ v) >>> 0; const product = lo * 435; hi = (hi * 435 + Math.floor(product / 4294967296) + (lo & 0x00ffffff) * 256) >>> 0; lo = product >>> 0; };
  for (const s of values) {
    for (const c of s) {
      const n = c.codePointAt(0)!;
      if (n <= 0x7f) byte(n);
      else if (n <= 0x7ff) { byte(0xc0 | (n >> 6)); byte(0x80 | (n & 63)); }
      else if (n <= 0xffff) { byte(0xe0 | (n >> 12)); byte(0x80 | ((n >> 6) & 63)); byte(0x80 | (n & 63)); }
      else { byte(0xf0 | (n >> 18)); byte(0x80 | ((n >> 12) & 63)); byte(0x80 | ((n >> 6) & 63)); byte(0x80 | (n & 63)); }
    }
    byte(0xff);
  }
  return hi.toString(16).padStart(8,'0') + lo.toString(16).padStart(8,'0');
}
function editSequence(before: string[], raw: unknown): string[] {
  const p = object(raw); const expected = p.len;
  if (!validInt(p.base_len) || p.base_len !== before.length || p.base_hash !== sequenceFingerprint(before) || !validInt(expected) || typeof p.hash !== 'string' || !/^[0-9a-f]{16}$/.test(p.hash) || !Array.isArray(p.ops) || new Set(before).size !== before.length) throw new Error('sequence baseline');
  const result:string[] = [];
  for (const operation of p.ops) {
    if (!Array.isArray(operation)) throw new Error('sequence operation');
    if (operation[0] === 0 && operation.length === 3 && validInt(operation[1]) && validInt(operation[2]) && operation[2] > 0 && operation[1] + operation[2] <= before.length) result.push(...before.slice(operation[1], operation[1] + operation[2]));
    else if (operation[0] === 1 && operation.length === 2 && names(operation[1]).length > 0) result.push(...names(operation[1]));
    else throw new Error('sequence operation');
    if (result.length > expected) throw new Error('sequence overflow');
  }
  if (result.length !== expected || new Set(result).size !== result.length || sequenceFingerprint(result) !== p.hash) throw new Error('sequence result');
  return result;
}
function patchSequences(before:unknown, raw:unknown):Obj {
  const b = object(before); const p = object(raw);
  const upsert = object(p.upsert), remove = names(p.remove), edit = object(p.edit ?? {});
  const result = patchMap(b,{upsert,remove}, v => { names(v); });
  for (const [key,val] of Object.entries(edit)) {
    if (!key || !(key in b) || key in upsert || remove.includes(key)) throw new Error('sequence conflict');
    result[key] = editSequence(names(b[key]),val);
  }
  return result;
}
const maps = ['worker_list_rows','order_controls','sequence_versions','sequence_revisions'];
const nested = ['worker_display_states','worker_report_prompts','queue_states','sequence_positions_by_apparatus'];
const sequences = ['sequences','visible_order_ids','worker_pending_report_ids'];
const replacements = ['completed_orders','completion_requests','completion_request_decisions'];
export function applyWorkerDelta(snapshot: unknown, event: unknown): Obj | null {
  try {
    const s=object(snapshot), e=object(event), cursor=workerSnapshotCursor(s);
    if (!cursor || e.ok !== true || e.type !== 'state_delta' || e.protocol !== 'state_delta_v2' || e.epoch !== cursor.epoch || e.scope !== cursor.scope || e.base_rev !== cursor.rev || !validInt(e.rev) || e.rev < cursor.rev) throw new Error('cursor mismatch');
    const patch=object(e.patch), next:Obj={...s};
    ownKeys(patch,[...maps,...nested,...sequences,...replacements,'queue_policies']);
    for (const key of maps) if (patch[key] != null) next[key] = patchMap(s[key] ?? {},patch[key], value => {
      if (key === 'sequence_versions' && typeof value !== 'string') throw new Error('version expected');
      if (key === 'sequence_revisions' && !validInt(value)) throw new Error('revision expected');
    });
    for (const key of nested) if (patch[key] != null) next[key] = patchNested(s[key] ?? {},patch[key]);
    for (const key of sequences) if (patch[key] != null) next[key] = patchSequences(s[key] ?? {},patch[key]);
    for (const key of replacements) if (patch[key] != null) { if (!Array.isArray(patch[key])) throw new Error('array expected'); next[key]=patch[key]; }
    if (patch.queue_policies != null) {
      if (!Array.isArray(s.queue_policies)) throw new Error('policies expected');
      const current = Object.fromEntries(s.queue_policies.map(item => {
        const policy = object(item);
        return [String(policy.apparatus_id), policy];
      }));
      const policies = patchMap(current, patch.queue_policies, value => { object(value); });
      next.queue_policies = Object.entries(policies).map(([id, value]) => {
        const policy = object(value);
        if (typeof policy.apparatus_id !== 'string' || policy.apparatus_id.trim() !== id.trim()) throw new Error('policy scope mismatch');
        return { ...policy, policy: String(policy.discipline ?? policy.policy ?? '').trim() === 'free_pick' ? 'free_pick' : 'strict_sequence' };
      });
    }
    next.rev=e.rev;
    return decodeWorkerListSnapshot(next);
  } catch { return null; }
}
