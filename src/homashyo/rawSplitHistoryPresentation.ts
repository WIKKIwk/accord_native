import { RawSplitIssue, RawSplitResult, RawSplitRoll, rawSplitDisplay, rawSplitLocalDateTime, rawSplitParseDateTime } from './rawSplitModel';
const two = (value: number) => String(value).padStart(2, '0');
/** @v2 _rawSplitTitle */
export const rawSplitHistoryTitle = (result: RawSplitResult): string =>
  `${rawSplitDisplay(result.sourceKg)} → ${rawSplitDisplay(result.outputKg)} kg`;
/** @v2 _rawSplitSubtitle */
export function rawSplitHistorySubtitle(result: RawSplitResult): string {
  return [result.source.warehouse.trim(), `${result.outputs.length} rulon`, `${rawSplitDisplay(result.wasteKg)} kg chiqindi`]
    .filter(Boolean).join(' • ');
}
/** @v2 _rawSplitTime */
export function rawSplitHistoryTime(raw: string | null, now = new Date()): string {
  if (raw === null || !raw.trim()) return '';
  const value = raw.trim(); let time: Date;
  try { time = rawSplitParseDateTime(value).date; } catch { return value; }
  const clock = `${two(time.getHours())}:${two(time.getMinutes())}`;
  return time.getFullYear() === now.getFullYear() && time.getMonth() === now.getMonth() && time.getDate() === now.getDate()
    ? clock : `${two(time.getDate())}.${two(time.getMonth() + 1)} ${clock}`;
}
export function rawSplitIssueFullTime(issue: RawSplitIssue): string {
  return rawSplitLocalDateTime(issue.createdAt, issue.createdAtMicrosecond);
}
export function rawSplitIssueTime(issue: RawSplitIssue): string {
  const time = issue.createdAt;
  return `${two(time.getDate())}.${two(time.getMonth() + 1)} ${two(time.getHours())}:${two(time.getMinutes())}`;
}
export function rawSplitOutputSummary(output: RawSplitRoll): string {
  return `${rawSplitDisplay(output.kg)} kg · ${rawSplitDisplay(output.widthMm)} mm · ${rawSplitDisplay(output.micron)} mkm` +
    (output.lengthM !== null && output.lengthM ? ` · ${rawSplitDisplay(output.lengthM)} m` : '');
}
export function rawSplitIssueOutputSummary(output: Record<string, unknown>): string {
  return `${rawSplitDisplay(output.width_mm as string)} mm · Og‘irlik: ${rawSplitDisplay(output.gross_kg as string)} kg · ` +
    `Babina: ${rawSplitDisplay(output.bobina_kg as string)} kg · Netto: ${rawSplitDisplay(output.kg as string)} kg`;
}

export type RawSplitDetailRow = { label: string; value: string };

// V2 RawSplitDetailsSheet, raw_material_split_result_view.dart:343-364.
export function rawSplitResultDetailRows(result: RawSplitResult): RawSplitDetailRow[] {
  return [
    { label: 'Manba QR', value: result.source.barcode },
    { label: 'Ombor', value: result.source.warehouse },
    ...(result.createdAt !== null ? [{ label: 'Vaqti', value: result.createdAt }] : []),
    ...(result.issueId !== null ? [
      { label: 'Farq', value: result.differenceLabel },
      { label: 'Sabab', value: result.issueNote ?? '' },
    ] : []),
  ];
}

// V2 RawSplitIssueDetailsSheet, raw_material_split_result_view.dart:545-561.
export function rawSplitIssueDetailRows(issue: RawSplitIssue): RawSplitDetailRow[] {
  return [
    { label: 'QR', value: issue.source.barcode },
    { label: 'Asl', value: `${rawSplitDisplay(issue.source.kg)} kg · Atxot: ${issue.enteredWaste === '' ? 'kiritilmagan' : issue.enteredWaste} kg` },
    ...issue.outputs.map((output, index) => ({ label: `${index + 1}-rulon`, value: rawSplitIssueOutputSummary(output) })),
  ];
}
