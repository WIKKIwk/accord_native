import type { Session } from './auth';
import { postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
import { progressBatchFromJson } from './workerProgressBatch';
import { printJobFromJson } from './workerPrintJob';

type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
export interface ProgressQrReprintInput {
  qr_payload: string;
  progress_batch_id?: string;
  driver_url?: string;
  printer?: string;
  print_mode?: string;
  print_count?: number;
  automatic_rezka_labels?: boolean;
  print_transport?: 'wifi' | 'offline' | 'bluetooth';
}

/** @v2 adminProgressQrReprint */
export async function adminProgressQrReprint(session: Session, input: ProgressQrReprintInput) {
  const qr = input.qr_payload.trim(), batchId = (input.progress_batch_id ?? '').trim();
  if (!qr && !batchId) throw new WorkerControlException('progress_batch_not_found', 'Progress QR topilmadi');
  const body: Obj = {};
  if (batchId) body.progress_batch_id = batchId;
  if (qr) body.qr_payload = qr;
  const driver = (input.driver_url ?? '').trim().replace(/\/+$/, '');
  if (driver) body.driver_url = driver;
  if (input.print_transport === 'offline' || input.print_transport === 'bluetooth') body.print_transport = 'offline';
  if (input.printer?.trim()) body.printer = input.printer.trim();
  if (input.print_mode?.trim()) body.print_mode = input.print_mode.trim();
  body.print_count = Math.trunc(Math.max(1, Math.min(100, input.print_count ?? 1)));
  if (input.automatic_rezka_labels) body.automatic_rezka_labels = true;
  const payload = object(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/progress-qr/reprint', body,
    null, false, 'progress_qr_reprint'));
  if (!object(payload?.batch)) throw new WorkerControlException('progress_batch_not_found', 'Progress QR topilmadi');
  const batch = progressBatchFromJson(payload!.batch), print = object(payload!.print) ?? {};
  return { ok: payload!.ok === true, batch,
    print_job: print.ok === true ? printJobFromJson(print, batch.completed_at_unix) : null,
    print_status: print.status == null ? '' : String(print.status) };
}
