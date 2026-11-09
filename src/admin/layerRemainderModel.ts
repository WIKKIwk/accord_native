import { layerRemainderFromJson, layerRemainderSourceFromJson } from '../workerLaminationRemainders';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject : null;
export type AdminLayerRemainderSnapshot = { sources: ReturnType<typeof layerRemainderSourceFromJson>[];
  remainders: ReturnType<typeof layerRemainderFromJson>[] };
/** Partial source-derived snapshot; inherited Worker string conversion differs on unusual JSON. */
export function layerRemainderSnapshotFromJson(value: unknown): AdminLayerRemainderSnapshot {
  const row = object(value);
  if (!row) throw new TypeError('Invalid layer remainder snapshot');
  return { sources: Array.isArray(row.sources) ? row.sources.map(layerRemainderSourceFromJson) : [],
    remainders: Array.isArray(row.remainders) ? row.remainders.map(layerRemainderFromJson) : [] };
}
