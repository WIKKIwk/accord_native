import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
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
import { createGScaleCatalogRuntime } from './gscaleCatalogRuntime';
import { loadGScaleArchive, printGScaleArchiveSession, reprintGScaleArchiveReceipt } from './gscaleArchiveRuntime';
import type { GScaleModeArgs } from './gscaleRouteArgs';
import { MaterialGScalePolicy, materialPreferenceOverlay, materialPrinterSelectionKey,
  type MaterialGScaleOperation } from './gscaleMaterialPolicy';
import type { PrintDeviceSelection } from './gscalePreferences';

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

export function createGScaleOperatorStore(session: Session, args: GScaleModeArgs,
  options: { materialPrinterSafety?: boolean } = {}): GScaleOperatorStore {
  const role = String(session.profile.role ?? ''), controlOnly = role === 'material_taminotchi' || role === 'tayyorlov_masteri';
  if (options.materialPrinterSafety && role !== 'material_taminotchi') throw new Error('Material printer policy requires Material role');
  const scope = options.materialPrinterSafety ? sessionReadScope(session) : '', policy = options.materialPrinterSafety
    ? new MaterialGScalePolicy(() => !!activeSessionToken(session) && sessionReadScope(session) === scope) : undefined;
  const storage = policy ? materialPreferenceOverlay(appPreferences) : appPreferences;
  let store: GScaleOperatorStore;
  const batch = new GScaleBatchStateStore({ state: () => gscaleRpsBatchState(session), stop: (id, rev) => {
    const selection = policy ? materialPrinterSelectionKey(store.getSnapshot().device.selection) ?? '' : '';
    const guard = policy ? () => policy.assertOperation('stop', store.getSnapshot(), { selection, batchId: id, batchRevision: rev }) : undefined;
    guard?.(); return gscaleRpsBatchStop(session, id, rev, guard);
  } }, policy ? { prepareAutomaticStop: expected => {
    const selection = materialPrinterSelectionKey(store.getSnapshot().device.selection) ?? '';
    return () => {
      try { policy.assertOperation('stop', store.getSnapshot(), { selection, batchId: expected.id, batchRevision: expected.revision }); return true; }
      catch { return false; }
    };
  } } : undefined);
  const selectionKey = (selection: PrintDeviceSelection | null) => materialPrinterSelectionKey(selection) ?? '';
  const beforeWrite = (operation: MaterialGScaleOperation, selection: string, expectedBatch?: { id: string; revision: number } | null) =>
    () => policy?.assertOperation(operation, store.getSnapshot(), { selection,
      ...(expectedBatch ? { batchId: expectedBatch.id, batchRevision: expectedBatch.revision } : {}) });
  const catalog = createGScaleCatalogRuntime(session, () => materialAssignedWarehouseNames(session));
  const materialWarehouses = async () => (await timed(preparationSnapshot(session), 4000)).material_warehouses;
  const warehouseAllowed = async (warehouse: string) => role !== 'material_taminotchi' ||
    (await materialAssignedWarehouseNames(session)).has(warehouse.trim().toLowerCase());
  store = new GScaleOperatorStore(role, args, {
    devices: createGScaleDeviceStore(policy ? { storage, allowSelection: value => policy.allowSelection(value), rememberBluetooth: false } : {}),
    batch, refreshProfileScope: async () => { await profile(session); },
    loadDraft: () => loadOperatorControlDraft(storage), saveDraft: draft => saveOperatorControlDraft(storage, draft),
    loadMaterialWarehouses: materialWarehouses,
    prefillMaterialOrder: async orderId => {
      const choice = await catalog.singleOrderChoice(orderId);
      return choice ? { item: { code: choice.item.code, name: choice.item.name || choice.item.code,
        requiresDimensions: choice.item.requires_dimensions }, micron: choice.micron } : null;
    },
    loadPreparationPreset: async presetArgs => {
      const orderId = presetArgs.order?.id ?? '';
      const item = await loadPreparationReceiptPreset({ orderId, materialId: presetArgs.materialId ?? '',
        materialName: presetArgs.materialName ?? '', current: () => store.isActive() && (store.currentArgs().order?.id ?? '') === orderId,
        loadPage: (query, orderId, offset, limit) => gscaleItemsPage(session, { query, orderId, offset, limit, useBackend: true }) });
      return item ? { code: item.code, name: item.name || item.code, requiresDimensions: item.requires_dimensions } : null;
    },
    warehouseAllowed,
    startBatch: (context, choose) => {
      const selection: PrintDeviceSelection | null = context.transport === 'offline' && context.offlinePrinter
        ? { transport: 'offline', offlinePrinter: context.offlinePrinter } : context.transport === 'bluetooth' && context.bluetoothPrinter
          ? { transport: 'bluetooth', bluetoothPrinter: context.bluetoothPrinter } : context.transport === 'wifi' && context.server
            ? { transport: 'wifi', server: context.server } : null;
      const expectedSelection = policy ? selectionKey(selection) : '';
      policy?.assertOperation('start', store.getSnapshot(), { selection: expectedSelection });
      return startGScaleBatch(context, {
      warehouseAllowed, detectOfflinePrinter: () => PrintService.detectOfflinePrinter(),
      itemPage: (query, orderId, useBackend) => gscaleItemsPage(session, { query, orderId, offset: 0, limit: 200, useBackend }),
      chooseApparatus: choose,
      current: () => { const state = store.getSnapshot(); return { mounted: store.isActive(), linkedOrderId: store.currentArgs().order?.id ?? '',
        draftOrderId: state.draft.order_id, batchResolved: state.batch.resolved, batchActive: state.batch.batch?.active === true }; },
      start: request => {
        const guard = policy ? () => policy.assertOperation('start', store.getSnapshot(), { selection: expectedSelection,
          requestPrinter: request.printer, requestDriverUrl: request.driver_url }) : undefined;
        guard?.(); return gscaleRpsBatchStart(session, request, guard);
      },
    }); },
    printBatch: context => {
      const selection: PrintDeviceSelection | null = context.transport === 'offline' && context.offlinePrinter
        ? { transport: 'offline', offlinePrinter: context.offlinePrinter } : context.transport === 'bluetooth' && context.bluetoothPrinter
          ? { transport: 'bluetooth', bluetoothPrinter: context.bluetoothPrinter } : context.transport === 'wifi' && context.server
            ? { transport: 'wifi', server: context.server } : null;
      const guard = policy ? beforeWrite('print', selectionKey(selection), context.batch) : undefined;
      guard?.();
      return printGScaleBatch(session, context, () => batch.refresh(), guard);
    },
    submitSimple: (itemCode, warehouse, quantityText, previous) => submitSimpleGScaleReceipt({ itemCode, warehouse, quantityText, role,
      controlOnly, freshForm: args.freshForm === true, materialWarehouses: previous,
      refreshMaterialWarehouses: materialWarehouses, submit: payload => gscaleSimpleMaterialReceipt(session, payload) }),
    refreshMonitor: baseUrl => refreshGScaleMonitor(fetch, baseUrl),
    makeLive: (server, callbacks) => createGScaleLiveMonitor(server.endpoint.baseUrl, callbacks),
    loadArchive: context => loadGScaleArchive(session, context),
    printArchive: (context, archive) => {
      const guard = policy ? beforeWrite('archive', selectionKey(context.selection)) : undefined; guard?.();
      return printGScaleArchiveSession(context, archive, guard);
    },
    reprintArchiveReceipt: (context, entry) => {
      const guard = policy ? beforeWrite('reprint', selectionKey(context.selection)) : undefined; guard?.();
      return reprintGScaleArchiveReceipt(session, context, entry, guard);
    },
  }, policy);
  return store;
}
