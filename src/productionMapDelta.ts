import { productionMapDeltaOpFromJson } from './workerSequenceMoveApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const parseIntValue = (value: unknown): number => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Expected a finite revision');
    return Math.trunc(value);
  }
  const text = String(value ?? '').trim(); return /^[+-]?\d+$/.test(text) ? Number(text) : 0;
};

/** @v2 AdminProductionMapLiveDelta */
export function productionMapLiveDeltaFromJson(event: Obj): Obj {
  if (event.snapshot_rev != null && (typeof event.snapshot_rev !== 'number' || !Number.isFinite(event.snapshot_rev))) {
    throw new TypeError('Expected a finite snapshot revision');
  }
  return { type: 'delta', epoch: String(event.epoch ?? ''), apparatus: String(event.apparatus ?? event.canonical_apparatus_id ?? ''),
    base_revision: parseIntValue(event.base_revision), revision: parseIntValue(event.revision),
    version: String(event.version ?? ''), base_version: String(event.base_version ?? ''),
    snapshot_revision: typeof event.snapshot_rev === 'number' ? Math.trunc(event.snapshot_rev) : null,
    ops: Array.isArray(event.ops) ? event.ops.filter(item => object(item)).map(productionMapDeltaOpFromJson) : [] };
}
