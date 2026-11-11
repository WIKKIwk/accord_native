import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError, WorkerControlException } from './workerControlsApi';

const earlyCloseMessages: Record<string, string> = {
  order_not_started: 'Server boshlanmagan buyurtmani erta yopishni rad etdi. Backendni yangilash kerak.',
  order_already_completed: 'Buyurtma allaqachon yopilgan. Yopilganlar bo‘limini tekshiring.',
  early_close_comment_required_or_too_long: 'Yopish sababini yozing (2000 belgigacha).',
  order_freeze_target_not_found: 'Erta yopish uchun faol ish sessiyasi topilmadi. Buyurtma holatini yangilang.',
  order_freeze_target_ambiguous: 'Buyurtmada bir nechta faol ish bor. Erta yopishdan oldin ularning holatini tekshiring.',
  order_freeze_requested: 'Buyurtmani yopish uchun ishchining oxirgi rulonni yechishi kutilmoqda.',
  order_frozen: 'Buyurtmaning hozirgi holatida erta yopish mumkin emas. Holatni yangilang.',
  order_control_action_not_allowed: 'Buyurtmaning hozirgi holatida erta yopish mumkin emas. Holatni yangilang.',
};

/** @v2 adminEarlyCloseProductionOrder */
export async function adminEarlyCloseProductionOrder(session: Session, input: { order_id: string; comment: string }): Promise<'freeze_requested' | 'frozen'> {
  const comment = input.comment.trim();
  if (!comment || Array.from(comment).length > 2000) {
    throw new WorkerControlException('early_close_comment_invalid', 'Yopish sababini yozing (2000 belgigacha)');
  }
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/order-control', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: input.order_id.trim(), action: 'close_early', comment }),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    const error = productionMapResponseError(response.status, payload, 'order_control_failed', response.headers);
    error.message = earlyCloseMessages[error.code.trim().toLowerCase()] ?? error.message;
    throw error;
  }
  const payload: unknown = await response.json();
  const control = payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).control : null;
  const row = control !== null && typeof control === 'object' && !Array.isArray(control) ? control as Record<string, unknown> : null;
  if (!row || row.early_close === null || typeof row.early_close !== 'object' || Array.isArray(row.early_close) ||
      (row.state !== 'freeze_requested' && row.state !== 'frozen')) {
    throw new WorkerControlException('order_control_invalid_response', 'Buyurtma holati olinmadi');
  }
  return row.state;
}
