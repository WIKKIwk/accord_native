import { preparationEstimatedKgDisplay, preparationFormulaSharesComplete, preparationRequiredKg, preparationScrewLineKg,
  preparationDisplay, type PreparationFormula } from './preparationModel';
import type { PreparationFormulaOptions } from './usePreparationFormula';

export function preparationFormulaHeading(options: PreparationFormulaOptions, estimatedKg: string | null) {
  const customer = options.customerName?.trim() ?? '', material = options.materialName.trim() || options.materialId.trim();
  const subtitle = customer ? (options.productTitle ? `${customer} • ${options.productTitle}` : customer) : options.productTitle;
  const context = [material, options.variantCode?.trim(), options.orderCode.trim()].filter(Boolean).join(' • ');
  const code = options.manageSavedFormula && options.variantCode
    ? `Formula kodi: ${options.variantCode}`
    : `${options.manageSavedFormula ? 'Komplekt kodi' : 'Buyurtma kodi'}: ${options.orderCode || '-'}`;
  const estimate = options.manageSavedFormula ? null : estimatedKg == null ? 'Taxminiy kg hisobi hozir mavjud emas'
    : `${options.materialName}: ≈ ${preparationEstimatedKgDisplay(estimatedKg)} kg (taxminiy)`;
  return { context, code, subtitle, estimate };
}

export function preparationFormulaCard(formula: PreparationFormula, formulas: readonly PreparationFormula[], estimatedKg: string | null) {
  const eligible = preparationFormulaSharesComplete(formulas) && estimatedKg !== null && formula.share_percent !== null;
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
  return { count: `${formula.lines.length} ta seriyo`, share,
    lines: formula.lines.map(line => `${line.name || line.item_code} • ${preparationDisplay(line.percent)}%${estimate(line.percent)}`) };
}
