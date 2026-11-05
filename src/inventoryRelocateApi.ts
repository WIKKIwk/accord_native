import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerControlException } from './workerControlsApi';
import { inventoryAssetFromJson } from './inventoryModels';
import { inventoryResponseError } from './inventoryReadApi';

/** @v2 inventoryRelocate */
export async function inventoryRelocate(session: Session, input: { asset_kind: 'raw_material' | 'finished_goods' | 'qolip';
  asset_ref: string; physical_location_id: string; idempotency_key: string; note?: string }) {
  const ref = input.asset_ref.trim(), location = input.physical_location_id.trim(), key = input.idempotency_key.trim();
  if (!ref || !location || !key) throw new WorkerControlException('inventory_relocation_invalid', 'Mahsulot va joylashuvni tanlang');
  const body = { asset_kind: input.asset_kind, asset_ref: ref, physical_location_id: location, idempotency_key: key,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}) };
  const response = await authorizedFetch(session, '/v1/mobile/admin/inventory/relocations', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (response.status !== 200) throw await inventoryResponseError(response, 'inventory_relocation_failed', 'Joylashuv o‘zgartirilmadi');
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    throw new WorkerControlException('inventory_relocation_failed', 'Joylashuv o‘zgartirilmadi', response.status);
  return inventoryAssetFromJson(payload);
}
