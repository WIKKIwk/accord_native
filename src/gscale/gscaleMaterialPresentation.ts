import { formatArchiveTimestamp, type ArchivePrintEntry, type ArchiveSession } from './gscaleArchive';
import { formatCompactKg } from './gscalePreparation';

type Detail = readonly [label: string, value: string];
const text = (value: unknown) => value == null ? '' : String(value).trim();
const objects = (value: unknown): Record<string, unknown>[] => Array.isArray(value)
  ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row)) : [];

/** @v2 _ArchiveSessionDetailsSheet details; used only by the Material receipt entry. */
export function materialArchiveDetails(batch: ArchiveSession): Detail[] {
  const net = batch.net_qty > 0 ? batch.net_qty : batch.total_qty, gross = batch.gross_qty > 0 ? batch.gross_qty : net;
  const unit = batch.unit || 'kg', formula = batch.preparation_formula;
  const result: Detail[] = [['Holat', batch.active ? 'ACTIVE' : 'CLOSED']];
  if (batch.batch_code.trim()) result.push(['Batch', batch.batch_code]);
  if (batch.warehouse.trim()) result.push(['Ombor', batch.warehouse]);
  if (Object.keys(formula).length) {
    result.push(['Shnek formulasi', text(formula.variant_name)], ['Homashyo', text(formula.material_name)],
      ['Formula olingan', formatArchiveTimestamp(text(formula.captured_at))]);
    for (const entry of objects(formula.formulas)) result.push([`Shnek ${text(entry.name)} (${text(entry.share_percent)}%)`,
      objects(entry.lines).map(line => `${text(line.name) || text(line.item_code)}: ${text(line.percent)}%`).join('\n')]);
  }
  if (batch.started_at.trim()) result.push(['Boshlangan', formatArchiveTimestamp(batch.started_at)]);
  if (batch.ended_at.trim()) result.push(['Tugagan', formatArchiveTimestamp(batch.ended_at)]);
  result.push(['Brutto / netto', `${formatCompactKg(gross)} / ${formatCompactKg(net)} ${unit}`]);
  if (batch.tare_enabled && batch.tare_kg > 0) result.push(['Tara', `${formatCompactKg(batch.tare_kg)} ${unit}`]);
  result.push(['Printlar', `${batch.print_count} ta`]);
  return result;
}

/** @v2 _formatArchiveSessionSubtitle */
export function materialArchiveSubtitle(batch: ArchiveSession) {
  return [batch.active ? 'ACTIVE' : 'CLOSED', batch.started_at ? `Started ${formatArchiveTimestamp(batch.started_at)}` : '',
    batch.ended_at ? `Ended ${formatArchiveTimestamp(batch.ended_at)}` : '', batch.warehouse,
    Object.keys(batch.preparation_formula).length ? `Formula: ${text(batch.preparation_formula.variant_name)}` : '',
    batch.tare_enabled && batch.tare_kg > 0 ? `Tare ${formatCompactKg(batch.tare_kg)} kg` : ''].filter(Boolean).join(' • ');
}

/** @v2 _showArchiveReceiptQr details */
export function materialArchiveReceiptDetails(batch: ArchiveSession, entry: ArchivePrintEntry): Detail[] {
  return [...(entry.draft_name ? [['Kirim raqami', entry.draft_name] as const] : []),
    ['Miqdor', `B ${formatCompactKg(entry.gross_qty)} / N ${formatCompactKg(entry.net_qty)} ${entry.unit}`],
    ['Ombor', batch.warehouse], ...(Object.keys(batch.preparation_formula).length ? [['Shnek formulasi', text(batch.preparation_formula.variant_name)] as const] : [])];
}
export function materialArchivePrintLabel(entry: ArchivePrintEntry) {
  return `B ${formatCompactKg(entry.gross_qty)} / N ${formatCompactKg(entry.net_qty)} ${entry.unit}`;
}
export function materialArchivePrintSubtitle(entry: ArchivePrintEntry) {
  return [formatArchiveTimestamp(entry.printed_at), entry.draft_name, entry.status].filter(Boolean).join(' • ');
}

/** @v2 _confirmArchivePrint message; confirmation uses source Yo‘q / Ha labels. */
export function materialArchivePrintConfirmation(batch: ArchiveSession) {
  const net = batch.net_qty > 0 ? batch.net_qty : batch.total_qty, gross = batch.gross_qty > 0 ? batch.gross_qty : net;
  const unit = batch.unit || 'kg', item = batch.item_name || batch.item_code || '-';
  return ['Shu partiya uchun QR chop etamizmi?', '', `Mahsulot: ${item}`,
    `Jami: BRUTTO ${formatCompactKg(gross)} ${unit} / NETTO ${formatCompactKg(net)} ${unit}`,
    `Sana: ${formatArchiveTimestamp(batch.ended_at || batch.started_at)}`].join('\n');
}

/** @v2 _BatchContextSummary */
export function materialReceiptContextSummary(value: { itemName: string; warehouse: string; width: number | null; micron: number | null;
  length: number | null; quantitySource: string; babina: boolean; tareKg: number }) {
  return [[value.itemName, value.width != null ? `${formatCompactKg(value.width)} mm` : '', value.micron != null ? `${formatCompactKg(value.micron)} mikron` : '',
    value.length != null ? `${formatCompactKg(value.length)} m` : ''].filter(Boolean).join(' • '),
  `Ombor: ${value.warehouse} • ${value.quantitySource === 'manual' ? 'Qo‘lda kg' : 'Tarozidan kg'} • ${value.babina ? `Babina: ${formatCompactKg(value.tareKg)} kg` : 'Babina: Yo‘q'}`];
}
