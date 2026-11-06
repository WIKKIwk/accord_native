import { preparationDisplay, type preparationFormulaCatalogEntryFromJson, type preparationFormulaSetFromJson } from './preparationModel';

type Recipe = ReturnType<typeof preparationFormulaCatalogEntryFromJson>;
type FormulaSet = ReturnType<typeof preparationFormulaSetFromJson>;
type ScopedFormula = FormulaSet['formulas'][number];

export const preparationSharedFormulaWarning = 'Katalogdagi o‘zgarishlar formula keyingi safar buyurtmaga biriktirilganda olinadi.';

export function preparationCatalogSubtitle(recipe: Recipe) {
  return [recipe.formula_code, recipe.product_title, recipe.material_name,
    recipe.order_codes.length ? `Buyurtmalar: ${recipe.order_codes.join(', ')}` : ''].filter(Boolean).join(' • ');
}

export function preparationSetSubtitle(set: FormulaSet, count: number) {
  return `${set.set_id}${set.order_codes.length ? '' : '\nMos buyurtma yo‘q'}\n${count} ta formula`;
}

export function preparationSetRecipeSubtitle(recipe: Recipe) {
  return [recipe.formula_code, recipe.material_name].filter(Boolean).join(' • ');
}

export function preparationLegacyFormulaTitle(entry: ScopedFormula) {
  return [entry.variant_name, entry.material_name, entry.formula.name].filter(Boolean).join(' • ');
}

export function preparationLegacyFormulaSubtitle(entry: ScopedFormula) {
  return [entry.formula.share_percent === null ? 'Shnek ulushi belgilanmagan' : `Shnek ulushi: ${preparationDisplay(entry.formula.share_percent)}%`,
    ...(!entry.material_id ? ['Eski formula — homashyo turi belgilanmagan'] : []),
    ...entry.formula.lines.map(line => `${line.name} • ${preparationDisplay(line.percent)}%`)].join('\n');
}

export function preparationSavedFormulaDeleteMessage(name: string) {
  return `«${name}» formulasi o‘chirilsinmi? ${preparationSharedFormulaWarning}`;
}
