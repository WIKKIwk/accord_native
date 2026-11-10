import type { Session } from './auth';
import { postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
import { progressBatchFromJson } from './workerProgressBatch';

export interface ProgressBatchCorrectionInput {
  batch_id: string;
  expected_revision: number;
  produced_qty: number;
  uom: string;
  reason: string;
  return_ink_kg?: number | null;
  lamination_print_leftover_rolls?: number | null;
  lamination_film_leftover_rolls?: number | null;
  rezka_bosma_waste?: number | null;
  rezka_lamination_waste?: number | null;
  rezka_edge_waste?: number | null;
  total_waste?: number | null;
  finished_goods_kg?: number | null;
  bobina_kg?: number | null;
  finished_goods_meter?: number | null;
  diameter?: number | null;
  description?: string;
}

/** @v2 adminProgressBatchCorrect */
export async function adminProgressBatchCorrect(session: Session, input: ProgressBatchCorrectionInput, current?: () => boolean) {
  if (!input.batch_id.trim() || input.expected_revision <= 0 || !Number.isFinite(input.produced_qty) || input.produced_qty <= 0 ||
      !input.uom.trim() || !input.reason.trim()) {
    throw new WorkerControlException('progress_input_invalid', 'WIP o‘zgartirish ma’lumoti to‘liq emas');
  }
  const body: Record<string, unknown> = { batch_id: input.batch_id.trim(), expected_revision: input.expected_revision,
    produced_qty: input.produced_qty, uom: input.uom.trim() };
  for (const key of ['return_ink_kg', 'lamination_print_leftover_rolls', 'lamination_film_leftover_rolls', 'rezka_bosma_waste',
    'rezka_lamination_waste', 'rezka_edge_waste', 'total_waste', 'finished_goods_kg', 'bobina_kg', 'finished_goods_meter', 'diameter'] as const) {
    body[key] = input[key] ?? null;
  }
  body.description = (input.description ?? '').trim(); body.reason = input.reason.trim();
  const payload = await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/progress-qr/correct', body,
    null, !!current, 'progress_batch_correction_failed', current) as Record<string, unknown>;
  if (!payload.batch || typeof payload.batch !== 'object' || Array.isArray(payload.batch)) {
    throw new WorkerControlException('progress_batch_correction_failed', 'Yangilangan WIP ma’lumoti kelmadi');
  }
  return progressBatchFromJson(payload.batch);
}
