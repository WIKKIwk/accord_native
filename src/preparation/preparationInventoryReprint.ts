import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';
import { adminConfirmRawMaterialStockReprint, adminPrepareRawMaterialStockReprint } from '../shared/printApi';
import { pickPreparationInventoryPrinter, printPreparationJob, type PreparationDeviceSelection } from './preparationPrinter';
import { PreparationReprintCancelled } from './preparationReprint';

/** @v2 _InventoryAssetQrSheetState */
export async function reprintPreparationInventoryAsset(session: Session, barcode: string, options: {
  isCurrent: () => boolean; selectDevice: () => Promise<PreparationDeviceSelection | null>;
}) {
  const scope = sessionReadScope(session), current = () => options.isCurrent() && sessionReadScope(session) === scope;
  if (!current()) throw new PreparationReprintCancelled();
  const prepared = await adminPrepareRawMaterialStockReprint(session, barcode);
  const expected = barcode.trim().toUpperCase();
  if (!prepared.reprint_id.trim() || prepared.stock.barcode.trim().toUpperCase() !== expected ||
      prepared.print_request.epc.trim().toUpperCase() !== expected)
    throw new MobileApiException({ code: 'raw_material_stock_reprint_identity_mismatch', message: 'Serverdagi QR identifikatori mos kelmadi' });
  if (!current()) throw new PreparationReprintCancelled();
  const printer = await pickPreparationInventoryPrinter(options);
  if (!current() || !printer) throw new PreparationReprintCancelled();
  if (!(await printPreparationJob(prepared.print_request, printer, { inventory: true }))) throw new Error('Printer QR kodini chop etmadi');
  if (!current()) return 'QR chop etildi, lekin server tasdig‘i saqlanmadi';
  try { await adminConfirmRawMaterialStockReprint(session, prepared.stock.barcode, prepared.reprint_id); return null; }
  catch { return 'QR chop etildi, lekin server tasdig‘i saqlanmadi'; }
}
