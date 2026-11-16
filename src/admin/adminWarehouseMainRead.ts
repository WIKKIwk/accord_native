import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch, currentQueueSnapshotReadEpoch } from '../authorizedFetch';
import { adminApparatus } from '../apparatusApi';
import { inventoryAssetFromJson, inventoryLocationFromJson } from '../inventoryModels';
import { qolipProductFromJson } from '../qolipCatalogApi';
import { sessionReadScope } from '../sessionReadScope';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { MobileApiException } from '../shared/mobileApiException';
import { rawMaterialStockFromJson } from '../shared/printApi';
import { productionMapResponseError } from '../workerControlsApi';
import { rawMaterialAssignment } from '../workerRawMaterials';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminWarehouseAssignmentFromJson } from './adminWarehouseAssignmentApi';
import { dartJsonString, dartPartialLower, dartTrim } from './dartJsonString';
import { dartQueryComponent } from './dartUri';
import type { AdminWarehouseMainDetail, AdminWarehouseMainProfileFlags, AdminWarehouseMainQolipProduct,
  AdminWarehouseMainReadGuard, AdminWarehouseMainReadWitness, AdminWarehouseMainSummary } from './adminWarehouseMainReadTypes';
import { adminWarehouseSummaryFromJson } from './warehouseApi';
import { adminWarehouseStockItemFromJson } from './warehouseStockApi';

type Guard = AdminWarehouseMainReadGuard;
type Witness = AdminWarehouseMainReadWitness;
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : null;
const lower = (value: string) => dartPartialLower(dartTrim(value));
const unique = (values: readonly string[]) => {
  const seen = new Set<string>(); return values.map(dartTrim).filter(value => !!value && !seen.has(lower(value)) && !!seen.add(lower(value)));
};
const query = (values: Record<string, string>) => Object.entries(values).map(([key, value]) => `${dartQueryComponent(key)}=${dartQueryComponent(value)}`).join('&');

/** Each request retains the supplied operation's original authority through body/model settlement. */
function boundary(guard: Guard, witness: Witness): Guard {
  const checked = checkedAdminGuard(guard); if (!checked || typeof witness !== 'function') throw new TypeError('Warehouse main read requires a guard and witness');
  let expired = false, checking = false;
  return () => {
    if (expired || checking) { expired = true; throw new Error('Warehouse main read expired'); }
    checking = true;
    try {
      checked(); if (!isSynchronouslyTrue(witness)) throw new Error('Warehouse main read expired'); checked();
    } catch (error) { expired = true; throw error; }
    finally { checking = false; }
  };
}
async function guarded<T>(guard: Guard, witness: Witness, read: (check: Guard) => Promise<T>): Promise<T> {
  const check = boundary(guard, witness);
  try { check(); const result = await read(check); check(); return result; } catch (error) { check(); throw error; }
}
async function send(session: Session, path: string, check: Guard, witness: Witness, headers?: Record<string, string>): Promise<Response> {
  check(); const response = await authorizedFetch(session, path, headers ? { headers } : {}, check, 10_000, { readWitness: witness }); check(); return response;
}
async function json(response: Response, check: Guard): Promise<unknown> {
  try { const value: unknown = await response.json(); check(); return value; } catch (error) { check(); throw error; }
}
async function errorBody(response: Response, check: Guard): Promise<unknown> {
  try { return await json(response, check); } catch { check(); return null; }
}
function list(value: unknown): unknown[] { if (!Array.isArray(value)) throw new TypeError('Invalid warehouse main list'); return value; }
async function listRead<T>(session: Session, path: string, failure: string, parse: (value: unknown) => T,
  guard: Guard, witness: Witness): Promise<T[]> {
  return guarded(guard, witness, async check => {
    const response = await send(session, path, check, witness); if (response.status !== 200) throw new Error(failure);
    const result = list(await json(response, check)).map(parse); check(); return result;
  });
}

export const readAdminWarehouseMainSummaries = (session: Session, guard: Guard, witness: Witness) =>
  listRead(session, '/v1/mobile/admin/warehouses/summary?limit=500', 'Admin warehouse summaries failed', adminWarehouseSummaryFromJson, guard, witness);
export const readAdminWarehouseMainAssignments = (session: Session, guard: Guard, witness: Witness) =>
  listRead(session, '/v1/mobile/admin/warehouses/assignments', 'Admin warehouse assignments failed', adminWarehouseAssignmentFromJson, guard, witness);
export const readAdminWarehouseMainRawStock = (session: Session, warehouse: string, guard: Guard, witness: Witness) =>
  listRead(session, `/v1/mobile/admin/raw-material-stock?${query({ ...(dartTrim(warehouse) ? { warehouse: dartTrim(warehouse) } : {}), limit: '500' })}`,
    'Admin raw material stock failed', rawMaterialStockFromJson, guard, witness);
export function readAdminWarehouseMainRawAssignments(session: Session, guard: Guard, witness: Witness) {
  return guarded(guard, witness, async check => {
    const response = await send(session, '/v1/mobile/admin/raw-material-assignments', check, witness);
    if (response.status !== 200) {
      const value = await errorBody(response, check), error = productionMapResponseError(response.status, value, 'raw_material_assignments', response.headers); check();
      throw new MobileApiException({ code: error.code, message: error.message, statusCode: error.statusCode,
        diagnostics: error.diagnostics, requestId: error.requestId, apparatusOptions: error.apparatusOptions, details: error.details });
    }
    const result = list(await json(response, check)).map(rawMaterialAssignment); check(); return result;
  });
}
const inventoryErrors: Record<string, string> = {
  inventory_asset_not_found: 'Mahsulot topilmadi', inventory_asset_unavailable: 'Mahsulot band qilingan yoki hozir mavjud emas',
  inventory_asset_not_in_source_warehouse: 'Mahsulotni transferdan oldin omborga qaytaring', inventory_location_not_found: 'Joylashuv topilmadi',
  inventory_location_inactive: 'Bu state faol emas', inventory_cross_warehouse_requires_transfer: 'Boshqa omborga faqat transfer orqali yuboriladi',
  inventory_destination_warehouse_unassigned: 'Qabul qiluvchi omborga mas’ul foydalanuvchi biriktirilmagan',
  inventory_transfer_transition_invalid: 'Transfer bu bosqichda o‘zgartirilmaydi', inventory_idempotency_conflict: 'Amal takrorlandi yoki mos kelmadi',
};
async function inventoryRead<T>(session: Session, path: string, fallbackCode: string, fallbackMessage: string, parse: (value: unknown) => T, guard: Guard, witness: Witness): Promise<T[]> {
  return guarded(guard, witness, async check => {
    const response = await send(session, path, check, witness);
    if (response.status !== 200) {
      const value = object(await errorBody(response, check)), code = value?.error == null ? fallbackCode : dartJsonString(value.error);
      check(); throw new MobileApiException({ code, message: inventoryErrors[code] ?? fallbackMessage, statusCode: response.status });
    }
    const result = list(await json(response, check)).filter(value => object(value) !== null).map(parse); check(); return result;
  });
}
export const readAdminWarehouseMainLocations = (session: Session, guard: Guard, witness: Witness) =>
  inventoryRead(session, '/v1/mobile/admin/inventory/locations', 'inventory_locations_load_failed', 'Joylashuvlar yuklanmadi', inventoryLocationFromJson, guard, witness);
export const readAdminWarehouseMainAssets = (session: Session, warehouseId: string, guard: Guard, witness: Witness) =>
  inventoryRead(session, `/v1/mobile/admin/inventory/assets?${query({ ...(dartTrim(warehouseId) ? { warehouse_id: dartTrim(warehouseId) } : {}), asset_kind: 'raw_material', limit: '500' })}`,
    'inventory_assets_load_failed', 'Ombordagi mahsulotlar yuklanmadi', inventoryAssetFromJson, guard, witness);
export const readAdminWarehouseMainApparatus = (session: Session, guard: Guard, witness: Witness) =>
  guarded(guard, witness, check => adminApparatus(session, { limit: 10000, beforeSend: check, readWitness: witness }));
export function readAdminWarehouseMainItemsPage(session: Session, warehouse: string, search: string, offset: number, guard: Guard, witness: Witness) {
  if (!dartTrim(warehouse)) return guarded(guard, witness, async () => []);
  return listRead(session, `/v1/mobile/admin/warehouses/items?${query({ warehouse: dartTrim(warehouse), ...(dartTrim(search) ? { q: dartTrim(search) } : {}), limit: '80', ...(offset > 0 ? { offset: String(offset) } : {}) })}`,
    'Admin warehouse items failed', adminWarehouseStockItemFromJson, guard, witness);
}

type QolipCache = { scope: string; products: AdminWarehouseMainQolipProduct[] | null; etag: string | null; generation: number; inFlight: WeakMap<Guard, WeakMap<Witness, Promise<AdminWarehouseMainQolipProduct[]>>> };
const qolipCaches = new WeakMap<Session, QolipCache>();
const qolipScope = (session: Session) => JSON.stringify([sessionReadScope(session), activeSessionToken(session), session.profile, currentQueueSnapshotReadEpoch()]);
/** Admin-local full-catalog ETag cache. The protected Qolip shared cache and its callers are unchanged. */
export function readAdminWarehouseMainQolipProducts(session: Session, search: string, guard: Guard, witness: Witness): Promise<AdminWarehouseMainQolipProduct[]> {
  const check = boundary(guard, witness); check();
  const normalized = dartTrim(search), scope = qolipScope(session); let cache: QolipCache | null = null;
  if (!normalized) {
    cache = qolipCaches.get(session) ?? null;
    if (!cache || cache.scope !== scope) { cache = { scope, products: null, etag: null, generation: 0, inFlight: new WeakMap() }; qolipCaches.set(session, cache); }
    const existing = cache.inFlight.get(guard)?.get(witness); if (existing) return guarded(guard, witness, async () => existing);
  }
  const captured = cache, previous = cache?.products ?? null, etag = cache?.etag ?? null, generation = cache ? ++cache.generation : 0;
  const pending = (async () => {
    try {
      const path = `/v1/mobile/qolip/products?${query({ ...(normalized ? { q: normalized } : {}), limit: '20000', with_qolip: 'true' })}`;
      const response = await send(session, path, check, witness, previous && etag !== null ? { 'If-None-Match': etag } : {});
      let products: AdminWarehouseMainQolipProduct[];
      if (response.status === 304 && previous) products = previous;
      else if (response.status === 200) {
        const data = object(await json(response, check)); if (!data) throw new TypeError('Invalid Qolip products');
        products = []; let slice = Date.now();
        if (Array.isArray(data.products)) for (const value of data.products) {
          products.push(qolipProductFromJson(value));
          // V2 yields after a 2ms parse slice; preserve event order and the original operation across that yield.
          if (Date.now() - slice >= 2) { check(); await new Promise<void>(resolve => setTimeout(resolve, 0)); check(); slice = Date.now(); }
        }
      } else throw new MobileApiException({ code: 'qolip_products_failed', message: 'Qolip products failed', statusCode: response.status });
      check();
      if (scope !== qolipScope(session)) return await readAdminWarehouseMainQolipProducts(session, search, guard, witness);
      if (captured && captured.generation === generation) { captured.products = products; captured.etag = response.headers.get('etag') ?? (response.status === 304 ? etag : null); }
      check(); return products;
    } catch (error) {
      if (captured && captured.generation === generation) { captured.products = null; captured.etag = null; }
      check(); throw error;
    }
  })();
  if (!captured) return pending;
  let requests = captured.inFlight.get(guard); if (!requests) { requests = new WeakMap(); captured.inFlight.set(guard, requests); }
  const originalRequests = requests, tracked = pending.finally(() => { if (originalRequests.get(witness) === tracked) originalRequests.delete(witness); });
  originalRequests.set(witness, tracked); return tracked;
}

async function assignedWarehouses(session: Session, guard: Guard, witness: Witness): Promise<string[]> {
  const assigned = session.assigned_warehouses ?? session.profile.assigned_warehouses;
  if (Array.isArray(assigned) && assigned.length) return unique(assigned.filter((value): value is string => typeof value === 'string'));
  const assignments = await readAdminWarehouseMainAssignments(session, guard, witness), ref = lower(dartJsonString(session.profile.ref ?? '')), name = lower(dartJsonString(session.profile.display_name ?? ''));
  return unique(assignments.filter(row => row.principal_role === session.profile.role && ((!!ref && lower(row.principal_ref) === ref) || (!!name && lower(row.display_name) === name))).map(row => row.warehouse));
}
const allowed = (warehouse: string, names: readonly string[] | null) => names === null || (!!lower(warehouse) && names.some(name => lower(name) === lower(warehouse)));
class WarehouseLocationNotFound extends Error {
  constructor(warehouse: string) { super(`Bad state: Inventory warehouse location not found: ${warehouse}`); this.name = 'StateError'; }
  toString(): string { return this.message; }
}

/** @v2 AdminWarehousesScreen._load */
export function loadAdminWarehouseMainSummary(session: Session, flags: AdminWarehouseMainProfileFlags, guard: Guard, witness: Witness): Promise<AdminWarehouseMainSummary> {
  const { warehouseScoped, adminScoped } = flags;
  return guarded(guard, witness, async check => {
    const [summaries, names, assignments] = await Promise.all([
      readAdminWarehouseMainSummaries(session, guard, witness), warehouseScoped ? assignedWarehouses(session, guard, witness) : Promise.resolve(null),
      adminScoped ? readAdminWarehouseMainAssignments(session, guard, witness) : Promise.resolve([]),
    ]); check();
    return { sections: summaries.filter(row => allowed(row.warehouse, names)), qolipWarehouseNames: unique(assignments.filter(row => row.principal_role === 'qolipchi').map(row => row.warehouse)) };
  });
}
/** @v2 AdminWarehousesScreen._loadDetail: physical location is authoritative, not custody/name alone. */
export function loadAdminWarehouseMainDetail(session: Session, warehouse: string, flags: AdminWarehouseMainProfileFlags, guard: Guard, witness: Witness): Promise<AdminWarehouseMainDetail | null> {
  const { warehouseScoped } = flags;
  return guarded(guard, witness, async check => {
    const names = warehouseScoped ? await assignedWarehouses(session, guard, witness) : null; check(); if (!allowed(warehouse, names)) return null;
    const [reservations, rawStock, locations, apparatus] = await Promise.all([
      readAdminWarehouseMainRawAssignments(session, guard, witness), readAdminWarehouseMainRawStock(session, warehouse, guard, witness),
      readAdminWarehouseMainLocations(session, guard, witness), readAdminWarehouseMainApparatus(session, guard, witness),
    ]); check(); if (!rawStock.length) return { rawStock: [], reservations: [], apparatus };
    const location = locations.find(row => row.kind === 'warehouse' && lower(row.name) === lower(warehouse));
    if (!location) throw new WarehouseLocationNotFound(warehouse);
    const assets = await readAdminWarehouseMainAssets(session, location.warehouse_id, guard, witness); check();
    const physical = new Set(assets.filter(row => row.physical_location.kind === 'warehouse' && row.physical_location.id === location.id).map(row => lower(row.asset_ref)).filter(Boolean));
    const stock = rawStock.filter(row => physical.has(lower(row.id))), barcodes = new Set(stock.map(row => lower(row.barcode)).filter(Boolean));
    return { rawStock: stock, reservations: reservations.filter(row => barcodes.has(lower(row.barcode))), apparatus };
  });
}
