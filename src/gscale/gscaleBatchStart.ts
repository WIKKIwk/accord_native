import type { BluetoothPrinterProfile } from '../printing/nativePrinter';
import type { UsbPrinterProfile } from '../printing/printModels';
import { offlineUsbDriverUrl, type PrintTransport } from '../printing/printTransport';
import type { SupplierItem } from '../shared/catalogApi';
import { normalizePrinterChoice, normalizeQuantitySource, parsePositiveKg } from './gscaleControlLogic';
import { driverUrlForRs, type DiscoveredServer } from './gscaleDiscovery';
import type { GScaleBatchStart, GScaleBatchSession } from './gscaleBatchModel';

export type GScaleStartContext = {
  batchResolved: boolean; batch: GScaleBatchSession | null; linkedOrderId: string; draftOrderId: string;
  usesReceiptOrderContext: boolean; preparationFormulaReceipt: boolean; initialMaterialId: string; formulaVariantId: string;
  transport: PrintTransport; server: DiscoveredServer | null; item: { code: string; name: string; requiresDimensions: boolean } | null;
  warehouse: string | null; widthText: string; micronText: string; lengthText: string; babinaEnabled: boolean; babinaText: string;
  offlinePrinter: UsbPrinterProfile | null; bluetoothPrinter: BluetoothPrinterProfile | null; batchPrinter: string;
  batchPrintMode: string; quantitySource: string; grossQtyKg: number;
};
export type GScaleStartDependencies = {
  warehouseAllowed(warehouse: string): Promise<boolean>;
  detectOfflinePrinter(): Promise<UsbPrinterProfile>;
  itemPage(query: string, orderId: string, useBackend: boolean): Promise<SupplierItem[]>;
  chooseApparatus(options: Record<string, string>): Promise<string | null>;
  current(): { mounted: boolean; linkedOrderId: string; draftOrderId: string; batchResolved: boolean; batchActive: boolean };
  start(request: GScaleBatchStart): Promise<{ batch: GScaleBatchSession; ok: boolean }>;
};

/** @v2 _startRsBatchFromSelection */
export async function startGScaleBatch(context: GScaleStartContext, deps: GScaleStartDependencies) {
  const orderId = context.linkedOrderId.trim();
  if (!context.batchResolved || context.batch?.active) throw new Error('Avval faol batchni to‘xtating va holatni yangilang');
  if (context.usesReceiptOrderContext && context.draftOrderId !== orderId) throw new Error('Order o‘zgardi. Homashyoni qayta tanlang');
  if (context.transport === 'wifi' && !context.server) throw new Error('Avval printer yoki tarozini tanlang');
  const item = context.item;
  if (!item) throw new Error('Mahsulot tanlang');
  const width = parsePositiveKg(context.widthText), micron = parsePositiveKg(context.micronText), length = parsePositiveKg(context.lengthText);
  if (item.requiresDimensions && width == null) throw new Error("Material enini mm da to'g'ri kiriting");
  if (item.requiresDimensions && micron == null) throw new Error("Material mikronini to'g'ri kiriting");
  if (length == null) throw new Error("Material metrajini metrda to'g'ri kiriting");
  const warehouse = context.warehouse;
  if (!warehouse?.trim()) throw new Error('Ombor tanlang');
  if (!await deps.warehouseAllowed(warehouse)) throw new Error('Bu ombor sizga biriktirilmagan');
  const tare = context.babinaEnabled ? parsePositiveKg(context.babinaText) : 0;
  if (context.babinaEnabled && tare == null) throw new Error("Babina og'irligini kg da to'g'ri kiriting");
  const offline = context.transport === 'offline' ? context.offlinePrinter ?? await deps.detectOfflinePrinter() : null;
  const bluetooth = context.transport === 'bluetooth' ? context.bluetoothPrinter : null;
  if (context.transport === 'bluetooth' && !bluetooth) throw new Error('XP-P323B Bluetooth printer tanlanmagan');
  const selectedPrinter = offline?.printer ?? bluetooth?.printer ?? normalizePrinterChoice(context.batchPrinter);
  const printMode = offline?.printMode ?? bluetooth?.printMode ?? (selectedPrinter === 'godex' ? 'label' : context.batchPrintMode === 'label' ? 'label' : 'rfid');
  let apparatus = '';
  if (orderId) {
    const items = await deps.itemPage(item.code, orderId, context.preparationFormulaReceipt);
    const options = items.find(value => value.code === item.code)?.order_apparatus_options ?? {};
    const keys = Object.keys(options);
    if (!keys.length) throw new Error('Bu homashyo uchun orderda mos apparat yo‘q');
    if (keys.length === 1) apparatus = keys[0];
    else {
      const selected = await deps.chooseApparatus(options);
      if (selected == null) throw new Error('Apparat tanlanmadi');
      apparatus = selected;
    }
  }
  const current = deps.current();
  if (!current.mounted || current.linkedOrderId.trim() !== orderId ||
      (context.usesReceiptOrderContext && current.draftOrderId !== orderId)) throw new Error('Order o‘zgardi. Qayta boshlang');
  if (!current.batchResolved || current.batchActive) throw new Error('Avval faol batchni to‘xtating va holatni yangilang');
  const printer = normalizePrinterChoice(selectedPrinter), source = normalizeQuantitySource(context.quantitySource);
  const request: GScaleBatchStart = { client_batch_id: '',
    preparation_formula_material_id: context.preparationFormulaReceipt ? context.initialMaterialId : '',
    preparation_formula_variant_id: context.preparationFormulaReceipt ? context.formulaVariantId : '',
    order_id: orderId, apparatus, driver_url: context.transport === 'wifi' ? driverUrlForRs(context.server!) : offlineUsbDriverUrl,
    item_code: item.code, item_name: item.name, warehouse, printer,
    print_mode: printer === 'godex' ? 'label' : printMode.trim().toLowerCase() === 'label' ? 'label' : 'rfid',
    quantity_source: source, manual_qty_kg: source === 'manual' && Number.isFinite(context.grossQtyKg) && context.grossQtyKg > 0 ? context.grossQtyKg : 0,
    tare_enabled: context.babinaEnabled || (tare ?? 0) > 0, tare_kg: tare != null && Number.isFinite(tare) && tare > 0 ? tare : 0,
    width_mm: item.requiresDimensions ? width : null, micron: item.requiresDimensions ? micron : null, length_m: length };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([deps.start(request), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request timed out')), 15000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
