import { progressBatchFromJson } from './workerProgressBatch';
import { WorkerControlException } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const requiredObject = (value: unknown): Obj => { const row = object(value); if (!row) throw new TypeError('Expected an object'); return row; };
const text = (value: unknown): string => value == null ? '' : String(value);
const number = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value !== 'number') throw new TypeError('Expected a number');
  return value;
};
const integer = (value: unknown): number => { const n = number(value); if (!Number.isFinite(n)) throw new TypeError('Expected a finite integer'); return Math.trunc(n); };
const rows = <T>(value: unknown, decode: (row: unknown) => T): T[] => Array.isArray(value) ? value.map(decode) : [];

/** @v2 AdminLayerRemainderSource */
export function layerRemainderSourceFromJson(value: unknown) {
  const row = requiredObject(value);
  return { source_kind: text(row.source_kind), source_id: text(row.source_id), is_current_roll: row.is_current_roll === true,
    session_id: text(row.session_id), revision: integer(row.revision), qr_payload: text(row.qr_payload),
    item_code: text(row.item_code), item_name: text(row.item_name), source_net_kg: number(row.source_net_kg),
    source_meter: number(row.source_meter), tare_kg: number(row.tare_kg), producer_name: text(row.producer_name) };
}
type Source = ReturnType<typeof layerRemainderSourceFromJson>;
export const layerRemainderSourceToJson = (source: Source): Source => ({ ...source });
export function layerRemainderSourceCanCalculate(source: Source): boolean {
  return ['progress_batch', 'opening_wip', 'raw_material'].includes(source.source_kind) && !!source.source_id && !!source.session_id &&
    source.revision > 0 && Number.isFinite(source.source_net_kg) && source.source_net_kg > 0 &&
    Number.isFinite(source.source_meter) && source.source_meter > 0;
}
export function layerRemainderEstimateMeter(source: Source, remainingNetKg: number): number | null {
  if (!layerRemainderSourceCanCalculate(source) || !Number.isFinite(remainingNetKg) ||
      remainingNetKg <= 0 || remainingNetKg > source.source_net_kg) return null;
  const result = source.source_meter * remainingNetKg / source.source_net_kg;
  return Number.isFinite(result) ? result : null;
}

/** @v2 AdminLayerRemainder */
export function layerRemainderFromJson(value: unknown) {
  const row = requiredObject(value), actor = object(row.recorded_by);
  return { operation_id: text(row.operation_id), source_kind: text(row.source_kind), source_id: text(row.source_id),
    qr_payload: text(row.qr_payload), remaining_net_kg: number(row.remaining_net_kg), remaining_meter: number(row.remaining_meter),
    request_id: text(row.request_id), item_name: text(row.item_name), producer_name: text(row.producer_name),
    recorded_by_name: text(row.recorded_by_name ?? actor?.display_name) };
}

/** @v2 AdminLaminationLabelSettings */
export function laminationLabelSettingsFromJson(value: unknown) {
  const row = requiredObject(value);
  return { print_wip_remainder_labels: row.print_wip_remainder_labels === true,
    print_film_remainder_labels: row.print_film_remainder_labels === true };
}
const labelSettings = (value: unknown) => object(value) ? laminationLabelSettingsFromJson(value)
  : { print_wip_remainder_labels: true, print_film_remainder_labels: true };
export function laminationLabelPrints(settings: ReturnType<typeof laminationLabelSettingsFromJson>, sourceKind: string): boolean {
  return sourceKind === 'raw_material' ? settings.print_film_remainder_labels
    : ['progress_batch', 'opening_wip'].includes(sourceKind) && settings.print_wip_remainder_labels;
}

/** @v2 AdminLaminationAstatkaResult */
export function laminationAstatkaResultFromJson(value: unknown) {
  const row = requiredObject(value), action = row.action == null ? 'pause' : text(row.action), session = object(row.session);
  if (row.ok !== true || !['pause', 'complete'].includes(action) ||
      (action === 'pause' && !object(row.report)) || (action === 'complete' && session?.status !== 'completed')) {
    throw new WorkerControlException('laminatsiya_astatka_invalid_response', 'Astatka qaydi javobi noto‘g‘ri');
  }
  return { action, label_settings: labelSettings(row.label_settings), session_status: text(session?.status),
    remainders: rows(row.remainders, layerRemainderFromJson), progress_batches: rows(row.progress_batches, progressBatchFromJson),
    prints: rows(row.prints, requiredObject) };
}

/** @v2 AdminLaminationAstatkaSnapshot */
export function laminationAstatkaSnapshotFromJson(value: unknown) {
  const row = requiredObject(value), session = object(row.session);
  return { session_id: text(session?.session_id), session_status: text(session?.status),
    allow_empty_sources: row.allow_empty_sources === true, layer_remainders_required: row.layer_remainders_required !== false,
    supports_remainder_weights: row.remainder_weights_supported === true, label_settings: labelSettings(row.label_settings),
    sources: rows(row.sources, layerRemainderSourceFromJson),
    request_result: object(row.request_result) ? laminationAstatkaResultFromJson(row.request_result) : null };
}
type Snapshot = ReturnType<typeof laminationAstatkaSnapshotFromJson>;
export const laminationAstatkaOutputRequired = (snapshot: Snapshot): boolean => snapshot.session_status === 'active';
export function laminationAstatkaInputRoll(snapshot: Snapshot, kind: 'wip' | 'film'): Source | null {
  const kinds = kind === 'wip' ? ['progress_batch', 'opening_wip'] : ['raw_material'];
  const matching = snapshot.sources.filter(source => kinds.includes(source.source_kind));
  const current = matching.filter(source => source.is_current_roll);
  if (current.length === 1) return current[0];
  const calculable = matching.filter(layerRemainderSourceCanCalculate);
  return current.length === 0 && calculable.length === 1 ? calculable[0] : null;
}
