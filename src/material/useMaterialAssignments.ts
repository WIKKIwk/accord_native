import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { adminApparatus, readApparatus } from '../apparatusApi';
import { isSessionWitnessCurrent, subscribeSessionWitness, sessionWitnessVersion } from '../auth';
import { adminRawMaterialAssignmentOrders } from '../gscale/gscaleAdminApi';
import { preparationAssignMaterial } from '../preparation/preparationInventoryAssignment';
import { adminRawMaterialLookup } from '../rawMaterialLookupApi';
import { adminUnlinkRawMaterialAssignment } from '../rawMaterialUnlinkApi';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { adminRawMaterialAssignmentCandidates, adminRawMaterialAssignmentDiagnostics } from '../shared/rawMaterialAssignmentApi';
import { rawMaterialAssignmentCanUnlink } from '../shared/rawMaterialAssignmentCommands';
import { productionMapResponseError } from '../workerControlsApi';
import { rawMaterialAssignment, type AdminRawMaterialAssignment } from '../workerRawMaterials';
import { useMaterialContext } from './MaterialContext';
import { MaterialAssignmentsController, materialAssignmentKey, type AssignmentOrder } from './materialAssignmentsController';
import { materialAssignmentAssignee, materialAssignmentTimestamp, materialDiagnosticMessage, materialScannedOrderTitle,
  materialScannedOrderLabel, materialScannedStatus, materialStockStatusLabel, materialScannedLockMessage } from './materialAssignmentPresentation';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeSnapshot = () => localeController.locale;
export function useMaterialAssignments(initialBarcode = '') {
  const { session, witness } = useMaterialContext();
  const params = useLocalSearchParams<{ barcode?: string; orderId?: string }>();
  const barcode = initialBarcode || (typeof params.barcode === 'string' ? params.barcode : '');
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  const locale = useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot);
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  const groupScopeReady = !!session.assigned_item_groups?.length;
  const controller = useMemo(() => {
    const current = () => isSessionWitnessCurrent(witness) && session.profile.role === 'material_taminotchi' &&
      session.token !== 'test-mode-token' && !!session.assigned_item_groups?.length && canOpenRoute(session, appRoutes.adminRawMaterialAssignments);
    const guard = () => { if (!current()) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching'); };
    return new MaterialAssignmentsController({ current, assignedApparatus: session.assigned_apparatus,
      text: key => adminText(key, localeController.locale),
      orders: () => adminRawMaterialAssignmentOrders(session, guard),
      assignments: async () => {
        guard(); const { response, body } = await readApparatus(session, '/v1/mobile/admin/raw-material-assignments', false, undefined, guard); guard();
        const payload: unknown = JSON.parse(body);
        if (response.status !== 200) throw productionMapResponseError(response.status, payload, 'raw_material_assignments');
        if (!Array.isArray(payload)) throw new TypeError('Invalid material assignments');
        return payload.map(rawMaterialAssignment);
      },
      apparatus: () => adminApparatus(session, { limit: 10000, beforeSend: guard }),
      candidates: (order, apparatus) => adminRawMaterialAssignmentCandidates(session, order, apparatus, guard),
      lookup: code => adminRawMaterialLookup(session, code, guard),
      diagnostic: (code, order, apparatus) => adminRawMaterialAssignmentDiagnostics(session, code, order, apparatus, guard),
      assign: (order, code, apparatus) => preparationAssignMaterial(session, order, code, apparatus, guard),
      unlink: row => adminUnlinkRawMaterialAssignment(session, row.order_id, row.barcode, guard),
    }, barcode, orderId);
  }, [session, witness, barcode, orderId]);
  useEffect(() => { if (!groupScopeReady) return; controller.mount(barcode); return () => controller.unmount(); }, [controller, groupScopeReady, barcode]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => controller.dismissNotice(), 5000);
    return () => clearTimeout(timer);
  }, [controller, state.notice, state.noticeRevision]);
  const t = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values);
  const orderLabel = (order: AssignmentOrder) => `${order.map.code.trim() || order.map.order_number.trim() || order.map.id.trim()} · ${order.map.title.trim() || t('raw_material.order_fallback')}`;
  const selectedOrder = state.orders.find(row => row.map.id.trim() === state.selectedOrderId.trim());
  const canUnlink = (row: AdminRawMaterialAssignment, source: 'manual' | 'scan' = 'manual') => rawMaterialAssignmentCanUnlink(row,
    source === 'scan' && state.lookup ? { kind: 'scan', detailStatus: state.lookup.status } : { kind: 'manual' });
  const statusLabel = (row: AdminRawMaterialAssignment) => materialStockStatusLabel(row.stock_status, t);
  const scanned = state.lookup?.assignment;
  const apparatusNames = new Map(state.catalog.filter(item => item.id.trim() && item.name.trim()).map(item => [item.id.trim(), item.name.trim()]));
  return { controller, state, t, groupScopeReady, selectedOrder, orderLabel, selectedOrderLabel: selectedOrder ? orderLabel(selectedOrder) : state.selectedOrderId.trim(),
    visibleAssignments: state.assignments.filter(row => row.order_id.trim() === state.selectedOrderId.trim() &&
      (!state.selectedApparatus.trim() || row.apparatus.trim() === state.selectedApparatus.trim())),
    canSave: !state.saving && !state.scanLoading && !!state.selectedOrderId.trim() && state.lookup !== null &&
      !state.scanError.trim() && !state.lookup.assignment && state.diagnostic?.compatible !== false,
    canUnlink, assignmentKey: materialAssignmentKey, statusLabel,
    diagnosticMessage: state.diagnostic ? materialDiagnosticMessage(state.diagnostic, t) : '',
    scannedOrderTitle: materialScannedOrderTitle(state.lookup, state.lookup?.assignment),
    scannedOrderLabel: materialScannedOrderLabel(state.lookup, scanned),
    scannedStatusLabel: state.lookup && scanned ? materialStockStatusLabel(materialScannedStatus(state.lookup, scanned), t) : '',
    scannedLockMessage: state.lookup && scanned ? materialScannedLockMessage(state.lookup, scanned, t) : '',
    unlinkConfirmationMessage: (row: AdminRawMaterialAssignment) => {
      const title = state.lookup?.assignment && materialAssignmentKey(state.lookup.assignment) === materialAssignmentKey(row)
        ? materialScannedOrderTitle(state.lookup, row) : '';
      return title ? t('raw_material.unlink_message_order', { order: title }) : t('raw_material.unlink_message');
    },
    assignmentAssignee: materialAssignmentAssignee, formatAssignmentTimestamp: materialAssignmentTimestamp,
    formatQty: (qty: number, uom: string) => `${Number.isInteger(qty) ? qty : qty.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}${uom.trim() ? ` ${uom.trim()}` : ''}`,
    apparatusLabel: (id: string) => apparatusNames.get(id.trim()) ?? id.trim(),
  };
}
