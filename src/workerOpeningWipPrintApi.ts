import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { openingWipBatch } from './workerOpeningWip';
import { printJobFromJson } from './workerPrintJob';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
type PrintInput = { batch_id: string; qr_payload?: string; driver_url?: string; printer?: string; print_mode?: string;
  print_count?: number; print_transport?: 'wifi' | 'offline' | 'bluetooth' };

/** @v2 adminPrintOpeningWip */
export async function adminPrintOpeningWip(session: Session, input: PrintInput) {
  const body: Obj = { batch_id: input.batch_id.trim() };
  const driver = input.driver_url?.trim().replace(/\/+$/, '') ?? '';
  if (input.qr_payload?.trim()) body.qr_payload = input.qr_payload.trim();
  if (driver) body.driver_url = driver;
  if (input.printer?.trim()) body.printer = input.printer.trim();
  if (input.print_mode?.trim()) body.print_mode = input.print_mode.trim();
  body.print_count = Math.max(1, Math.min(100, Math.trunc(input.print_count ?? 1)));
  if (input.print_transport === 'offline' || input.print_transport === 'bluetooth') body.print_transport = 'offline';
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/opening-wip/print', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'opening_wip_print');
  }
  const payload = object(await response.json());
  if (!payload) throw new TypeError('Invalid opening WIP print response');
  if (!object(payload.batch)) throw new WorkerControlException('opening_wip_print', 'Opening WIP print javobi noto‘g‘ri');
  const print = object(payload.print) ?? {};
  return { ok: payload.ok === true, batch: openingWipBatch(payload.batch),
    print_job: Object.keys(print).length ? printJobFromJson(print) : null, print_status: print.status == null ? '' : String(print.status).trim() };
}
