import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { validateLayerRemainderContext } from './workerLaminationApi';
import { layerRemainderFromJson } from './workerLaminationRemainders';
import { printJobFromJson } from './workerPrintJob';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

/** @v2 AdminLayerRemainderResult */
export function layerRemainderResultFromJson(value: unknown) {
  const row = object(value);
  if (!row || row.ok !== true || !object(row.remainder)) {
    throw new WorkerControlException('layer_remainder_invalid_response', 'Qavat astatkasi javobi noto‘g‘ri');
  }
  const print = object(row.print) ?? {};
  return { remainder: layerRemainderFromJson(row.remainder), print_ok: print.ok === true,
    print_job: print.ok === true ? printJobFromJson(print) : null, print_status: print.status == null ? '' : String(print.status) };
}

type ReprintInput = { apparatus: string; order_id: string; operation_id: string; driver_url?: string;
  printer?: string; print_mode?: string; print_transport?: 'wifi' | 'offline' | 'bluetooth' };

/** @v2 adminLayerRemainderReprint */
export async function adminLayerRemainderReprint(session: Session, input: ReprintInput) {
  validateLayerRemainderContext(input.apparatus, input.order_id);
  if (!input.operation_id.trim()) throw new WorkerControlException('layer_remainder_not_found', 'Qavat astatkasi topilmadi');
  const body: Obj = { apparatus: input.apparatus.trim(), order_id: input.order_id.trim(), operation_id: input.operation_id.trim() };
  if (input.driver_url?.trim()) body.driver_url = input.driver_url.trim();
  if (input.printer?.trim()) body.printer = input.printer.trim();
  if (input.print_mode?.trim()) body.print_mode = input.print_mode.trim();
  if (input.print_transport === 'offline' || input.print_transport === 'bluetooth') body.print_transport = 'offline';
  body.print_count = 1;
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/layer-remainders/reprint', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'layer_remainder_failed');
  }
  return layerRemainderResultFromJson(await response.json());
}
