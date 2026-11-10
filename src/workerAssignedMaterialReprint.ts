import type { Session } from './auth';
import { pickPreparationPrinter, printPreparationJob, type PreparationDeviceSelection } from './preparation/preparationPrinter';
import { PreparationReprintCancelled } from './preparation/preparationReprint';
import { sessionReadScope } from './sessionReadScope';
import { MobileApiException } from './shared/mobileApiException';
import { adminConfirmRawMaterialStockReprint, adminPrepareRawMaterialStockReprint } from './shared/printApi';
/** @v2 _reprintAssignedMaterialStock */
export async function reprintWorkerAssignedMaterial(session: Session, barcode: string, orderId: string, options: {
  current: () => boolean; selectDevice: () => Promise<PreparationDeviceSelection | null>;
}): Promise<string | null> {
  const scope = sessionReadScope(session), current = () => options.current() && sessionReadScope(session) === scope;
  if (!current()) throw new PreparationReprintCancelled();
  const prepared = await adminPrepareRawMaterialStockReprint(session, barcode, orderId), expected = barcode.trim().toUpperCase();
  if (!prepared.reprint_id.trim() || prepared.stock.barcode.trim().toUpperCase() !== expected || prepared.print_request.epc.trim().toUpperCase() !== expected) {
    throw new MobileApiException({ code: 'raw_material_stock_reprint_identity_mismatch', message: 'Serverdagi QR identifikatori mos kelmadi' });
  }
  if (!current()) throw new PreparationReprintCancelled();
  const printer = await pickPreparationPrinter({ isCurrent: current, selectDevice: options.selectDevice });
  if (!printer || !current()) throw new PreparationReprintCancelled();
  if (!await printPreparationJob(prepared.print_request, printer)) throw new Error('Printer QR kodini chop etmadi');
  const warning = 'QR chop etildi, lekin server tasdig‘i saqlanmadi';
  if (!current()) return warning;
  try { await adminConfirmRawMaterialStockReprint(session, prepared.stock.barcode, prepared.reprint_id); return null; }
  catch { return warning; }
}
