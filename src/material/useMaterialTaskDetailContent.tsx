import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { AdminApparatus } from '../apparatusApi';
import type { Session, SessionWitness } from '../auth';
import { WorkerAssignedMaterialQr } from '../components/WorkerAssignedMaterialQr';
import { WorkerWipHistory } from '../components/WorkerWipHistory';
import { useWorkerOrderText } from '../components/useWorkerOrderText';
import { serializeGScaleModeArgs } from '../gscale/gscaleRouteArgs';
import { useNativeSheet } from '../nativeSheet';
import { adminUnlinkRawMaterialAssignment } from '../rawMaterialUnlinkApi';
import { dartTrim } from '../shared/dartApparatus';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminText, productionText } from '../shared/localization';
import { productionDataRevision } from '../shared/productionDataRevisionRuntime';
import { MobileApiException } from '../shared/mobileApiException';
import { WorkerControlException } from '../workerControlsApi';
import type { SupplyTaskRow } from '../shared/supplyTasks/supplyTaskModels';
import { adminOpeningWipRecords } from '../workerOpeningWipRecordsApi';
import type { AdminRawMaterialAssignment } from '../workerRawMaterials';
import { adminWipBatches } from '../workerWipApi';
import type { WipBatch } from '../workerWip';
import { materialReceiptArgs } from './materialReceiptArgs';
import { readMaterialTaskDetail } from './materialTaskDetailApi';
import { materialDetailAssignments, materialDetailAttachedMolds, materialDetailCanUnlink,
  materialMoldHexColor, type MaterialDetailOrder, type MaterialDetailMold } from './materialTaskDetailSections';
import { materialMapOpeningBatches, materialTaskMapRows, type MaterialTaskMapSnapshot } from './materialTaskMapModel';
import { materialSequenceCode } from './materialSequenceModel';

export type MaterialTaskDetailProps = { session: Session; witness: SessionWitness; row: SupplyTaskRow; isCurrent(): boolean;
  onClose(): void; route?: string; apparatusCatalog?: readonly AdminApparatus[]; sourceSnapshot?: MaterialTaskMapSnapshot | null };
type Result = { attempt: number; order: MaterialDetailOrder | null; error: string | null };
type Section<T> = { value: T; loading: boolean; error: string };
const empty = <T,>(value: T): Section<T> => ({ value, loading: true, error: '' });

/** Non-worker branches of _ReadOnlyOrderDetailSheet; both native views share this owner. */
export function useMaterialTaskDetailContent({ session, witness, row, isCurrent, route, apparatusCatalog = [], sourceSnapshot }: MaterialTaskDetailProps) {
  const { locale, p } = useWorkerOrderText(), sheet = useNativeSheet();
  const [attempt, setAttempt] = useState(0), [result, setResult] = useState<Result | null>(null);
  const [materials, setMaterials] = useState<Section<AdminRawMaterialAssignment[]>>(empty([]));
  const [molds, setMolds] = useState<Section<MaterialDetailMold[]>>(empty([]));
  const [materialsExpanded, setMaterialsExpanded] = useState(false), [moldsExpanded, setMoldsExpanded] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false), [mapFacts, setMapFacts] = useState<Section<WipBatch[]>>(empty([]));
  const [mapRevision, setMapRevision] = useState(0), [unlinking, setUnlinking] = useState(''), [notice, setNotice] = useState('');
  const [noticeId, setNoticeId] = useState(0);
  const [receiptOpening, setReceiptOpening] = useState(false);
  const mounted = useRef(true), openingReceipt = useRef(false), materialGeneration = useRef(0), unlinkingRef = useRef('');
  const current = useCallback(() => mounted.current && isSynchronouslyTrue(isCurrent), [isCurrent]);
  const guard = useCallback(() => { if (!current()) throw new Error('Buyurtma mavjud emas.'); }, [current]);
  const shown = result?.attempt === attempt ? result : null, order = shown?.order ?? null;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    const valid = () => active && current();
    void readMaterialTaskDetail(session, witness, row, valid, route).then(value => {
      if (valid()) setResult({ attempt, order: value, error: null });
    }, error => { if (valid()) setResult({ attempt, order: null, error: error instanceof MobileApiException || error instanceof WorkerControlException
      ? error.message : adminText('production.open_failed', locale) }); });
    return () => { active = false; };
  }, [session, witness, row, current, attempt, route, locale]);

  const reloadMaterials = useCallback(async (full: MaterialDetailOrder, loading = true) => {
    const generation = ++materialGeneration.current;
    if (!current()) return;
    setMaterials(previous => ({ ...previous, loading: loading || previous.loading, error: '' }));
    try {
      const value = await materialDetailAssignments(session, full, guard);
      if (current() && generation === materialGeneration.current) setMaterials({ value, loading: false, error: '' });
    } catch (error) {
      if (current() && generation === materialGeneration.current) setMaterials({ value: [], loading: false,
        error: error instanceof Error && error.message && error.message !== 'TimeoutException' ? error.message : productionText('worker.materials.load_failed', locale) });
    }
  }, [session, guard, current, locale]);

  useEffect(() => {
    if (!order || !current()) return;
    let active = true;
    void Promise.resolve().then(() => { if (active && current()) { void reloadMaterials(order); setMolds(empty([])); } });
    void materialDetailAttachedMolds(session, order, guard).then(value => {
      if (active && current()) setMolds({ value, loading: false, error: '' });
    }, error => { if (active && current()) setMolds({ value: [], loading: false,
      error: error instanceof Error && error.message ? error.message : adminText('production.qolip_load_failed', locale) }); });
    const generation = materialGeneration;
    return () => { active = false; generation.current++; };
  }, [order, session, guard, current, reloadMaterials, locale]);

  useFocusEffect(useCallback(() => {
    if (openingReceipt.current && order && current()) {
      openingReceipt.current = false;
      setReceiptOpening(false);
      void reloadMaterials(order);
    }
  }, [order, current, reloadMaterials]));

  useEffect(() => productionDataRevision.subscribe(() => { if (current() && mapExpanded) setMapRevision(value => value + 1); }), [current, mapExpanded]);
  useEffect(() => {
    if (!order || !mapExpanded || !current()) return;
    let active = true, timer: ReturnType<typeof setTimeout> | undefined;
    const valid = () => active && current();
    void Promise.resolve().then(() => { if (valid()) setMapFacts(previous => ({ ...previous, loading: true, error: '' })); });
    const check = () => { if (!valid()) throw new Error('Buyurtma mavjud emas.'); };
    const work = order.map.id.startsWith('training-') ? Promise.resolve<[WipBatch[], Awaited<ReturnType<typeof adminOpeningWipRecords>>]>([[], []])
      : Promise.all([adminWipBatches(session, { status: 'all', orderId: order.map.id, limit: 1000, current: valid }),
        adminOpeningWipRecords(session, { status: 'all', order_id: order.map.id, limit: 500 }, undefined, { beforeSend: check })]);
    void Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 12000); })]).then(([batches, records]) => {
      if (!valid()) return;
      const merged = new Map<string, WipBatch>();
      for (const batch of batches) merged.set(dartTrim(String(batch.batch_id ?? '')), batch);
      for (const batch of materialMapOpeningBatches(order, records)) if (!merged.has(dartTrim(String(batch.batch_id ?? '')))) merged.set(dartTrim(String(batch.batch_id ?? '')), batch);
      setMapFacts({ value: [...merged.values()], loading: false, error: '' });
    }, () => { if (valid()) setMapFacts(previous => ({ ...previous, loading: false, error: adminText('factory_map.wip.load_error', locale) })); })
      .finally(() => { if (timer !== undefined) clearTimeout(timer); });
    return () => { active = false; if (timer !== undefined) clearTimeout(timer); };
  }, [order, mapExpanded, mapRevision, session, current, locale]);

  const receive = () => {
    if (!order || !current() || openingReceipt.current) return;
    openingReceipt.current = true;
    setReceiptOpening(true);
    router.push({ pathname: `/${Platform.OS === 'ios' ? 'ios' : 'android'}-material/receipt`,
      params: serializeGScaleModeArgs(materialReceiptArgs(order)) } as unknown as Href);
  };
  const unlink = (assignment: AdminRawMaterialAssignment) => {
    if (!current() || unlinkingRef.current || !materialDetailCanUnlink(assignment)) return;
    Alert.alert(p('worker.material.unlink.title'), p('worker.material.unlink.message'), [
      { text: p('worker.action.cancel'), style: 'cancel' },
      { text: p('worker.material.unlink.confirm'), style: 'destructive', onPress: () => {
        if (!order || !current() || unlinkingRef.current) return;
        unlinkingRef.current = dartTrim(assignment.barcode).toUpperCase();
        setUnlinking(dartTrim(assignment.barcode).toUpperCase());
        void adminUnlinkRawMaterialAssignment(session, assignment.order_id, assignment.barcode, guard).then(async () => {
          await reloadMaterials(order, false); if (current()) { setNotice(p('worker.material.unlink.success')); setNoticeId(value => value + 1); }
        }, error => { if (current()) { setNotice(error instanceof Error ? error.message : p('worker.material.unlink.failed')); setNoticeId(value => value + 1); } })
          .finally(() => { unlinkingRef.current = ''; if (current()) setUnlinking(''); });
      } },
    ]);
  };
  const openMaterialQr = (assignment: AdminRawMaterialAssignment) => {
    if (!current() || !dartTrim(assignment.barcode) || sheet.isOpen()) return;
    sheet.open(<WorkerAssignedMaterialQr session={session} row={assignment} isCurrent={current} onClose={sheet.close} />, { dismissible: true });
  };
  const openMoldQr = (product: MaterialDetailMold) => {
    if (!current() || !dartTrim(product.qolip_code) || sheet.isOpen()) return;
    const details: [string, string][] = [];
    if (dartTrim(product.code)) details.push([productionText('qolip.products.product_code', locale), product.code]);
    if (product.size > 0) details.push([productionText('qolip.products.size', locale), String(product.size)]);
    if (product.customer_names.length) details.push([productionText('qolip.products.customer', locale), product.customer_names.join(', ')]);
    sheet.open(<WorkerAssignedMaterialQr session={session} row={{ barcode: product.qolip_code, item_name: product.name || product.qolip_code }}
      title={p('worker.mold.qr_title')} detailRows={details} allowReprint={false} isCurrent={current} onClose={sheet.close} />, { dismissible: true });
  };
  const code = order ? materialSequenceCode(order) : dartTrim(row.code) || dartTrim(row.order_number) || row.id;
  const title = order ? dartTrim(order.map.title) || order.map.nodes.find(node => node.kind === 'end' && dartTrim(node.title) && dartTrim(node.title) !== dartTrim(order.map.title))?.title.trim()
    || p('worker.order.fallback') : row.title;
  const customer = order ? sourceSnapshot?.order_customers?.[dartTrim(order.map.id)] ?? order.map.customer_name : row.customer_name;
  const imageId = order?.map.image_id || row.image_id;
  const names = Object.fromEntries(apparatusCatalog.map(value => [value.id, value.name]));
  const openStage = (apparatus: string, stageTitle: string) => {
    if (!order || !apparatus || !current() || sheet.isOpen()) return;
    sheet.open(<WorkerWipHistory session={session} order={{ id: row.id, code, title, imageId, apparatusId: apparatus }}
      apparatusNames={{ ...names, [apparatus]: names[apparatus] || stageTitle }} stageHistory allowReactivation={false} allowReprint={false}
      isCurrent={current} readPolicy="legacy" onClose={sheet.close} />, { dismissible: true });
  };
  const mapRows = order ? materialTaskMapRows(order, mapFacts.value, sourceSnapshot) : [];
  const moldItems = molds.value.map(product => ({ product, color: materialMoldHexColor(product.color),
    details: [product.size > 0 ? String(product.size) : '', dartTrim(product.color) && !materialMoldHexColor(product.color) ? dartTrim(product.color) : '',
      product.is_in_use ? adminText('production.qolip_in_use', locale) : ''].filter(Boolean).join(' • ') || p('worker.mold.color.missing') }));
  return { current, order, shown, code, title, customer, imageId, materials, molds, moldItems, materialsExpanded, moldsExpanded, mapExpanded, mapFacts,
    toggleMaterials: () => { if (current()) { setMaterialsExpanded(value => !value); if (!materialsExpanded && order) void reloadMaterials(order, false); } },
    toggleMolds: () => { if (current()) setMoldsExpanded(value => !value); }, toggleMap: () => { if (current()) setMapExpanded(value => !value); },
    retryMap: () => { if (current()) setMapRevision(value => value + 1); }, retry: () => { if (current()) setAttempt(value => value + 1); },
    receive, canReceive: !!order && !receiptOpening, unlink, unlinking, notice, noticeId,
    dismissNotice: () => setNotice(''), canUnlink: materialDetailCanUnlink, openMaterialQr, openMoldQr, openStage,
    mapRows, mapProgress: p('worker.map.progress', { completed: mapRows.filter(value => value.completed).length, total: mapRows.length }),
    p, a: (key: string, values?: Record<string, unknown>) => adminText(key, locale, values) };
}
