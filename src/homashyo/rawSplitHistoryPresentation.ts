import { RawSplitIssue, RawSplitResult, RawSplitRoll, rawSplitDisplay } from './rawSplitModel';
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
  const value = raw.trim(), dateOnly = /^(\d{4})-(\d\d)-(\d\d)$/.exec(value);
  const time = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(value);
  if (!Number.isFinite(time.getTime())) return value;
  const clock = `${two(time.getHours())}:${two(time.getMinutes())}`;
  return time.getFullYear() === now.getFullYear() && time.getMonth() === now.getMonth() && time.getDate() === now.getDate()
    ? clock : `${two(time.getDate())}.${two(time.getMonth() + 1)} ${clock}`;
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
