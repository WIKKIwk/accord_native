import { rawSplitOutputNet, type RawSplitOutputDraft } from './rawSplitDraft';
import { RawSplitRoll, rawSplitDecimal, rawSplitDisplay, rawSplitQuantity } from './rawSplitModel';
import { RawSplitWidthPlan, rawSplitMinimumWidth } from './rawSplitWidthPlan';

/** @v2 _OutputDraft.netLabel */
export function rawSplitNetLabel(output: RawSplitOutputDraft): string {
  try { return `Netto: ${rawSplitDisplay(rawSplitDecimal(rawSplitOutputNet(output)))} kg`; }
  catch { return 'Netto: —'; }
}
/** @v2 _RawMaterialSplitScreenState._widthSummary */
export function rawSplitWidthSummary(plan: RawSplitWidthPlan, outputs: readonly RawSplitOutputDraft[]): string {
  if (!plan.valid || outputs.every(output => !output.width.trim())) return `Ko‘pi bilan ${plan.maxRolls} ta rulon · eng kam eni 355 mm`;
  if (plan.remaining === 0n) return 'En to‘liq taqsimlandi';
  const remaining = rawSplitDisplay(rawSplitDecimal(plan.remaining));
  return plan.remaining < rawSplitMinimumWidth ? `Qolgan ${remaining} mm — atxot` : `Qolgan ${remaining} mm — yana rulon kiriting`;
}
/** @v2 _RawMaterialSplitScreenState._wasteWidthLabel */
export function rawSplitWasteWidthLabel(plan: RawSplitWidthPlan): string | null {
  if (!plan.valid || !plan.complete) return null;
  const remaining = rawSplitDisplay(rawSplitDecimal(plan.remaining));
  return plan.remaining >= rawSplitMinimumWidth ? `Yana rulon kerak: ${remaining} mm` : `Atxotga ketadi: ${remaining} mm`;
}
/** @v2 _RawMaterialSplitScreenState._balance */
export function rawSplitBalance(source: RawSplitRoll, outputs: readonly RawSplitOutputDraft[], waste: string): string {
  try {
    const sum = outputs.reduce((value, output) => value + rawSplitOutputNet(output), 0n), wasted = rawSplitQuantity(waste);
    const delta = rawSplitQuantity(source.kg) - sum - wasted;
    const prefix = `Chiqish: ${rawSplitDisplay(rawSplitDecimal(sum))} kg · Chiqindi: ${rawSplitDisplay(rawSplitDecimal(wasted))} kg`;
    return `${prefix}\n${delta === 0n ? 'Hisob teng ✓' : delta < 0n ? 'Asl kg dan oshib ketdi' : `Kiritilmagan: ${rawSplitDisplay(rawSplitDecimal(delta))} kg`}`;
  } catch { return 'Og‘irlik, babina va 0 dan katta atxot kg ni kiriting.'; }
}
export function rawSplitSourceSummary(source: RawSplitRoll): string {
  return `${rawSplitDisplay(source.kg)} kg · ${rawSplitDisplay(source.widthMm)} mm · ${rawSplitDisplay(source.micron)} mkm` +
    (source.lengthM !== null && source.lengthM ? ` · ${rawSplitDisplay(source.lengthM)} m` : '');
}
