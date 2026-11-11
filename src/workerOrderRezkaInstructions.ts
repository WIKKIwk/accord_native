import { orderDisplayPath } from './workerApi';
import { isCanonicalApparatusId } from './workerControlsApi';
import { workerRawQuantity } from './workerPeremotka';

type Obj = Record<string, any>;
type Text = (key: string, values?: Record<string, unknown>) => string;
const text = (value: unknown) => String(value ?? '').trim();

/** @v2 _rezkaNodeForStation */
function rezkaNode(map: Obj, station: string, stage: string): Obj | undefined {
  if (!station.trim()) return;
  const matches = (node: Obj) => {
    const apparatus = text(node.alternative_group_id) || !text(node.alternative_assigned_apparatus_id)
      ? text(node.apparatus_id) : text(node.alternative_assigned_apparatus_id);
    return node.kind === 'apparatus' && isCanonicalApparatusId(apparatus) && apparatus === station.trim();
  };
  return (map.nodes ?? []).find((node: Obj) => text(stage) && text(node.id) === text(stage) && matches(node)) ?? orderDisplayPath(map).find(matches);
}

/** @v2 _rezkaWipSplitInstructionLines */
export function workerOrderRezkaInstructions(map: Obj, station: string, stage: string, outputCounts: number[], p: Text): string[] {
  const node = rezkaNode(map, station, stage);
  if (!node) return [];
  const positive = (values: unknown) => Array.isArray(values) ? values.filter((value): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0) : [];
  const authoritative = positive(outputCounts), groups = authoritative.length ? authoritative : positive(node.rezka_frame_groups);
  if (groups.length) return [p('worker.split.summary', { count: groups.length }),
    ...groups.map((frames, index) => p('worker.split.part', { index: index + 1, frames })),
    p('worker.split.total', { frames: groups.reduce((sum, value) => sum + value, 0) })];
  const frames = node.rezka_kadr_count, length = node.rezka_label_length;
  return [...(typeof frames === 'number' && frames > 0 ? [p('worker.split.rolls', { frames }), p('worker.split.qr'), p('worker.split.same')] : []),
    ...(typeof length === 'number' && Number.isFinite(length) && length > 0 ? [p('worker.split.label_length', { length: workerRawQuantity(length) })] : [])];
}
