import type { AccountStorage } from '../savedAccountStore';
import { normalizePrinterChoice, normalizeQuantitySource } from './gscaleControlLogic';

const key = 'accord_v4_gscale_operator_control_draft_v1';
const text = (value: unknown, fallback = '') => value == null || !String(value).trim() ? fallback : String(value).trim();
export type OperatorControlDraft = {
  order_id: string; item_code: string; item_name: string; item_requires_dimensions: boolean; warehouse: string;
  print_mode: string; printer: string; quantity_source: string; manual_qty_text: string; manual_duplicate_text: string;
  babina_enabled: boolean; babina_text: string; warehouse_mode: 'default' | 'manual'; default_warehouse: string;
  width_text: string; micron_text: string; length_text: string; material_supplier: string; context_saved: boolean;
};

/** @v2 OperatorControlDraft */
export function emptyOperatorControlDraft(): OperatorControlDraft {
  return { order_id: '', item_code: '', item_name: '', item_requires_dimensions: false, warehouse: '', print_mode: '', printer: '',
    quantity_source: '', manual_qty_text: '', manual_duplicate_text: '', babina_enabled: false, babina_text: '', warehouse_mode: 'manual',
    default_warehouse: '', width_text: '', micron_text: '', length_text: '', material_supplier: '', context_saved: false };
}

export function operatorControlDraftFromJson(json: Record<string, unknown>): OperatorControlDraft {
  return { order_id: text(json.order_id), item_code: text(json.item_code), item_name: text(json.item_name),
    item_requires_dimensions: json.item_requires_dimensions === true, warehouse: text(json.warehouse), print_mode: text(json.print_mode),
    printer: normalizePrinterChoice(text(json.printer)), quantity_source: normalizeQuantitySource(text(json.quantity_source)),
    manual_qty_text: text(json.manual_qty_text), manual_duplicate_text: text(json.manual_duplicate_text),
    babina_enabled: json.babina_enabled === true, babina_text: text(json.babina_text),
    warehouse_mode: text(json.warehouse_mode, 'manual') === 'default' ? 'default' : 'manual',
    default_warehouse: text(json.default_warehouse), width_text: text(json.width_text), micron_text: text(json.micron_text),
    length_text: text(json.length_text), material_supplier: text(json.material_supplier), context_saved: json.context_saved === true };
}

/** @v2 saveOperatorControlDraft */
export async function saveOperatorControlDraft(storage: AccountStorage, draft: OperatorControlDraft): Promise<void> {
  await storage.setItem(key, JSON.stringify(draft));
}
/** @v2 loadOperatorControlDraft */
export async function loadOperatorControlDraft(storage: AccountStorage): Promise<OperatorControlDraft> {
  const value = await storage.getItem(key);
  if (!value?.trim()) return emptyOperatorControlDraft();
  try {
    const json: unknown = JSON.parse(value);
    if (json && typeof json === 'object' && !Array.isArray(json)) return operatorControlDraftFromJson(json as Record<string, unknown>);
  } catch { /* V2 returns an empty draft when the saved JSON is invalid. */ }
  return emptyOperatorControlDraft();
}
