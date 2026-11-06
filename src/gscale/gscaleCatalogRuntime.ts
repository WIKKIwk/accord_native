import type { Session } from '../auth';
import { preparationSnapshot } from '../preparationReadApi';
import { gscaleItemsPage } from '../shared/catalogApi';
import { adminItemsPage, adminRawMaterialAssignmentOrders, adminWarehouses } from './gscaleAdminApi';
import { fetchGScaleDefaultWarehouses, fetchGScaleItemWarehouses, gscaleCatalogItemSourceForProfile } from './gscaleCatalog';
import { GScaleMaterialPicker } from './gscaleMaterialPicker';
import type { GScaleOrder } from './gscaleOrderSelection';

export function createGScaleCatalogRuntime(session: Session, assignedWarehouses: () => Promise<Set<string>>) {
  const role = String(session.profile.role ?? ''), materialReceipt = role === 'material_taminotchi';
  const itemPage = (query: string, offset: number, limit: number, orderId: string, freshForm = false) =>
    gscaleCatalogItemSourceForProfile(session) === 'adminItems'
      ? adminItemsPage(session, { query, offset, limit })
      : gscaleItemsPage(session, { query, offset, limit, orderId, useBackend: freshForm });
  const picker = new GScaleMaterialPicker((query, offset, limit, orderId) => itemPage(query, offset, limit, orderId));
  const catalog = {
    adminItemsPage: (query: string, limit: number) => adminItemsPage(session, { query, limit }),
    gscaleItemsPage: (query: string, limit: number) => gscaleItemsPage(session, { query, limit }),
    adminWarehouses: (query: string, limit: number) => adminWarehouses(session, { query, limit }),
    preparationSnapshot: () => preparationSnapshot(session),
  };
  return {
    itemPage,
    materialChoices: (query: string, offset: number, limit: number, orderId: string, freshForm: boolean) => {
      if (freshForm && !materialReceipt) {
        const freshPicker = new GScaleMaterialPicker((q, o, l, id) => itemPage(q, o, l, id, true));
        return freshPicker.page(query, offset, limit, orderId, false);
      }
      return picker.page(query, offset, limit, orderId, materialReceipt);
    },
    singleOrderChoice: (orderId: string) => picker.singleOrderChoice(orderId),
    async warehouses(query: string, itemCode: string, independent: boolean) {
      const found = independent ? await fetchGScaleDefaultWarehouses(catalog, session, query, 30, role)
        : await fetchGScaleItemWarehouses(catalog, session, itemCode, query, 12, role);
      if (!materialReceipt) return found;
      const allowed = await assignedWarehouses();
      return found.filter(value => allowed.has(value.warehouse.trim().toLowerCase()));
    },
    async orders(): Promise<GScaleOrder[]> {
      if (materialReceipt) return (await adminRawMaterialAssignmentOrders(session)).map(saved => ({
        id: saved.map.id, code: saved.map.code.trim() || saved.map.order_number, title: saved.map.title,
        order_kg: String(saved.map.order_kg ?? 0), width_mm: saved.map.width_mm, saved: false }));
      return (await preparationSnapshot(session)).orders.map(order => ({ id: order.id, code: order.code,
        title: order.title, order_kg: order.kg, width_mm: order.width_mm, saved: order.saved }));
    },
  };
}
