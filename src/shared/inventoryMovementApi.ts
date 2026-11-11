import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { inventoryAssetFromJson } from '../inventoryModels';
import { inventoryResponseError } from '../inventoryReadApi';
import { WorkerControlException } from '../workerControlsApi';

/** @v2 inventoryRelocateBatch */
export async function inventoryRelocateBatch(session: Session, input: {
  assets: readonly { kind: string; asset_ref: string }[]; physicalLocationId: string; idempotencyKey: string; note?: string;
}, beforeSend?: () => void) {
  const assets = new Map<string, { asset_kind: string; asset_ref: string }>();
  for (const asset of input.assets) {
    const ref = asset.asset_ref.trim();
    if (ref) assets.set(`${asset.kind}:${ref.toLowerCase()}`, { asset_kind: asset.kind, asset_ref: ref });
  }
  const location = input.physicalLocationId.trim(), key = input.idempotencyKey.trim();
  if (!assets.size || !location || !key) throw new WorkerControlException('inventory_relocation_invalid', 'Mahsulot va joylashuvni tanlang');
  const response = await authorizedFetch(session, '/v1/mobile/admin/inventory/relocations/batch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets: [...assets.values()], physical_location_id: location, idempotency_key: key,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}) }),
  }, beforeSend);
  if (!response.ok) throw await inventoryResponseError(response, 'inventory_relocation_failed', 'Joylashuv o‘zgartirilmadi');
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new TypeError('Invalid inventory assets');
  return payload.filter(row => row && typeof row === 'object' && !Array.isArray(row)).map(inventoryAssetFromJson);
}
