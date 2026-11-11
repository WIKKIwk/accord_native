import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown): string => value == null ? '' : String(value);
const numeric = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value !== 'number') throw new TypeError('Expected a number');
  return value;
};
const integer = (value: unknown): number => {
  const n = numeric(value) ?? 0;
  if (!Number.isFinite(n)) throw new TypeError('Expected a finite integer');
  return Math.trunc(n);
};

/** @v2 AdminLaminatsiyaAstatkaReport */
export function laminatsiyaAstatkaReportFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid lamination astatka report');
  const apparatus = text(row.apparatus).trim();
  if (!isCanonicalApparatusId(apparatus)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  return { report_id: text(row.report_id), order_id: text(row.order_id), apparatus,
    from_at_unix: integer(row.from_at_unix), to_at_unix: integer(row.to_at_unix),
    lamination_print_leftover_rolls: numeric(row.lamination_print_leftover_rolls) ?? 0,
    lamination_film_leftover_rolls: numeric(row.lamination_film_leftover_rolls) ?? 0,
    total_waste: numeric(row.total_waste) ?? 0, finished_goods_meter: numeric(row.finished_goods_meter),
    finished_goods_kg: numeric(row.finished_goods_kg), bobina_kg: numeric(row.bobina_kg) ?? numeric(row.babina_kg),
    worker_role: text(row.worker_role), worker_ref: text(row.worker_ref), worker_display_name: text(row.worker_display_name),
    description: text(row.description), created_at_unix: integer(row.created_at_unix) };
}

type Metrics = { apparatus: string; order_id: string; lamination_print_leftover_rolls: number | null;
  lamination_film_leftover_rolls: number | null; total_waste: number | null;
  finished_goods_meter?: number | null; finished_goods_kg?: number | null; bobina_kg?: number | null; description?: string };

/** @v2 adminLaminatsiyaAstatkaReport */
export async function adminLaminatsiyaAstatkaReport(session: Session, input: Metrics, current?: () => boolean) {
  const apparatus = input.apparatus.trim(), orderId = input.order_id.trim();
  const nonnegative = (value: number | null | undefined): boolean => value != null && Number.isFinite(value) && value >= 0;
  const optionalPositive = (value: number | null | undefined): boolean => value == null || (Number.isFinite(value) && value > 0);
  if (!isCanonicalApparatusId(apparatus) || !orderId || !nonnegative(input.lamination_print_leftover_rolls) ||
      !nonnegative(input.lamination_film_leftover_rolls) || !nonnegative(input.total_waste) ||
      !optionalPositive(input.finished_goods_meter) || !optionalPositive(input.finished_goods_kg) || !optionalPositive(input.bobina_kg)) {
    throw new WorkerControlException('laminatsiya_astatka_metrics_required', 'Metraj, og‘irlik, babina va chiqindini to‘g‘ri kiriting');
  }
  const body: Obj = { apparatus, order_id: orderId, lamination_print_leftover_rolls: input.lamination_print_leftover_rolls,
    lamination_film_leftover_rolls: input.lamination_film_leftover_rolls, total_waste: input.total_waste };
  if (input.finished_goods_meter != null) body.finished_goods_meter = input.finished_goods_meter;
  if (input.finished_goods_kg != null) body.finished_goods_kg = input.finished_goods_kg;
  if (input.bobina_kg != null) body.bobina_kg = input.bobina_kg;
  if (input.description?.trim()) body.description = input.description.trim();
  const guard = () => { if (current && !current()) throw new Error('Session scope changed'); };
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/laminatsiya-astatka', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, guard);
  guard();
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'laminatsiya_astatka_report_failed', response.headers);
  }
  const payload = object(await response.json()); guard();
  if (!payload) throw new TypeError('Invalid lamination astatka response');
  if (!object(payload.report)) throw new WorkerControlException('laminatsiya_astatka_invalid_response', 'Astatka qaydi javobi noto‘g‘ri');
  return laminatsiyaAstatkaReportFromJson(payload.report);
}
