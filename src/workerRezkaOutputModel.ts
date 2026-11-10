import { rezkaFrameAt, rezkaFrameIssueNote, rezkaFramePeremotkaReason, type AdminRecordedRezkaFrame, type AdminRezkaOutputReport } from './workerRezkaReport';
import { isAsciiCanonicalApparatusId } from './shared/dartApparatus';

type Obj = Record<string, any>;
export type RezkaFrameDraft = { meter: string; kg: string; bobina: string; diameter: string; note: string };
export type RezkaOutputWaste = { total: string; print: string; lamination: string; edge: string };
export type RezkaOutputDeviation = { index: number; referenceIndex: number; field: 'kg' | 'meter' | 'diameter'; reference: number; entered: number; percent: number; approval: string };
export const emptyRezkaFrame = (): RezkaFrameDraft => ({ meter: '', kg: '', bobina: '', diameter: '', note: '' });
export const rezkaQty = (raw: unknown): number | null => {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (typeof raw === 'string' && !raw.trim()) return null;
  if (typeof raw === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim().replaceAll(',', '.'))) return null;
  const value = typeof raw === 'number' ? raw : Number(raw.trim().replaceAll(',', '.'));
  return Number.isFinite(value) ? value : null;
};
const positive = (raw: unknown) => (rezkaQty(raw) ?? 0) > 0;

/** @v2 _ProgressQtyDialogState._rezkaFrameMetricsComplete */
export function rezkaFrameInput(draft: RezkaFrameDraft, includeBobina: boolean, peremotka = ''): Obj {
  if (![draft.meter, draft.kg, draft.diameter, ...(includeBobina ? [] : [draft.bobina])].every(positive)) throw new Error(includeBobina ? 'worker.rezka.print.fill_roll_with_bobina' : 'worker.rezka.print.fill_roll');
  const meter = rezkaQty(draft.meter)!, kg = rezkaQty(draft.kg)!, bobina = includeBobina ? null : rezkaQty(draft.bobina);
  if (bobina != null && kg < 1e12 && bobina < 1e12 && Math.round(kg * 1e6) > 0 && Math.round(bobina * 1e6) > Math.round(kg * 1e6)) throw new Error('worker.progress.qty.bobina_exceeds_gross');
  return { produced_qty: meter, finished_goods_meter: meter, gross_qty: kg, finished_goods_kg: kg,
    ...(bobina != null ? { bobina_kg: bobina } : {}), diameter: rezkaQty(draft.diameter), ...(peremotka ? { peremotka_reason: peremotka } : {}) };
}

/** @v2 _RezkaDeviationWarning._rezkaInputFromSaved */
export function rezkaSavedInput(frame: AdminRecordedRezkaFrame): Obj {
  const input = frame.input, meter = rezkaQty(input.produced_qty ?? input.finished_goods_meter), kg = rezkaQty(input.gross_qty ?? input.finished_goods_kg);
  return { ...(meter != null ? { produced_qty: meter, finished_goods_meter: meter } : {}), ...(kg != null ? { gross_qty: kg, finished_goods_kg: kg } : {}),
    ...(rezkaQty(input.bobina_kg) != null ? { bobina_kg: rezkaQty(input.bobina_kg) } : {}), ...(rezkaQty(input.diameter) != null ? { diameter: rezkaQty(input.diameter) } : {}),
    ...(rezkaFrameIssueNote(frame) ? { issue_note: rezkaFrameIssueNote(frame) } : {}), ...(rezkaFramePeremotkaReason(frame) ? { peremotka_reason: rezkaFramePeremotkaReason(frame) } : {}) };
}
export function rezkaSavedDraft(frame: AdminRecordedRezkaFrame): RezkaFrameDraft {
  const input = rezkaSavedInput(frame), value = (key: string) => input[key] == null ? '' : String(input[key]);
  return { meter: value('produced_qty'), kg: value('gross_qty'), bobina: value('bobina_kg'), diameter: value('diameter'), note: value('issue_note') };
}
/** @v2 _RezkaFramePrint._rezkaSavedFrameMatchesRequest */
export function rezkaSavedMatches(frame: AdminRecordedRezkaFrame, input: Obj): boolean {
  const saved = rezkaSavedInput(frame);
  return ['produced_qty', 'gross_qty', 'bobina_kg', 'diameter'].every(key => rezkaQty(saved[key]) === rezkaQty(input[key])) &&
    (saved.issue_note ?? '') === (input.issue_note ?? '') && (saved.peremotka_reason ?? '') === (input.peremotka_reason ?? '');
}

/** @v2 rezkaOutputDeviationPercent */
export function rezkaDeviationPercent(reference: number | null, actual: number | null): number | null {
  if (reference == null || actual == null || !Number.isFinite(reference) || !Number.isFinite(actual) || reference <= 0 || actual <= 0) return null;
  const relative = actual / reference - 1;
  if (Math.abs(relative) <= 0.1 + 1e-12) return null;
  const percent = relative * 100;
  return Number.isFinite(percent) ? percent : Number.MAX_VALUE;
}

/** @v2 _RezkaDeviationWarning._confirmRezkaOutputDeviations */
export function rezkaOutputDeviations(report: AdminRezkaOutputReport, pending: Map<number, Obj>): RezkaOutputDeviation[] {
  const healthy = (frame: AdminRecordedRezkaFrame) => !rezkaFrameIssueNote(frame) && !rezkaFramePeremotkaReason(frame);
  const reference = (report.reference_frame_index ? report.frames.find(frame => frame.index === report.reference_frame_index && healthy(frame)) : null) ?? report.frames.find(healthy);
  const entries = [...pending].sort((a, b) => a[0] - b[0]);
  const first = reference ? [reference.index - 1, rezkaSavedInput(reference)] as const : entries.find(([, input]) => !input.issue_note);
  if (!first) return [];
  const [referenceIndex, input] = first, result: RezkaOutputDeviation[] = [];
  for (const [index, entered] of entries) {
    if (index === referenceIndex || entered.issue_note || rezkaFrameAt(report, index)) continue;
    for (const [field, key] of [['kg', 'gross_qty'], ['meter', 'produced_qty'], ['diameter', 'diameter']] as const) {
      const expected = rezkaQty(input[key]), actual = rezkaQty(entered[key]), percent = rezkaDeviationPercent(expected, actual);
      if (percent != null) result.push({ index, referenceIndex, field, reference: expected!, entered: actual!, percent,
        approval: JSON.stringify([report.cycle_id, referenceIndex, index, field, expected, actual]) });
    }
  }
  return result;
}

/** @v2 productionMapIncludesBobinaInOutputNet */
export function rezkaStageOptions(map: Obj, stageId: string) {
  const nodes: Obj[] = Array.isArray(map.nodes) ? map.nodes : [], edges: Obj[] = Array.isArray(map.edges) ? map.edges : [];
  const physical = (value: Obj) => value.kind === 'apparatus' && isAsciiCanonicalApparatusId(String(value.alternative_group_id ?? '').trim() ? String(value.apparatus_id ?? '') : String(value.alternative_assigned_apparatus_id ?? '').trim() || String(value.apparatus_id ?? ''));
  const node = nodes.find(value => String(value.id).trim() === stageId.trim() && physical(value));
  if (!node || !stageId) return { includeBobina: false, printCount: 1 };
  const byId = new Map(nodes.map(value => [value.id, value]));
  const successors = (id: string): string[] => {
    const source = byId.get(id), group = source?.kind === 'apparatus' ? String(source.alternative_group_id ?? '').trim() : '';
    const operation = new Set(group ? nodes.filter(value => value.kind === 'apparatus' && String(value.alternative_group_id ?? '').trim() === group).map(value => value.id) : [id]);
    return edges.filter(edge => operation.has(edge.from) && !operation.has(edge.to) && (byId.get(edge.from)?.kind !== 'condition' ||
      ['ha', 'yes', 'true', '1', "yo'q", 'yoq', 'no', 'false', '0'].includes(String(edge.branch ?? '').trim().toLowerCase()))).map(edge => edge.to);
  };
  const start = nodes.find(value => value.kind === 'start'), reachable = new Set<string>(), route = start ? [start.id] : [];
  for (let index = 0; index < route.length; index++) {
    const id = route[index]; if (reachable.has(id)) continue; reachable.add(id); route.push(...successors(id));
    const source = byId.get(id), group = source?.kind === 'apparatus' ? String(source.alternative_group_id ?? '').trim() : '';
    if (group) nodes.filter(value => value.kind === 'apparatus' && String(value.alternative_group_id ?? '').trim() === group).forEach(value => reachable.add(value.id));
  }
  if (!reachable.has(node.id)) return { includeBobina: false, printCount: 1 };
  const pending = successors(node.id), seen = new Set<string>();
  let hasNext = false;
  for (let index = 0; index < pending.length; index++) {
    const id = pending[index]; if (seen.has(id)) continue; seen.add(id);
    const next = byId.get(id); if (!next || next.kind === 'end') continue;
    if (physical(next)) hasNext = true;
    else pending.push(...successors(id));
  }
  return { includeBobina: !hasNext && map.include_bobina_in_net === true, printCount: !hasNext && map.duplicate_rezka_labels === true ? 2 : 1 };
}

/** @v2 _ProgressQtyDialogState._submit */
export function rezkaOutputBody(input: { apparatus: string; orderId: string; action: string; report: AdminRezkaOutputReport;
  frames: Obj[]; waste: RezkaOutputWaste; note: string; fullReport: boolean; totalWasteOnly: boolean; freezeRequest?: string }) {
  const { report, frames } = input, first = frames.find(frame => !frame.issue_note), allIssues = frames.every(frame => !!frame.issue_note);
  const wasteKeys = { total: 'total_waste', print: 'rezka_bosma_waste', lamination: 'rezka_lamination_waste', edge: 'rezka_edge_waste' } as const;
  const waste: Obj = {};
  for (const [key, value] of Object.entries(input.waste)) {
    if (input.totalWasteOnly && key !== 'total') continue;
    if (!value.trim()) continue;
    const number = rezkaQty(value);
    if (number == null || number < 0) throw new Error('worker.daily.invalid_number');
    waste[wasteKeys[key as keyof typeof wasteKeys]] = number;
  }
  if (!allIssues && input.action === 'complete' && (input.totalWasteOnly ? waste.total_waste == null : input.fullReport && !Object.values(waste).some(value => (value as number) > 0))) throw new Error('worker.progress.qty.completion_reason');
  return { apparatus: input.apparatus, order_id: input.orderId, action: input.action, include_control: true, uom: 'm',
    rezka_output_cycle: report.cycle_id, rezka_frames: frames, ...(first ? { produced_qty: first.produced_qty, gross_qty: first.gross_qty,
      ...(first.bobina_kg != null ? { bobina_kg: first.bobina_kg } : {}), diameter: first.diameter } : {}), ...waste,
    ...(input.fullReport && !input.totalWasteOnly ? { full_completion_report_required: true } : {}),
    ...(input.note.trim() ? { completion_request_note: input.note.trim() } : {}), ...(input.freezeRequest ? { freeze_request_id: input.freezeRequest } : {}) };
}
