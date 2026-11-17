import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { WorkerOrderImage } from '../components/WorkerOrderHeader';
import { WorkerAssignedMaterialQr } from '../components/WorkerAssignedMaterialQr';
import { WorkerWipHistory } from '../components/WorkerWipHistory';
import { adminProductionMap } from '../productionMapReadApi';
import { adminText, extensionText, localizedMethod, productionText } from '../shared/localization';
import { MobileApiException } from '../shared/mobileApiException';
import { productionDataRevision } from '../shared/productionDataRevisionRuntime';
import type { Apparatus, WorkerOrderDetail } from '../workerApi';
import type { MaterialRow } from '../workerMaterialPresentation';
import { adminOpeningWipRecords } from '../workerOpeningWipRecordsApi';
import { adminRawMaterialAssignments } from '../workerRawMaterials';
import { adminWipBatches } from '../workerWipApi';
import { qolipProductMolds } from '../qolipCatalogApi';
import { QolipCatalogCodeDetails } from './QolipCatalogCodeDetails';
import { useQolipRole } from './QolipRoleContext';
import { QolipOrderDetailState } from './qolipOrderDetailState';
import { qolipOrderDisplayStages, qolipStageInformationStatus, qolipStageStation, type QolipOrderStageNode, type QolipStageBatch } from './qolipOrderStageFacts';
import type { QolipSequenceMold } from './qolipSequenceMolds';
import type { QolipSequenceOrder } from './useQolipSequenceMolds';
import { useQolipPresentation } from './useQolipPresentation';
import { useQolipText } from './useQolipText';
export type QolipSequenceOrderDetailProps = { orderId: string; onClose(): void; initialOrder?: QolipSequenceOrder; apparatusCatalog?: readonly Apparatus[] };
export type QolipOrderMoldRow = { id: string; title: string; subtitle: string; color: string | null; rework: string; product: QolipSequenceMold };
export type QolipOrderStageRow = { id: string; title: string; kind: string; number: number; done: boolean; last: boolean; operation: string; type: string;
  status: string; statusColor: string; produced: string; input: string; enabled: boolean; node: QolipOrderStageNode };
const has = (value: unknown) => !!value;
/** @v2 _ReadOnlyOrderDetailSheet without worker start/complete/mutation controls. */
export function useQolipSequenceOrderDetail({ orderId, onClose, initialOrder, apparatusCatalog = [] }: QolipSequenceOrderDetailProps) {
  const role = useQolipRole(), { locale } = useQolipText(), sheet = useQolipPresentation();
  const controller = useMemo(() => new QolipOrderDetailState(role.boundary, orderId, {
    order: current => adminProductionMap(role.session, orderId, () => { if (!current()) throw new Error('session_scope_changed'); }, current),
    materials: (order, current) => adminRawMaterialAssignments(role.session, order.map.id, '', current),
    molds: (order, current) => qolipProductMolds(role.session, order.map.product_code.trim(), current),
    stageBatches: (order, current) => adminWipBatches(role.session, { orderId: order.map.id, status: 'all', limit: 1000, current, readWitness: current }) as Promise<QolipStageBatch[]>,
    openingBatches: (order, current) => adminOpeningWipRecords(role.session, { order_id: order.map.id, status: 'all', limit: 500 }, current),
    subscribeRevision: listener => productionDataRevision.subscribe(() => { if (productionDataRevision.isCurrentScope) listener(); }),
  }, initialOrder), [role.boundary, role.session, orderId, initialOrder]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.activate(); void controller.load(); return () => controller.suspend(); }, [controller]);
  const p = (key: string, values?: Record<string, unknown>) => productionText(key, locale, values), a = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values);
  const map = state.order?.map, code = map ? map.code.trim() || map.order_number.trim() || (map.id.trim().startsWith('zakaz-') ? map.id.trim().slice(6).trim() : '') : '';
  const productTitle = map?.title.trim() || map?.nodes.find(node => node.kind === 'end' && node.title.trim())?.title.trim() || p('worker.order.fallback');
  const title = [map?.customer_name.trim(), productTitle].filter(has).join(' • ');
  const overview: WorkerOrderDetail | null = map ? { map, customer: map.customer_name, stages: [] } : null;
  const materialsHasContent = state.materialsLoading || !!state.materialsError || state.materials.length > 0;
  const moldsHasContent = state.moldsLoading || !!state.moldsError || state.molds.length > 0;
  const steps = state.order ? qolipOrderDisplayStages(state.order) : [], firstApparatus = steps.findIndex(node => node.kind === 'apparatus');
  const stageRows: QolipOrderStageRow[] = steps.map((node, index) => {
    const station = qolipStageStation(node), operation = apparatusCatalog.find(item => item.id === station)?.operation ?? '';
    const kind = node.kind === 'start' || node.kind === 'end' ? p(`worker.detail.kind.${node.kind}`) : node.kind === 'apparatus'
      ? operation === 'glue' ? a('apparatus.group.glue') : p(`worker.detail.kind.${operation === 'laminate' ? 'lamination' : operation === 'cut' ? 'cutting' : 'machine'}`) : node.kind;
    const facts = state.stageFacts.get(node.id), status = facts ? qolipStageInformationStatus(facts) : 'unknown';
    return { id: node.id, node, title: node.title.trim() || p('worker.detail.step', { step: index + 1 }), kind, number: index + 1,
      done: firstApparatus > 0 && index < firstApparatus, last: index === steps.length - 1, operation, type: node.kind,
      status: node.kind === 'apparatus' ? a(`factory_map.live.${status}`) : '', statusColor: status === 'unknown' ? '#8B8984' : '#81618B',
      produced: facts && facts.produced > 0 ? a('factory_map.wip.produced', { count: facts.produced }) : '',
      input: facts && facts.waitingInput + facts.inUseInput + facts.processedInput > 0 ? a('factory_map.wip.input', { waiting: facts.waitingInput, inUse: facts.inUseInput, processed: facts.processedInput }) : '',
      enabled: node.kind === 'apparatus' && !!station };
  });
  const moldRows: QolipOrderMoldRow[] = state.molds.map(product => {
    const color = /^#[0-9a-f]{6}$/i.test(product.color.trim()) ? product.color.trim() : null;
    const details = [product.size > 0 ? String(product.size) : '', !color ? product.color.trim() : '', product.is_in_use ? a('production.qolip_in_use') : ''].filter(has);
    return { id: product.qolip_code.trim(), title: p('worker.mold.code', { code: product.qolip_code.trim() }), subtitle: details.join(' • ') || p('worker.mold.color.missing'), color, rework: product.is_in_rework ? extensionText('qolipReworkText', 'open', locale) : '', product };
  });
  const error = (value: unknown, fallback: string) => value instanceof MobileApiException ? value.message : fallback;
  function material(row: MaterialRow) { if (!controller.current() || sheet.isOpen() || !row.barcode?.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sheet.open(<WorkerAssignedMaterialQr session={role.session} row={row} onClose={sheet.close} />, { dismissible: true }); }
  function mold(row: QolipOrderMoldRow) { if (!controller.current() || sheet.isOpen() || !row.id) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sheet.open(<QolipCatalogCodeDetails product={row.product} title={p('worker.mold.qr_title')} loadMileage={false} close={sheet.close} />, { dismissible: true }); }
  function stage(row: QolipOrderStageRow) { if (!controller.current() || !row.enabled || !map || sheet.isOpen()) return;
    sheet.open(<WorkerWipHistory session={role.session} order={{ id: map.id, code, title: productTitle, imageId: map.image_id, apparatusId: qolipStageStation(row.node) }}
      onClose={sheet.close} stageHistory apparatusNames={Object.fromEntries(apparatusCatalog.map(item => [item.id, item.name]))}
      operation={row.operation} allowReactivation={false} allowReprint={false} isCurrent={controller.current} />, { dismissible: true, fitContent: false }); }
  return { ...state, valid: !state.invalid && role.isCurrent(), role, controller, p, a, close: onClose, code, title, overview, imageId: map?.image_id ?? '',
    materialsTitle: p(materialsHasContent ? 'worker.materials.attached' : 'worker.materials.attached.empty'), materialsEnabled: materialsHasContent && !state.materialsLoading && !state.pending,
    materialsCount: state.materialsLoading ? '..' : state.materials.length ? localizedMethod('productionCount', locale, { count: state.materials.length, kind: 'materials' }) : '',
    materialsMessage: state.materialsError ? error(state.materialsError, p('worker.materials.load_failed')) : state.materials.length ? '' : p('worker.materials.attached.empty'),
    moldsTitle: p(moldsHasContent ? 'worker.molds.attached' : 'worker.molds.attached.empty'), moldsEnabled: moldsHasContent && !state.pending,
    moldsCount: state.moldsLoading ? '..' : state.molds.length ? localizedMethod('productionCount', locale, { count: state.molds.length, kind: 'molds' }) : '',
    moldsMessage: state.moldsError ? error(state.moldsError, a('production.qolip_load_failed')) : state.molds.length ? '' : p('worker.molds.attached.empty'),
    moldRows, stageRows, mapProgress: p('worker.map.progress', { completed: Math.max(firstApparatus, 0), total: steps.length }),
    errorMessage: state.error ? error(state.error, p('worker.error.sync')) : '', material, mold, stage,
    image: () => { if (controller.current() && map && !sheet.isOpen()) sheet.open(<WorkerOrderImage session={role.session} orderId={map.id} imageId={map.image_id} onClose={sheet.close} />, { presentation: 'page' }); } };
}
export type QolipSequenceOrderDetailModel = ReturnType<typeof useQolipSequenceOrderDetail>;
