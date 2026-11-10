import type { Session } from './auth';
import { pickPreparationPrinter, printPreparationJob, type PreparationDeviceSelection } from './preparation/preparationPrinter';
import { offlineUsbDriverUrl } from './printing/printTransport';
import type { BluetoothPrinterProfile } from './printing/nativePrinter';
import { adminProgressQrReprint } from './productionProgressReprintApi';
import type { WorkerPrintJob } from './workerPrintJob';

export type WorkerPrinter = { transport: 'bluetooth'; printer: BluetoothPrinterProfile };
export type WorkerPrinterOptions = { current: () => boolean; selectDevice: () => Promise<PreparationDeviceSelection | null> };
export class WorkerPrintCancelled extends Error {}

/** @v2 _pickProgressPrinter */
export async function pickWorkerPrinter(options: WorkerPrinterOptions): Promise<WorkerPrinter> {
  if (!options.current()) throw new WorkerPrintCancelled();
  const printer = await pickPreparationPrinter({ isCurrent: options.current, selectDevice: async () => {
    const selected = await options.selectDevice();
    return options.current() && selected?.transport === 'bluetooth' ? selected : null;
  } });
  if (!options.current() || !printer || printer.transport !== 'bluetooth') throw new WorkerPrintCancelled();
  return printer;
}

export function workerPrinterFields(printer: WorkerPrinter) {
  return { driver_url: offlineUsbDriverUrl, print_transport: printer.transport,
    printer: printer.printer.printer, print_mode: printer.printer.printMode };
}

/** @v2 _ReadOnlyOrderDetailSheetState._runQueueAction */
export async function printWorkerJobs(result: { print_jobs?: WorkerPrintJob[]; print_job?: WorkerPrintJob | null },
  printer: WorkerPrinter, current: () => boolean): Promise<void> {
  const jobs = result.print_jobs?.length ? result.print_jobs : result.print_job ? [result.print_job] : [];
  for (const job of jobs) {
    if (!current()) throw new WorkerPrintCancelled();
    if (!await printPreparationJob(job, printer)) throw new Error('Printer WIP QR kodini chop etmadi');
  }
}

/** @v2 _WorkerWipHistorySheetState._reprintWip */
export async function reprintWorkerWip(session: Session, batch: { batch_id: string; qr_payload: string }, options: WorkerPrinterOptions) {
  const printer = await pickWorkerPrinter(options);
  if (!options.current()) throw new WorkerPrintCancelled();
  const prepared = await adminProgressQrReprint(session, { progress_batch_id: batch.batch_id,
    qr_payload: batch.qr_payload, print_count: 1, ...workerPrinterFields(printer) }, options.current);
  if (!options.current()) throw new WorkerPrintCancelled();
  if (!prepared.ok) throw new Error(prepared.print_status.trim() || 'WIP QR kodini chop etib bo‘lmadi');
  if (!prepared.print_job) throw new Error('WIP QR uchun local print ma’lumoti kelmadi');
  await printWorkerJobs(prepared, printer, options.current);
}
