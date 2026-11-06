import type { Session } from '../auth';
import { appPreferences } from '../appPreferences';
import { preparationSnapshot } from '../preparationReadApi';
import { gscaleSimpleMaterialReceipt } from '../preparation/preparationCommandApi';
import { PrintService } from '../printing/printService';
import { profile } from '../profileApi';
import { adminWarehouseAssignments, gscaleItemsPage } from '../shared/catalogApi';
import { GScaleBatchStateStore } from './gscaleBatchState';
import { gscaleRpsBatchStart, gscaleRpsBatchState, gscaleRpsBatchStop } from './gscaleBatchApi';
import { printGScaleBatch } from './gscaleBatchPrintRuntime';
import { startGScaleBatch } from './gscaleBatchStart';
import { createGScaleDeviceStore } from './gscaleDeviceRuntime';
import { loadOperatorControlDraft, saveOperatorControlDraft } from './gscaleDraft';
import { refreshGScaleMonitor } from './gscaleLive';
import { createGScaleLiveMonitor } from './gscaleLiveRuntime';
import { loadPreparationReceiptPreset, submitSimpleGScaleReceipt } from './gscalePreparation';
import { GScaleOperatorStore } from './gscaleOperatorState';
import type { GScaleModeArgs } from './gscaleRouteArgs';

async function timed<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out')), milliseconds); })]); }
  finally { if (timer) clearTimeout(timer); }
}

/** @v2 _materialAssignedWarehouseNames */
export async function materialAssignedWarehouseNames(session: Session): Promise<Set<string>> {
  if ((session.assigned_warehouses ?? []).length) return new Set(session.assigned_warehouses!.map(value => value.trim().toLowerCase()).filter(Boolean));
  const ref = String(session.profile.ref ?? '').trim().toLowerCase();
  const name = String(session.profile.display_name ?? '').trim().toLowerCase();
  return new Set((await adminWarehouseAssignments(session)).filter(value =>
    ['material_taminotchi', 'tayyorlov_masteri'].includes(value.principal_role) &&
    ((!!ref && value.principal_ref.trim().toLowerCase() === ref) || (!!name && value.display_name.trim().toLowerCase() === name)))
    .map(value => value.warehouse.trim().toLowerCase()).filter(Boolean));
}

export function createGScaleOperatorStore(session: Session, args: GScaleModeArgs): GScaleOperatorStore {
  const role = String(session.profile.role ?? ''), controlOnly = role === 'material_taminotchi' || role === 'tayyorlov_masteri';
  const batch = new GScaleBatchStateStore({ state: () => gscaleRpsBatchState(session), stop: (id, rev) => gscaleRpsBatchStop(session, id, rev) });
  const materialWarehouses = async () => (await timed(preparationSnapshot(session), 4000)).material_warehouses;
  const warehouseAllowed = async (warehouse: string) => role !== 'material_taminotchi' ||
    (await materialAssignedWarehouseNames(session)).has(warehouse.trim().toLowerCase());
  let store: GScaleOperatorStore;
  store = new GScaleOperatorStore(role, args, {
    devices: createGScaleDeviceStore(), batch, refreshProfileScope: async () => { await profile(session); },
    loadDraft: () => loadOperatorControlDraft(appPreferences), saveDraft: draft => saveOperatorControlDraft(appPreferences, draft),
    loadMaterialWarehouses: materialWarehouses,
    loadPreparationPreset: async () => {
      const item = await loadPreparationReceiptPreset({ orderId: args.order?.id ?? '', materialId: args.materialId ?? '',
        materialName: args.materialName ?? '', current: () => store.isActive(),
        loadPage: (query, orderId, offset, limit) => gscaleItemsPage(session, { query, orderId, offset, limit, useBackend: true }) });
      return item ? { code: item.code, name: item.name || item.code, requiresDimensions: item.requires_dimensions } : null;
    },
    warehouseAllowed,
    startBatch: (context, choose) => startGScaleBatch(context, {
      warehouseAllowed, detectOfflinePrinter: () => PrintService.detectOfflinePrinter(),
      itemPage: (query, orderId, useBackend) => gscaleItemsPage(session, { query, orderId, offset: 0, limit: 200, useBackend }),
      chooseApparatus: choose,
      current: () => { const state = store.getSnapshot(); return { mounted: store.isActive(), linkedOrderId: args.order?.id ?? '',
        draftOrderId: state.draft.order_id, batchResolved: state.batch.resolved, batchActive: state.batch.batch?.active === true }; },
      start: request => gscaleRpsBatchStart(session, request),
    }),
    printBatch: context => printGScaleBatch(session, context, () => batch.refresh()),
    submitSimple: (itemCode, warehouse, quantityText, previous) => submitSimpleGScaleReceipt({ itemCode, warehouse, quantityText, role,
      controlOnly, freshForm: args.freshForm === true, materialWarehouses: previous,
      refreshMaterialWarehouses: materialWarehouses, submit: payload => gscaleSimpleMaterialReceipt(session, payload) }),
    refreshMonitor: baseUrl => refreshGScaleMonitor(fetch, baseUrl),
    makeLive: (server, callbacks) => createGScaleLiveMonitor(server.endpoint.baseUrl, callbacks),
  });
  return store;
}
