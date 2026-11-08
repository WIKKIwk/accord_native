import * as Crypto from 'expo-crypto';
import { RawSplitRoll, RawSplitWasteCheck, rawSplitDecimal, rawSplitQuantity } from './rawSplitModel';
import { RawSplitWidthPlan, rawSplitMinimumWidth } from './rawSplitWidthPlan';

export type RawSplitOutputField = 'width' | 'gross' | 'bobina' | 'length';
export type RawSplitOutputDraft = { id?: string; width: string; gross: string; bobina: string; length: string };
export class RawSplitWasteInputError extends Error {}
/** @v2 newRawSplitRequestId */
export async function newRawSplitRequestId(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return `split-${Date.now() * 1000}-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
/** @v2 _OutputDraft.net */
export function rawSplitOutputNet(output: RawSplitOutputDraft): bigint {
  const net = rawSplitQuantity(output.gross) - rawSplitQuantity(output.bobina, true);
  if (net <= 0n) throw new Error('Rulon og‘irligi babina kg dan katta bo‘lsin');
  return net;
}
/** @v2 _RawMaterialSplitScreenState._confirmWidth */
export function rawSplitConfirmWidth(sourceWidth: string, outputs: readonly RawSplitOutputDraft[]): RawSplitOutputDraft[] {
  const plan = new RawSplitWidthPlan(sourceWidth, outputs.map(output => output.width));
  if (!plan.valid || plan.remaining >= rawSplitMinimumWidth) return [...outputs];
  const retained = [...outputs];
  for (const output of outputs) {
    if (retained.length <= 1) break;
    if ([output.width, output.gross, output.bobina, output.length].every(value => !value.trim())) {
      const index = retained.indexOf(output); if (index >= 0) retained.splice(index, 1);
    }
  }
  return retained;
}
/** @v2 _RawMaterialSplitScreenState._payload */
export function buildRawSplitPayload(input: { source: RawSplitRoll; outputs: readonly RawSplitOutputDraft[]; waste: string;
  issue: boolean; issueSaved: boolean; savedIssueId: string | null; requestId: string }): Record<string, unknown> {
  const { source, outputs, waste } = input;
  new RawSplitWidthPlan(source.widthMm, outputs.map(output => output.width)).validateForSave();
  let sum = 0n;
  const rows = outputs.map(output => {
    if (!output.gross.trim() || !output.bobina.trim()) throw new Error('Har bir rulonning og‘irligi va babina kg ini kiriting');
    if (!output.length.trim()) throw new Error('Har bir rulonning metrajini kiriting');
    const kg = rawSplitOutputNet(output), width = rawSplitQuantity(output.width), length = rawSplitQuantity(output.length);
    if (width > rawSplitQuantity(source.widthMm)) throw new Error('Chiqish eni asl rulondan katta');
    sum += kg;
    return { kg: rawSplitDecimal(kg), width_mm: rawSplitDecimal(width), gross_kg: rawSplitDecimal(rawSplitQuantity(output.gross)),
      bobina_kg: rawSplitDecimal(rawSplitQuantity(output.bobina, true)), length_m: rawSplitDecimal(length) };
  });
  const check = new RawSplitWasteCheck(rawSplitQuantity(source.kg), sum, waste);
  const useIssue = !input.issue && check.kind !== null && input.issueSaved && input.savedIssueId !== null;
  if (!input.issue && check.kind !== null && (!useIssue || check.waste === null)) throw new RawSplitWasteInputError();
  if (input.issue && check.kind === null) throw new Error('Hisob teng, vazn xatosi yo‘q');
  return { request_id: input.requestId, ...(useIssue ? { issue_id: input.savedIssueId } : {}), source_barcode: source.barcode,
    expected_revision: source.revision, expected_kg: source.kg, expected_width_mm: source.widthMm, expected_micron: source.micron,
    waste_kg: input.issue ? waste.trim() : rawSplitDecimal(check.waste!), outputs: rows };
}
