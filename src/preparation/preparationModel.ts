export type JsonObject = Record<string, unknown>;

export function jsonObject(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid object');
  return value as JsonObject;
}
export function requiredString(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Invalid string');
  return value;
}
export function optionalString(value: unknown, fallback = ''): string {
  return value == null ? fallback : requiredString(value);
}
export function stringList(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new TypeError('Invalid string list');
  return value as string[];
}
const million = 1000000n;
const hundred = 100000000n;

/** @v2 preparationDecimal */
export function preparationDecimal(raw: string, allowZero = false): bigint {
  const value = raw.trim().replace(/,/g, '.');
  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error('Musbat son kiriting (ko‘pi bilan 6 kasr xona)');
  const [whole, fraction = ''] = value.split('.');
  const units = BigInt(whole) * million + BigInt(fraction.padEnd(6, '0'));
  if ((!allowZero && units === 0n) || units > 999999999999999999n) throw new Error('Miqdor ruxsat etilgan chegaradan tashqarida');
  return units;
}
/** @v2 preparationDecimalText */
export function preparationDecimalText(value: bigint): string {
  return `${value / million}.${(value % million).toString().padStart(6, '0')}`;
}
/** @v2 preparationRequiredKg */
export function preparationRequiredKg(orderKg: string, percent: string): string {
  const kg = preparationDecimal(orderKg), pct = preparationDecimal(percent);
  if (pct > hundred) throw new Error('Foiz 100 dan oshmasligi kerak');
  const result = (kg * pct + 50000000n) / hundred;
  if (!result) throw new Error('Hisoblangan sarf 0.000001 kg dan kichik');
  return preparationDecimalText(result);
}
/** @v2 preparationScrewLineKg */
export function preparationScrewLineKg(materialKg: string, screwPercent: string, seriesPercent: string): string {
  const mass = preparationDecimal(materialKg), screw = preparationDecimal(screwPercent), series = preparationDecimal(seriesPercent);
  if (screw > hundred || series > hundred) throw new Error('Foiz 100 dan oshmasligi kerak');
  const divisor = hundred * hundred, result = (mass * screw * series + divisor / 2n) / divisor;
  if (!result) throw new Error('Hisoblangan sarf 0.000001 kg dan kichik');
  return preparationDecimalText(result);
}
/** @v2 preparationFormulaShareTotal */
export function preparationFormulaShareTotal(formulas: readonly PreparationFormula[]): bigint | null {
  if (!formulas.length) return null;
  let total = 0n;
  for (const formula of formulas) {
    if (formula.share_percent == null) return null;
    try { const value = preparationDecimal(formula.share_percent); if (value > hundred) return null; total += value; }
    catch { return null; }
  }
  return total;
}
/** @v2 preparationFormulaSharesComplete */
export const preparationFormulaSharesComplete = (formulas: readonly PreparationFormula[]): boolean =>
  preparationFormulaShareTotal(formulas) === hundred;
/** @v2 preparationDisplay */
export const preparationDisplay = (value: string): string => value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
/** @v2 preparationEstimatedKgDisplay */
export function preparationEstimatedKgDisplay(value: string): string {
  const hundredths = (preparationDecimal(value) + 5000n) / 10000n;
  return hundredths === 0n ? '< 0.01' : `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, '0')}`;
}

export type PreparationFormulaLine = { item_code: string; name: string; percent: string };
export type PreparationFormula = { product_code: string; formula_code: string; name: string; lines: PreparationFormulaLine[]; share_percent: string | null };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
/** @v2 PreparationFormulaLine */
export function preparationFormulaLineFromJson(value: unknown): PreparationFormulaLine {
  const row = jsonObject(value);
  return { item_code: optionalString(row.item_code).trim(), name: optionalString(row.name).trim(), percent: optionalString(row.percent).trim() };
}
/** @v2 PreparationFormula */
export function preparationFormulaFromJson(value: unknown): PreparationFormula {
  const row = jsonObject(value), name = optionalString(row.name).trim();
  const lines = (Array.isArray(row.lines) ? row.lines.filter(value => value !== null && typeof value === 'object' && !Array.isArray(value)) : [])
    .map(preparationFormulaLineFromJson).sort((a, b) => compare(a.name.toLowerCase(), b.name.toLowerCase()) || compare(a.item_code, b.item_code));
  return { product_code: optionalString(row.product_code).trim(), formula_code: optionalString(row.formula_code).trim(),
    name: name || 'Asosiy', lines, share_percent: row.share_percent == null ? null : requiredString(row.share_percent) };
}
export function preparationFormulaListFromJson(value: unknown): PreparationFormula[] {
  const row = jsonObject(value), product_code = optionalString(row.product_code).trim();
  return (Array.isArray(row.formulas) ? row.formulas.filter(value => value !== null && typeof value === 'object' && !Array.isArray(value)) : [])
    .map(value => preparationFormulaFromJson({ product_code, ...jsonObject(value) }))
    .sort((a, b) => compare(a.name.toLowerCase(), b.name.toLowerCase()) || compare(a.name, b.name));
}
/** @v2 PreparationOwnedMaterial */
export function preparationOwnedMaterialFromJson(value: unknown) {
  const row = jsonObject(value);
  return { item_code: requiredString(row.item_code), name: requiredString(row.name),
    warehouses: Array.isArray(row.warehouses) ? row.warehouses.filter((v): v is string => typeof v === 'string') : [] };
}
/** @v2 PreparationFormulaVariant */
export function preparationFormulaVariantFromJson(value: unknown) {
  const row = jsonObject(value);
  if (row.formula_count != null && typeof row.formula_count !== 'number') throw new TypeError('Invalid formula count');
  return { id: requiredString(row.id), name: requiredString(row.name), formula_code: optionalString(row.formula_code).trim(),
    formula_count: row.formula_count == null ? 0 : Math.trunc(row.formula_count as number), shares_complete: row.shares_complete === true };
}
/** @v2 PreparationFormulaCatalogEntry */
export function preparationFormulaCatalogEntryFromJson(value: unknown) {
  const row = jsonObject(value);
  return { id: requiredString(row.id), formula_code: optionalString(row.formula_code).trim(), name: requiredString(row.name),
    product_code: requiredString(row.product_code), product_title: requiredString(row.product_title), set_name: optionalString(row.set_name),
    material_id: requiredString(row.material_id), material_name: requiredString(row.material_name),
    order_codes: stringList(row.order_codes), can_create: row.can_create === true };
}
/** @v2 PreparationScopedFormula */
export function preparationScopedFormulaFromJson(value: unknown) {
  const row = jsonObject(value);
  return { material_id: requiredString(row.material_id), material_name: requiredString(row.material_name),
    variant_id: optionalString(row.variant_id), variant_name: optionalString(row.variant_name), formula: preparationFormulaFromJson(row) };
}
/** @v2 PreparationFormulaSet */
export function preparationFormulaSetFromJson(value: unknown) {
  const row = jsonObject(value), product_code = requiredString(row.product_code);
  if (!Array.isArray(row.formulas)) throw new TypeError('Invalid formulas');
  return { set_id: requiredString(row.set_id), name: requiredString(row.name), product_code,
    product_title: requiredString(row.product_title), order_codes: stringList(row.order_codes),
    formulas: row.formulas.map(value => preparationScopedFormulaFromJson({ product_code, ...jsonObject(value) })) };
}
