import type { AdminApparatus } from '../apparatusApi';
import type { RawMaterialAssignmentCandidate } from '../shared/rawMaterialAssignmentApi';
import type { AdminRawMaterialAssignment } from '../workerRawMaterials';
import type { MaterialSequenceOrder } from './materialSequenceModel';
import { sequenceAssignmentBarcodeKey, type MaterialSequenceAssignmentState, type SequenceAssignmentText } from './materialSequenceAssignmentController';

const mm = (value: number) => `${(Object.is(value, -0) ? '-0.0' : value.toFixed(1)).replace(/\.0$/, '')} mm`;
const qty = (value: number, unit: string) => `${(Object.is(value, -0) ? '-0.000' : value.toFixed(3)).replace(/\.?0+$/, '')}${unit.trim() ? ` ${unit.trim()}` : ''}`;
const canonicalName = (id: string, catalog: readonly AdminApparatus[]) => new Map(catalog.filter(row => row.id.trim() && row.name.trim())
  .map(row => [row.id.trim(), row.name.trim()])).get(id.trim()) ?? id.trim();

/** @v2 _sequenceMinimumAcceptedRollWidthMm */
/** @v2 _sequenceMinimumAcceptedRollWidthMmForOrder */
/** @v2 _sequenceMaximumAcceptedRollWidthMm */
export function materialSequenceWidthRequirement(order: MaterialSequenceOrder, candidates: readonly RawMaterialAssignmentCandidate[],
  apparatus: AdminApparatus | undefined, t: SequenceAssignmentText) {
  const widths = candidates.map(row => row.order_width_mm).filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  const operation = apparatus?.operation.trim().toLowerCase(), laminated = operation === 'laminate' || operation === 'glue';
  const orderWidth = order.map.width_mm, orderMinimum = orderWidth !== null && Number.isFinite(orderWidth) && orderWidth > 0 &&
    (operation === 'print' || laminated) ? orderWidth : null;
  const minimum = widths.length ? Math.min(...widths) : orderMinimum;
  if (minimum === null) return '';
  const maximum = operation === 'print' ? minimum + 20 : laminated ? minimum + 30 : null;
  return maximum === null ? t('production.assignment.minimum_width', { value: mm(minimum) })
    : t('production.assignment.width_range', { min: mm(minimum), max: mm(maximum) });
}

/** @v2 _SequenceCandidateCard */
export function materialSequenceCandidatePresentation(candidate: RawMaterialAssignmentCandidate, index: number,
  state: MaterialSequenceAssignmentState, catalog: readonly AdminApparatus[], t: SequenceAssignmentText) {
  const rawTitle = candidate.item_name.trim() || candidate.item_code.trim(), key = sequenceAssignmentBarcodeKey(candidate.barcode);
  const selected = state.selectedKeys.has(key), selectionMode = state.selectedKeys.size > 0;
  const busy = state.assigningBarcode === key || (state.bulkAssigning && selected);
  const details: string[] = [];
  if (candidate.warehouse.trim()) details.push(t('production.assignment.warehouse', { value: candidate.warehouse.trim() }));
  for (const [value, label] of [[candidate.order_width_mm, 'order_width'], [candidate.roll_width_mm, 'roll_width'],
    [candidate.leftover_width_mm, 'leftover_width']] as const) {
    if (value !== null) details.push(t(`production.assignment.${label}`, { value: mm(value) }));
  }
  return { raw: candidate, key, rank: index + 1, title: rawTitle || t('production.assignment.unnamed'),
    subtitle: [candidate.item_code.trim() && candidate.item_code.trim() !== rawTitle ? candidate.item_code.trim() : '',
      candidate.barcode.trim() ? `QR ${candidate.barcode.trim()}` : '', candidate.qty > 0 ? qty(candidate.qty, candidate.uom) : ''].filter(Boolean).join(' • '),
    details, matchLabel: t(`production.assignment.${candidate.match_type.trim() === 'exact_width' ? 'exact'
      : candidate.match_type.trim() === 'closest_width' ? 'closest' : 'compatible'}`),
    groupApparatus: candidate.item_group.trim() ? t('production.assignment.group_apparatus', { group: candidate.item_group.trim(),
      apparatus: [...new Set(candidate.apparatus_options.map(id => id.trim()))].filter(Boolean).map(id => canonicalName(id, catalog)).sort().join(', ') }) : '',
    selected, busy, selectionMode, actionLabel: t(busy ? 'production.assignment.linking'
      : selectionMode ? selected ? 'production.assignment.selected_label' : 'production.assignment.select' : 'production.assignment.link') };
}

/** @v2 _SequenceAssignedMaterialRow */
export function materialSequenceAssignedPresentation(row: AdminRawMaterialAssignment, catalog: readonly AdminApparatus[], t: SequenceAssignmentText) {
  return { raw: row, key: sequenceAssignmentBarcodeKey(row.barcode),
    title: row.item_name.trim() || row.item_code.trim() || t('production.assignment.connected'),
    subtitle: [row.barcode.trim(), row.apparatus.trim() ? canonicalName(row.apparatus, catalog) : '', row.stock_warehouse.trim()].filter(Boolean).join(' • ') };
}
