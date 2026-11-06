import type { Session } from '../auth';
import type { SupplierItem } from '../shared/catalogApi';

export type GScaleCatalogWarehouse = { warehouse: string; actualQty?: number | null; company?: string | null };
type Role = string | null | undefined;
const sessionRole = (session: Session | null) => String(session?.profile.role ?? '');
const has = (session: Session | null, capability: string) => session?.capabilities.includes(capability) === true;

/** @v2 gscaleCatalogItemSourceForProfile */
export function gscaleCatalogItemSourceForProfile(session: Session | null): 'adminItems' | 'gscaleItems' {
  const role = sessionRole(session);
  if (role === 'material_taminotchi' || role === 'tayyorlov_masteri') return 'gscaleItems';
  return has(session, 'catalog.item.read') ? 'adminItems' : 'gscaleItems';
}

/** @v2 gscaleUsesScopedAdminWarehousesForProfile */
export function gscaleUsesScopedAdminWarehousesForProfile(session: Session | null, role?: Role): boolean {
  if (role != null) return ['admin', 'brigader', 'werka', 'material_taminotchi'].includes(role);
  return has(session, 'admin.access') || has(session, 'production.map.manage') || has(session, 'catalog.item.read') ||
    (sessionRole(session) === 'werka' && has(session, 'gscale.catalog.read')) ||
    (sessionRole(session) === 'material_taminotchi' && has(session, 'raw_material.assign'));
}

/** @v2 gscaleMergesDefaultWarehousesForProfile */
export function gscaleMergesDefaultWarehousesForProfile(session: Session | null, role?: Role): boolean {
  return ['werka', 'material_taminotchi'].includes(role ?? sessionRole(session));
}

function uniqueWarehouses(warehouses: Iterable<string>, query = ''): GScaleCatalogWarehouse[] {
  const normalized = query.trim().toLowerCase();
  const seen = new Set<string>();
  const result: GScaleCatalogWarehouse[] = [];
  for (const raw of warehouses) {
    const warehouse = raw.trim(), key = warehouse.toLowerCase();
    if (!warehouse || !key.includes(normalized) || seen.has(key)) continue;
    seen.add(key);
    result.push({ warehouse });
  }
  return result;
}

/** @v2 gscaleAssignedWarehousesForProfile */
export function gscaleAssignedWarehousesForProfile(session: Session | null, query = ''): GScaleCatalogWarehouse[] {
  return uniqueWarehouses(session?.assigned_warehouses ?? [], query);
}

/** @v2 gscaleScopeWarehousesForProfile */
export function gscaleScopeWarehousesForProfile(warehouses: Iterable<GScaleCatalogWarehouse>, session: Session | null, role?: Role): GScaleCatalogWarehouse[] {
  const values = [...warehouses];
  if ((role ?? sessionRole(session)) !== 'werka') return values;
  const allowed = new Set((session?.assigned_warehouses ?? []).map(value => value.trim().toLowerCase()).filter(Boolean));
  return values.filter(value => allowed.has(value.warehouse.trim().toLowerCase()));
}

/** @v2 mergeGScaleCatalogWarehouses */
export function mergeGScaleCatalogWarehouses(first: Iterable<GScaleCatalogWarehouse>, second: Iterable<GScaleCatalogWarehouse>): GScaleCatalogWarehouse[] {
  const seen = new Set<string>();
  return [...first, ...second].filter(value => {
    const key = value.warehouse.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** @v2 gscaleWarehousesFromSupplierItems */
export function gscaleWarehousesFromSupplierItems(items: Iterable<Pick<SupplierItem, 'code' | 'warehouse'>>, itemCode = '', query = ''): GScaleCatalogWarehouse[] {
  const code = itemCode.trim().toLowerCase();
  return uniqueWarehouses([...items].filter(item => !code || item.code.trim().toLowerCase() === code).map(item => item.warehouse), query);
}

/** @v2 gscaleWarehousesFromCustomerOptions */
export function gscaleWarehousesFromCustomerOptions(options: Iterable<{ item_code: string; warehouse: string }>, itemCode = '', query = ''): GScaleCatalogWarehouse[] {
  const code = itemCode.trim().toLowerCase();
  return uniqueWarehouses([...options].filter(item => !code || item.item_code.trim().toLowerCase() === code).map(item => item.warehouse), query);
}

/** @v2 gscaleWarehousesFromDefault */
export function gscaleWarehousesFromDefault(warehouse: string, query = ''): GScaleCatalogWarehouse[] {
  return uniqueWarehouses([warehouse], query);
}

export type GScaleCatalogApi = {
  adminItemsPage(query: string, limit: number): Promise<SupplierItem[]>;
  gscaleItemsPage(query: string, limit: number): Promise<SupplierItem[]>;
  adminWarehouses(query: string, limit: number): Promise<{ warehouse: string; company: string }[]>;
  preparationSnapshot(): Promise<{ assigned_warehouses: string[] }>;
};

/** @v2 fetchGScaleDefaultWarehouses */
export async function fetchGScaleDefaultWarehouses(api: GScaleCatalogApi, session: Session | null, query = '', limit = 30, role?: Role): Promise<GScaleCatalogWarehouse[]> {
  if ((role ?? sessionRole(session)) === 'tayyorlov_masteri') {
    return uniqueWarehouses((await api.preparationSnapshot()).assigned_warehouses, query).slice(0, limit);
  }
  if (gscaleUsesScopedAdminWarehousesForProfile(session, role)) {
    try {
      const warehouses = (await api.adminWarehouses(query, limit)).map(value => ({ warehouse: value.warehouse,
        company: value.company.trim() ? value.company : null })).filter(value => value.warehouse.trim());
      return gscaleScopeWarehousesForProfile(warehouses, session, role).slice(0, limit);
    } catch (error) {
      if ((role ?? sessionRole(session)) !== 'werka') throw error;
      const fallback = gscaleAssignedWarehousesForProfile(session, query).slice(0, limit);
      if (!fallback.length) throw error;
      return fallback;
    }
  }
  if (role === 'werka' || (role == null && has(session, 'gscale.catalog.read'))) {
    return gscaleWarehousesFromSupplierItems(await api.gscaleItemsPage('', 200), '', query).slice(0, limit);
  }
  throw new Error('GScale omborlari faqat admin yoki werka uchun mavjud');
}

/** @v2 fetchGScaleItemWarehouses */
export async function fetchGScaleItemWarehouses(api: GScaleCatalogApi, session: Session | null, itemCode: string, query = '', limit = 12, role?: Role): Promise<GScaleCatalogWarehouse[]> {
  const admin = role === 'admin' || role === 'brigader' || (role == null && has(session, 'catalog.item.read'));
  const gscale = role === 'werka' || (role == null && has(session, 'gscale.catalog.read'));
  if (admin) {
    const items = (await api.adminItemsPage(itemCode, 50)).filter(item => item.code.trim().toLowerCase() === itemCode.trim().toLowerCase());
    if (!items.length) return [];
    const warehouses = gscaleWarehousesFromSupplierItems(items, itemCode, query);
    return gscaleScopeWarehousesForProfile(mergeGScaleCatalogWarehouses(warehouses,
      await fetchGScaleDefaultWarehouses(api, session, query, limit, role)), session, role).slice(0, limit);
  }
  if (gscale) {
    const warehouses = gscaleWarehousesFromSupplierItems(await api.gscaleItemsPage(itemCode, 50), itemCode, query);
    if (warehouses.length && !gscaleMergesDefaultWarehousesForProfile(session, role)) return warehouses.slice(0, limit);
    return gscaleScopeWarehousesForProfile(mergeGScaleCatalogWarehouses(warehouses,
      await fetchGScaleDefaultWarehouses(api, session, query, limit, role)), session, role).slice(0, limit);
  }
  throw new Error('GScale omborlari faqat admin yoki werka uchun mavjud');
}

/** @v2 MaterialReceiptChoice */
export function materialReceiptChoices(items: Iterable<SupplierItem>): { item: SupplierItem; micron: number | null }[] {
  const choices: { item: SupplierItem; micron: number | null }[] = [];
  for (const item of items) {
    if (!item.order_microns.length) choices.push({ item, micron: null });
    else for (const micron of new Set(item.order_microns)) choices.push({ item, micron });
  }
  return choices;
}
