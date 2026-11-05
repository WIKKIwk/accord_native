import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';
import { adminConfirmRawMaterialStockReprint, adminPrepareRawMaterialStockReprint } from '../shared/printApi';
import type { WorkerPrintJob } from '../workerPrintJob';
import type { preparationProductionRollFromJson } from './preparationProductionModel';

type Roll = ReturnType<typeof preparationProductionRollFromJson>;
export class PreparationReprintCancelled extends Error {}
const warning = 'QR chop etildi, lekin server tasdig‘i saqlanmadi';

/** @v2 _reprintRoll */
export async function reprintPreparationRoll<P>(session: Session, roll: Roll, orderId: string, context: {
  isCurrent: () => boolean;
  pickPrinter: () => Promise<P | null>;
  print: (job: WorkerPrintJob, printer: P) => Promise<boolean>;
}): Promise<string | null> {
  const scope = sessionReadScope(session);
  const current = () => context.isCurrent() && scope === sessionReadScope(session);
  if (!current()) throw new PreparationReprintCancelled();
  const prepared = await adminPrepareRawMaterialStockReprint(session, roll.epc, orderId);
  const barcode = roll.epc.trim().toUpperCase();
  if (!prepared.reprint_id.trim() || prepared.stock.barcode.trim().toUpperCase() !== barcode ||
      prepared.print_request.epc.trim().toUpperCase() !== barcode ||
      (roll.receipt_name.trim() && prepared.stock.source_receipt_id.trim() !== roll.receipt_name.trim())) {
    throw new MobileApiException({ code: 'raw_material_stock_reprint_identity_mismatch', message: 'Serverdagi QR identifikatori mos kelmadi' });
  }
  if (!current()) throw new PreparationReprintCancelled();
  const printer = await context.pickPrinter();
  if (!current() || printer === null) throw new PreparationReprintCancelled();
  if (!(await context.print(prepared.print_request, printer))) throw new Error('Printer QR kodini chop etmadi');
  if (!current()) return warning;
  try { await adminConfirmRawMaterialStockReprint(session, prepared.stock.barcode, prepared.reprint_id); return null; }
  catch { return warning; }
}
