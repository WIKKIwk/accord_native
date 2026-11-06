import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { inventoryTransferFromJson } from '../inventoryModels';
import { inventoryResponseError } from '../inventoryReadApi';
import { WorkerControlException } from '../workerControlsApi';

type Asset = { kind: string; asset_ref: string };
async function decode(response: Response, code: string, message: string) {
  if (response.status !== 200) throw await inventoryResponseError(response, code, message);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new WorkerControlException(code, message, response.status);
  return inventoryTransferFromJson(data);
}
const jsonPost = (body: Record<string, unknown>): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** @v2 inventoryCreateTransfer */
export async function inventoryCreateTransfer(session: Session, input: { sourceWarehouseId: string; destinationWarehouseId: string;
  assets: Asset[]; idempotencyKey: string; note?: string }) {
  const source = input.sourceWarehouseId.trim(), destination = input.destinationWarehouseId.trim(), key = input.idempotencyKey.trim();
  if (!source || !destination || source === destination || !input.assets.length || !key)
    throw new WorkerControlException('inventory_transfer_invalid', 'Manba, qabul qiluvchi va mahsulotni tanlang');
  const note = (input.note ?? '').trim();
  const response = await authorizedFetch(session, '/v1/mobile/admin/inventory/transfers', jsonPost({
    source_warehouse_id: source, destination_warehouse_id: destination,
    assets: input.assets.map(asset => ({ asset_kind: asset.kind, asset_ref: asset.asset_ref })),
    idempotency_key: key, ...(note ? { note } : {}),
  }));
  return decode(response, 'inventory_transfer_create_failed', 'Transfer yaratilmadi');
}

/** @v2 inventoryTransferAction */
export async function inventoryTransferAction(session: Session, input: { transferId: string; action: string; idempotencyKey: string; note?: string }) {
  const id = input.transferId.trim(), action = input.action.trim().toLowerCase(), key = input.idempotencyKey.trim();
  if (!id || !['approve', 'reject', 'dispatch', 'receive', 'cancel'].includes(action) || !key)
    throw new WorkerControlException('inventory_transfer_action_invalid', 'Transfer amali noto‘g‘ri');
  const note = (input.note ?? '').trim();
  const response = await authorizedFetch(session, `/v1/mobile/admin/inventory/transfers/${encodeURIComponent(id)}/${encodeURIComponent(action)}`,
    jsonPost({ idempotency_key: key, ...(note ? { note } : {}) }));
  return decode(response, 'inventory_transfer_action_failed', 'Transfer yangilanmadi');
}
