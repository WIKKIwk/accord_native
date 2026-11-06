import { MobileApiException } from '../shared/mobileApiException';
import type { SupplierItem } from '../shared/catalogApi';
import { parsePositiveKg } from './gscaleControlLogic';

/** @v2 _preparationPresetConflictMessage */
export function preparationPresetConflict(options: { freshForm: boolean; controlOnly: boolean; orderId: string;
  materialId: string; variantId: string; itemCode: string | null; applied: boolean;
  batch: { active: boolean; order_id: string; item_code: string; preparation_formula: Record<string, unknown> } | null }): string {
  const { batch } = options;
  if (!options.controlOnly || !options.freshForm || !batch?.active) return '';
  if (batch.order_id !== options.orderId || (options.itemCode != null && batch.item_code !== options.itemCode)) {
    return 'Boshqa homashyo yoki order uchun batch faol. Avval uni to‘xtating.';
  }
  if (batch.preparation_formula.material_id !== options.materialId ||
      (options.variantId && batch.preparation_formula.variant_id !== options.variantId)) {
    return 'Faol batch tanlangan shnek formulasiga bog‘lanmagan. Avval uni to‘xtating va formuladan qayta boshlang.';
  }
  if (!options.applied && options.itemCode == null) return 'Tanlangan homashyo tekshirilmaguncha faol batchdan chop etib bo‘lmaydi.';
  return '';
}

/** @v2 _loadPreparationReceiptPreset */
export async function loadPreparationReceiptPreset(options: {
  orderId: string; materialId: string; materialName: string; current(): boolean;
  loadPage(query: string, orderId: string, offset: number, limit: number): Promise<SupplierItem[]>;
}): Promise<SupplierItem | null> {
  const orderId = options.orderId.trim();
  const identities = new Set([options.materialId.trim().toLowerCase(), options.materialName.trim().toLowerCase()].filter(Boolean));
  if (!orderId || !identities.size) throw new MobileApiException({ code: 'preparation_receipt_invalid', message: 'Buyurtma yoki homashyo ma’lumoti topilmadi.' });
  const matches = new Map<string, SupplierItem>();
  for (const query of identities) {
    let offset = 0;
    while (true) {
      const items = await options.loadPage(query, orderId, offset, 200);
      if (!options.current()) return null;
      for (const item of items) {
        if (identities.has(item.code.trim().toLowerCase()) || identities.has(item.name.trim().toLowerCase())) matches.set(item.code, item);
      }
      if (items.length < 200) break;
      offset += items.length;
    }
  }
  if (matches.size !== 1) throw new MobileApiException({ code: 'preparation_receipt_material', message: matches.size === 0
    ? 'Tanlangan homashyoga mos Rulon katalog mahsuloti topilmadi.'
    : 'Homashyoga bir nechta katalog mahsuloti mos keldi. Homashyoni tanlang.' });
  if (!options.current()) return null;
  return [...matches.values()][0];
}

/** @v2 _isTayyorlovSimpleWarehouse */
export function isTayyorlovSimpleWarehouse(controlOnly: boolean, freshForm: boolean, role: string,
  warehouse: string, materialWarehouses: Iterable<string>): boolean {
  const target = warehouse.trim().toLowerCase();
  return controlOnly && !freshForm && role === 'tayyorlov_masteri' &&
    [...materialWarehouses].some(value => value.trim().toLowerCase() === target);
}

/** @v2 formatCompactKg */
export function formatCompactKg(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '');
}

/** @v2 _submitSimpleReceipt */
export async function submitSimpleGScaleReceipt(options: {
  itemCode: string | null; warehouse: string; quantityText: string; role: string; controlOnly: boolean; freshForm: boolean;
  materialWarehouses: string[]; refreshMaterialWarehouses(): Promise<string[]>;
  submit(payload: { item_code: string; warehouse: string; kg: string }): Promise<unknown>;
}): Promise<void> {
  if (options.itemCode == null) throw new Error('Mahsulot tanlang');
  const warehouse = options.warehouse.trim();
  if (!warehouse) throw new Error('Ombor tanlang');
  const kg = parsePositiveKg(options.quantityText);
  if (kg == null) throw new Error('Kirim kg miqdorini to‘g‘ri kiriting');
  let warehouses = options.materialWarehouses;
  try { warehouses = await options.refreshMaterialWarehouses(); } catch { /* V2 keeps the previous scope. */ }
  if (!isTayyorlovSimpleWarehouse(options.controlOnly, options.freshForm, options.role, warehouse, warehouses)) {
    throw new Error('Bu ombor uchun QR kirimi talab qilinadi');
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      options.submit({ item_code: options.itemCode, warehouse, kg: formatCompactKg(kg) }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out')), 30000); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
