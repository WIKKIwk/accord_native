import type { Session } from './auth';
import { isCanonicalApparatusId, postWorkerApiRequest, WorkerControlException } from './workerControlsApi';

type Obj = Record<string, any>;
const object = (v: unknown): Obj | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null;
const str = (v: unknown) => v == null ? '' : String(v);
const num = (v: unknown, fallback: number | null = 0) => {
  if (v == null) return fallback;
  if (typeof v !== 'number') throw new TypeError('Invalid astatka metric');
  return v;
};

/** @v2 AdminRezkaAstatkaReport */
export function rezkaAstatkaReportFromJson(value: unknown) {
  const row = object(value); if (!row) throw new TypeError('Invalid astatka report');
  const apparatus = str(row.apparatus).trim();
  if (!isCanonicalApparatusId(apparatus)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  return { report_id: str(row.report_id), order_id: str(row.order_id), apparatus,
    from_at_unix: Math.trunc(num(row.from_at_unix)!), to_at_unix: Math.trunc(num(row.to_at_unix)!),
    total_waste: num(row.total_waste), rezka_bosma_waste: num(row.rezka_bosma_waste),
    rezka_lamination_waste: num(row.rezka_lamination_waste), rezka_edge_waste: num(row.rezka_edge_waste),
    finished_goods_meter: num(row.finished_goods_meter, null), finished_goods_kg: num(row.finished_goods_kg, null),
    bobina_kg: num(row.bobina_kg, null) ?? num(row.babina_kg, null), worker_role: str(row.worker_role),
    worker_ref: str(row.worker_ref), worker_display_name: str(row.worker_display_name), description: str(row.description),
    created_at_unix: Math.trunc(num(row.created_at_unix)!) };
}
export interface RezkaAstatkaInput {
  apparatus: string; order_id: string; request_id: string; session_id: string; stage_node_id?: string;
  total_waste_only?: boolean; total_waste: number | null; rezka_bosma_waste?: number | null; rezka_lamination_waste?: number | null;
  rezka_edge_waste?: number | null; finished_goods_meter?: number | null; finished_goods_kg?: number | null;
  bobina_kg?: number | null; description?: string;
}
/** @v2 adminRezkaAstatkaReport */
export async function adminRezkaAstatkaReport(session: Session, input: RezkaAstatkaInput) {
  const apparatus = input.apparatus.trim(), order = input.order_id.trim(), request = input.request_id.trim(), sessionId = input.session_id.trim();
  const nonnegative = (v: number | null | undefined) => v != null && Number.isFinite(v) && v >= 0;
  const positive = (v: number | null | undefined) => v == null || (Number.isFinite(v) && v > 0);
  const category = (v: number | null | undefined) => (input.total_waste_only && v == null) || nonnegative(v);
  if (!isCanonicalApparatusId(apparatus) || !order || request.length < 8 || request.length > 128 || !sessionId ||
      !nonnegative(input.total_waste) || !category(input.rezka_bosma_waste) || !category(input.rezka_lamination_waste) ||
      !category(input.rezka_edge_waste) || !positive(input.finished_goods_meter) || !positive(input.finished_goods_kg) || !positive(input.bobina_kg))
    throw new WorkerControlException('rezka_astatka_metrics_required', 'Rezka metraj, og‘irlik, babina va chiqindisini to‘g‘ri kiriting');
  const body: Obj = { apparatus, order_id: order, request_id: request, session_id: sessionId };
  if (input.stage_node_id?.trim()) body.stage_node_id = input.stage_node_id.trim();
  body.total_waste = input.total_waste;
  for (const key of ['rezka_bosma_waste', 'rezka_lamination_waste', 'rezka_edge_waste', 'finished_goods_meter', 'finished_goods_kg', 'bobina_kg'] as const)
    if (input[key] != null) body[key] = input[key];
  if (input.description?.trim()) body.description = input.description.trim();
  const payload = object(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/rezka-astatka', body, null, false, 'rezka_astatka_report_failed'));
  const report = object(payload?.report);
  if (!report || !str(report.report_id).trim() || report.order_id !== order || report.apparatus !== apparatus)
    throw new WorkerControlException('rezka_astatka_invalid_response', 'Rezka astatka javobi noto‘g‘ri');
  return rezkaAstatkaReportFromJson(report);
}
