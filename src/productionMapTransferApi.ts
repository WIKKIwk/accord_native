import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { sessionReadScope } from './sessionReadScope';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { productionMapSavedFromJson } from './workerProductionMapSaved';
import { acknowledgeTransferCommand, retainTransferCommand } from './apparatusTransferCommandStore';

export interface ProductionMapTransferInput { order_id: string; from_apparatus: string; to_apparatus: string; reason: string; idempotency_key: string }
/** @v2 adminTransferProductionMapOrder */
export async function adminTransferProductionMapOrder(session: Session, input: ProductionMapTransferInput) {
  const order = input.order_id.trim(), from = input.from_apparatus.trim(), to = input.to_apparatus.trim();
  const reason = input.reason.trim(), id = input.idempotency_key.trim();
  if (!isCanonicalApparatusId(from) || !isCanonicalApparatusId(to)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  const currentScope = () => JSON.stringify([session.baseUrl, sessionReadScope(session)]), scope = currentScope();
  const guard = () => { if (scope !== currentScope()) throw new WorkerControlException('session_changed', 'Ko‘chirish davomida hisob o‘zgardi.'); };
  if (!order) throw new WorkerControlException('apparatus_transfer_order_not_paused', 'Avariya ko‘chirish ma’lumotlari to‘liq emas');
  if (!reason) throw new WorkerControlException('apparatus_transfer_reason_required', 'Avariya sababini kiriting');
  if (!id || id.length > 200) throw new WorkerControlException('apparatus_transfer_idempotency_required', 'Avariya ko‘chirish identifikatori mavjud emas');
  await Promise.resolve(); guard();
  const command = await retainTransferCommand(scope, { order_id: order, from_apparatus: from, to_apparatus: to, reason, idempotency_key: id });
  guard();
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/apparatus-transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: controller.signal,
    }, guard);
    guard();
    if (response.status !== 200) {
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429)
        await acknowledgeTransferCommand(scope, command);
      let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
      throw productionMapResponseError(response.status, payload, 'apparatus_transfer');
    }
    const payload = await response.json();
    if (!payload || typeof payload !== 'object' || !payload.saved || typeof payload.saved !== 'object' || Array.isArray(payload.saved))
      throw new WorkerControlException('apparatus_transfer_invalid_response', 'Avariya ko‘chirish javobi noto‘g‘ri');
    const saved = productionMapSavedFromJson(payload.saved);
    if (saved.map.id.trim() !== order) throw new WorkerControlException('apparatus_transfer_invalid_response', 'Ko‘chirish javobidagi order mos kelmadi');
    await acknowledgeTransferCommand(scope, command);
    return saved;
  } finally { clearTimeout(timer); }
}
