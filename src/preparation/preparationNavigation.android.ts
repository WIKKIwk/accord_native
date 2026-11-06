import { router, type Href } from 'expo-router';
import { serializeGScaleModeArgs, type GScaleModeArgs } from '../gscale/gscaleRouteArgs';
import type { PreparationFormulaOptions } from './usePreparationFormula';
import { preparationDecimal, preparationDecimalText, preparationDisplay, preparationEstimatedKgDisplay,
  preparationFormulaSharesComplete, preparationRequiredKg, preparationScrewLineKg, type PreparationFormula } from './preparationModel';

export function openPreparationFormula(options: PreparationFormulaOptions) {
  router.push({ pathname: '/android-preparation/formula', params: { data: JSON.stringify(options) } } as unknown as Href);
}
export function openPreparationScale(args: GScaleModeArgs = {}) {
  router.push({ pathname: '/android-gscale', params: serializeGScaleModeArgs(args) } as unknown as Href);
}
export function readPreparationRouteData<T>(data: string | string[] | undefined): T | null {
  try { return typeof data === 'string' ? JSON.parse(data) as T : null; } catch { return null; }
}

export function preparationShareDisplay(values: readonly string[]) {
  try {
    const total = values.reduce((sum, value) => {
      const parsed = preparationDecimal(value);
      if (parsed > 100000000n) throw new Error('Invalid share');
      return sum + parsed;
    }, 0n);
    return { valid: values.length > 0 && total === 100000000n, total: preparationDisplay(preparationDecimalText(total)) };
  } catch { return { valid: false, total: null }; }
}

export function preparationJournalDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '—';
  const two = (number: number) => String(number).padStart(2, '0');
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

export function preparationRecipeLines(recipe: Record<string, unknown> | null): string[] {
  if (!recipe || !Object.keys(recipe).length) return ['Formula qayd etilmagan'];
  const lines = [`Shnek formulasi: ${String(recipe.variant_name ?? '—')}`];
  if (recipe.variant_code != null) lines.push(`Formula kodi: ${String(recipe.variant_code)}`);
  lines.push(`Saqlangan tarkib • ${preparationJournalDate(String(recipe.captured_at ?? ''))}`);
  if (Array.isArray(recipe.formulas)) for (const value of recipe.formulas) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const screw = value as Record<string, unknown>;
    lines.push(`Shnek ${String(screw.name ?? '')} • ${preparationDisplay(String(screw.share_percent ?? '—'))}%`);
    if (Array.isArray(screw.lines)) for (const entry of screw.lines) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const line = entry as Record<string, unknown>;
      lines.push(`${String(line.name ?? line.item_code ?? '')} — ${preparationDisplay(String(line.percent ?? '—'))}%`);
    }
  }
  return lines;
}

export function preparationFormulaPresentation(formula: PreparationFormula, all: readonly PreparationFormula[], estimatedKg: string | null) {
  const eligible = preparationFormulaSharesComplete(all) && estimatedKg !== null && formula.share_percent !== null;
  const estimate = (linePercent?: string) => {
    if (!eligible) return '';
    try {
      const kg = linePercent === undefined ? preparationRequiredKg(estimatedKg!, formula.share_percent!)
        : preparationScrewLineKg(estimatedKg!, formula.share_percent!, linePercent);
      return ` • ≈ ${preparationEstimatedKgDisplay(kg)} kg`;
    } catch { return ''; }
  };
  const share = formula.share_percent === null ? 'Shnek ulushi belgilanmagan'
    : `Shnek ulushi: ${preparationDisplay(formula.share_percent)}%${estimate()}`;
  return [share, ...formula.lines.map(line => `${line.name || line.item_code}: ${preparationDisplay(line.percent)}%${estimate(line.percent)}`)].join('\n');
}
