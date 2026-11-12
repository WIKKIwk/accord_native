import { Host, TextInput as NativeInput, useNativeState } from '@expo/ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { useCallback, useContext, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { Alert, AppState, DynamicColorIOS, Platform, PlatformColor, ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeSessionToken, type Session } from './auth';
import { adminBosmaAstatkaReport } from './workerControlsApi';
import { MobileApiException } from './shared/mobileApiException';
import { extensionText } from './shared/localization';
import { adminPrintPreflight } from './workerPrintPreflight';
import { adminMaterialStartDeliveryCandidates, adminReceiveMaterialForStart, materialDeliveryIdempotencyKey } from './workerMaterialDelivery';
import { adminRawMaterialAssignments, adminRawMaterialIntakeCandidates, adminReceiveRawMaterialForActiveOrder } from './workerRawMaterials';
import { adminOrderScanBootstrap } from './workerScanBootstrap';
import { sessionReadScope } from './sessionReadScope';
import { adminApparatusQueueActionResult } from './workerQueueAction';
import { completeWorkerScanSections } from './workerScanSections';
import { legacyWorkerScanControl } from './workerLegacyScan';
import { adminProgressQrLookup } from './workerProgressApi';
import { adminLookupOpeningWip } from './workerOpeningWip';
import { WorkerDetailRecovery } from './workerDetailRecovery';
import { readWorkerDetailSnapshot, workerDetailInitialBootstrap, workerDetailSectionRetryable } from './workerDetailRecoveryRead';
import { useNativeSheet } from './nativeSheet';
import { WorkerOrderImage } from './components/WorkerOrderHeader';
import { WorkerInitialOrderSwitch } from './components/WorkerInitialOrderSwitch';
import { WorkerOrderIdentity } from './components/WorkerOrderIdentity';
import { WorkerScannedWipHistory } from './components/WorkerScannedWipHistory';
import { WorkerLaminationReport } from './components/WorkerLaminationReport';
import { WorkerRezkaAstatkaReport } from './components/WorkerRezkaAstatkaReport';
import { WorkerRezkaOutputReport } from './components/WorkerRezkaOutputReport';
import { usesIntegratedLaminationReport } from './workerLaminationWorkflow';
import { canReadScannedWips, scannedWipStage } from './workerScannedWips';
import { workerQrPayload, WorkerInitialQr } from './workerQr';
import { WorkerOrderOverview } from './components/WorkerOrderOverview';
import { WorkerPaintPalette } from './components/WorkerPaintPalette';
import { WorkerOutputProgress } from './components/WorkerOutputProgress';
import { WorkerOrderButton as PlatformButton, WorkerOrderActionGroup, WorkerOrderBlockingNotice } from './components/WorkerOrderControls';
import { WorkerMaterialList } from './components/WorkerMaterialList';
import { WorkerAssignedMaterialQr } from './components/WorkerAssignedMaterialQr';
import { MaterialLinkRequestPanel, WorkerMaterialUsePanel } from './components/WorkerMaterialPanels';
import { WorkerOrderAlertButton } from './components/WorkerOrderAlertButton';
import { useWorkerOrderText } from './components/useWorkerOrderText';
import { WORKER_ORDER_LAYOUT as GRID } from './components/workerOrderLayout';
import { workerMoldPresentation, workerMoldBlockingText, workerMoldCountText } from './workerMoldPresentation';
import { workerCompletionMode } from './workerCompletion';
import { legacyLaminationReportMetrics } from './workerLegacyLaminationReport';
import { adminLaminatsiyaAstatkaReport } from './workerLaminationReportApi';
import { adminWipBatches } from './workerWipApi';
import { workerHandoffBatch } from './workerHandoff';
import { materialSectionExpansion, type MaterialRow } from './workerMaterialPresentation';
import { pickWorkerPrinter, printWorkerJobs, workerPrinterFields, WorkerPrintCancelled } from './workerPrinting';
import { useWorkerPrinterSelector } from './components/useWorkerPrinterSelector';
import { useWorkerColors } from './components/useWorkerColors';
import { WorkerSheetCloseContext } from './components/workerSheetContext';
import { WorkerFormDialog } from './components/WorkerFormDialog';
import { WorkerDeliveryDialog } from './components/WorkerDeliveryDialog';
import { WorkerIconButton } from './components/WorkerIconButton';
import { WorkerPreflightButton } from './components/WorkerPreflightButton';
import { WorkerFormField as PlatformField } from './components/WorkerFormField';
import { WorkerExpansion as Expansion } from './components/WorkerExpansion';
import { loadReturnedPaintDraft, saveReturnedPaintDraft } from './returnedPaintDraft';
import { ReturnedPaintNamedFieldDialog } from './boyoqchi/BoyoqchiFormContent';
import { WorkerReturnedPaintField as ReturnedPaintField } from './components/WorkerReturnedPaintField';
import { BoyoqchiImage } from './boyoqchi/BoyoqchiImage';
import { deleteReturnedPaintImage, uploadReturnedPaintImage } from './boyoqchi/returnedPaintApi';
import type { ReturnedPaintImage } from './boyoqchi/returnedPaintModel';
import { prepareWorkerReturnedPaintPhoto, selectWorkerReturnedPaintPhoto } from './workerReturnedPaintPhoto';
import { workerPaintValue, workerPaintValueKey, workerReturnedPaintReport } from './workerReturnedPaint';
import { automaticQolipConfirmation, matchesMaterialAssignment, materialStartReadiness, paintOptions, preflightFreezeRequest, runningFreezeRequest, validWorkerOrderControl, workerControlCoversReceipt, workerControlIsUnversioned, type QueueCursor } from './workerOrderLogic';
import { workerOrderDetailFromSnapshot, type Apparatus, type QueueOrder } from './workerApi';
import { workerOrderBlockingText } from './workerOrderBlocking';
import { workerOrderCardState, workerStartMaterialStatus } from './workerOrderCardState';
import { workerOrderReclose } from './workerOrderReclose';
import { runWorkerMenuAction, workerLongPressMenu } from './workerLongPress';
import { workerFabQrReads } from './workerFabQrReads';
import { workerMergeStateLines } from './workerOrderMerge';
import { useWorkerOrderMerge } from './components/useWorkerOrderMerge';
import { WorkerOrderMergeDialog } from './components/WorkerOrderMergeDialog';
import { workerOrderPresentationDenied } from './workerOrderPresentation';
import { useWorkerOrderPresentation } from './components/useWorkerOrderPresentation';
import { WorkerOrderSyncProgress } from './components/WorkerOrderSyncProgress';
import { WorkerOrderPauseStatus } from './components/WorkerOrderPauseStatus';
import { workerOrderRezkaInstructions } from './workerOrderRezkaInstructions';

type Obj = Record<string, any>;
type Props = { session: Session; apparatusId: string; apparatus?: Apparatus; apparatusCatalog?: Apparatus[]; orderId: string; preview?: QueueOrder; queueCursor: QueueCursor | null; queueWindow?: string; onWritePending?: (pending: boolean) => void; busyOrderTitle?: string; initialAction?: 'complete' | 'astatka' | 'resume' | 'detach_roll'; initialScanQr?: string; initialSwitchQr?: string; onSwitchCommitted?: () => void; onNotice?: (message: string) => void; onClose: () => void; onChanged: () => void };
function NativeButton(props: ComponentProps<typeof PlatformButton>) {
  const { t } = useWorkerOrderText(); return <PlatformButton {...props} label={t(props.label)} />;
}
function Field(props: ComponentProps<typeof PlatformField>) {
  const { t } = useWorkerOrderText(); return <PlatformField {...props} multiline={Platform.OS === 'ios' && props.keyboardType !== 'decimal-pad'} label={t(props.label)} />;
}
type ScanKind = 'material' | 'qolip' | 'input';
const numberValue = (v: string) => Number(v.trim().replace(',', '.'));
function barcodeFromQr(raw: string) {
  const value = raw.trim();
  try {
    const url = new URL(value);
    if (!url.host) return value;
    for (const key of ['barcode', 'epc', 'qr']) {
      const candidate = url.searchParams.get(key)?.trim();
      if (candidate) return candidate;
    }
    const part = url.pathname.split('/').pop()?.trim();
    return part ? decodeURIComponent(part).trim() || value : value;
  } catch { return value; }
}

async function scanBootstrap(session: Session, input: Parameters<typeof adminOrderScanBootstrap>[1],
  unsupported: { current: boolean }): Promise<Obj> {
  const scope = sessionReadScope(session);
  const aggregate = unsupported.current ? null : await adminOrderScanBootstrap(session, input);
  if (!aggregate) unsupported.current = true;
  const result = aggregate ?? await legacyWorkerScanControl(session, input.apparatus, input.orderId);
  if (scope !== sessionReadScope(session)) throw new Error('Sessiya o‘zgardi. Qayta urining.');
  return input.includeSections === false ? result : completeWorkerScanSections(session, result, input.materialBarcodes ?? []);
}

export function OrderScreen({ session, apparatusId, apparatus, apparatusCatalog, orderId, preview, queueCursor, queueWindow = '', onWritePending, busyOrderTitle = '', initialAction, initialScanQr = '', initialSwitchQr = '', onSwitchCommitted, onNotice, onClose, onChanged }: Props) {
  const { t, p, locale } = useWorkerOrderText();
  const colors = useWorkerColors();
  const sheetBackground = Platform.OS === 'ios' ? PlatformColor('systemGroupedBackground') : colors.field;
  const sheetCard = Platform.OS === 'ios' ? PlatformColor('secondarySystemGroupedBackground') : colors.surface;
  const errorTextStyle = [styles.error, { color: colors.error }];
  const successTextStyle = [styles.success, Platform.OS === 'ios' && iosStyles.success];
  const cardSectionStyle = [styles.sectionGroup, Platform.OS === 'ios' && iosStyles.sectionGroup];
  const cardSeparatorStyle = Platform.OS === 'ios' ? iosStyles.separatedSection : undefined;
  const closeSheet = useContext(WorkerSheetCloseContext) ?? onClose;
  const [detail, setDetail] = useState<Obj | null>(null);
  const [detailReadScope, setDetailReadScope] = useState('');
  const [detailWindow, setDetailWindow] = useState(queueWindow);
  const [presentationDenied, setPresentationDenied] = useState(false);
  const [bootstrap, setBootstrap] = useState<Obj | null>(null);
  const [pendingControlReceipt, setPendingControlReceipt] = useState<QueueCursor | null>(null);
  const latestControlReceipt = useRef<QueueCursor | null>(null);
  const updateControlReceipt = useCallback((receipt: QueueCursor | null) => {
    latestControlReceipt.current = receipt; setPendingControlReceipt(receipt);
  }, []);
  const validOrderControl = useCallback((data: Obj | null, apparatus: string, order: string, cursor: QueueCursor | null) =>
    validWorkerOrderControl(data, apparatus, order, cursor) && workerControlCoversReceipt(data, pendingControlReceipt), [pendingControlReceipt]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusyState] = useState(false);
  const writePendingCallback = useRef(onWritePending);
  useLayoutEffect(() => { writePendingCallback.current = onWritePending; }, [onWritePending]);
  const writePendingState = useRef(false);
  const notifyWritePending = useCallback((pending: boolean) => {
    if (writePendingState.current === pending) return;
    writePendingState.current = pending; writePendingCallback.current?.(pending);
  }, []);
  const setBusy = useCallback((pending: boolean) => { notifyWritePending(pending); setBusyState(pending); }, [notifyWritePending]);
  const [controlRetired, setControlRetired] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [materials, setMaterials] = useState<string[]>([]);
  const [qolips, setQolips] = useState<string[]>([]);
  const [qolipsReset, setQolipsReset] = useState(false);
  const [inputBatch, setInputBatch] = useState<{ id: string; qr: string; stage: string } | null>(null);
  const [scanner, setScanner] = useState<ScanKind | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [scannedWipsStage, setScannedWipsStage] = useState('');
  const [paintImageId, setPaintImageId] = useState('');
  const [paintImageMetadata, setPaintImageMetadata] = useState<ReturnedPaintImage | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [permission, askPermission] = useCameraPermissions();
  const [selected, setSelected] = useState('');
  const [switchProgress, setSwitchProgress] = useState<'complete' | 'astatka' | null>(null);
  const [kg, setKg] = useState('');
  const [meter, setMeter] = useState('');
  const [bobina, setBobina] = useState('');
  const [waste, setWaste] = useState('');
  const [leftoverWip, setLeftoverWip] = useState(''), [leftoverFilm, setLeftoverFilm] = useState('');
  const [freezeNote, setFreezeNote] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [descriptionRevealed, setDescriptionRevealed] = useState(false);
  const operationReportAttempted = useRef(false);
  function selectProgressAction(action: string) { setCompletionNote(''); setDescriptionRevealed(false); setSelected(action); }
  const [astatkaNote, setAstatkaNote] = useState('');
  const [paintColor, setPaintColor] = useState('');
  const [paintEditor, setPaintEditor] = useState(false);
  const paintSheet = useNativeSheet();
  const [paintUsage, setPaintUsage] = useState<'rasxot' | 'astatka'>('rasxot');
  const [paintDynamic, setPaintDynamic] = useState<Record<string, string[]>>({});
  const [paintFieldDialog, setPaintFieldDialog] = useState<{ target: string; usage: 'rasxot' | 'astatka' } | null>(null);
  const paintPhotoPending = useRef(false);
  const [loadedDraftScope, setLoadedDraftScope] = useState('');
  const [paint, setPaint] = useState<Record<string, string>>({});
  const [selectedQolipSet, setSelectedQolipSet] = useState('');
  const [materialsExpanded, setMaterialsExpanded] = useState(false);
  const [qolipsExpanded, setQolipsExpanded] = useState(false);
  const [manualScanVisible, setManualScanVisible] = useState(false);
  const [manualScan, setManualScan] = useState('');
  const manualScanValue = useNativeState('');
  const [attachedMaterials, setAttachedMaterials] = useState<Obj[] | null>(null);
  const [attachedMaterialsError, setAttachedMaterialsError] = useState('');
  const [intakeCandidatesState, setIntakeCandidates] = useState<Obj[]>([]);
  const [attachedReadKey, setAttachedReadKey] = useState('');
  const [intakeReadKey, setIntakeReadKey] = useState('');
  const [intakeError, setIntakeError] = useState('');
  const [intakeExpanded, setIntakeExpanded] = useState(false);
  const materialQrSheet = useNativeSheet();
  const [intakeMode, setIntakeMode] = useState(false);
  const [delivery, setDelivery] = useState<{ material: Obj; deliverers: Obj[]; purpose: 'start' | 'intake' } | null>(null);
  const [deliveryChoice, setDeliveryChoice] = useState('');
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [sectionReadVersion, setSectionReadVersion] = useState(0);
  const isTrainingOrder = orderId.startsWith('training-');
  const operation = apparatus?.operation.trim().toLowerCase() ?? '';
  const laminationReport = operation === 'laminate' || operation === 'glue';
  const directMaterialUse = !!apparatus && apparatus.worker_material_assignment_allowed === true && !isTrainingOrder;
  const loadVersion = useRef(0);
  const actionInFlight = useRef(false);
  const scanInFlight = useRef(false);
  const scanBootstrapUnsupported = useRef(false);
  const recentQuickScan = useRef<{ value: string; at: number } | null>(null);
  const screenMounted = useRef(true);
  const [printerDialogHidden, setPrinterDialogHidden] = useState(false);
  const reportDismissed = useRef<(() => void) | null>(null);
  const closeAfterProgress = useRef(false);
  const printingScope = sessionReadScope(session), printingIdentity = JSON.stringify([printingScope, apparatusId, orderId]);
  const latestPrintingIdentity = useRef(printingIdentity);
  useLayoutEffect(() => { latestPrintingIdentity.current = printingIdentity; }, [printingIdentity]);
  const isCurrent = useCallback(() => screenMounted.current && !!activeSessionToken(session) && printingScope === sessionReadScope(session) && latestPrintingIdentity.current === printingIdentity,
    [session, printingScope, printingIdentity]);
  const printerSelector = useWorkerPrinterSelector(isCurrent);
  const initialActionHandled = useRef(false);
  const initialQr = useRef(new WorkerInitialQr(initialScanQr));
  const validateInitialQr = useRef<(qr: string) => void>(() => {});
  const workerRole = String(session.profile?.role ?? '').trim();
  const workerRef = String(session.profile?.ref ?? '').trim();
  const draftScope = JSON.stringify([session.baseUrl, workerRole, workerRef, workerRole && workerRef ? '' : session.imageCacheScope, orderId, apparatusId]) + (selected === 'astatka' ? ':astatka' : '');
  const queueEpoch = queueCursor?.epoch;
  const queueRevision = queueCursor?.rev;
  const latestCursor = useRef(queueCursor);
  const detailHydrated = useRef(false);
  const detailRecovery = useRef<WorkerDetailRecovery | null>(null);
  const sectionRecoveryNeeded = useRef({ bootstrap: false, assignments: false, intake: false });
  const latestDetailWindow = useRef(queueWindow);
  const liveDetailAuthority = useRef(!!bootstrap && !controlRetired);
  const detailIdentity = useRef(printingIdentity);
  const authorityContext = JSON.stringify([printingIdentity, queueWindow, queueEpoch, queueRevision]);
  const previousAuthorityContext = useRef(authorityContext);
  useLayoutEffect(() => {
    if (previousAuthorityContext.current !== authorityContext) {
      previousAuthorityContext.current = authorityContext; liveDetailAuthority.current = false;
    }
  }, [authorityContext]);
  useEffect(() => { scanBootstrapUnsupported.current = false; }, [session, apparatusId, orderId]);
  useLayoutEffect(() => { latestCursor.current = queueCursor; }, [queueCursor]);
  useLayoutEffect(() => { latestDetailWindow.current = queueWindow; }, [queueWindow]);
  useEffect(() => {
    const mounted = screenMounted;
    mounted.current = true;
    return () => { mounted.current = false; reportDismissed.current?.(); reportDismissed.current = null; };
  }, []);
  useEffect(() => {
    let current = true;
    loadReturnedPaintDraft(draftScope).then(draft => {
      if (!current) return;
      setPhotoBusy(false); setPaintFieldDialog(null);
      if (draft) { setPaint(draft.values); setPaintDynamic(draft.fields); setPaintUsage(draft.usage); setPaintImageId(draft.imageId); setPaintImageMetadata(draft.image ?? null); }
      else { setPaint({}); setPaintDynamic({}); setPaintUsage('rasxot'); setPaintImageId(''); setPaintImageMetadata(null); }
      setLoadedDraftScope(draftScope);
    }).catch(() => { if (current) { setError('Bo‘yoq hisobotini qurilmadan o‘qib bo‘lmadi.'); setLoadedDraftScope(draftScope); } });
    return () => { current = false; };
  }, [draftScope]);
  useEffect(() => {
    if (loadedDraftScope !== draftScope) return;
    void saveReturnedPaintDraft(draftScope, { values: paint, fields: paintDynamic, usage: paintUsage, imageId: paintImageId, ...(paintImageMetadata ? { image: paintImageMetadata } : {}) })
      .catch(() => { if (screenMounted.current) setError('Bo‘yoq hisobotini qurilmada saqlab bo‘lmadi.'); });
  }, [draftScope, loadedDraftScope, paint, paintDynamic, paintUsage, paintImageId, paintImageMetadata]);

  const load = useCallback(async (ownerCurrent: () => boolean) => {
    const version = ++loadVersion.current;
    const scope = sessionReadScope(session);
    const window = latestDetailWindow.current;
    const current = () => ownerCurrent() && version === loadVersion.current && isCurrent() && scope === sessionReadScope(session) && window === latestDetailWindow.current;
    setLoading(true);
    sectionRecoveryNeeded.current = { bootstrap: false, assignments: false, intake: false };
    setSectionReadVersion(value => value + 1);
    // The first frame is the row preview. Full map hydration precedes section loading,
    // and a section read never makes opening the sheet depend on a second request.
    const snapshot = await readWorkerDetailSnapshot(session, apparatusId, orderId, () => latestCursor.current, current);
    if (!current()) return;
    detailHydrated.current = true;
    setDetail(snapshot); setDetailReadScope(scope); setDetailWindow(window); setPresentationDenied(false);
    const initial = workerDetailInitialBootstrap(snapshot, apparatusId, orderId);
    let remainingReceipt = latestControlReceipt.current;
    if (initial && validWorkerOrderControl(initial, apparatusId, orderId, latestCursor.current) && workerControlCoversReceipt(initial, remainingReceipt)) {
      liveDetailAuthority.current = true; setBootstrap(initial); setControlRetired(false); setLoading(false);
      remainingReceipt = null; updateControlReceipt(null);
    }
    const scan = await scanBootstrap(session, { apparatus: apparatusId, orderId, materialBarcodes: materials, automaticQolipConfirmation: true }, scanBootstrapUnsupported);
    if (!current()) return;
    const unversioned = workerControlIsUnversioned(scan);
    if ((!unversioned && (snapshot.epoch !== scan.control_state?.epoch || scan.control_state?.rev < snapshot.rev)) ||
        !validWorkerOrderControl(scan, apparatusId, orderId, latestCursor.current) || !workerControlCoversReceipt(scan, remainingReceipt)) {
      throw new MobileApiException({ code: 'order_scan_bootstrap_stale', message: 'Order state changed while scan requirements loaded' });
    }
    liveDetailAuthority.current = true; setBootstrap(scan); setControlRetired(false); setLoading(false);
    updateControlReceipt(null);
    sectionRecoveryNeeded.current.bootstrap = scan.sections?.materials?.status === 'error' && workerDetailSectionRetryable(scan.sections.materials.readError);
  }, [session, apparatusId, orderId, materials, isCurrent, updateControlReceipt]);
  const recoveryOptions = useRef({ load, current: isCurrent });
  useLayoutEffect(() => { recoveryOptions.current = { load, current: isCurrent }; }, [load, isCurrent]);
  if (detailRecovery.current === null) detailRecovery.current = new WorkerDetailRecovery({
    load: current => recoveryOptions.current.load(current), current: () => recoveryOptions.current.current(),
    hydrated: () => detailHydrated.current,
    sectionsNeedRecovery: () => Object.values(sectionRecoveryNeeded.current).some(Boolean),
    invalidate: () => { loadVersion.current++; liveDetailAuthority.current = false; setControlRetired(true); setLoading(true); },
    failed: (failure, initial) => {
      liveDetailAuthority.current = false; setControlRetired(true); setLoading(false);
      if (workerOrderPresentationDenied(failure)) { setPresentationDenied(true); setBootstrap(null); }
      if (initial) setError(failure instanceof Error ? failure.message : 'Buyurtmani yuklab bo‘lmadi');
    }, denied: workerOrderPresentationDenied,
  });
  useEffect(() => {
    const recovery = detailRecovery.current!;
    if (detailIdentity.current !== printingIdentity) {
      detailIdentity.current = printingIdentity; detailHydrated.current = false;
      setDetail(null); setDetailReadScope(''); setBootstrap(null); updateControlReceipt(null); setPresentationDenied(false); setError('');
      recovery.reset();
    }
    recovery.invalidate(busy);
  }, [load, refresh, busy, queueEpoch, queueRevision, queueWindow, printingIdentity, updateControlReceipt]);
  useEffect(() => {
    const recovery = detailRecovery.current!;
    recovery.activate();
    recovery.setForeground(AppState.currentState == null || AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => recovery.setForeground(state === 'active'));
    return () => { subscription.remove(); recovery.dispose(); };
  }, []);

  const authorityCurrent = () => liveDetailAuthority.current && isCurrent();
  const synchronized = !loading && !busy && !controlRetired && detailReadScope === printingScope && detailWindow === queueWindow && !!activeSessionToken(session) &&
    session.capabilities.includes('apparatus.queue.manage') && session.assigned_apparatus.includes(apparatusId) &&
    validOrderControl(bootstrap, apparatusId, orderId, queueCursor);
  useEffect(() => {
    const timer = setTimeout(() => initialQr.current.run(synchronized, qr => validateInitialQr.current(qr)), 0);
    return () => clearTimeout(timer);
  }, [synchronized]);
  const control: Obj = bootstrap?.control_state?.control ?? {};
  const interaction: Obj = control.interaction ?? {};
  const controlEpoch = bootstrap?.control_state?.epoch, controlRevision = bootstrap?.control_state?.rev;
  const materialReadKey = JSON.stringify([sessionReadScope(session), apparatusId, orderId, controlEpoch, controlRevision, refresh]) + (sectionReadVersion ? `:${sectionReadVersion}` : '');
  const intakeCandidates = intakeReadKey === materialReadKey ? intakeCandidatesState : [];
  const intakeLoading = intakeReadKey !== materialReadKey;
  const isActiveOrder = bootstrap?.control_state?.order_control === 'active' && !['frozen', 'freeze_requested'].includes(control.stage_control_state);
  const safeStopRequest = synchronized ? runningFreezeRequest(bootstrap?.control_state, apparatusId) : null;
  const allowed: string[] = synchronized && (isActiveOrder || !!safeStopRequest) && Array.isArray(control.allowed_actions) ? control.allowed_actions : [];
  const finishReclose = workerOrderReclose(session, bootstrap, apparatusId, orderId, synchronized);
  const order = detailReadScope === printingScope ? detail?.maps?.[0]?.map ?? {} : {};
  const merge = useWorkerOrderMerge({ identity: printingIdentity, available: synchronized && allowed.includes('merge') && !delivery && !deliveryBusy,
    current: () => isCurrent() && session.capabilities.includes('apparatus.queue.manage') && session.assigned_apparatus.includes(apparatusId),
    target: { apparatus: apparatusId, order: orderId, orderLabel: String(order.title || preview?.title || orderId),
      apparatusLabel: apparatus?.name ?? apparatusId, label: id => apparatusCatalog?.find(row => row.id === id)?.name ?? id }, p,
    reads: () => {
      const reads = workerFabQrReads(session, apparatusId, () => detail, isCurrent);
      return { ...reads, context: async (targetOrder, qr) => {
        const result = await reads.context(targetOrder, qr);
        if (targetOrder === orderId && isCurrent() && validOrderControl(result.bootstrap, apparatusId, orderId, latestCursor.current)) {
          setBootstrap(previous => previous && previous.control_state?.epoch === result.bootstrap.control_state.epoch &&
            previous.control_state.rev > result.bootstrap.control_state.rev ? previous : result.bootstrap);
        }
        return result;
      } };
    },
    notice: message => { setSuccess(message); onNotice?.(message); },
    write: async (qr, proof, current) => {
      const writeCurrent = () => current() && isCurrent() && validOrderControl(proof.context.bootstrap, apparatusId, orderId, latestCursor.current);
      if (!writeCurrent() || actionInFlight.current || scanInFlight.current) throw new Error(p('worker.error.sync'));
      actionInFlight.current = true; loadVersion.current++;
      setControlRetired(true); setBusy(true); setError(''); setSuccess('');
      try {
        const result = await adminApparatusQueueActionResult(session, { apparatus: apparatusId, order_id: orderId, action: 'merge', qr_payload: qr, include_control: true }, writeCurrent);
        if (isCurrent() && result.has_states === true) presentation.clear();
        return result.has_states === true;
      }
      finally {
        actionInFlight.current = false; notifyWritePending(false);
        if (isCurrent()) { onChanged(); setRefresh(value => value + 1); setBusy(false); }
      }
    },
  });
  const scannedStage = scannedWipStage(control, order, apparatusId);
  const canOpenScannedWips = !busy && canReadScannedWips(session, apparatusId, operation, scannedStage, loading || !detail);
  const sections: Obj = bootstrap?.sections ?? {};
  const scanningRequired = interaction.start_materials_mode === 'scan_required';
  const qolipRequired = interaction.qolip_mode === 'scan_required';
  const automaticQolip = interaction.qolip_automatic_confirmation === true;
  const materialRequirements: Obj = sections.materials?.data ?? {};
  const requiredQolips: Obj[] = Array.isArray(sections.qolips?.data?.qolip?.required_qolips)
    ? sections.qolips.data.qolip.required_qolips : [];
  const qolipValidation: Obj | undefined = sections.qolips?.status === 'ready' ? sections.qolips.data?.qolip : undefined;
  const automaticConfirmation = automaticQolip ? automaticQolipConfirmation(qolipValidation, interaction, selectedQolipSet) : null;
  const automaticSets: Obj[] = Array.isArray(qolipValidation?.sets) ? qolipValidation.sets : [];
  const preflight = control.print_preflight;
  const validPreflight = preflight && preflight.order_id === orderId && preflight.apparatus === apparatusId &&
    typeof preflight.hold_id === 'string' && !!preflight.hold_id && Number.isInteger(preflight.revision) && preflight.revision >= 0;
  const preflightInProgress = validPreflight && ['held', 'running'].includes(preflight.status);
  const showPreflightHold = synchronized && isActiveOrder && operation === 'print' && control.print_preflight_allowed === true && !preflight;
  const showPreflightOutcome = synchronized && isActiveOrder && operation === 'print' && control.state === 'print_preflight' && preflightInProgress;
  const showPreflightFreeze = synchronized && operation === 'print' && !!preflightFreezeRequest(bootstrap?.control_state, apparatusId, orderId);
  const normalizeCode = (value: unknown) => String(value ?? '').trim().toUpperCase();
  const moldSets = new Map<string, Set<string>>();
  const extensions = new Set<string>();
  for (const mold of requiredQolips) {
    const code = normalizeCode(mold.qolip_code);
    if (!code) continue;
    if (mold.is_extension === true) { extensions.add(code); continue; }
    const setId = String(mold.qolip_set_id ?? '').trim() || 'legacy';
    if (!moldSets.has(setId)) moldSets.set(setId, new Set());
    moldSets.get(setId)!.add(code);
  }
  if (!moldSets.size && extensions.size) moldSets.set('extensions', new Set());
  for (const set of moldSets.values()) for (const code of extensions) set.add(code);
  const reused = qolipValidation?.reused_qolip_codes;
  const requiredCodes = new Set(requiredQolips.map(mold => normalizeCode(mold.qolip_code)));
  const reusedCodes = Array.isArray(reused) && reused.every(code => typeof code === 'string' && code.trim()) ? reused : [];
  const reusedSet = new Set(reusedCodes.map(normalizeCode));
  const canReuse = allowed.includes('resume') && !qolipsReset && reusedCodes.length > 0 && reusedSet.size === reusedCodes.length &&
    reusedSet.size === requiredCodes.size && [...requiredCodes].every(code => reusedSet.has(code));
  const effectiveQolips = qolips.length ? qolips : canReuse ? reusedCodes : [];
  const scannedMolds = new Set(effectiveQolips.map(normalizeCode));
  const moldsSatisfied = [...moldSets.values()].some(set => set.size > 0 && set.size === scannedMolds.size && [...set].every(code => scannedMolds.has(code)));
  const materialState = materialStartReadiness(interaction, sections.materials, order.width_mm);
  const moldsReady = !qolipRequired || (sections.qolips?.status === 'ready' && (automaticQolip ? !!automaticConfirmation : moldsSatisfied));
  const inputReady = !!inputBatch && inputBatch.stage === String(control.stage_node_id ?? '');
  const previousRequired = interaction.previous_wip_mode === 'scan_required' || interaction.opening_wip_mode === 'scan_required';
  const startReady = materialState.ready && moldsReady && (!previousRequired || inputReady);
  const resumeReady = materialState.ready && moldsReady && (interaction.resume_input_required === false || inputReady);
  const preparationVisible = synchronized && (allowed.includes('start') || allowed.includes('resume'));
  const pendingMaterials = scanningRequired && !materialState.unavailable && materialRequirements.scan_satisfied !== true;
  const startAssignments: Obj[] = Array.isArray(materialRequirements.assignments) ? materialRequirements.assignments.filter((row: Obj) => matchesMaterialAssignment(row, orderId, apparatusId)) : [];
  const pendingDelivery = allowed.includes('start') && scanningRequired && startAssignments.some(row =>
    (['compatible', 'ready', 'awaiting_delivery'].includes(row.execution_status) || (!row.execution_status && row.stock_status === 'available' && Number(row.stock_qty) > 0)) &&
    !materials.some(value => normalizeCode(value) === normalizeCode(row.barcode)));
  const pendingIntake = synchronized && interaction.material_intake_allowed === true && intakeMode && intakeCandidates.length > 0;
  const pendingMolds = qolipRequired && !automaticQolip && requiredQolips.length > 0 && !moldsSatisfied;
  const pendingInput = (previousRequired || interaction.resume_input_required === true) && !inputReady;
  const scannerReady = !qolipRequired || (automaticQolip ? !!automaticConfirmation : sections.qolips?.status === 'ready' && requiredQolips.length > 0);
  const showQuickScanner = synchronized && !selected && !delivery && !deliveryBusy && !showPreflightHold &&
    !['confirmation', 'saving', 'guidance'].includes(merge.state.phase) &&
    ((preparationVisible && scannerReady && (pendingMaterials || pendingDelivery || pendingMolds || pendingInput)) || pendingIntake || merge.scanning);
  useEffect(() => {
    if (showQuickScanner && permission?.status === 'undetermined') void askPermission();
  }, [showQuickScanner, permission?.status, askPermission]);
  const canOpenInitialComplete = allowed.includes('complete') || !!finishReclose;
  const canOpenInitialAstatka = isActiveOrder && (control.stage_work?.astatka_available === true || ['in_progress', 'paused', 'completed'].includes(control.state));
  const canResume = allowed.includes('resume'), canDetachRoll = laminationReport && allowed.includes('detach_roll');
  const resumeNeedsInput = interaction.resume_input_required === true || interaction.material_scan_required === true || interaction.qolip_mode === 'scan_required';
  const resumeOnOpen = useEffectEvent(() => { void submit('resume'); });
  const completeOnOpen = useEffectEvent(() => { void beginCompletion(); });
  useEffect(() => {
    if (!initialAction || initialActionHandled.current || !synchronized) return;
    if (initialAction === 'resume' && canResume && !resumeNeedsInput && !resumeReady) return;
    const timer = setTimeout(() => {
      initialActionHandled.current = true;
      if (initialAction === 'resume' && canResume) {
        if (resumeNeedsInput) setSuccess(p('worker.lamination_astatka.resume_scan'));
        else resumeOnOpen();
      } else if (initialAction === 'complete' && canOpenInitialComplete) completeOnOpen();
      else if ((initialAction === 'astatka' && canOpenInitialAstatka) || (initialAction === 'detach_roll' && canDetachRoll)) selectProgressAction(initialAction);
      else setError('Buyurtma holati o‘zgardi. Qayta urining.');
    }, 0);
    return () => clearTimeout(timer);
  }, [initialAction, synchronized, canOpenInitialComplete, canOpenInitialAstatka, canResume, canDetachRoll, resumeNeedsInput, resumeReady, p]);

  async function beginCompletion() {
    if (!synchronized || !authorityCurrent() || actionInFlight.current) return;
    if (!finishReclose) { if (allowed.includes('complete')) { setError(''); selectProgressAction('complete'); } return; }
    const previous = workerLongPressMenu(bootstrap!, session, apparatusId, orderId, latestCursor.current, operation);
    if (!previous.actions.includes('reclose')) return;
    actionInFlight.current = true; loadVersion.current++;
    setBusy(true); setControlRetired(true); setError('');
    try {
      await runWorkerMenuAction(session, apparatusId, orderId, 'reclose', previous, () => latestCursor.current);
      if (!isCurrent()) return;
      onNotice?.(p('worker.reclose.success')); closeSheet();
    } catch { if (isCurrent()) { onNotice?.(p('worker.reclose.failed')); setError(p('worker.reclose.failed')); } }
    finally { actionInFlight.current = false; notifyWritePending(false); if (isCurrent()) { setBusy(false); setRefresh(value => value + 1); onChanged(); } }
  }
  useEffect(() => {
    if (!controlEpoch || scanningRequired) return;
    let current = true;
    const scope = sessionReadScope(session);
    adminRawMaterialAssignments(session, orderId, apparatusId).then(data => {
      if (!current || !activeSessionToken(session) || scope !== sessionReadScope(session)) return;
      if (!Array.isArray(data)) throw new Error('Homashyolar yuklanmadi.');
      setAttachedMaterials(data.filter((row: Obj) => matchesMaterialAssignment(row, orderId, apparatusId)));
      setAttachedMaterialsError(''); setAttachedReadKey(materialReadKey);
      sectionRecoveryNeeded.current.assignments = false;
    }).catch(error => { if (current && activeSessionToken(session) && scope === sessionReadScope(session)) {
      setAttachedMaterialsError('Homashyolar yuklanmadi.'); setAttachedReadKey(materialReadKey);
      sectionRecoveryNeeded.current.assignments = workerDetailSectionRetryable(error);
      if (sectionRecoveryNeeded.current.assignments) detailRecovery.current?.recover();
    } });
    return () => { current = false; };
  }, [session, apparatusId, orderId, scanningRequired, controlEpoch, controlRevision, materialReadKey]);
  useEffect(() => {
    if (!controlEpoch || scanningRequired || operation === 'cut' || interaction.material_intake_allowed !== true) return;
    let current = true;
    const scope = sessionReadScope(session);
    adminRawMaterialIntakeCandidates(session, orderId, apparatusId).then(data => {
      if (!current || !activeSessionToken(session) || scope !== sessionReadScope(session)) return;
      if (!Array.isArray(data)) throw new TypeError('Invalid materials');
      setIntakeCandidates(data.filter((row: Obj) => matchesMaterialAssignment(row, orderId, apparatusId))); setIntakeError(''); setIntakeReadKey(materialReadKey);
      sectionRecoveryNeeded.current.intake = false;
    }).catch(error => { if (current && activeSessionToken(session) && scope === sessionReadScope(session)) {
      setIntakeCandidates([]); setIntakeError('Homashyolar yuklanmadi.'); setIntakeReadKey(materialReadKey);
      sectionRecoveryNeeded.current.intake = workerDetailSectionRetryable(error);
      if (sectionRecoveryNeeded.current.intake) detailRecovery.current?.recover();
    } });
    return () => { current = false; };
  }, [session, apparatusId, orderId, scanningRequired, operation, interaction.material_intake_allowed, controlEpoch, controlRevision, materialReadKey]);

  const paintPhotoGeneration = useRef(0);
  useLayoutEffect(() => {
    paintPhotoGeneration.current++;
    paintPhotoPending.current = false;
  }, [draftScope, paintEditor]);
  const paintPhotoError = (failure: unknown, fallback: string) => failure instanceof Error && failure.name === 'MobileApiException' ? failure.message : fallback;
  async function pickPaintPhoto(source: 'camera' | 'gallery') {
    if (photoBusy || paintPhotoPending.current || !isCurrent()) return;
    paintPhotoPending.current = true;
    const generation = paintPhotoGeneration.current;
    const current = () => isCurrent() && generation === paintPhotoGeneration.current;
    try {
      const photo = await selectWorkerReturnedPaintPhoto(source, current);
      if (!photo || !current()) return;
      setPhotoBusy(true); setError('');
      const prepared = await prepareWorkerReturnedPaintPhoto(photo, current);
      if (!prepared || !current()) return;
      const image = await uploadReturnedPaintImage(session, { orderId, apparatus: apparatusId, ...prepared });
      if (!current()) return;
      setPaintImageId(image.image_id); setPaintImageMetadata(image);
      if (paintImageId && paintImageId !== image.image_id) {
        try { await deleteReturnedPaintImage(session, paintImageId, orderId); } catch { /* The new image is already committed to this draft. */ }
      }
    } catch (failure) { if (current()) setError(paintPhotoError(failure, 'Rasm yuklanmadi')); }
    finally { if (current()) { paintPhotoPending.current = false; setPhotoBusy(false); } }
  }
  async function removePaintPhoto() {
    if (!paintImageId || photoBusy || paintPhotoPending.current || !isCurrent()) return;
    const generation = paintPhotoGeneration.current;
    const current = () => isCurrent() && generation === paintPhotoGeneration.current;
    paintPhotoPending.current = true; setPhotoBusy(true); setError('');
    try {
      await deleteReturnedPaintImage(session, paintImageId, orderId);
      if (current()) { setPaintImageId(''); setPaintImageMetadata(null); }
    } catch (failure) { if (current()) setError(paintPhotoError(failure, 'Rasm olib tashlanmadi')); }
    finally { if (current()) { paintPhotoPending.current = false; setPhotoBusy(false); } }
  }
  async function onScan(value: string, kind: ScanKind | null = scanner) {
    if (kind === 'input') {
      const qr = workerQrPayload(value);
      setScanner(null);
      if (!qr || !synchronized || !authorityCurrent() || scanInFlight.current) return;
      scanInFlight.current = true;
      const version = loadVersion.current;
      const scanScope = sessionReadScope(session);
      setLoading(true); setError(''); setInputBatch(null);
      try {
        if (interaction.opening_wip_mode === 'scan_required') {
          try {
            const batch = await adminLookupOpeningWip(session, { apparatus: apparatusId, orderId, qrPayload: qr });
            if (scanScope !== sessionReadScope(session) || version !== loadVersion.current || !validOrderControl(bootstrap, apparatusId, orderId, latestCursor.current) ||
                !batch || batch.order_id !== orderId || typeof batch.batch_id !== 'string' || !batch.batch_id.trim() ||
                String(batch.qr_payload ?? '').trim().toUpperCase() !== qr.toUpperCase() || batch.wip_status !== 'waiting') throw new Error('Rulon ushbu buyurtma uchun tasdiqlanmadi.');
            setInputBatch({ id: batch.batch_id.trim(), qr, stage: String(control.stage_node_id ?? '') });
            setSuccess('Kiruvchi rulon tasdiqlandi.');
            return;
          } catch (e) {
            if (interaction.previous_wip_mode !== 'scan_required' && interaction.resume_input_required !== true) throw e;
          }
        }
        const scan = await scanBootstrap(session, { apparatus: apparatusId, orderId, qrPayload: qr,
          materialBarcodes: materials, automaticQolipConfirmation: true }, scanBootstrapUnsupported);
        let proof = scan.validated_progress;
        if (!proof) {
          const validated = await adminProgressQrLookup(session, qr, { apparatus: apparatusId, orderId, requireActiveOrder: true });
          proof = { ok: true, active_order_validated: true, validated_apparatus: apparatusId, validated_order_id: orderId,
            batch: validated, input_route: validated.input_route, input_route_error: validated.input_route_error };
        }
        const batch = proof?.batch;
        const route = proof?.input_route;
        if (scanScope !== sessionReadScope(session) || version !== loadVersion.current || !validOrderControl(scan, apparatusId, orderId, queueCursor) || proof?.ok !== true || proof.active_order_validated !== true ||
            proof.validated_apparatus !== apparatusId || proof.validated_order_id !== orderId ||
            !batch || batch.order_id !== orderId || typeof batch.batch_id !== 'string' || !batch.batch_id.trim() ||
            String(batch.qr_payload ?? '').trim().toUpperCase() !== qr.toUpperCase() || batch.wip_status !== 'waiting' ||
            !route?.source_stage_node_id || !route.stage_node_id || !route.map_fingerprint ||
            !Array.isArray(route.consumer_apparatus_ids) || !route.consumer_apparatus_ids.includes(apparatusId) || proof.input_route_error) {
          throw new Error('Rulon ushbu buyurtma uchun tasdiqlanmadi.');
        }
        setBootstrap(scan);
        setInputBatch({ id: batch.batch_id.trim(), qr, stage: String(scan.control_state.control.stage_node_id ?? '') });
        setSuccess('Kiruvchi rulon tasdiqlandi.');
      } catch (e) { if (version === loadVersion.current) setError(e instanceof Error ? e.message : 'Rulonni tekshirib bo‘lmadi.'); }
      finally { scanInFlight.current = false; if (version === loadVersion.current) setLoading(false); }
      return;
    }
    const clean = barcodeFromQr(value);
    if (!clean || !kind) return;
    setScanner(null);
    const key = normalizeCode(clean);
    if (kind === 'material') {
      const assigned = Array.isArray(materialRequirements.assigned_barcodes) ? materialRequirements.assigned_barcodes : [];
      if (!assigned.some((code: unknown) => normalizeCode(code) === key)) { setError('Bu material buyurtmaga biriktirilmagan.'); return; }
      setMaterials(old => old.some(code => normalizeCode(code) === key) ? old : [...old, clean]);
    } else {
      const match = requiredQolips.find(mold => normalizeCode(mold.qolip_code) === key);
      if (!match) { setError('Bu qolip buyurtma uchun talab qilinmagan.'); return; }
      if (scannedMolds.has(key)) { setError(''); return; }
      const matchesSet = [...moldSets.values()].some(set => set.has(key) && [...scannedMolds].every(code => set.has(code)));
      if (!matchesSet) { setError('Turli qolip to‘plamlarini aralashtirib bo‘lmaydi.'); return; }
      setQolips(old => old.some(code => normalizeCode(code) === key) ? old : [...old, String(match.qolip_code).trim()]);
    }
    setError('');
  }
  useLayoutEffect(() => { validateInitialQr.current = qr => { void onScan(qr, 'input'); }; });
  async function finishMaterialReceipt(material: Obj, purpose: 'start' | 'intake', version: number) {
    const barcode = String(material.barcode ?? '').trim();
    const current = await scanBootstrap(session, { apparatus: apparatusId, orderId, materialBarcodes: materials,
      automaticQolipConfirmation: true }, scanBootstrapUnsupported);
    if (!screenMounted.current || version !== loadVersion.current || !validOrderControl(current, apparatusId, orderId, latestCursor.current)) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
    if (purpose === 'start') {
      const requirements = current.sections?.materials?.data;
      const staged = Array.isArray(requirements?.staged_barcodes) ? requirements.staged_barcodes : [];
      const eligible = Array.isArray(requirements?.start_assignments) ? requirements.start_assignments : [];
      if (current.sections?.materials?.status !== 'ready' ||
          !staged.some((value: unknown) => normalizeCode(value) === normalizeCode(barcode)) ||
          !eligible.some((row: Obj) => normalizeCode(row.barcode) === normalizeCode(barcode))) throw new Error('Homashyo apparat oldiga qabul qilingani tasdiqlanmadi.');
      setBootstrap(current);
      setMaterials(old => old.some(value => normalizeCode(value) === normalizeCode(barcode)) ? old : [...old, barcode]);
      setSuccess('Homashyo tasdiqlandi.');
    } else {
      if (current.control_state.control.interaction.material_intake_allowed !== true) throw new Error('Hozir homashyo ulash mumkin emas.');
      const received = await adminReceiveRawMaterialForActiveOrder(session, orderId, apparatusId, barcode);
      if (!screenMounted.current) return;
      if (!matchesMaterialAssignment(received, orderId, apparatusId) || normalizeCode(received.barcode) !== normalizeCode(barcode)) throw new Error('Homashyo qabuli tasdiqlanmadi.');
      const remainingBeforeRefresh = intakeCandidates.filter(row => normalizeCode(row.barcode) !== normalizeCode(barcode));
      setIntakeCandidates(remainingBeforeRefresh);
      if (!remainingBeforeRefresh.length) setIntakeMode(false);
      setSuccess('Homashyo qabul qilindi.');
      onChanged();
      setRefresh(value => value + 1);
      const [assignments, candidates] = await Promise.allSettled([
        adminRawMaterialAssignments(session, orderId, apparatusId),
        adminRawMaterialIntakeCandidates(session, orderId, apparatusId),
      ]);
      if (!screenMounted.current) return;
      if (assignments.status === 'fulfilled' && Array.isArray(assignments.value)) setAttachedMaterials(assignments.value.filter((row: Obj) => matchesMaterialAssignment(row, orderId, apparatusId)));
      if (candidates.status === 'fulfilled' && Array.isArray(candidates.value)) {
        const remaining = candidates.value.filter((row: Obj) => matchesMaterialAssignment(row, orderId, apparatusId));
        setIntakeCandidates(remaining);
        if (!remaining.length) setIntakeMode(false);
      }
      if (assignments.status === 'rejected' || candidates.status === 'rejected') setError('Homashyo qabul qilindi, lekin ro‘yxatni yangilab bo‘lmadi.');
    }
  }
  async function receiveScannedMaterial(material: Obj, purpose: 'start' | 'intake') {
    if (scanInFlight.current || !synchronized || !authorityCurrent()) return;
    scanInFlight.current = true;
    const version = loadVersion.current;
    setDeliveryBusy(true); setError('');
    try {
      if (purpose === 'intake' && material.execution_status !== 'awaiting_delivery') {
        await finishMaterialReceipt(material, purpose, version);
      } else {
        const result = await adminMaterialStartDeliveryCandidates(session, orderId, apparatusId, String(material.barcode ?? ''));
        if (!screenMounted.current || version !== loadVersion.current || !validOrderControl(bootstrap, apparatusId, orderId, latestCursor.current)) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
        if (result.already_at_apparatus === true) await finishMaterialReceipt(material, purpose, version);
        else {
          const deliverers = result.deliverers;
          if (!deliverers.length) throw new Error('Bu homashyoni ko‘chirishga ruxsati bor xodim topilmadi. Iltimos, adminga xabar bering.');
          setDeliveryChoice('');
          setDelivery({ material, deliverers, purpose });
        }
      }
    } catch (e) { if (screenMounted.current) setError(e instanceof Error ? e.message : 'Homashyoni qabul qilib bo‘lmadi.'); }
    finally { scanInFlight.current = false; if (screenMounted.current) setDeliveryBusy(false); }
  }
  async function confirmMaterialDelivery() {
    if (!delivery || !deliveryChoice || scanInFlight.current || !synchronized || !authorityCurrent()) return;
    const person = delivery.deliverers.find(value => `${value.role}:${value.ref}` === deliveryChoice);
    if (!person) return;
    scanInFlight.current = true;
    const version = loadVersion.current;
    setDeliveryBusy(true); setError('');
    try {
      const barcode = String(delivery.material.barcode ?? '').trim();
      await adminReceiveMaterialForStart(session, { order_id: orderId, apparatus: apparatusId, barcode,
        delivered_by: { role: person.role, ref: person.ref, name: person.name },
        idempotency_key: materialDeliveryIdempotencyKey(orderId, apparatusId, barcode) });
      if (screenMounted.current) setDelivery(null);
      await finishMaterialReceipt(delivery.material, delivery.purpose, version);
    } catch (e) { if (screenMounted.current) setError(e instanceof Error ? e.message : 'Homashyoni qabul qilib bo‘lmadi.'); }
    finally { scanInFlight.current = false; if (screenMounted.current) setDeliveryBusy(false); }
  }
  async function quickScan(raw: string) {
    const value = raw.trim();
    if (!value || !showQuickScanner || !authorityCurrent() || scanInFlight.current) return;
    if (merge.scanning) { await merge.flow.scan(value, barcodeFromQr(value)); return; }
    const now = Date.now();
    if (recentQuickScan.current?.value === value && now - recentQuickScan.current.at < 1500) return;
    recentQuickScan.current = { value, at: now };
    const code = normalizeCode(barcodeFromQr(value));
    const intakeMaterial = pendingIntake ? intakeCandidates.find(item => normalizeCode(item.barcode) === code) : null;
    if (intakeMaterial) { await receiveScannedMaterial(intakeMaterial, 'intake'); return; }
    const startMaterial = scanningRequired ? startAssignments.find(item => normalizeCode(item.barcode) === code) : null;
    const staged = Array.isArray(materialRequirements.staged_barcodes) ? materialRequirements.staged_barcodes : [];
    if (startMaterial && !staged.some((value: unknown) => normalizeCode(value) === code)) {
      await receiveScannedMaterial(startMaterial, 'start'); return;
    }
    const assigned = Array.isArray(materialRequirements.assigned_barcodes) ? materialRequirements.assigned_barcodes : [];
    const kind: ScanKind | null = pendingMaterials && assigned.some((item: unknown) => normalizeCode(item) === code) ? 'material'
      : pendingMolds && requiredQolips.some(item => normalizeCode(item.qolip_code) === code) ? 'qolip'
      : pendingInput ? 'input' : null;
    if (!kind) { setError('Bu QR buyurtma uchun talab qilinmagan.'); return; }
    await onScan(value, kind);
  }
  async function submit(action: string) {
    const isAstatka = action === 'astatka';
    const removingHandoffRoll = laminationReport && action === 'detach_roll';
    if (!synchronized || !authorityCurrent() || merge.pending || (isAstatka ? !canOpenInitialAstatka : !allowed.includes(action)) || actionInFlight.current ||
        (isAstatka && !laminationReport && loadedDraftScope !== draftScope)) return;
    const isStarting = action === 'start' || action === 'resume';
    if (isStarting && !materialState.ready) { setError(materialState.reason); return; }
    if (isStarting && automaticQolip && qolipRequired && !automaticConfirmation) { setError('Boshlash uchun tayyor qolip to‘plamini tanlang.'); return; }
    const inputRequired = isStarting && ((action === 'start' && (interaction.previous_wip_mode === 'scan_required' || interaction.opening_wip_mode === 'scan_required')) || (action === 'resume' && interaction.resume_input_required === true));
    if (inputRequired && (!inputBatch || inputBatch.stage !== String(control.stage_node_id ?? ''))) { setError('Kiruvchi rulonni skanerlang.'); return; }
    const materialScan = action === 'start' ? scanningRequired : action === 'resume' && interaction.material_scan_required === true;
    if (materialScan) {
      const assigned = Array.isArray(materialRequirements.assigned_barcodes) ? materialRequirements.assigned_barcodes : [];
      if (sections.materials?.status !== 'ready' || materialRequirements.assignments_satisfied !== true || (materialRequirements.requires_material === true && !assigned.length) || (assigned.length > 0 && materialRequirements.scan_satisfied !== true)) { setError('Boshlash uchun serverdagi material talablarini bajaring va kerakli materiallarni skanerlang.'); return; }
    }
    if (isStarting && qolipRequired && !automaticQolip && (sections.qolips?.status !== 'ready' || !moldsSatisfied)) { setError('Boshlash uchun bitta to‘liq qolip to‘plamini skanerlang.'); return; }
    if (action === 'start' && preflight && (!validPreflight || preflight.status !== 'passed')) { setError('Avval rang chiqarish natijasini tasdiqlang.'); return; }
    const closingOutputId = action === 'complete' && typeof control.closing_output_batch_id === 'string' ? control.closing_output_batch_id.trim() : '';
    const completion = workerCompletionMode({ action, orderId, closingOutputId, safeStopRequest,
      description: action === 'pause' ? freezeNote : completionNote, kg, meter, bobina, waste, additionalOutput: laminationReport ? [leftoverWip, leftoverFilm] : [] });
    const { safeStopIssue, completionIssue, needsOutput } = completion;
    if (completion.needsIssueOrOutput) { setDescriptionRevealed(true); setError(p('worker.freeze.safe_stop.output_or_issue_required')); return; }
    const fullReport = !completionIssue && !safeStopIssue && (isAstatka || (action === 'complete' && (switchProgress === 'complete' || control.complete_requires_full_report !== false || !!closingOutputId)));
    const fields = [kg, meter, bobina];
    if (needsOutput && fields.some(x => !x.trim() || !Number.isFinite(numberValue(x)) || numberValue(x) <= 0)) { setDescriptionRevealed(true); setError('Metr, vazn va bobina uchun noldan katta qiymatlarni kiriting.'); return; }
    const returnedPaintReport = workerReturnedPaintReport(paint, paintDynamic, paintImageId);
    const returnedPaintItems = returnedPaintReport.items;
    if (fullReport && operation === 'print' && returnedPaintReport.error) {
      setDescriptionRevealed(true); setError(p(returnedPaintReport.error.key, returnedPaintReport.error.values)); return;
    }
    let laminationMetrics: ReturnType<typeof legacyLaminationReportMetrics> | null = null;
    if (fullReport && laminationReport) {
      try { laminationMetrics = legacyLaminationReportMetrics(isAstatka, { wip: leftoverWip, film: leftoverFilm, waste }); }
      catch (reason) { setDescriptionRevealed(true); setError(p(reason instanceof Error ? reason.message : 'worker.daily.invalid_number')); return; }
    }
    if (fullReport && !laminationReport) {
      const amount = numberValue(waste);
      const wasteError = !waste.trim()
        ? closingOutputId || isAstatka ? p('worker.daily.required_field', { label: p('worker.daily.field.total_waste') }) : p('worker.progress.qty.completion_reason')
        : !Number.isFinite(amount) || amount < 0 ? p('worker.progress.qty.invalid_number')
        : !closingOutputId && !isAstatka && amount === 0 ? p('worker.progress.qty.completion_reason') : '';
      if (wasteError) { setDescriptionRevealed(true); setError(wasteError); return; }
    }
    actionInFlight.current = true;
    loadVersion.current++;
    setControlRetired(true); setBusy(true); setError(''); setSuccess('');
    try {
      const printer = needsOutput && !removingHandoffRoll ? await selectOutputPrinter() : null;
      if (!isCurrent()) return;
      if (!validOrderControl(bootstrap, apparatusId, orderId, latestCursor.current)) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
      if (removingHandoffRoll) {
        const current = await scanBootstrap(session, { apparatus: apparatusId, orderId, includeSections: false, automaticQolipConfirmation: true }, scanBootstrapUnsupported);
        if (!isCurrent() || !validOrderControl(current, apparatusId, orderId, latestCursor.current) || current.control_state?.control?.state !== 'paused' ||
            current.control_state.control.stage_node_id !== control.stage_node_id || !current.control_state.control.allowed_actions?.includes('detach_roll')) throw new Error(p('worker.error.sync'));
        const batches = await adminWipBatches(session, { status: 'all', apparatus: apparatusId, orderId, limit: 250 });
        if (!isCurrent() || !workerHandoffBatch(batches, apparatusId, orderId)) throw new Error(p('worker.error.machine_roll'));
      }
      const body: Obj = { apparatus: apparatusId, order_id: orderId, action: completionIssue ? 'freeze' : action, include_control: true };
      if (completionIssue) Object.assign(body, { freeze_with_issue: true, issue_note: completion.note });
      else if (completion.note && !safeStopIssue) body.completion_request_note = completion.note;
      if (materials.length && materialScan) body.material_barcodes = materials;
      if (effectiveQolips.length && isStarting && !automaticQolip) body.qolip_codes = effectiveQolips;
      if (isStarting && automaticConfirmation) body.qolip_confirmation = automaticConfirmation;
      if (inputRequired && inputBatch) Object.assign(body, { qr_payload: inputBatch.qr, progress_batch_id: inputBatch.id });
      if (action === 'start' && validPreflight && preflight.status === 'passed') body.print_preflight_hold_id = preflight.hold_id;
      if (needsOutput) Object.assign(body, { finished_goods_kg: numberValue(kg), finished_goods_meter: numberValue(meter), bobina_kg: numberValue(bobina), uom: 'm', ...(printer ? workerPrinterFields(printer) : {}) });
      if (removingHandoffRoll) body.remove_roll_from_apparatus = true;
      if (closingOutputId) Object.assign(body, { complete_without_output: true, progress_batch_id: closingOutputId });
      if (safeStopRequest && action === 'pause') body.freeze_request_id = safeStopRequest;
      if (safeStopIssue) body.completion_request_note = completion.note;
      if (fullReport && laminationMetrics) Object.assign(body, laminationMetrics, { full_completion_report_required: true });
      else if (fullReport) {
        const returnInk = closingOutputId ? returnedPaintReport.rawReturnInkKg : returnedPaintReport.returnInkKg;
        Object.assign(body, { total_waste: numberValue(waste), full_completion_report_required: true, returned_paint_items: returnedPaintItems });
        if (paintImageId) body.returned_paint_image_id = paintImageId;
        if (returnInk !== null) body.return_ink_kg = returnInk;
      }
      if (preview?.customer || order.customer_name) body.customer_name = preview?.customer || order.customer_name;
      const result = isAstatka
        ? { report: laminationReport && laminationMetrics
          ? await adminLaminatsiyaAstatkaReport(session, { apparatus: apparatusId, order_id: orderId,
            lamination_print_leftover_rolls: laminationMetrics.lamination_print_leftover_rolls ?? null,
            lamination_film_leftover_rolls: laminationMetrics.lamination_film_leftover_rolls ?? null, total_waste: laminationMetrics.total_waste, description: astatkaNote }, isCurrent)
          : await adminBosmaAstatkaReport(session, { apparatus: apparatusId, order_id: orderId, total_waste: numberValue(waste), returned_paint_items: returnedPaintItems, returned_paint_image_id: paintImageId, description: astatkaNote }) }
        : await adminApparatusQueueActionResult(session, body, isCurrent);
      if (!isCurrent()) return;
      if (!isAstatka) {
        if (result.has_states !== true) return;
        if (result.has_snapshot_cursor === true) updateControlReceipt({ epoch: result.epoch, rev: result.rev });
        presentation.clear();
      }
      if (result.completion_request) { setSwitchProgress(null); setSelected(''); setSuccess(p('worker.notice.completion_request_sent')); return; }
      let printFailed = false;
      if (printer) {
        try { await printWorkerJobs(result, printer, isCurrent); }
        catch { printFailed = true; }
      }
      if (!isCurrent()) return;
      selectProgressAction(''); setMaterials([]); setQolips([]); setQolipsReset(false); setInputBatch(null); setFreezeNote(''); setCompletionNote(''); setKg(''); setMeter(''); setBobina('');
      if (action === 'complete' || isAstatka) {
        setLeftoverWip(''); setLeftoverFilm('');
        void saveReturnedPaintDraft(draftScope, { values: {}, fields: {}, usage: 'rasxot', imageId: '' }).catch(() => {});
        setWaste(''); setAstatkaNote(''); setPaintImageId(''); setPaintImageMetadata(null); setPaint({}); setPaintColor(''); setPaintDynamic({}); setPaintUsage('rasxot'); setPaintEditor(false);
      }
      const qr = result.progress_batch?.qr_payload;
      if (printFailed) setError('Amal bajarildi, lekin rulon yorlig‘i chop etilmadi.');
      else setSuccess(isAstatka ? 'Order astatkasi qayd qilindi.' : qr ? `Amal bajarildi. Rulon QR: ${qr}` : 'Amal bajarildi.');
      setSelectedQolipSet('');
      const switchCompleted = !!initialSwitchQr && switchProgress === action && !printFailed;
      setSwitchProgress(null);
      if (switchCompleted) onSwitchCommitted?.();
      if ((initialAction === action || switchCompleted) && !printFailed) {
        if (Platform.OS === 'ios' && selected) closeAfterProgress.current = true; else closeSheet();
      }
    } catch (e) { setSwitchProgress(null); if (isCurrent() && !(e instanceof WorkerPrintCancelled)) setError(e instanceof Error ? e.message : 'Amal bajarilmadi'); }
    finally { actionInFlight.current = false; notifyWritePending(false); onChanged(); if (screenMounted.current) { setRefresh(value => value + 1); setBusy(false); } }
  }
  async function selectOutputPrinter() {
    // UIKit must finish dismissing the report Modal before the native picker
    // can be presented. Use its dismissal event, never a timing delay.
    if (Platform.OS === 'ios') await new Promise<void>(resolve => { reportDismissed.current = resolve; setPrinterDialogHidden(true); });
    else setPrinterDialogHidden(true);
    try { return await pickWorkerPrinter({ current: isCurrent, selectDevice: printerSelector.selectDevice }); }
    finally { if (isCurrent()) setPrinterDialogHidden(false); }
  }
  async function runPreflight(action: 'hold' | 'passed' | 'failed') {
    if (!synchronized || !authorityCurrent() || actionInFlight.current || (action === 'hold' ? !showPreflightHold : !showPreflightOutcome)) return;
    const holdId = action === 'hold' ? `print-preflight:${orderId}:${apparatusId}:${Date.now()}-${Math.random().toString(36).slice(2)}` : preflight.hold_id;
    actionInFlight.current = true;
    loadVersion.current++;
    setControlRetired(true); setBusy(true); setError(''); setSuccess('');
    try {
      await adminPrintPreflight(session, { apparatus: apparatusId, order_id: orderId, action, hold_id: holdId,
        ...(action === 'hold' ? { idempotency_key: holdId } : { expected_revision: preflight.revision }) });
      if (!isCurrent()) return;
      setSuccess(action === 'hold' ? 'Rang chiqarish boshlandi.' : action === 'passed' ? 'Rang chiqdi.' : 'Rang chiqmagani qayd etildi.');
    } catch (e) { if (isCurrent()) setError(e instanceof Error ? e.message : 'Amal bajarilmadi'); }
    finally { actionInFlight.current = false; notifyWritePending(false); if (isCurrent()) { presentation.clear(); onChanged(); setRefresh(value => value + 1); setBusy(false); } }
  }
  async function freezePreflight() {
    if (!showPreflightFreeze || !authorityCurrent() || actionInFlight.current) return;
    const initialRequest = preflightFreezeRequest(bootstrap?.control_state, apparatusId, orderId);
    actionInFlight.current = true;
    loadVersion.current++;
    setControlRetired(true); setBusy(true); setError(''); setSuccess('');
    try {
      const current = await scanBootstrap(session, { apparatus: apparatusId, orderId, includeSections: false,
        automaticQolipConfirmation: true }, scanBootstrapUnsupported);
      if (!isCurrent()) return;
      const requestId = preflightFreezeRequest(current.control_state, apparatusId, orderId);
      if (!validOrderControl(current, apparatusId, orderId, latestCursor.current) || !requestId || requestId !== initialRequest) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
      const result = await adminApparatusQueueActionResult(session, { apparatus: apparatusId, order_id: orderId, action: 'freeze', freeze_request_id: requestId, include_control: true }, isCurrent);
      if (!isCurrent() || result.has_states !== true) return;
      presentation.clear();
      setSuccess('Buyurtma to‘xtatildi.');
    } catch (e) { if (isCurrent()) setError(e instanceof Error ? e.message : 'Amal bajarilmadi'); }
    finally { actionInFlight.current = false; notifyWritePending(false); if (isCurrent()) { onChanged(); setRefresh(value => value + 1); setBusy(false); } }
  }
  const code = String(preview?.code || order.order_number || order.code || orderId);
  const closingOutput = selected === 'complete' && typeof control.closing_output_batch_id === 'string' && !!control.closing_output_batch_id.trim();
  const showFullReport = selected === 'astatka' || (selected === 'complete' && (switchProgress === 'complete' || control.complete_requires_full_report !== false || closingOutput));
  const integratedLaminationReport = usesIntegratedLaminationReport({ operation, action: selected, training: isTrainingOrder,
    testMode: session.token === 'test-mode-token', fullReport: switchProgress === 'complete' || control.complete_requires_full_report !== false,
    freezeRequested: bootstrap?.control_state?.order_control === 'freeze_requested' || control.stage_control_state === 'freeze_requested' || !!runningFreezeRequest(bootstrap?.control_state, apparatusId) });
  const rezkaAstatkaReport = operation === 'cut' && selected === 'astatka' && !isTrainingOrder && session.token !== 'test-mode-token';
  const rezkaOutputReport = operation === 'cut' && ['pause', 'detach_roll', 'roll_complete', 'complete'].includes(selected) && !isTrainingOrder && session.token !== 'test-mode-token';
  const currentRows: Obj[] | null = scanningRequired
    ? (Array.isArray(materialRequirements.assignments) ? materialRequirements.assignments.filter((row: Obj) => matchesMaterialAssignment(row, orderId, apparatusId)) : null)
    : attachedReadKey === materialReadKey ? attachedMaterials : null;
  const requiredMaterialCount = Number(materialRequirements.required_scan_count ?? 0);
  const matchedMaterialCount = Number(materialRequirements.matched_scan_count ?? materials.length);
  // V2 keeps assigned material information visible after start, pause and completion.
  const allowNewMaterialRequests = sections.materials?.status === 'ready' && materialRequirements.assignments_satisfied === false;
  const canSendOrderAlert = operation === 'print' && synchronized && bootstrap?.control_state?.order_control === 'active' && !isTrainingOrder &&
    (allowed.includes('start') || !!String(interaction.blocking_reason_code ?? '').trim() || showPreflightHold || showPreflightOutcome);
  const currentMaterialsError = scanningRequired && sections.materials?.status === 'error' ? String(sections.materials?.error || 'Homashyolar yuklanmadi.') : attachedReadKey === materialReadKey ? attachedMaterialsError : '';
  const currentMaterialLoading = scanningRequired ? sections.materials?.status === 'loading' || currentRows === null : currentRows === null && !currentMaterialsError;
  const currentMaterialBlockingText = (allowed.includes('start') || allowed.includes('resume')) && !currentMaterialLoading && materialState.unavailable ? materialState.reason : '';
  const currentCardState = workerOrderCardState({ synchronized, activeOrder: isActiveOrder, allowed, interaction, operation,
    previousStage: String(control.previous_stage ?? ''), automaticQolip, preflightHold: showPreflightHold,
    preflightOutcome: !!showPreflightOutcome, preflightFreeze: showPreflightFreeze, materialLoading: currentMaterialLoading,
    materialError: currentMaterialsError, assignedCount: currentRows?.length ?? 0, materialBlockingText: currentMaterialBlockingText, intakeCount: intakeCandidates.length, reclose: !!finishReclose });
  const effectiveOrderControl = bootstrap?.control_state?.order_control === 'active' && ['frozen', 'freeze_requested'].includes(control.stage_control_state)
    ? control.stage_control_state : bootstrap?.control_state?.order_control;
  const presentation = useWorkerOrderPresentation({
    scope: JSON.stringify([printingIdentity, queueEpoch ?? detail?.epoch ?? controlEpoch ?? '']), synchronized,
    eligible: !!detail && detailReadScope === printingScope && !presentationDenied &&
      ['aparatchi', 'rezka_master'].includes(workerRole) && session.capabilities.includes('apparatus.queue.manage') &&
      session.assigned_apparatus.includes(apparatusId) && (!bootstrap || effectiveOrderControl === 'active') &&
      (!queueEpoch || !detail?.epoch || queueEpoch === detail.epoch),
  }, {
    cardState: currentCardState, showPreflightHold, showPreflightOutcome: !!showPreflightOutcome, showPreflightFreeze,
    temporarilyPaused: synchronized && control.temporarily_paused === true,
    pauseLabel: safeStopRequest ? 'Rulonni yechib muzlatish' : 'Rulonni yechish',
    blockingNotice: currentCardState.showBackendBlockingNotice ? workerOrderBlockingText(interaction.blocking_reason_code, apparatus?.name ?? '', busyOrderTitle, p) : '',
    previousStageLabel: apparatusCatalog?.find(row => row.id === control.previous_stage)?.name ?? String(control.previous_stage ?? ''),
    rows: currentRows, materialLoading: currentMaterialLoading, materialsError: currentMaterialsError, materialBlockingText: currentMaterialBlockingText,
    intakeCandidates, intakeLoading, intakeError, requiredMaterialCount, matchedMaterialCount,
    requiredQolips, effectiveQolips, automaticQolip, automaticSets, automaticConfirmed: !!automaticConfirmation, moldSetCount: moldSets.size, moldStatus: sections.qolips?.status,
    moldValidationLoaded: !!qolipValidation, moldBlockingReason: String(qolipValidation?.blocking_reason_code ?? ''),
    moldReadError: typeof sections.qolips?.error === 'string' ? sections.qolips.error : '',
    selectedMoldSetId: selectedQolipSet || (automaticSets.length === 1 ? String(automaticSets[0].set_id ?? '') : ''),
    stageId: String(control.stage_node_id ?? ''), mergeLines: workerMergeStateLines(control.rezka_input_lineage ?? [], p),
    rezkaInstructions: workerOrderRezkaInstructions(order, apparatusId, String(control.stage_node_id ?? ''), control.rezka_output_kadr_counts ?? [], p),
    inputVisible: preparationVisible && previousRequired,
    inputLabel: t(inputBatch ? (interaction.opening_wip_mode === 'scan_required' ? 'Opening WIP ruloni tasdiqlandi' : 'Oldingi bosqich tasdiqlandi') : (interaction.opening_wip_mode === 'scan_required' ? 'Opening WIP QR ni skan qiling' : 'Oldingi bosqich QR')),
    inputQr: inputBatch?.qr ?? '',
  });
  const view = presentation.data, cardState = view.cardState;
  const moldDisplay = workerMoldPresentation({ automatic: view.automaticQolip, status: view.moldStatus, requiredQolips: view.requiredQolips,
    scannedCodes: view.effectiveQolips, sets: view.automaticSets, selectedSetId: view.selectedMoldSetId || null, confirmed: view.automaticConfirmed,
    validation: view.moldValidationLoaded ? { blocking_reason_code: view.moldBlockingReason } : null, readError: view.moldReadError });
  const moldWarning = workerMoldBlockingText(moldDisplay.blocking, p, key => extensionText('qolipReworkText', key, locale));
  const actionsEnabled = synchronized && !busy && !merge.pending;
  const rows = view.rows, materialLoading = view.materialLoading, materialsError = view.materialsError, materialBlockingText = view.materialBlockingText;
  const showIntakeCandidates = cardState.showIntakeCandidates;
  const showLinkRequests = !!apparatus && !directMaterialUse && cardState.showStartMaterials && !isTrainingOrder;
  const showMaterials = !!bootstrap || presentation.retaining;
  const intakeSection = materialSectionExpansion({ loading: view.intakeLoading, error: view.intakeError, count: view.intakeCandidates.length, expanded: intakeExpanded });
  const attachedSection = materialSectionExpansion({ loading: materialLoading, error: materialsError, count: rows?.length ?? 0, expanded: materialsExpanded });
  const startMaterialStatus = workerStartMaterialStatus(rows ?? [], materialBlockingText, p('worker.error.material_not_at_machine'), p('worker.error.no_materials'));
  const allMaterialsAwaitingDelivery = cardState.showStartMaterials && startMaterialStatus.allAwaiting;
  const displayScannedMolds = new Set(view.effectiveQolips.map(normalizeCode));
  function materialsChanged(barcode?: string) {
    if (barcode) setMaterials(previous => previous.some(value => normalizeCode(value) === normalizeCode(barcode)) ? previous : [...previous, barcode]);
    onChanged(); setRefresh(value => value + 1);
  }
  function openMaterialQr(row: MaterialRow) {
    if (!row.barcode?.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    materialQrSheet.open(<WorkerAssignedMaterialQr session={session} row={row} onClose={materialQrSheet.close} />, { dismissible: true });
  }
  function materialCount(count: number) {
    const code = locale.split(/[-_]/)[0];
    return `${count} ${code === 'uz' ? 'ta' : code === 'ru' ? 'материалов' : code === 'ur' ? 'مواد' : `material${count === 1 ? '' : 's'}`}`;
  }
  const showMolds = cardState.showMolds;
  const showOutputProgress = !!detail && cardState.showOutputProgress;
  const blockingNotice = view.blockingNotice;
  const previousStageLabel = view.previousStageLabel;
  function cancelProgressDialog() {
    if (busy || photoBusy) return;
    if (paintEditor) {
      setPaintFieldDialog(null);
      if (Platform.OS === 'android') paintSheet.close();
      else if (paintColor) setPaintColor('');
      else setPaintEditor(false);
      return;
    }
    const closeInitial = !!initialAction && selected === initialAction;
    selectProgressAction('');
    if (closeInitial) closeSheet();
  }
  function addPaintField(label: string, value: string) {
    if (!paintFieldDialog || !isCurrent() || photoBusy || busy) return;
    const { target, usage } = paintFieldDialog, key = `${usage}:${target}`;
    setPaintFieldDialog(null);
    const existing = paintDynamic[key] ?? [];
    if (existing.some(item => item.toLowerCase() === label.toLowerCase())) { setError('Bu nom allaqachon qo‘shilgan.'); return; }
    setPaintDynamic(old => ({ ...old, [key]: [...existing, label] }));
    const index = (paintOptions.find(option => option.name === target)?.fields.length ?? 0) + existing.length;
    setPaint(old => ({ ...old, [workerPaintValueKey(key, index, label)]: value })); setError('');
  }

  const inlinePaint = Platform.OS !== 'android' && paintEditor;
  const paintPhoto: ReturnedPaintImage | null = paintImageId ? paintImageMetadata?.image_id === paintImageId ? paintImageMetadata : {
    image_id: paintImageId, image_name: '', image_mime: '', image_size_bytes: 0,
    image_url: `/v1/mobile/returned-paint/images/view?id=${encodeURIComponent(paintImageId)}`,
  } : null;
  const pickPaintImage = () => Alert.alert('', '', [
    { text: t('Kamera'), onPress: () => { void pickPaintPhoto('camera'); } },
    { text: t('Gallery'), onPress: () => { void pickPaintPhoto('gallery'); } },
    { text: t('Bekor qilish'), style: 'cancel' },
  ]);
  const paintLocked = () => !isCurrent() || photoBusy || busy;
  const paintBody = paintEditor ? <>
          {paintPhoto && <>
            <BoyoqchiImage session={session} image={paintPhoto} allowDownload={false} isLocked={() => !isCurrent()} />
            <View style={styles.actionRow}>
              <View style={styles.flex}><NativeButton label={t('Almashtirish')} disabled={photoBusy} onPress={pickPaintImage} /></View>
              <View style={styles.flex}><NativeButton label={t('Olib tashlash')} disabled={photoBusy} onPress={() => { void removePaintPhoto(); }} /></View>
            </View>
          </>}
          {inlinePaint && !paintPhoto && <NativeButton label={t('Rasm qo‘shish')} disabled={photoBusy} onPress={pickPaintImage} />}
          {!paintColor && <WorkerPaintPalette usage={paintUsage} onUsage={setPaintUsage} onSelect={setPaintColor} />}
          {!!paintColor && <View style={styles.sectionGroup}>
            {[...(paintOptions.find(option => option.name === paintColor)?.fields ?? []), ...(paintDynamic[`${paintUsage}:${paintColor}`] ?? [])].map((label, index) => <ReturnedPaintField key={`${paintUsage}:${paintColor}:${index}:${label}`} label={label} initial={workerPaintValue(paint, `${paintUsage}:${paintColor}`, index, label)} decimal isLocked={paintLocked} onChange={value => setPaint(old => ({ ...old, [workerPaintValueKey(`${paintUsage}:${paintColor}`, index, label)]: value }))} />)}
            {paintColor === 'Pantone' && (paintDynamic[`${paintUsage}:Pantone Mix`] ?? []).map((label, index) => <ReturnedPaintField key={`${paintUsage}:Pantone Mix:${index}:${label}`} label={label} initial={workerPaintValue(paint, `${paintUsage}:Pantone Mix`, index, label)} decimal isLocked={paintLocked} onChange={value => setPaint(old => ({ ...old, [workerPaintValueKey(`${paintUsage}:Pantone Mix`, index, label)]: value }))} />)}
            {!['Lak', 'Spirtlar'].includes(paintColor) && <>
              <NativeButton label={t(paintColor === 'Mix' ? 'Mix+' : 'Pantone+')} onPress={() => setPaintFieldDialog({ target: paintColor, usage: paintUsage })} />
              {paintColor === 'Pantone' && <NativeButton label={t('Mix+')} onPress={() => setPaintFieldDialog({ target: 'Pantone Mix', usage: paintUsage })} />}
            </>}
          </View>}
          {paintFieldDialog && <ReturnedPaintNamedFieldDialog paint={paintFieldDialog.target === 'Pantone Mix' ? 'Mix' : paintFieldDialog.target}
            close={() => setPaintFieldDialog(null)} add={addPaintField} disabled={photoBusy || busy} isLocked={paintLocked} />}
        </> : null;
  const paintContent = paintEditor && !inlinePaint ? (
    <View style={styles.screen}>
      <View style={styles.paintHeader}>
        <WorkerIconButton icon="back" label={t("Orqaga")} onPress={() => {
          if (photoBusy) return;
          if (paintColor) setPaintColor('');
          else paintSheet.close();
        }} />
        <Text style={[styles.expansionTitle, { color: colors.text }]}>{t("Qaytarilgan bo‘yoq")}</Text>
        <WorkerIconButton icon="photo" label={t(paintPhoto ? 'Rasmni almashtirish' : 'Rasm qo‘shish')}
          onPress={() => { if (!photoBusy) pickPaintImage(); }} />
      </View>
      <ScrollView nestedScrollEnabled contentContainerStyle={styles.paintContent} keyboardShouldPersistTaps="handled">
        {!!error && <Text style={errorTextStyle}>{t(error)}</Text>}
        {paintBody}
      </ScrollView>
    </View>
  ) : null;
  useLayoutEffect(() => {
    if (!paintContent) return;
    if (paintSheet.isOpen()) paintSheet.update(paintContent);
    else paintSheet.open(paintContent, { dismissible: true, onDismiss: () => {
      setPaintEditor(false);
      setPaintColor('');
      setPaintFieldDialog(null);
      setScanner(null);
      setError('');
    } });
  });

  if (scanner) return <View style={styles.cameraScreen}><CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix', 'code128', 'ean13', 'ean8'] }} onBarcodeScanned={({ data }: { data: string }) => { void onScan(data); }} /><Text style={styles.cameraText}>{t(scanner === 'material' ? 'Material kodini skanerlang' : scanner === 'qolip' ? 'Qolip kodini skanerlang' : 'Kiruvchi rulonni skanerlang')}</Text><NativeButton label={t("Bekor qilish")} onPress={() => setScanner(null)} /></View>;
  const imageId = String(order.image_id || preview?.imageId || '');
  if (imageOpen) return <WorkerOrderImage session={session} orderId={orderId} imageId={imageId} onClose={() => setImageOpen(false)} />;

  return <View style={[styles.screen, { backgroundColor: sheetBackground }]}><ScrollView nestedScrollEnabled contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, Platform.OS === 'ios' && iosStyles.content]} keyboardShouldPersistTaps="handled">
    <WorkerOrderIdentity session={session} orderId={orderId} imageId={imageId} code={code} title={String(order.title || preview?.title || '')}
      onScannedWips={canOpenScannedWips ? () => setScannedWipsStage(scannedStage) : undefined}
      onOpenImage={() => setImageOpen(true)} onClose={closeSheet} />
    {showQuickScanner && <View style={[styles.scannerPanel, { backgroundColor: sheetCard }, Platform.OS === 'ios' && iosStyles.scannerPanel]}>
      {permission?.granted ? <CameraView style={[styles.quickCamera, Platform.OS === 'ios' && iosStyles.quickCamera]} barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix', 'code128', 'ean13', 'ean8'] }} onBarcodeScanned={({ data }: { data: string }) => { void quickScan(data); }} /> :
        <NativeButton label={t("Kameraga ruxsat berish")} onPress={() => { void askPermission(); }} />}
      <Text style={[styles.scannerText, { color: colors.muted }, Platform.OS === 'ios' && iosStyles.scannerText]}>{merge.scanning ? p('worker.scanner.merge_prompt') : t("Qolip yoki homashyo kodidan bittasini kamera markaziga olib keling")}</Text>
      {interaction.opening_wip_mode !== 'scan_required' && <>
        <View style={[styles.manualToggle, Platform.OS === 'ios' && iosStyles.manualToggle]}><WorkerIconButton icon="edit" label={t("Kodni qo‘lda kiritish")} onPress={() => setManualScanVisible(value => !value)} /></View>
        {manualScanVisible && <View style={styles.manualRow}>
          <View style={styles.flex}><Host matchContents={{ vertical: true }} style={styles.host}><NativeInput value={manualScanValue} placeholder={t("QR / barcode")} onChangeText={setManualScan} autoCapitalize="none" /></Host></View>
          <WorkerIconButton icon="check" label={t("Kodni tekshirish")} onPress={() => { void quickScan(manualScan); manualScanValue.set(''); setManualScan(''); }} />
        </View>}
      </>}
    </View>}
    <View style={[styles.card, { backgroundColor: sheetCard }, Platform.OS === 'ios' && iosStyles.actionCard]}>
    <WorkerOrderSyncProgress pending={loading || (!synchronized && !busy && !presentationDenied)} color={colors.icon} />
    {view.temporarilyPaused && <WorkerOrderPauseStatus message={t("Vaqtincha yechilgan")}
      style={[styles.detailText, { color: colors.muted }, Platform.OS === 'ios' && iosStyles.temporaryPause]} />}
    {['frozen', 'freeze_requested'].includes(effectiveOrderControl) && <Text style={errorTextStyle}>{p(effectiveOrderControl === 'frozen' ? 'worker.freeze.active' : 'worker.freeze.requested')}</Text>}
    {!!error && !selected && !delivery && <Text style={errorTextStyle}>{t(error)}</Text>}
    {!!success && <Text style={successTextStyle}>{t(success)}</Text>}
    {!!blockingNotice && <WorkerOrderBlockingNotice message={blockingNotice} />}
    {(!!bootstrap || presentation.retaining) && <>
      {showIntakeCandidates && <View style={cardSectionStyle}>
        <Expansion systemColors={Platform.OS === 'android'} title={p(intakeSection.hasContent ? 'worker.materials.pending' : 'worker.materials.pending.empty')}
          count={view.intakeLoading ? '..' : view.intakeCandidates.length ? materialCount(view.intakeCandidates.length) : ''} expanded={intakeSection.expanded}
          onPress={intakeSection.canToggle ? () => setIntakeExpanded(value => !value) : undefined} />
        {intakeSection.expanded && <>
          {view.intakeLoading && <Text style={[styles.muted, { color: colors.muted }]}>{t('Yuklanmoqda...')}</Text>}
          {!!view.intakeError && <Text style={errorTextStyle}>{t(view.intakeError)}</Text>}
          {!view.intakeLoading && !view.intakeError && <WorkerMaterialList rows={view.intakeCandidates} scanned={[]} onLongPress={openMaterialQr} showBalances={false} />}
        </>}
      </View>}
      {showMaterials && <View style={[cardSectionStyle, showIntakeCandidates && cardSeparatorStyle]}>
        {cardState.showStartMaterials && !materialLoading && !materialsError && rows?.length === 0 ? <Text style={[styles.expansionTitle, { color: colors.text }]}>{p('worker.materials.unassigned_order')}</Text> : <Expansion systemColors={Platform.OS === 'android'} title={t(allMaterialsAwaitingDelivery ? 'Apparat oldiga homashyo olib kelinmagan' : p(attachedSection.hasContent ? 'worker.materials.attached' : 'worker.materials.attached.empty'))}
          count={materialLoading ? '..' : rows?.length && !allMaterialsAwaitingDelivery ? materialCount(rows.length) : ''} expanded={attachedSection.expanded}
          onPress={attachedSection.canToggle ? () => setMaterialsExpanded(value => !value) : undefined} />}
        {cardState.showStartMaterials && !!rows?.length && !materialLoading && !materialsError && !!startMaterialStatus.deliveryKey &&
          <Text style={[styles.muted, { color: colors.muted }]}>{p(startMaterialStatus.deliveryKey, { present: startMaterialStatus.present, waiting: startMaterialStatus.waiting })}</Text>}
        {attachedSection.expanded && <>
          {materialLoading && <Text style={[styles.muted, { color: colors.muted }]}>{t('Yuklanmoqda...')}</Text>}
          {!!materialsError && <Text style={errorTextStyle}>{t(materialsError)}</Text>}
          {!materialLoading && !materialsError && !!rows?.length && <WorkerMaterialList rows={rows} scanned={materials} orderId={orderId} onLongPress={openMaterialQr} />}
        </>}
        {canSendOrderAlert && scanningRequired && !materialLoading && !materialsError && rows?.length === 0 && <WorkerOrderAlertButton session={session} orderId={orderId} apparatusId={apparatusId} kind="rawMaterial" enabled={!busy} />}
        {cardState.showStartMaterials && !!rows?.length && !materialLoading && !materialsError && view.requiredMaterialCount > 0 && <View style={[styles.expansion, Platform.OS === 'ios' && iosStyles.scanProgress]}><Text style={[styles.expansionTitle, { color: colors.text }, Platform.OS === 'ios' && iosStyles.scanProgressLabel]}>{p('worker.materials.scan_progress')}</Text><Text style={[styles.muted, { color: colors.muted }, Platform.OS === 'ios' && iosStyles.scanProgressCount]}>{view.matchedMaterialCount}/{view.requiredMaterialCount}</Text></View>}
        {cardState.showStartMaterials && !!rows?.length && !materialLoading && !materialsError && startMaterialStatus.showBlockingReason && <Text style={errorTextStyle}>{t(materialBlockingText)}</Text>}
        {showLinkRequests && <View style={!scanningRequired && !materialsExpanded ? { display: 'none' } : undefined}>
          <MaterialLinkRequestPanel session={session} orderId={orderId} apparatusId={apparatusId} actionsEnabled={synchronized} allowNewRequests={allowNewMaterialRequests} onChanged={materialsChanged} />
        </View>}
        {directMaterialUse && <WorkerMaterialUsePanel session={session} orderId={orderId} apparatusId={apparatusId} actionsEnabled={synchronized} onChanged={materialsChanged} />}
      </View>}
      {showMolds && <View style={[cardSectionStyle, (showMaterials || showIntakeCandidates) && cardSeparatorStyle]}>
        <Expansion title={moldDisplay.manualStatusText || p(moldDisplay.manualStatusKey || moldDisplay.titleKey)} count={workerMoldCountText(moldDisplay, locale, p)}
          expanded={moldDisplay.expandable && qolipsExpanded} onPress={moldDisplay.expandable && !moldDisplay.loading ? () => setQolipsExpanded(value => !value) : undefined} />
        {!!moldWarning && <View style={[iosStyles.moldWarning, { borderColor: colors.error, backgroundColor: colors.field }]}>
          <Text accessibilityRole="alert" style={[errorTextStyle, iosStyles.moldWarningText]}>{moldWarning}</Text>
        </View>}
        {view.automaticQolip && view.automaticSets.length > 1 && view.automaticSets.map(set => <NativeButton key={String(set.set_id)} label={String(set.set_id)} disabled={!actionsEnabled} variant={selectedQolipSet === set.set_id ? 'filled' : 'outlined'} onPress={() => { if (actionsEnabled && authorityCurrent()) setSelectedQolipSet(String(set.set_id)); }} />)}
        {canSendOrderAlert && sections.qolips?.status === 'ready' && requiredQolips.length === 0 && <WorkerOrderAlertButton session={session} orderId={orderId} apparatusId={apparatusId} kind="qolip" enabled={!busy} />}
        {qolipsExpanded && moldDisplay.molds.map((mold, index) => <View key={String(mold.qolip_code || index)} style={[styles.detailRow, { backgroundColor: colors.field }]}><Text style={[styles.detailText, { color: colors.text }]}>{String(mold.qolip_code ?? '')}{t(mold.color ? ` · ${mold.color}` : '')}{t(displayScannedMolds.has(normalizeCode(mold.qolip_code)) ? ' ✓' : '')}</Text></View>)}
        {!view.automaticQolip && view.moldSetCount > 1 && view.effectiveQolips.length > 0 && <NativeButton label={t("Komplektni almashtirish")} variant="text" disabled={!actionsEnabled} onPress={() => { if (!actionsEnabled || !authorityCurrent()) return; setQolipsReset(true); setQolips([]); }} />}
        {!view.automaticQolip && view.moldStatus === 'error' && !!view.requiredQolips.length && <Text style={errorTextStyle}>{t("Qoliplar yuklanmadi")}</Text>}
      </View>}
      {view.inputVisible && <View style={[styles.detailRow, { backgroundColor: colors.field }]}>
        <Text style={[styles.expansionTitle, { color: colors.text }]}>{view.inputLabel}</Text>
        {!!view.inputQr && <Text style={[styles.small, { color: colors.muted }]}>{view.inputQr}</Text>}
      </View>}
      {cardState.hasActions && <View style={[cardSectionStyle, (showMaterials || showMolds || showIntakeCandidates) && cardSeparatorStyle]}>
        {cardState.showMaterialIntakeAction && <NativeButton label={p(intakeMode ? 'worker.action.close_scanner' : 'worker.action.receive_material')} height={52} disabled={!actionsEnabled || deliveryBusy} onPress={() => { if (!actionsEnabled || !authorityCurrent()) return; merge.flow.cancel(); setIntakeMode(value => !value); }} />}
        {!!view.rezkaInstructions.length && <View style={[styles.detailRow, { backgroundColor: colors.field }]}><Text style={[styles.detailText, { color: colors.text }]}>{p('worker.map.cutting')}</Text>{view.rezkaInstructions.map((line, index) => <Text key={index} style={[styles.detailText, { color: colors.text }]}>{line}</Text>)}</View>}
        {!!view.mergeLines.length && <View style={[styles.detailRow, { backgroundColor: colors.field }]}><Text style={[styles.detailText, { color: colors.text }]}>{p('worker.merge_state.title')}</Text>{view.mergeLines.map((line, index) => <Text key={index} style={[styles.detailText, { color: colors.text }]}>{line}</Text>)}</View>}
        {view.showPreflightFreeze && <NativeButton label={t("Rang chiqarishni to‘xtatib muzlatish")} height={58} variant="filled" disabled={!actionsEnabled} onPress={() => { void freezePreflight(); }} />}
        {view.showPreflightOutcome && <View style={[styles.actionRow, Platform.OS === 'ios' && iosStyles.outcomeActions]}>
          <View style={styles.flex}>{Platform.OS === 'ios' ? <WorkerPreflightButton label={t("Rang chiqdi")} disabled={!actionsEnabled} onPress={() => { void runPreflight('passed'); }} /> : <NativeButton label={t("Rang chiqdi")} height={58} variant="filled" disabled={!actionsEnabled} icon={{ android: 'check_circle', ios: 'checkmark.circle' }} onPress={() => { void runPreflight('passed'); }} />}</View>
          <View style={styles.flex}>{Platform.OS === 'ios' ? <WorkerPreflightButton label={t("Chiqmadi")} disabled={!actionsEnabled} outlined onPress={() => { void runPreflight('failed'); }} /> : <NativeButton label={t("Chiqmadi")} height={58} disabled={!actionsEnabled} icon={{ android: 'cancel', ios: 'xmark.circle' }} onPress={() => { void runPreflight('failed'); }} />}</View>
        </View>}
        {view.showPreflightHold && <WorkerPreflightButton label={p('worker.action.print_preflight')} disabled={!actionsEnabled} onPress={() => { void runPreflight('hold'); }} />}
        {!view.showPreflightHold && !view.showPreflightOutcome && cardState.showStart && <NativeButton orderAction="start" label={p('worker.action.start')} height={58} variant="filled" icon={{ android: 'play_arrow', ios: 'play.fill' }} largeLabel disabled={!startReady || !actionsEnabled} onPress={() => { void submit('start'); }} />}
        {showOutputProgress && <WorkerOutputProgress session={session} orderId={orderId} apparatusId={apparatusId}
          stageId={view.stageId} map={order} operation={operation} outputRevision={`${controlEpoch}:${controlRevision}:${refresh}`} />}
        {(cardState.showPause || cardState.showComplete) && <WorkerOrderActionGroup>
          {cardState.showPause && <NativeButton orderAction="pause" label={t(view.pauseLabel)} height={58} disabled={!actionsEnabled} onPress={() => { if (!actionsEnabled || !authorityCurrent()) return; setError(''); selectProgressAction('pause'); }} />}
          {cardState.showComplete && <NativeButton orderAction="complete" label={p('worker.action.complete')} height={58} variant="filled" disabled={!actionsEnabled} onPress={() => { if (actionsEnabled && authorityCurrent()) void beginCompletion(); }} />}
        </WorkerOrderActionGroup>}
        {cardState.showMerge && <NativeButton label={p('worker.action.merge')} height={58} disabled={!actionsEnabled || scanInFlight.current} onPress={() => { if (!actionsEnabled || !authorityCurrent()) return; setIntakeMode(false); merge.flow.toggle(); }} />}
        {cardState.showResume && <NativeButton orderAction="resume" label={p('worker.action.resume')} height={58} variant="filled" icon={{ android: 'play_arrow', ios: 'play.fill' }} disabled={!resumeReady || !actionsEnabled} onPress={() => { void submit('resume'); }} />}
        {cardState.showWaitingForPrevious && <WorkerOrderBlockingNotice message={p('worker.waiting.previous', { stage: previousStageLabel })} />}
        {cardState.showWaitingForSequence && <WorkerOrderBlockingNotice message={p('worker.waiting.sequence')} />}
      </View>}
    </>}
    {!loading && !detail && !bootstrap && !presentation.retaining && <NativeButton label={t("Qayta urinish")} onPress={() => { setError(''); detailRecovery.current?.retry(); }} disabled={busy} />}
    </View>
    <WorkerOrderOverview session={session} orderId={orderId} code={code} imageId={imageId}
      title={String(order.title || preview?.title || '')}
      detail={detail && detailReadScope === printingScope ? workerOrderDetailFromSnapshot(detail, orderId) : null} />
  </ScrollView>
    {!!initialSwitchQr && apparatus && <WorkerInitialOrderSwitch session={session} apparatus={apparatus} apparatusCatalog={apparatusCatalog} orderId={orderId}
      orderLabel={[code, String(order.title || preview?.title || '')].filter(Boolean).join(' • ')} qr={initialSwitchQr}
      ready={synchronized && !busy} data={bootstrap} current={isCurrent} snapshot={() => latestCursor.current as Obj | null}
      onError={setError} onReport={action => { setSwitchProgress(action); selectProgressAction(action); }}
      onProceed={() => { if (isCurrent()) { onSwitchCommitted?.(); closeSheet(); } }}
      onPauseStart={() => { actionInFlight.current = true; loadVersion.current++; setControlRetired(true); setBusy(true); setError(''); }}
      onPauseEnd={completed => {
        actionInFlight.current = false; notifyWritePending(false); setBusy(false); onChanged(); setRefresh(value => value + 1);
        if (completed) { onSwitchCommitted?.(); closeSheet(); }
        else setError(p('worker.temporary_pause.failed'));
      }} />}
    <WorkerOrderMergeDialog state={merge.state} orderNumber={String(order.order_number ?? code)} onCancel={() => merge.flow.cancel()} onConfirm={() => { void merge.flow.confirm(); }} />
    <WorkerFormDialog actionColors="blue" neutralCancelLabel={!inlinePaint} visible={!!selected && !printerDialogHidden && !integratedLaminationReport && !rezkaAstatkaReport && !rezkaOutputReport} onDismiss={() => {
      reportDismissed.current?.(); reportDismissed.current = null;
      if (closeAfterProgress.current && isCurrent()) { closeAfterProgress.current = false; closeSheet(); }
    }} title={selected === 'detach_roll' ? p('worker.handoff.detach') : t(inlinePaint ? 'Qaytarilgan bo‘yoq' : selected === 'astatka' ? 'Astatka hisobotini topshirish' : safeStopRequest && selected === 'pause' ? 'Rulonni yechib muzlatish' : selected === 'pause' ? 'Pauza miqdori' : 'Tugatish miqdori')}
      cancelLabel={t(inlinePaint ? 'Orqaga' : 'Bekor qilish')} onCancel={() => { setSwitchProgress(null); cancelProgressDialog(); }} cancelDisabled={busy || photoBusy}
      preventDismiss
      confirmLabel={t(inlinePaint ? 'Tayyor' : busy ? 'Yuborilmoqda…' : 'Tasdiqlash')}
      confirmDisabled={busy || photoBusy || (!inlinePaint && (!synchronized || (selected === 'astatka' ? !canOpenInitialAstatka : !allowed.includes(selected)) || (showFullReport && !laminationReport && loadedDraftScope !== draftScope)))}
      onConfirm={() => { if (inlinePaint) { setError(''); setPaintEditor(false); } else void submit(selected); }}>
        {!!error && <Text style={errorTextStyle}>{t(error)}</Text>}
        {inlinePaint ? paintBody : <>
        <Text style={[styles.muted, { color: colors.muted }]}>{t(selected === 'astatka' ? 'Bu faqat order astatkasini qayd qiladi. Pauza va Tugatish holati o‘zgarmaydi.' : safeStopRequest && selected === 'pause' ? 'Sog‘lom rulon bo‘lsa barcha miqdorlarni kiriting. Ishlab chiqarish imkonsiz bo‘lsa miqdorlarni bo‘sh qoldirib, faqat muammo izohini yozing.' : showFullReport ? '0 yoki to‘liq bo‘lmagan hisobot uchun izoh yozing' : 'Joriy miqdorni kiriting')}</Text>
        {selected === 'pause' && safeStopRequest && descriptionRevealed && <Field label={p('worker.freeze.safe_stop.issue_note')} initialValue={freezeNote} onChangeText={setFreezeNote} />}
        {['pause','detach_roll','roll_complete','complete'].includes(selected) && !closingOutput && <><Text style={[styles.label, { color: colors.muted, textAlign: 'center' }]}>{p('worker.progress.qty.standard')}</Text><Field label={`${p('worker.daily.field.roll')}, ${p('worker.progress.qty.unit.kg')}`} initialValue={bobina} keyboardType="decimal-pad" onChangeText={setBobina} /><Text style={[styles.label, { color: colors.muted, textAlign: 'center' }]}>{p('worker.progress.qty.finished_goods')}</Text><Field label={`${p('worker.daily.field.length')}, ${p('worker.progress.qty.unit.meter')}`} initialValue={meter} keyboardType="decimal-pad" onChangeText={setMeter} /><Field label={`${p('worker.daily.field.weight')}, ${p('worker.progress.qty.unit.kg')}`} initialValue={kg} keyboardType="decimal-pad" onChangeText={setKg} /></>}
        {showFullReport && laminationReport && <><Text style={[styles.label, { color: colors.muted, textAlign: 'center' }]}>{p('worker.progress.qty.excess_rolls')}</Text>
          <Field label={`${p('worker.daily.field.print_leftover')} (kg)`} initialValue={leftoverWip} keyboardType="decimal-pad" onChangeText={setLeftoverWip} />
          <Field label={`${p('worker.daily.field.film_leftover')} (kg)`} initialValue={leftoverFilm} keyboardType="decimal-pad" onChangeText={setLeftoverFilm} /></>}
        {showFullReport && <><Text style={[styles.label, { color: colors.muted, textAlign: 'center' }]}>{p(laminationReport ? 'worker.progress.qty.waste' : 'worker.progress.qty.returned_paint_and_waste')}</Text><Field label={`${p('worker.daily.field.total_waste')}, ${p('worker.progress.qty.unit.kg')}`} initialValue={waste} keyboardType="decimal-pad" onChangeText={setWaste} />
          {!laminationReport && <NativeButton label={p('worker.daily.field.returned_ink')} variant={Platform.OS === 'ios' ? 'outlined' : 'filled'} neutralLabel disabled={photoBusy || loadedDraftScope !== draftScope} onPress={() => { setError(''); setPaintEditor(true); }} />}</>}
        {selected === 'astatka' && <Field label={p('worker.progress.qty.optional_note')} initialValue={astatkaNote} onChangeText={setAstatkaNote} />}
        {selected === 'complete' && descriptionRevealed && <Field label={p(closingOutput ? 'worker.progress.qty.optional_note' : 'worker.progress.qty.reason')} initialValue={completionNote} onChangeText={setCompletionNote} />}
        </>}
    </WorkerFormDialog>
    {printerSelector.dialogs}
    {rezkaOutputReport ? <WorkerRezkaOutputReport key={selected} session={session} apparatus={apparatusId} orderId={orderId}
      stage={String(control.stage_node_id ?? '')} action={selected} map={order} fullCompletionReportRequired={switchProgress === 'complete'} getCursor={() => latestCursor.current}
      onAttempted={() => { operationReportAttempted.current = true; actionInFlight.current = true; setBusy(true); loadVersion.current++; setControlRetired(true); }}
      onCommitted={() => { operationReportAttempted.current = true; loadVersion.current++; setControlRetired(true); }}
      onClose={completed => {
        const switched = completed && switchProgress === selected;
        const closeInitial = completed && (initialAction === selected || switched);
        setSwitchProgress(null);
        if (switched) onSwitchCommitted?.();
        setSelected(''); actionInFlight.current = false; notifyWritePending(false); setBusy(false);
        if (operationReportAttempted.current) { setRefresh(value => value + 1); onChanged(); }
        operationReportAttempted.current = false;
        if (closeInitial) closeSheet();
      }} /> : null}
    {integratedLaminationReport ? <WorkerLaminationReport key={selected} session={session}
      context={{ apparatus: apparatusId, orderId, stage: String(control.stage_node_id ?? ''), complete: selected === 'complete', fullReport: switchProgress === 'complete' || control.complete_requires_full_report !== false }}
      onAttempted={() => { operationReportAttempted.current = true; actionInFlight.current = true; setBusy(true); loadVersion.current++; setControlRetired(true); }}
      onCommitted={() => { operationReportAttempted.current = true; loadVersion.current++; setControlRetired(true); setInputBatch(null); setMaterials([]); }}
      onClose={completed => {
        const switched = completed && switchProgress === selected;
        setSwitchProgress(null); setSelected(''); actionInFlight.current = false; notifyWritePending(false); setBusy(false);
        if (operationReportAttempted.current) { setRefresh(value => value + 1); onChanged(); }
        operationReportAttempted.current = false;
        if (switched) { onSwitchCommitted?.(); closeSheet(); }
      }} /> : null}
    {rezkaAstatkaReport ? <WorkerRezkaAstatkaReport session={session} apparatus={apparatusId} orderId={orderId} getCursor={() => latestCursor.current}
      onAttempted={() => { operationReportAttempted.current = true; actionInFlight.current = true; setBusy(true); loadVersion.current++; setControlRetired(true); }}
      onCommitted={() => { operationReportAttempted.current = true; loadVersion.current++; setControlRetired(true); setInputBatch(null); setMaterials([]); }}
      onClose={completed => {
        const switched = completed && switchProgress === selected;
        setSwitchProgress(null); setSelected(''); actionInFlight.current = false; notifyWritePending(false); setBusy(false);
        if (operationReportAttempted.current) { setRefresh(value => value + 1); onChanged(); }
        operationReportAttempted.current = false;
        if (switched) { onSwitchCommitted?.(); closeSheet(); }
      }} /> : null}
    {!!scannedWipsStage && <WorkerScannedWipHistory session={session} apparatus={apparatusId} orderId={orderId} stage={scannedWipsStage}
      onClose={() => setScannedWipsStage('')} onMutationAttempted={() => {
        if (!isCurrent()) return;
        loadVersion.current++; setBootstrap(null); setControlRetired(true); setInputBatch(null); recentQuickScan.current = null;
        setScanner(null); setRefresh(value => value + 1); onChanged();
      }} />}
    <WorkerDeliveryDialog visible={!!delivery} name={String(delivery?.material.item_name || delivery?.material.item_code || '')} barcode={String(delivery?.material.barcode || '')}
      choices={(delivery?.deliverers ?? []).map(person => ({ key: `${person.role}:${person.ref}`, label: String(person.name || person.ref) }))}
      selected={deliveryChoice} error={error} busy={deliveryBusy} canConfirm={!!deliveryChoice && !deliveryBusy && synchronized}
      onChoose={setDeliveryChoice} onCancel={() => setDelivery(null)} onConfirm={() => { void confirmMaterialDelivery(); }} />
  </View>;
}
const iosStyles = StyleSheet.create({
  content: { paddingHorizontal: GRID.cardInset, paddingTop: GRID.sectionGap, gap: GRID.sectionGap },
  actionCard: { paddingHorizontal: GRID.cardInset, paddingVertical: 4, borderRadius: GRID.cardRadius, gap: 0, elevation: 0 },
  sectionGroup: { paddingTop: GRID.sectionGap, paddingBottom: GRID.sectionGap, gap: GRID.rowGap },
  separatedSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: PlatformColor('separator') },
  outcomeActions: { gap: GRID.rowGap },
  temporaryPause: {
    alignSelf: 'stretch', textAlign: 'center', fontSize: 17, lineHeight: 24, fontWeight: '600', paddingVertical: 12,
    color: Platform.OS === 'ios' ? DynamicColorIOS({ light: '#975916', dark: '#E9B472' }) : '#975916',
  },
  scannerPanel: { padding: GRID.cardInset, borderRadius: GRID.cardRadius, gap: GRID.sectionGap },
  quickCamera: { width: '100%', height: 'auto', aspectRatio: 1, maxWidth: 224, borderRadius: 12 },
  scannerText: { fontSize: 14, lineHeight: 20 },
  manualToggle: { padding: 0, minHeight: GRID.iconSize, justifyContent: 'center' },
  scanProgress: { paddingStart: 12, paddingEnd: GRID.chevronWidth + GRID.rowGap, paddingVertical: 8, minHeight: 40, borderRadius: 10, backgroundColor: PlatformColor('tertiarySystemFill') },
  scanProgressLabel: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  scanProgressCount: { fontSize: 14, lineHeight: 20, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: GRID.counterMinWidth, textAlign: 'right' },
  moldWarning: { borderStartWidth: 3, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  moldWarningText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  success: { color: PlatformColor('systemGreen'), fontSize: 14, lineHeight: 20, paddingTop: 12, paddingBottom: 4 },
});
const styles = StyleSheet.create({ screen:{flex:1},content:{padding:4,gap:8,paddingBottom:32},host:{width:'100%'},muted:{fontSize:14,color:'#52617a',lineHeight:21},small:{fontSize:13,color:'#52617a',lineHeight:20},card:{borderRadius:18,padding:14,gap:10,elevation:2},sectionGroup:{gap:10,paddingTop:8},label:{fontSize:13,color:'#52617a'},error:{color:'#a52626',fontSize:14},success:{color:'#1d7544',fontSize:14},cameraScreen:{flex:1,backgroundColor:'#10182b',justifyContent:'center',padding:16,gap:12},camera:{height:380,borderRadius:18,overflow:'hidden'},cameraText:{color:'#fff',textAlign:'center',fontSize:16},scannerPanel:{borderRadius:18,padding:12,alignItems:'center',gap:10},quickCamera:{width:218,height:218,borderRadius:24,overflow:'hidden'},scannerText:{fontSize:14,textAlign:'center'},manualToggle:{alignSelf:'flex-end',padding:8},manualRow:{width:'100%',flexDirection:'row',alignItems:'center',gap:8},expansion:{flexDirection:'row',alignItems:'center',gap:8,minHeight:40},expansionTitle:{flex:1,fontSize:16,fontWeight:'500'},detailRow:{borderRadius:12,padding:10,gap:3},detailText:{fontSize:14,fontWeight:'500'},actionRow:{flexDirection:'row',gap:8},paintHeader:{flexDirection:'row',alignItems:'center',padding:8,gap:6},paintPreview:{height:170,borderRadius:12},paintContent:{padding:14,gap:12,paddingBottom:24},flex:{flex:1}});
