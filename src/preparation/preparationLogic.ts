import { preparationDecimal, preparationDecimalText, preparationDisplay, preparationRequiredKg } from './preparationModel';

export type PreparationMaterial = { code: string; name: string; can_receive: boolean; visible_warehouses: string[] | null; balances: Record<string, string> };
export type PreparationOrder = { id: string; code: string; title: string; kg: string; saved: boolean };
export type FormulaEditorRow = { material: Pick<PreparationMaterial, 'code' | 'name'> | null; percent: string };
/** @v2 PreparationMaterial */
export const preparationMaterialAvailable = (material: PreparationMaterial, warehouse: string | null): string => warehouse == null ? '0' : material.balances[warehouse] ?? '0';
export function preparationMaterialVisibleIn(material: PreparationMaterial, warehouse: string | null): boolean {
  const key = warehouse?.trim().toLowerCase();
  return !!key && (material.visible_warehouses === null || material.visible_warehouses.includes(key));
}
/** @v2 PreparationOrder */
export const preparationOrderLabel = (order: PreparationOrder): string => `${order.code || order.id} — ${order.title}`;
/** @v2 _nextAutoName */
export function preparationNextFormulaName(names: readonly string[]): string {
  const used = new Set(names.map(name => name.trim().toUpperCase()));
  for (let index = 0; ; index++) {
    let n = index, result = '';
    do { result = String.fromCharCode(65 + n % 26) + result; n = Math.trunc(n / 26) - 1; } while (n >= 0);
    if (!used.has(result)) return result;
  }
}
/** @v2 _editorError */
export function preparationFormulaEditorError(rows: readonly FormulaEditorRow[]): string | null {
  if (!rows.length) return null;
  for (let i = 0; i < rows.length; i++) if (!rows[i].material?.code.trim()) return `${i + 1}-seriyoda seriyo tanlanmagan`;
  const counts = new Map<string, number>();
  for (const row of rows) { const code = row.material!.code.trim(); counts.set(code, (counts.get(code) ?? 0) + 1); }
  const duplicate = rows.find(row => (counts.get(row.material!.code.trim()) ?? 0) > 1);
  if (duplicate) {
    const name = duplicate.material!.name.trim(), label = name ? `«${name}»` : 'Bu seriyo';
    return `${label} takrorlangan — har bir seriyo 1 marta bo‘lishi kerak`;
  }
  let total = 0n;
  for (let i = 0; i < rows.length; i++) {
    try {
      const percent = preparationDecimal(rows[i].percent);
      if (percent > 100000000n) throw new Error();
      total += percent;
    } catch { return `${i + 1}-seriyo foizini to‘g‘ri kiriting (0–100, masalan 25)`; }
  }
  const display = preparationDisplay(preparationDecimalText(total));
  if (total > 100000000n) return `Jami foiz 100 dan oshib ketdi (hozir ${display}%). Kamaytiring.`;
  if (total !== 100000000n) return `Jami foiz 100% bo‘lishi kerak (hozir ${display}%). Saqlash uchun to‘ldiring.`;
  return null;
}
export function preparationFormulaEditorLines(rows: readonly FormulaEditorRow[]) {
  if (!rows.length || preparationFormulaEditorError(rows) !== null) throw new Error('Formula tarkibi noto‘g‘ri');
  return rows.map(row => ({ item_code: row.material!.code.trim(), percent: preparationDecimalText(preparationDecimal(row.percent)) }));
}
export function preparationFormulaShareInputs(names: readonly string[], values: readonly string[]) {
  if (names.length !== values.length) throw new Error('Shnek ulushlari noto‘g‘ri');
  let total = 0n;
  const shares = names.map((name, index) => {
    const value = preparationDecimal(values[index]);
    if (value > 100000000n) throw new Error('Shnek ulushlari noto‘g‘ri');
    total += value; return { name, percent: preparationDecimalText(value) };
  });
  if (total !== 100000000n) throw new Error('Shnek ulushlari jami 100% bo‘lishi kerak');
  return shares;
}
// V2 _PreparationForms._lineError (the ledger does not parse nullable-return extensions).
export function preparationConsumptionLineError(orderKg: string, percent: string, availableKg: string): string | null {
  try {
    return preparationDecimal(preparationRequiredKg(orderKg, percent)) > preparationDecimal(availableKg, true)
      ? 'Omborda yetarli homashyo yo‘q' : null;
  } catch (error) { return error instanceof Error ? error.message : String(error); }
}
export function preparationReceiptPayload(material: PreparationMaterial, warehouse: string, kg: string) {
  return { item_code: material.code, warehouse, kg: preparationDecimalText(preparationDecimal(kg)) };
}
export function preparationConsumptionPayload(warehouse: string, order: PreparationOrder, lines: readonly { item_code: string; percent: string }[]) {
  return { warehouse, order_id: order.id, expected_order_kg: order.kg,
    lines: lines.map(line => ({ item_code: line.item_code, percent: preparationDecimalText(preparationDecimal(line.percent)) })) };
}
export function preparationVisibleMaterials(materials: readonly PreparationMaterial[], warehouse: string | null, query = '') {
  const q = query.trim().toLowerCase();
  return materials.filter(material => preparationMaterialVisibleIn(material, warehouse) &&
    (!q || `${material.name} ${material.code}`.toLowerCase().includes(q)));
}
export function preparationWarehouseChoices(editable: readonly string[], assigned: readonly string[]) {
  const allowed = new Set(editable);
  return [...new Set([...editable, ...assigned])].sort().map(name => ({ name, editable: allowed.has(name), selected: assigned.includes(name) }));
}

export function preparationMaterialHistory(history: readonly Record<string, unknown>[], warehouse: string, itemCode: string) {
  const receipts: Record<string, unknown>[] = [], consumptions: { doc: Record<string, unknown>; line: Record<string, unknown> }[] = [];
  for (const doc of history) {
    if (doc.warehouse !== warehouse) continue;
    if ((doc.kind === 'receipt' || doc.kind === 'receipt_reversal') && (doc.item_code ?? '') === itemCode) receipts.push(doc);
    if (doc.kind === 'consumption' && Array.isArray(doc.lines)) {
      for (const value of doc.lines) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const line = value as Record<string, unknown>;
          if ((line.item_code ?? '') === itemCode) consumptions.push({ doc, line });
        }
      }
    }
  }
  return { receipts, consumptions };
}
export function preparationReverseHistory(history: readonly Record<string, unknown>[], receiptId: string | null,
  result: Record<string, unknown>, createdAt: string) {
  return [{ ...result, created_at: createdAt }, ...history.map(entry => (entry.id == null ? null : String(entry.id)) === receiptId
    ? { ...entry, reversed: true, can_reverse: false } : entry)];
}
export function preparationInputError(value: string, options: { quantity?: boolean; maxLength?: number; emptyError?: string } = {}): string | null {
  if (!options.quantity) {
    const trimmed = value.trim();
    return !trimmed ? options.emptyError ?? 'Nom kiriting' : trimmed.length > (options.maxLength ?? 160) ? 'Matn juda uzun' : null;
  }
  try { preparationDecimal(value); return null; }
  catch (error) { return error instanceof Error ? error.message : String(error); }
}

export function preparationQuantityInput(value: string) {
  return value.replace(/[^0-9.,]/g, '');
}
export function preparationReceiptMode(warehouse: string | null, materialWarehouses: readonly string[]) {
  return warehouse == null ? 'warehouse' : materialWarehouses.includes(warehouse) ? 'manual' : 'scale';
}
