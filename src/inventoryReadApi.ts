import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerControlException } from './workerControlsApi';
import { inventoryAssetFromJson, inventoryLocationFromJson } from './inventoryModels';
const errors: Record<string, string> = { inventory_asset_not_found: 'Mahsulot topilmadi', inventory_asset_unavailable: 'Mahsulot band qilingan yoki hozir mavjud emas',
  inventory_asset_not_in_source_warehouse: 'Mahsulotni transferdan oldin omborga qaytaring', inventory_location_not_found: 'Joylashuv topilmadi',
  inventory_location_inactive: 'Bu state faol emas', inventory_cross_warehouse_requires_transfer: 'Boshqa omborga faqat transfer orqali yuboriladi',
  inventory_destination_warehouse_unassigned: 'Qabul qiluvchi omborga mas’ul foydalanuvchi biriktirilmagan',
  inventory_transfer_transition_invalid: 'Transfer bu bosqichda o‘zgartirilmaydi', inventory_idempotency_conflict: 'Amal takrorlandi yoki mos kelmadi' };
export async function inventoryResponseError(response: Response, fallbackCode: string, fallbackMessage: string) {
  let payload: any; try { payload = await response.json(); } catch { payload = null; }
  const code = payload && typeof payload === 'object' && !Array.isArray(payload) && payload.error != null ? String(payload.error) : fallbackCode;
  return new WorkerControlException(code, errors[code] ?? fallbackMessage, response.status);
}
export interface InventoryAssetsOptions { warehouse_id?: string; query?: string; asset_kind?: 'raw_material' | 'finished_goods' | 'qolip';
  current_user_states_only?: boolean; include_order_assignment?: boolean; limit?: number; offset?: number }
/** @v2 inventoryAssets */
export async function inventoryAssets(session: Session, input: InventoryAssetsOptions = {}) {
  const query = new URLSearchParams();
  if (input.warehouse_id?.trim()) query.set('warehouse_id', input.warehouse_id.trim());
  if (input.query?.trim()) query.set('query', input.query.trim());
  if (input.asset_kind) query.set('asset_kind', input.asset_kind);
  if (input.current_user_states_only) query.set('current_user_states_only', 'true');
  if (input.include_order_assignment) query.set('include_order_assignment', 'true');
  query.set('limit', String(input.limit ?? 100));
  if ((input.offset ?? 0) > 0) query.set('offset', String(input.offset));
  const response = await authorizedFetch(session, `/v1/mobile/admin/inventory/assets?${query}`);
  if (response.status !== 200) throw await inventoryResponseError(response, 'inventory_assets_load_failed', 'Ombordagi mahsulotlar yuklanmadi');
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new TypeError('Invalid inventory assets');
  return payload.filter(value => value && typeof value === 'object' && !Array.isArray(value)).map(inventoryAssetFromJson);
}

/** @v2 inventoryLocations */
export async function inventoryLocations(session: Session) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/inventory/locations');
  if (response.status !== 200) throw await inventoryResponseError(response, 'inventory_locations_load_failed', 'Joylashuvlar yuklanmadi');
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new TypeError('Invalid inventory locations');
  return payload.filter(value => value && typeof value === 'object' && !Array.isArray(value)).map(inventoryLocationFromJson);
}
