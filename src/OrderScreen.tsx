import { Host, TextInput as NativeInput, useNativeState } from '@expo/ui';
import { Image } from 'expo-image';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, PlatformColor, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeSessionToken, type Session } from './auth';
import { adminBosmaAstatkaReport } from './workerControlsApi';
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
import { workerProductionOrderDetail } from './workerDetailApi';
import { useNativeSheet } from './nativeSheet';
import { authorizedFetch } from './authorizedFetch';
import { WorkerOrderImage } from './components/WorkerOrderHeader';
import { WorkerOrderIdentity } from './components/WorkerOrderIdentity';
import { WorkerScannedWipHistory } from './components/WorkerScannedWipHistory';
import { WorkerLaminationReport } from './components/WorkerLaminationReport';
import { WorkerRezkaAstatkaReport } from './components/WorkerRezkaAstatkaReport';
import { usesIntegratedLaminationReport } from './workerLaminationWorkflow';
import { canReadScannedWips, scannedWipStage } from './workerScannedWips';
import { workerQrPayload, WorkerInitialQr } from './workerQr';
import { WorkerOrderOverview } from './components/WorkerOrderOverview';
import { WorkerPaintPalette } from './components/WorkerPaintPalette';
import { WorkerOutputProgress } from './components/WorkerOutputProgress';
import { WorkerOrderButton as PlatformButton, WorkerOrderActionGroup } from './components/WorkerOrderControls';
import { WorkerMaterialList } from './components/WorkerMaterialList';
import { WorkerAssignedMaterialQr } from './components/WorkerAssignedMaterialQr';
import { MaterialLinkRequestPanel, WorkerMaterialUsePanel } from './components/WorkerMaterialPanels';
import { WorkerOrderAlertButton } from './components/WorkerOrderAlertButton';
import { useWorkerOrderText } from './components/useWorkerOrderText';
import { workerCompletionMode } from './workerCompletion';
import type { MaterialRow } from './workerMaterialPresentation';
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
import { automaticQolipConfirmation, matchesMaterialAssignment, materialStartReadiness, paintOptions, preflightFreezeRequest, returnedPaintItemsFromDraft, runningFreezeRequest, validOrderControl, type QueueCursor } from './workerOrderLogic';
import { workerOrderDetailFromSnapshot, type Apparatus, type QueueOrder } from './workerApi';

type Obj = Record<string, any>;
type Props = { session: Session; apparatusId: string; apparatus?: Apparatus; orderId: string; preview?: QueueOrder; queueCursor: QueueCursor | null; initialAction?: 'complete' | 'astatka'; initialScanQr?: string; onClose: () => void; onChanged: () => void };
function NativeButton(props: ComponentProps<typeof PlatformButton>) {
  const { t } = useWorkerOrderText(); return <PlatformButton {...props} label={t(props.label)} />;
}
function Field(props: ComponentProps<typeof PlatformField>) {
  const { t } = useWorkerOrderText(); return <PlatformField {...props} label={t(props.label)} />;
}
type ScanKind = 'material' | 'qolip' | 'input' | 'paintPhoto';
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

export function OrderScreen({ session, apparatusId, apparatus, orderId, preview, queueCursor, initialAction, initialScanQr = '', onClose, onChanged }: Props) {
  const { t, p, locale } = useWorkerOrderText();
  const colors = useWorkerColors();
  const sheetBackground = Platform.OS === 'ios' ? PlatformColor('systemGroupedBackground') : colors.field;
  const sheetCard = Platform.OS === 'ios' ? PlatformColor('secondarySystemGroupedBackground') : colors.surface;
  const closeSheet = useContext(WorkerSheetCloseContext) ?? onClose;
  const [detail, setDetail] = useState<Obj | null>(null);
  const [bootstrap, setBootstrap] = useState<Obj | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
  const [paintImageExpanded, setPaintImageExpanded] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const camera = useRef<CameraView>(null);
  const [permission, askPermission] = useCameraPermissions();
  const [selected, setSelected] = useState('');
  const [kg, setKg] = useState('');
  const [meter, setMeter] = useState('');
  const [bobina, setBobina] = useState('');
  const [waste, setWaste] = useState('');
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
  const [newPaintField, setNewPaintField] = useState('');
  const newPaintFieldValue = useNativeState('');
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
  const isTrainingOrder = orderId.startsWith('training-');
  const operation = apparatus?.operation.trim().toLowerCase() ?? '';
  const directMaterialUse = !!apparatus && apparatus.worker_material_assignment_allowed === true && !isTrainingOrder;
  const loadVersion = useRef(0);
  const actionInFlight = useRef(false);
  const scanInFlight = useRef(false);
  const scanBootstrapUnsupported = useRef(false);
  const recentQuickScan = useRef<{ value: string; at: number } | null>(null);
  const screenMounted = useRef(true);
  const [printerDialogHidden, setPrinterDialogHidden] = useState(false);
  const reportDismissed = useRef<(() => void) | null>(null);
  const printingIdentity = JSON.stringify([sessionReadScope(session), apparatusId, orderId]);
  const latestPrintingIdentity = useRef(printingIdentity);
  useLayoutEffect(() => { latestPrintingIdentity.current = printingIdentity; }, [printingIdentity]);
  const isCurrent = () => screenMounted.current && !!activeSessionToken(session) && latestPrintingIdentity.current === printingIdentity;
  const printerSelector = useWorkerPrinterSelector(isCurrent);
  const initialActionHandled = useRef(false);
  const initialQr = useRef(new WorkerInitialQr(initialScanQr));
  const validateInitialQr = useRef<(qr: string) => void>(() => {});
  useLayoutEffect(() => { validateInitialQr.current = qr => { void onScan(qr, 'input'); }; });
  const workerRole = String(session.profile?.role ?? '').trim();
  const workerRef = String(session.profile?.ref ?? '').trim();
  const draftScope = JSON.stringify([session.baseUrl, workerRole, workerRef, workerRole && workerRef ? '' : session.imageCacheScope, orderId, apparatusId]) + (selected === 'astatka' ? ':astatka' : '');
  const queueEpoch = queueCursor?.epoch;
  const queueRevision = queueCursor?.rev;
  const latestCursor = useRef(queueCursor);
  useEffect(() => { scanBootstrapUnsupported.current = false; }, [session, apparatusId, orderId]);
  useEffect(() => { latestCursor.current = queueCursor; }, [queueCursor]);
  useEffect(() => {
    const mounted = screenMounted;
    mounted.current = true;
    return () => { mounted.current = false; reportDismissed.current?.(); reportDismissed.current = null; };
  }, []);
  useEffect(() => {
    let current = true;
    loadReturnedPaintDraft(draftScope).then(draft => {
      if (!current) return;
      if (draft) { setPaint(draft.values); setPaintDynamic(draft.fields); setPaintUsage(draft.usage); setPaintImageId(draft.imageId); }
      else { setPaint({}); setPaintDynamic({}); setPaintUsage('rasxot'); setPaintImageId(''); }
      setLoadedDraftScope(draftScope);
    }).catch(() => { if (current) { setError('Bo‘yoq hisobotini qurilmadan o‘qib bo‘lmadi.'); setLoadedDraftScope(draftScope); } });
    return () => { current = false; };
  }, [draftScope]);
  useEffect(() => {
    if (loadedDraftScope !== draftScope) return;
    void saveReturnedPaintDraft(draftScope, { values: paint, fields: paintDynamic, usage: paintUsage, imageId: paintImageId })
      .catch(() => { if (screenMounted.current) setError('Bo‘yoq hisobotini qurilmada saqlab bo‘lmadi.'); });
  }, [draftScope, loadedDraftScope, paint, paintDynamic, paintUsage, paintImageId]);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const scope = sessionReadScope(session);
    setLoading(true);
    try {
      let accepted = false;
      for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
        const [snapshot, scan] = await Promise.all([
          workerProductionOrderDetail(session, apparatusId, orderId),
          scanBootstrap(session, { apparatus: apparatusId, orderId, materialBarcodes: materials, automaticQolipConfirmation: true }, scanBootstrapUnsupported),
        ]);
        if (version !== loadVersion.current) return;
        if (scope !== sessionReadScope(session)) { setBootstrap(null); setControlRetired(true); return; }
        const maps = snapshot.maps;
        accepted = Array.isArray(maps) && maps.length === 1 && maps[0]?.map?.id === orderId &&
          (!snapshot.projection || snapshot.projection === 'worker_detail_v1') && typeof snapshot.scope === 'string' && !!snapshot.scope && typeof snapshot.epoch === 'string' && !!snapshot.epoch &&
          Number.isInteger(snapshot.rev) && snapshot.rev >= 0 && snapshot.epoch === scan.control_state?.epoch &&
          scan.control_state?.rev >= snapshot.rev && validOrderControl(scan, apparatusId, orderId, { epoch: queueEpoch, rev: queueRevision });
        if (accepted) { setDetail(snapshot); setBootstrap(scan); setControlRetired(false); }
      }
      if (!accepted) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
    } catch (e) { if (version === loadVersion.current) { setBootstrap(null); setControlRetired(true); setError(e instanceof Error ? e.message : 'Buyurtmani yuklab bo‘lmadi'); } }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, [session, apparatusId, orderId, materials, queueEpoch, queueRevision]);
  useEffect(() => {
    const generation = loadVersion;
    const timer = setTimeout(() => { if (!busy) void load(); }, 0);
    return () => { clearTimeout(timer); generation.current++; };
  }, [load, refresh, busy]);

  const synchronized = !loading && !busy && !controlRetired && validOrderControl(bootstrap, apparatusId, orderId, queueCursor);
  useEffect(() => {
    const timer = setTimeout(() => initialQr.current.run(synchronized, qr => validateInitialQr.current(qr)), 0);
    return () => clearTimeout(timer);
  }, [synchronized]);
  const control: Obj = bootstrap?.control_state?.control ?? {};
  const interaction: Obj = control.interaction ?? {};
  const controlEpoch = bootstrap?.control_state?.epoch, controlRevision = bootstrap?.control_state?.rev;
  const materialReadKey = JSON.stringify([sessionReadScope(session), apparatusId, orderId, controlEpoch, controlRevision, refresh]);
  const intakeCandidates = intakeReadKey === materialReadKey ? intakeCandidatesState : [];
  const intakeLoading = intakeReadKey !== materialReadKey;
  const isActiveOrder = bootstrap?.control_state?.order_control === 'active' && !['frozen', 'freeze_requested'].includes(control.stage_control_state);
  const safeStopRequest = synchronized ? runningFreezeRequest(bootstrap?.control_state, apparatusId) : null;
  const allowed: string[] = synchronized && (isActiveOrder || !!safeStopRequest) && Array.isArray(control.allowed_actions) ? control.allowed_actions : [];
  const order = detail?.maps?.[0]?.map ?? {};
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
  const showPreflightHold = synchronized && isActiveOrder && control.print_preflight_allowed === true && !preflight;
  const showPreflightOutcome = synchronized && isActiveOrder && control.state === 'print_preflight' && preflightInProgress;
  const showPreflightFreeze = synchronized && !!preflightFreezeRequest(bootstrap?.control_state, apparatusId, orderId);
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
    ((preparationVisible && scannerReady && (pendingMaterials || pendingDelivery || pendingMolds || pendingInput)) || pendingIntake);
  useEffect(() => {
    if (showQuickScanner && permission?.status === 'undetermined') void askPermission();
  }, [showQuickScanner, permission?.status, askPermission]);
  const canOpenInitialComplete = allowed.includes('complete');
  const canOpenInitialAstatka = isActiveOrder && (control.stage_work?.astatka_available === true || ['in_progress', 'paused', 'completed'].includes(control.state));
  useEffect(() => {
    if (!initialAction || initialActionHandled.current || !synchronized) return;
    const timer = setTimeout(() => {
      initialActionHandled.current = true;
      if ((initialAction === 'complete' && canOpenInitialComplete) || (initialAction === 'astatka' && canOpenInitialAstatka)) selectProgressAction(initialAction);
      else setError('Buyurtma holati o‘zgardi. Qayta urining.');
    }, 0);
    return () => clearTimeout(timer);
  }, [initialAction, synchronized, canOpenInitialComplete, canOpenInitialAstatka]);
  useEffect(() => {
    if (!controlEpoch || scanningRequired) return;
    let current = true;
    const scope = sessionReadScope(session);
    adminRawMaterialAssignments(session, orderId, apparatusId).then(data => {
      if (!current || !activeSessionToken(session) || scope !== sessionReadScope(session)) return;
      if (!Array.isArray(data)) throw new Error('Homashyolar yuklanmadi.');
      setAttachedMaterials(data.filter((row: Obj) => matchesMaterialAssignment(row, orderId, apparatusId)));
      setAttachedMaterialsError(''); setAttachedReadKey(materialReadKey);
    }).catch(() => { if (current && activeSessionToken(session) && scope === sessionReadScope(session)) { setAttachedMaterialsError('Homashyolar yuklanmadi.'); setAttachedReadKey(materialReadKey); } });
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
    }).catch(() => { if (current && activeSessionToken(session) && scope === sessionReadScope(session)) { setIntakeCandidates([]); setIntakeError('Homashyolar yuklanmadi.'); setIntakeReadKey(materialReadKey); } });
    return () => { current = false; };
  }, [session, apparatusId, orderId, scanningRequired, operation, interaction.material_intake_allowed, controlEpoch, controlRevision, materialReadKey]);

  async function openScanner(kind: ScanKind) {
    const result = permission?.granted ? permission : await askPermission();
    if (!result.granted) { setError('QR skanerlash uchun kamera ruxsati kerak.'); return; }
    setCameraReady(false);
    setScanner(kind);
  }
  async function uploadPaintPhoto(uri: string, mime: string, fileName: string) {
      const blob = await (await fetch(uri)).blob();
      if (!blob.size || blob.size > 6 * 1024 * 1024) throw new Error('Rasm hajmi 6 MB dan oshmasligi kerak.');
      const params = new URLSearchParams({ order_id: orderId, apparatus: apparatusId });
      const response = await authorizedFetch(session, `/v1/mobile/returned-paint/images?${params}`, { method: 'POST', headers: { 'Content-Type': mime, 'x-file-name': fileName }, body: blob });
      if (!response.ok) throw new Error('Bo‘yoq rasmi yuklanmadi.');
      const payload = await response.json();
      const id = typeof payload.image?.image_id === 'string' ? payload.image.image_id.trim() : '';
      if (!id) throw new Error('Rasm javobi noto‘g‘ri.');
      if (paintImageId && paintImageId !== id) void authorizedFetch(session, `/v1/mobile/returned-paint/images?id=${encodeURIComponent(paintImageId)}`, { method: 'DELETE' }).catch(() => {});
      setPaintImageId(id); setScanner(null); setSuccess('Bo‘yoq rasmi yuklandi.');
  }
  async function takePaintPhoto() {
    if (photoBusy || !cameraReady || !camera.current) return;
    setPhotoBusy(true); setError('');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) throw new Error('Rasm olinmadi.');
      await uploadPaintPhoto(photo.uri, 'image/jpeg', 'returned-paint.jpg');
    } catch (e) { setError(e instanceof Error ? e.message : 'Rasm yuklanmadi.'); setScanner(null); }
    finally { setPhotoBusy(false); }
  }
  async function pickPaintPhoto() {
    if (photoBusy) return;
    setPhotoBusy(true); setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result.canceled) return;
      const photo = result.assets[0];
      const mime = photo.mimeType?.toLowerCase() ?? 'image/jpeg';
      const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
      if (!photo.uri || !extensions[mime]) throw new Error('Rasm formati qo‘llab-quvvatlanmaydi.');
      await uploadPaintPhoto(photo.uri, mime, `returned-paint.${extensions[mime]}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Rasm yuklanmadi.'); }
    finally { setPhotoBusy(false); }
  }
  async function removePaintPhoto() {
    if (!paintImageId || photoBusy) return;
    setPhotoBusy(true);
    try {
      const response = await authorizedFetch(session, `/v1/mobile/returned-paint/images?id=${encodeURIComponent(paintImageId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Rasmni olib tashlab bo‘lmadi.');
      setPaintImageId('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Rasmni olib tashlab bo‘lmadi.'); }
    finally { setPhotoBusy(false); }
  }
  async function onScan(value: string, kind: ScanKind | null = scanner) {
    if (kind === 'input') {
      const qr = workerQrPayload(value);
      setScanner(null);
      if (!qr || !synchronized || scanInFlight.current) return;
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
    if (scanInFlight.current || !synchronized) return;
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
    if (!delivery || !deliveryChoice || scanInFlight.current || !synchronized) return;
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
    if (!value || !showQuickScanner || scanInFlight.current) return;
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
    if (!synchronized || (isAstatka ? !canOpenInitialAstatka : !allowed.includes(action)) || actionInFlight.current ||
        (isAstatka && loadedDraftScope !== draftScope)) return;
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
      description: action === 'pause' ? freezeNote : completionNote, kg, meter, bobina, waste });
    const { safeStopIssue, completionIssue, needsOutput } = completion;
    if (completion.needsIssueOrOutput) { setDescriptionRevealed(true); setError(p('worker.freeze.safe_stop.output_or_issue_required')); return; }
    const fullReport = !completionIssue && !safeStopIssue && (isAstatka || (action === 'complete' && (control.complete_requires_full_report !== false || !!closingOutputId)));
    const fields = [kg, meter, bobina];
    if (needsOutput && fields.some(x => !x.trim() || !Number.isFinite(numberValue(x)) || numberValue(x) <= 0)) { setDescriptionRevealed(true); setError('Metr, vazn va bobina uchun noldan katta qiymatlarni kiriting.'); return; }
    const returnedPaintItems = returnedPaintItemsFromDraft(paint, paintDynamic);
    const imageOnly = !!paintImageId && returnedPaintItems.length === 0;
    if (fullReport && (!waste.trim() || !Number.isFinite(numberValue(waste)) || numberValue(waste) < 0 || (!closingOutputId && !isAstatka && numberValue(waste) === 0) || (!imageOnly && ['rasxot','astatka'].some(usage => {
      const values = returnedPaintItems.filter(item => item.usage === usage).flatMap(item => Object.values(item.values));
      return values.length < 3 || values.some(value => !Number.isFinite(numberValue(value)) || numberValue(value) < 0);
    })))) { setDescriptionRevealed(true); setError('Chiqindi va bo‘yoq rasmini yoki har bir bo‘lim uchun kamida uchta to‘g‘ri qiymatni kiriting.'); return; }
    actionInFlight.current = true;
    loadVersion.current++;
    setControlRetired(true); setBusy(true); setError(''); setSuccess('');
    try {
      const printer = needsOutput ? await selectOutputPrinter() : null;
      if (!screenMounted.current) return;
      if (!validOrderControl(bootstrap, apparatusId, orderId, latestCursor.current)) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
      const body: Obj = { apparatus: apparatusId, order_id: orderId, action: completionIssue ? 'freeze' : action, include_control: true };
      if (completionIssue) Object.assign(body, { freeze_with_issue: true, issue_note: completion.note });
      else if (completion.note && !safeStopIssue) body.completion_request_note = completion.note;
      if (materials.length && materialScan) body.material_barcodes = materials;
      if (effectiveQolips.length && isStarting && !automaticQolip) body.qolip_codes = effectiveQolips;
      if (isStarting && automaticConfirmation) body.qolip_confirmation = automaticConfirmation;
      if (inputRequired && inputBatch) Object.assign(body, { qr_payload: inputBatch.qr, progress_batch_id: inputBatch.id });
      if (action === 'start' && validPreflight && preflight.status === 'passed') body.print_preflight_hold_id = preflight.hold_id;
      if (needsOutput && printer) Object.assign(body, { finished_goods_kg: numberValue(kg), finished_goods_meter: numberValue(meter), bobina_kg: numberValue(bobina), uom: 'm', ...workerPrinterFields(printer) });
      if (closingOutputId) Object.assign(body, { complete_without_output: true, progress_batch_id: closingOutputId });
      if (safeStopRequest && action === 'pause') body.freeze_request_id = safeStopRequest;
      if (safeStopIssue) body.completion_request_note = completion.note;
      if (fullReport) {
        const returnInk = returnedPaintItems.filter(item => item.usage === 'astatka').flatMap(item => Object.values(item.values)).reduce((sum, value) => sum + numberValue(value), 0);
        Object.assign(body, { total_waste: numberValue(waste), full_completion_report_required: true, returned_paint_items: returnedPaintItems });
        if (paintImageId) body.returned_paint_image_id = paintImageId;
        if (returnedPaintItems.length && (returnInk > 0 || closingOutputId)) body.return_ink_kg = returnInk;
      }
      if (preview?.customer || order.customer_name) body.customer_name = preview?.customer || order.customer_name;
      const result = isAstatka
        ? { report: await adminBosmaAstatkaReport(session, { apparatus: apparatusId, order_id: orderId, total_waste: numberValue(waste), returned_paint_items: returnedPaintItems, returned_paint_image_id: paintImageId, description: astatkaNote }) }
        : await adminApparatusQueueActionResult(session, body);
      if (!isCurrent()) return;
      if (result.completion_request) { setSelected(''); setSuccess(p('worker.notice.completion_request_sent')); return; }
      let printFailed = false;
      if (printer) {
        try { await printWorkerJobs(result, printer, isCurrent); }
        catch { printFailed = true; }
      }
      if (!isCurrent()) return;
      selectProgressAction(''); setMaterials([]); setQolips([]); setQolipsReset(false); setInputBatch(null); setFreezeNote(''); setCompletionNote(''); setKg(''); setMeter(''); setBobina('');
      if (action === 'complete' || isAstatka) {
        void saveReturnedPaintDraft(draftScope, { values: {}, fields: {}, usage: 'rasxot', imageId: '' }).catch(() => {});
        setWaste(''); setAstatkaNote(''); setPaintImageId(''); setPaint({}); setPaintColor(''); setPaintDynamic({}); setPaintUsage('rasxot'); setPaintEditor(false);
      }
      const qr = result.progress_batch?.qr_payload;
      if (printFailed) setError('Amal bajarildi, lekin rulon yorlig‘i chop etilmadi.');
      else setSuccess(isAstatka ? 'Order astatkasi qayd qilindi.' : qr ? `Amal bajarildi. Rulon QR: ${qr}` : 'Amal bajarildi.');
      setSelectedQolipSet('');
      if (initialAction === action && !printFailed) closeSheet();
    } catch (e) { if (isCurrent() && !(e instanceof WorkerPrintCancelled)) setError(e instanceof Error ? e.message : 'Amal bajarilmadi'); }
    finally { actionInFlight.current = false; onChanged(); if (screenMounted.current) { setRefresh(value => value + 1); setBusy(false); } }
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
    if (!synchronized || actionInFlight.current || (action === 'hold' ? !showPreflightHold : !showPreflightOutcome)) return;
    const holdId = action === 'hold' ? `print-preflight:${orderId}:${apparatusId}:${Date.now()}-${Math.random().toString(36).slice(2)}` : preflight.hold_id;
    actionInFlight.current = true;
    loadVersion.current++;
    setControlRetired(true); setBusy(true); setError(''); setSuccess('');
    try {
      await adminPrintPreflight(session, { apparatus: apparatusId, order_id: orderId, action, hold_id: holdId,
        ...(action === 'hold' ? { idempotency_key: holdId } : { expected_revision: preflight.revision }) });
      if (!screenMounted.current) return;
      setSuccess(action === 'hold' ? 'Rang chiqarish boshlandi.' : action === 'passed' ? 'Rang chiqdi.' : 'Rang chiqmagani qayd etildi.');
    } catch (e) { if (screenMounted.current) setError(e instanceof Error ? e.message : 'Amal bajarilmadi'); }
    finally { actionInFlight.current = false; onChanged(); if (screenMounted.current) { setRefresh(value => value + 1); setBusy(false); } }
  }
  async function freezePreflight() {
    if (!showPreflightFreeze || actionInFlight.current) return;
    const initialRequest = preflightFreezeRequest(bootstrap?.control_state, apparatusId, orderId);
    actionInFlight.current = true;
    loadVersion.current++;
    setControlRetired(true); setBusy(true); setError(''); setSuccess('');
    try {
      const current = await scanBootstrap(session, { apparatus: apparatusId, orderId, includeSections: false,
        automaticQolipConfirmation: true }, scanBootstrapUnsupported);
      if (!screenMounted.current) return;
      const requestId = preflightFreezeRequest(current.control_state, apparatusId, orderId);
      if (!validOrderControl(current, apparatusId, orderId, latestCursor.current) || !requestId || requestId !== initialRequest) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
      await adminApparatusQueueActionResult(session, { apparatus: apparatusId, order_id: orderId, action: 'freeze', freeze_request_id: requestId, include_control: true });
      if (!screenMounted.current) return;
      setSuccess('Buyurtma to‘xtatildi.');
    } catch (e) { if (screenMounted.current) setError(e instanceof Error ? e.message : 'Amal bajarilmadi'); }
    finally { actionInFlight.current = false; onChanged(); if (screenMounted.current) { setRefresh(value => value + 1); setBusy(false); } }
  }
  const code = String(preview?.code || order.order_number || order.code || orderId);
  const closingOutput = selected === 'complete' && typeof control.closing_output_batch_id === 'string' && !!control.closing_output_batch_id.trim();
  const showFullReport = selected === 'astatka' || (selected === 'complete' && (control.complete_requires_full_report !== false || closingOutput));
  const integratedLaminationReport = usesIntegratedLaminationReport({ operation, action: selected, training: isTrainingOrder,
    testMode: session.token === 'test-mode-token', fullReport: control.complete_requires_full_report !== false,
    freezeRequested: bootstrap?.control_state?.order_control === 'freeze_requested' || control.stage_control_state === 'freeze_requested' || !!runningFreezeRequest(bootstrap?.control_state, apparatusId) });
  const rezkaAstatkaReport = operation === 'cut' && selected === 'astatka' && !isTrainingOrder && session.token !== 'test-mode-token';
  const rows: Obj[] | null = scanningRequired
    ? (Array.isArray(materialRequirements.assignments) ? materialRequirements.assignments.filter((row: Obj) => matchesMaterialAssignment(row, orderId, apparatusId)) : null)
    : attachedReadKey === materialReadKey ? attachedMaterials : null;
  const requiredMaterialCount = Number(materialRequirements.required_scan_count ?? 0);
  const matchedMaterialCount = Number(materialRequirements.matched_scan_count ?? materials.length);
  // V2 keeps assigned material information visible after start, pause and completion.
  const showMaterials = !!bootstrap;
  const showIntakeCandidates = synchronized && !scanningRequired && operation !== 'cut' && interaction.material_intake_allowed === true;
  const showLinkRequests = !!apparatus && !directMaterialUse && scanningRequired && !isTrainingOrder;
  const allowNewMaterialRequests = sections.materials?.status === 'ready' && materialRequirements.assignments_satisfied === false;
  const canSendOrderAlert = operation === 'print' && synchronized && bootstrap?.control_state?.order_control === 'active' && !isTrainingOrder &&
    (allowed.includes('start') || !!String(interaction.blocking_reason_code ?? '').trim() || showPreflightHold || showPreflightOutcome);
  const materialsError = scanningRequired && sections.materials?.status === 'error' ? String(sections.materials?.error || 'Homashyolar yuklanmadi.') : attachedReadKey === materialReadKey ? attachedMaterialsError : '';
  const materialLoading = scanningRequired ? sections.materials?.status === 'loading' || rows === null : rows === null && !materialsError;
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
  const showMolds = (preparationVisible || ['fresh_start_blocked', 'requeued_waiting', 'waiting_previous_stage'].includes(interaction.mode)) && qolipRequired;
  const showOutputProgress = !!detail && ['pause', 'complete', 'resume'].some(action => allowed.includes(action));
  function cancelProgressDialog() {
    if (busy || photoBusy) return;
    if (paintEditor) {
      if (Platform.OS === 'android') paintSheet.close();
      else if (paintColor) setPaintColor('');
      else setPaintEditor(false);
      return;
    }
    const closeInitial = !!initialAction && selected === initialAction;
    selectProgressAction('');
    if (closeInitial) closeSheet();
  }
  function addPaintField(target: string) {
    const label = newPaintField.trim();
    if (!label) return;
    const key = `${paintUsage}:${target}`;
    const existing = paintDynamic[key] ?? [];
    if (existing.some(value => value.toLowerCase() === label.toLowerCase())) { setError('Bu maydon allaqachon mavjud.'); return; }
    setPaintDynamic(old => ({ ...old, [key]: [...existing, label] }));
    setNewPaintField(''); newPaintFieldValue.set(''); setError('');
  }

  const inlinePaint = Platform.OS !== 'android' && paintEditor;
  const paintCamera = <View style={styles.cameraScreen}><CameraView ref={camera} style={styles.camera} mode="picture" onCameraReady={() => setCameraReady(true)} /><Text style={styles.cameraText}>{t("Bo‘yoq hisobotini suratga oling")}</Text><NativeButton label={t(photoBusy ? 'Yuklanmoqda…' : 'Suratga olish')} disabled={photoBusy || !cameraReady} variant="filled" onPress={() => { void takePaintPhoto(); }} /><NativeButton label={t("Bekor qilish")} disabled={photoBusy} onPress={() => setScanner(null)} /></View>;
  const paintToken = paintEditor ? activeSessionToken(session) : null;
  const paintPhoto = paintImageId && paintToken ? {
    uri: new URL(`/v1/mobile/returned-paint/images/view?id=${encodeURIComponent(paintImageId)}`, session.baseUrl).toString(),
    headers: { Authorization: `Bearer ${paintToken}` },
    cacheKey: JSON.stringify(['returned-paint', session.imageCacheScope, paintImageId]),
  } : null;
  const pickPaintImage = () => Alert.alert(paintImageId ? 'Rasmni almashtirish' : 'Rasm qo‘shish', '', [
    { text: 'Kamera', onPress: () => { void openScanner('paintPhoto'); } },
    { text: 'Galereya', onPress: () => { void pickPaintPhoto(); } },
    { text: 'Bekor qilish', style: 'cancel' },
  ]);
  const paintBody = paintEditor ? <>
          {paintPhoto && <>
            <Pressable disabled={inlinePaint} accessibilityRole="button" accessibilityLabel="Rasmni to‘liq ko‘rish" onPress={() => setPaintImageExpanded(true)}>
              <Image source={paintPhoto} style={styles.paintPreview} contentFit="contain" />
            </Pressable>
            <View style={styles.actionRow}>
              <View style={styles.flex}><NativeButton label={t("Almashtirish")} disabled={photoBusy} onPress={pickPaintImage} /></View>
              <View style={styles.flex}><NativeButton label={t("Olib tashlash")} disabled={photoBusy} onPress={() => { void removePaintPhoto(); }} /></View>
            </View>
          </>}
          {inlinePaint && !paintPhoto && <NativeButton label={t("Rasm qo‘shish")} disabled={photoBusy} onPress={pickPaintImage} />}
          {!paintColor && <WorkerPaintPalette usage={paintUsage} onUsage={setPaintUsage} onSelect={setPaintColor} />}
          {!!paintColor && <View style={styles.sectionGroup}>
            {[...(paintOptions.find(option => option.name === paintColor)?.fields ?? []), ...(paintDynamic[`${paintUsage}:${paintColor}`] ?? [])].map(label => <Field key={`${paintUsage}:${paintColor}:${label}`} label={label} initialValue={paint[`${paintUsage}:${paintColor}:${label}`] ?? ''} keyboardType="decimal-pad" onChangeText={value => setPaint(old => ({ ...old, [`${paintUsage}:${paintColor}:${label}`]: value }))} />)}
            {paintColor === 'Pantone' && (paintDynamic[`${paintUsage}:Pantone Mix`] ?? []).map(label => <Field key={`${paintUsage}:Pantone Mix:${label}`} label={label} initialValue={paint[`${paintUsage}:Pantone Mix:${label}`] ?? ''} keyboardType="decimal-pad" onChangeText={value => setPaint(old => ({ ...old, [`${paintUsage}:Pantone Mix:${label}`]: value }))} />)}
            {!['Lak', 'Spirtlar'].includes(paintColor) && <>
              <Host matchContents={{ vertical: true }} style={styles.host}><NativeInput value={newPaintFieldValue} placeholder={t("Maydon nomi")} onChangeText={setNewPaintField} /></Host>
              <NativeButton label={t(paintColor === 'Mix' ? 'Mix+' : 'Pantone+')} onPress={() => addPaintField(paintColor)} />
              {paintColor === 'Pantone' && <NativeButton label={t("Mix+")} onPress={() => addPaintField('Pantone Mix')} />}
            </>}
          </View>}
        </> : null;
  const paintContent = paintEditor && !inlinePaint ? (
    scanner === 'paintPhoto' ? paintCamera : <View style={styles.screen}>
      <View style={styles.paintHeader}>
        <WorkerIconButton icon="back" label={t("Orqaga")} onPress={() => {
          if (photoBusy) return;
          if (paintImageExpanded) setPaintImageExpanded(false);
          else if (paintColor) setPaintColor('');
          else paintSheet.close();
        }} />
        <Text style={[styles.expansionTitle, { color: colors.text }]}>{t("Qaytarilgan bo‘yoq")}</Text>
        <WorkerIconButton icon="photo" label={t(paintPhoto ? 'Rasmni almashtirish' : 'Rasm qo‘shish')}
          onPress={() => { if (!photoBusy) pickPaintImage(); }} />
      </View>
      {paintImageExpanded && paintPhoto ? <Image source={paintPhoto} style={styles.flex} contentFit="contain" /> :
      <ScrollView nestedScrollEnabled contentContainerStyle={styles.paintContent} keyboardShouldPersistTaps="handled">
        {!!error && <Text style={styles.error}>{t(error)}</Text>}
        {paintBody}
      </ScrollView>}
    </View>
  ) : null;
  useLayoutEffect(() => {
    if (!paintContent) return;
    if (paintSheet.isOpen()) paintSheet.update(paintContent);
    else paintSheet.open(paintContent, { dismissible: true, onDismiss: () => {
      setPaintEditor(false);
      setPaintColor('');
      setPaintImageExpanded(false);
      setScanner(null);
      setError('');
    } });
  });

  if (inlinePaint && scanner === 'paintPhoto') return paintCamera;
  if (scanner && scanner !== 'paintPhoto') return <View style={styles.cameraScreen}><CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix', 'code128', 'ean13', 'ean8'] }} onBarcodeScanned={({ data }: { data: string }) => { void onScan(data); }} /><Text style={styles.cameraText}>{t(scanner === 'material' ? 'Material kodini skanerlang' : scanner === 'qolip' ? 'Qolip kodini skanerlang' : 'Kiruvchi rulonni skanerlang')}</Text><NativeButton label={t("Bekor qilish")} onPress={() => setScanner(null)} /></View>;
  const imageId = String(order.image_id || preview?.imageId || '');
  if (imageOpen) return <WorkerOrderImage session={session} orderId={orderId} imageId={imageId} onClose={() => setImageOpen(false)} />;

  return <View style={[styles.screen, { backgroundColor: sheetBackground }]}><ScrollView nestedScrollEnabled contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, Platform.OS === 'ios' && iosStyles.content]} keyboardShouldPersistTaps="handled">
    <WorkerOrderIdentity session={session} orderId={orderId} imageId={imageId} code={code} title={String(order.title || preview?.title || '')}
      onScannedWips={canOpenScannedWips ? () => setScannedWipsStage(scannedStage) : undefined}
      onOpenImage={() => setImageOpen(true)} onClose={closeSheet} />
    {showQuickScanner && <View style={[styles.scannerPanel, { backgroundColor: sheetCard }]}>
      {permission?.granted ? <CameraView style={styles.quickCamera} barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix', 'code128', 'ean13', 'ean8'] }} onBarcodeScanned={({ data }: { data: string }) => { void quickScan(data); }} /> :
        <NativeButton label={t("Kameraga ruxsat berish")} onPress={() => { void askPermission(); }} />}
      <Text style={[styles.scannerText, { color: colors.muted }]}>{t("Qolip yoki homashyo kodidan bittasini kamera markaziga olib keling")}</Text>
      {interaction.opening_wip_mode !== 'scan_required' && <>
        <View style={styles.manualToggle}><WorkerIconButton icon="edit" label={t("Kodni qo‘lda kiritish")} onPress={() => setManualScanVisible(value => !value)} /></View>
        {manualScanVisible && <View style={styles.manualRow}>
          <View style={styles.flex}><Host matchContents={{ vertical: true }} style={styles.host}><NativeInput value={manualScanValue} placeholder={t("QR / barcode")} onChangeText={setManualScan} autoCapitalize="none" /></Host></View>
          <WorkerIconButton icon="check" label={t("Kodni tekshirish")} onPress={() => { void quickScan(manualScan); manualScanValue.set(''); setManualScan(''); }} />
        </View>}
      </>}
    </View>}
    <View style={[styles.card, { backgroundColor: sheetCard }, Platform.OS === 'ios' && iosStyles.actionCard]}>
    {loading && <ActivityIndicator color={colors.icon} />}
    {synchronized && control.temporarily_paused === true && <Text style={[styles.detailText, { color: colors.muted }]}>{t("Vaqtincha yechilgan")}</Text>}
    {bootstrap?.control_state?.order_control === 'frozen' && <Text style={styles.error}>{t("Buyurtma muzlatilgan. Ishni davom ettirish uchun, iltimos, adminga xabar bering va buyurtmani muzdan ochishini so‘rang.")}</Text>}
    {!!error && !selected && !delivery && <Text style={styles.error}>{t(error)}</Text>}
    {!!success && <Text style={styles.success}>{t(success)}</Text>}
    {!!bootstrap && <>
      {showIntakeCandidates && <View style={styles.sectionGroup}>
        <Expansion title={p(intakeLoading || intakeError || intakeCandidates.length ? 'worker.materials.pending' : 'worker.materials.pending.empty')}
          count={intakeLoading ? '..' : intakeCandidates.length ? materialCount(intakeCandidates.length) : ''} expanded={intakeExpanded}
          onPress={() => { if (intakeLoading || intakeError || intakeCandidates.length) setIntakeExpanded(value => !value); }} />
        {intakeExpanded && <>
          {intakeLoading && <Text style={[styles.muted, { color: colors.muted }]}>{t('Yuklanmoqda...')}</Text>}
          {!!intakeError && <Text style={styles.error}>{t(intakeError)}</Text>}
          {!intakeLoading && !intakeError && <WorkerMaterialList rows={intakeCandidates} scanned={[]} onLongPress={openMaterialQr} showBalances={false} />}
        </>}
      </View>}
      {showMaterials && <View style={styles.sectionGroup}>
        <Expansion title={t(scanningRequired && rows?.length && rows.every(row => row.execution_status === 'awaiting_delivery') ? 'Apparat oldiga homashyo olib kelinmagan' : p(rows?.length || materialLoading || materialsError || showLinkRequests ? 'worker.materials.attached' : 'worker.materials.attached.empty'))}
          count={materialLoading ? '..' : rows?.length ? materialCount(rows.length) : ''} expanded={materialsExpanded}
          onPress={() => { if (rows?.length || materialLoading || materialsError || showLinkRequests) setMaterialsExpanded(value => !value); }} />
        {materialsExpanded && <>
          {materialLoading && <Text style={[styles.muted, { color: colors.muted }]}>{t('Yuklanmoqda...')}</Text>}
          {!!materialsError && <Text style={styles.error}>{t(materialsError)}</Text>}
          {!materialLoading && !materialsError && !!rows?.length && <WorkerMaterialList rows={rows} scanned={materials} onLongPress={openMaterialQr} />}
        </>}
        {canSendOrderAlert && scanningRequired && !materialLoading && !materialsError && rows?.length === 0 && <WorkerOrderAlertButton session={session} orderId={orderId} apparatusId={apparatusId} kind="rawMaterial" enabled={!busy} />}
        {scanningRequired && requiredMaterialCount > 0 && <View style={styles.expansion}><Text style={[styles.expansionTitle, { color: colors.text }]}>{t('Homashyo QR tasdiqlari')}</Text><Text style={[styles.muted, { color: colors.muted }]}>{matchedMaterialCount}/{requiredMaterialCount}</Text></View>}
        {scanningRequired && materialState.unavailable && materialState.reason !== 'Apparat oldiga homashyo olib kelinmagan' && <Text style={styles.error}>{t(materialState.reason)}</Text>}
        {showLinkRequests && <View style={!scanningRequired && !materialsExpanded ? { display: 'none' } : undefined}>
          <MaterialLinkRequestPanel session={session} orderId={orderId} apparatusId={apparatusId} actionsEnabled={synchronized} allowNewRequests={allowNewMaterialRequests} onChanged={materialsChanged} />
        </View>}
        {directMaterialUse && <WorkerMaterialUsePanel session={session} orderId={orderId} apparatusId={apparatusId} actionsEnabled={synchronized} onChanged={materialsChanged} />}
      </View>}
      {showMolds && <View style={styles.sectionGroup}>
        <Expansion title={t(moldSets.size > 1 ? 'Muqobil qoliplar' : 'Qoliplar')} count={`${automaticQolip && automaticConfirmation ? requiredQolips.length : effectiveQolips.length}/${requiredQolips.length} ta`} expanded={qolipsExpanded} onPress={() => setQolipsExpanded(value => !value)} />
        {automaticQolip && automaticSets.length > 1 && automaticSets.map(set => <NativeButton key={String(set.set_id)} label={String(set.set_id)} disabled={!synchronized} variant={selectedQolipSet === set.set_id ? 'filled' : 'outlined'} onPress={() => setSelectedQolipSet(String(set.set_id))} />)}
        {canSendOrderAlert && sections.qolips?.status === 'ready' && requiredQolips.length === 0 && <WorkerOrderAlertButton session={session} orderId={orderId} apparatusId={apparatusId} kind="qolip" enabled={!busy} />}
        {qolipsExpanded && requiredQolips.map((mold, index) => <View key={String(mold.qolip_code || index)} style={[styles.detailRow, { backgroundColor: colors.field }]}><Text style={[styles.detailText, { color: colors.text }]}>{String(mold.qolip_code ?? '')}{t(mold.color ? ` · ${mold.color}` : '')}{t(scannedMolds.has(normalizeCode(mold.qolip_code)) ? ' ✓' : '')}</Text></View>)}
        {!automaticQolip && moldSets.size > 1 && effectiveQolips.length > 0 && <NativeButton label={t("Komplektni almashtirish")} variant="text" onPress={() => { setQolipsReset(true); setQolips([]); }} />}
        {sections.qolips?.status === 'error' && <Text style={styles.error}>{t("Qoliplar yuklanmadi")}</Text>}
      </View>}
      {preparationVisible && previousRequired && <View style={[styles.detailRow, { backgroundColor: colors.field }]}>
        <Text style={[styles.expansionTitle, { color: colors.text }]}>{t(inputBatch ? (interaction.opening_wip_mode === 'scan_required' ? 'Opening WIP ruloni tasdiqlandi' : 'Oldingi bosqich tasdiqlandi') : (interaction.opening_wip_mode === 'scan_required' ? 'Opening WIP QR ni skan qiling' : 'Oldingi bosqich QR'))}</Text>
        {!!inputBatch && <Text style={[styles.small, { color: colors.muted }]}>{inputBatch.qr}</Text>}
      </View>}
      <View style={styles.sectionGroup}>
        {showIntakeCandidates && !directMaterialUse && intakeCandidates.length > 0 && <NativeButton label={t(intakeMode ? 'Scannerni yopish' : 'Homashyo ulash')} height={52} disabled={!synchronized || deliveryBusy} onPress={() => setIntakeMode(value => !value)} />}
        {showPreflightFreeze && <NativeButton label={t("Rang chiqarishni to‘xtatib muzlatish")} height={58} variant="filled" onPress={() => { void freezePreflight(); }} />}
        {showPreflightOutcome && <View style={[styles.actionRow, Platform.OS === 'ios' && iosStyles.outcomeActions]}>
          <View style={styles.flex}>{Platform.OS === 'ios' ? <WorkerPreflightButton label={t("Rang chiqdi")} onPress={() => { void runPreflight('passed'); }} /> : <NativeButton label={t("Rang chiqdi")} height={58} variant="filled" icon={{ android: 'check_circle', ios: 'checkmark.circle' }} onPress={() => { void runPreflight('passed'); }} />}</View>
          <View style={styles.flex}>{Platform.OS === 'ios' ? <WorkerPreflightButton label={t("Chiqmadi")} outlined onPress={() => { void runPreflight('failed'); }} /> : <NativeButton label={t("Chiqmadi")} height={58} icon={{ android: 'cancel', ios: 'xmark.circle' }} onPress={() => { void runPreflight('failed'); }} />}</View>
        </View>}
        {showPreflightHold && <WorkerPreflightButton onPress={() => { void runPreflight('hold'); }} />}
        {!showPreflightHold && !showPreflightOutcome && allowed.includes('start') && <NativeButton label={t("Boshlash")} height={58} variant="filled" icon={{ android: 'play_arrow', ios: 'play.fill' }} largeLabel disabled={!startReady || busy} onPress={() => { void submit('start'); }} />}
        {showOutputProgress && <WorkerOutputProgress session={session} orderId={orderId} apparatusId={apparatusId}
          stageId={String(control.stage_node_id ?? '')} map={order} operation={operation} outputRevision={`${controlEpoch}:${controlRevision}:${refresh}`} />}
        {(allowed.includes('pause') || allowed.includes('complete')) && <WorkerOrderActionGroup>
          {allowed.includes('pause') && <NativeButton label={t(safeStopRequest ? 'Rulonni yechib muzlatish' : 'Rulonni yechish')} height={58} disabled={busy} onPress={() => { setError(''); selectProgressAction('pause'); }} />}
          {allowed.includes('complete') && <NativeButton label={t("Tugatish")} height={58} variant="filled" disabled={busy} onPress={() => { setError(''); selectProgressAction('complete'); }} />}
        </WorkerOrderActionGroup>}
        {allowed.includes('resume') && <NativeButton label={t("Davom ettirish")} height={58} variant="filled" icon={{ android: 'play_arrow', ios: 'play.fill' }} disabled={!resumeReady || busy} onPress={() => { void submit('resume'); }} />}
        {synchronized && !showPreflightHold && !showPreflightOutcome && !showPreflightFreeze && !allowed.length && <Text style={[styles.muted, { color: colors.muted }]}>{t(interaction.mode === 'waiting_previous_stage' ? 'Oldingi bosqich tugallanguncha kutilmoqda' : interaction.mode === 'requeued_waiting' ? 'Buyurtma apparat navbatidagi o‘z vaqtini kutmoqda' : 'Hozir bajarish mumkin bo‘lgan amal yo‘q.')}</Text>}
        {!synchronized && <Text style={[styles.muted, { color: colors.muted }]}>{t("Buyurtma holati tekshirilmoqda…")}</Text>}
      </View>
    </>}
    {!loading && !bootstrap && <NativeButton label={t("Qayta urinish")} onPress={() => { setError(''); void load(); }} disabled={busy} />}
    </View>
    <WorkerOrderOverview session={session} orderId={orderId} code={code} imageId={imageId}
      title={String(order.title || preview?.title || '')}
      detail={detail ? workerOrderDetailFromSnapshot(detail, orderId) : null} />
  </ScrollView>
    <WorkerFormDialog visible={!!selected && !printerDialogHidden && !integratedLaminationReport && !rezkaAstatkaReport} onDismiss={() => { reportDismissed.current?.(); reportDismissed.current = null; }} title={t(inlinePaint ? 'Qaytarilgan bo‘yoq' : selected === 'astatka' ? 'Astatka hisobotini topshirish' : safeStopRequest && selected === 'pause' ? 'Rulonni yechib muzlatish' : selected === 'pause' ? 'Pauza miqdori' : 'Tugatish miqdori')}
      cancelLabel={t(inlinePaint ? 'Orqaga' : 'Bekor qilish')} onCancel={cancelProgressDialog} cancelDisabled={busy || photoBusy}
      preventDismiss
      confirmLabel={t(inlinePaint ? 'Tayyor' : busy ? 'Yuborilmoqda…' : 'Tasdiqlash')}
      confirmDisabled={busy || photoBusy || (!inlinePaint && (!synchronized || (selected === 'astatka' ? !canOpenInitialAstatka : !allowed.includes(selected)) || (showFullReport && loadedDraftScope !== draftScope)))}
      onConfirm={() => { if (inlinePaint) { setError(''); setPaintEditor(false); } else void submit(selected); }}>
        {!!error && <Text style={styles.error}>{t(error)}</Text>}
        {inlinePaint ? paintBody : <>
        <Text style={[styles.muted, { color: colors.muted }]}>{t(selected === 'astatka' ? 'Bu faqat order astatkasini qayd qiladi. Pauza va Tugatish holati o‘zgarmaydi.' : safeStopRequest && selected === 'pause' ? 'Sog‘lom rulon bo‘lsa barcha miqdorlarni kiriting. Ishlab chiqarish imkonsiz bo‘lsa miqdorlarni bo‘sh qoldirib, faqat muammo izohini yozing.' : showFullReport ? '0 yoki to‘liq bo‘lmagan hisobot uchun izoh yozing' : 'Joriy miqdorni kiriting')}</Text>
        {selected === 'pause' && safeStopRequest && descriptionRevealed && <Field label={p('worker.freeze.safe_stop.issue_note')} initialValue={freezeNote} onChangeText={setFreezeNote} />}
        {['pause','roll_complete','complete'].includes(selected) && !closingOutput && <><Text style={[styles.label, { color: colors.muted, textAlign: 'center' }]}>{p('worker.progress.qty.standard')}</Text><Field label={`${p('worker.daily.field.roll')}, ${p('worker.progress.qty.unit.kg')}`} initialValue={bobina} keyboardType="decimal-pad" onChangeText={setBobina} /><Text style={[styles.label, { color: colors.muted, textAlign: 'center' }]}>{p('worker.progress.qty.finished_goods')}</Text><Field label={`${p('worker.daily.field.length')}, ${p('worker.progress.qty.unit.meter')}`} initialValue={meter} keyboardType="decimal-pad" onChangeText={setMeter} /><Field label={`${p('worker.daily.field.weight')}, ${p('worker.progress.qty.unit.kg')}`} initialValue={kg} keyboardType="decimal-pad" onChangeText={setKg} /></>}
        {showFullReport && <><Text style={[styles.label, { color: colors.muted, textAlign: 'center' }]}>{p('worker.progress.qty.returned_paint_and_waste')}</Text><Field label={`${p('worker.daily.field.total_waste')}, ${p('worker.progress.qty.unit.kg')}`} initialValue={waste} keyboardType="decimal-pad" onChangeText={setWaste} /><NativeButton label={p('worker.daily.field.returned_ink')} variant="filled" disabled={photoBusy || loadedDraftScope !== draftScope} onPress={() => { setError(''); setPaintEditor(true); }} /></>}
        {selected === 'astatka' && <Field label={p('worker.progress.qty.optional_note')} initialValue={astatkaNote} onChangeText={setAstatkaNote} />}
        {selected === 'complete' && descriptionRevealed && <Field label={p(closingOutput ? 'worker.progress.qty.optional_note' : 'worker.progress.qty.reason')} initialValue={completionNote} onChangeText={setCompletionNote} />}
        </>}
    </WorkerFormDialog>
    {printerSelector.dialogs}
    {integratedLaminationReport ? <WorkerLaminationReport key={selected} session={session}
      context={{ apparatus: apparatusId, orderId, stage: String(control.stage_node_id ?? ''), complete: selected === 'complete', fullReport: control.complete_requires_full_report !== false }}
      onAttempted={() => { operationReportAttempted.current = true; actionInFlight.current = true; setBusy(true); loadVersion.current++; setControlRetired(true); }}
      onCommitted={() => { operationReportAttempted.current = true; loadVersion.current++; setControlRetired(true); setInputBatch(null); setMaterials([]); }}
      onClose={() => {
        setSelected(''); actionInFlight.current = false; setBusy(false);
        if (operationReportAttempted.current) { setRefresh(value => value + 1); onChanged(); }
        operationReportAttempted.current = false;
      }} /> : null}
    {rezkaAstatkaReport ? <WorkerRezkaAstatkaReport session={session} apparatus={apparatusId} orderId={orderId} getCursor={() => latestCursor.current}
      onAttempted={() => { operationReportAttempted.current = true; actionInFlight.current = true; setBusy(true); loadVersion.current++; setControlRetired(true); }}
      onCommitted={() => { operationReportAttempted.current = true; loadVersion.current++; setControlRetired(true); setInputBatch(null); setMaterials([]); }}
      onClose={() => {
        setSelected(''); actionInFlight.current = false; setBusy(false);
        if (operationReportAttempted.current) { setRefresh(value => value + 1); onChanged(); }
        operationReportAttempted.current = false;
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
const iosStyles = StyleSheet.create({ content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 }, actionCard: { padding: 16, borderRadius: 22, gap: 16 }, outcomeActions: { gap: 24 } });
const styles = StyleSheet.create({ screen:{flex:1},content:{padding:4,gap:8,paddingBottom:32},host:{width:'100%'},muted:{fontSize:14,color:'#52617a',lineHeight:21},small:{fontSize:13,color:'#52617a',lineHeight:20},card:{borderRadius:18,padding:14,gap:10,elevation:2},sectionGroup:{gap:10,paddingTop:8},label:{fontSize:13,color:'#52617a'},error:{color:'#a52626',fontSize:14},success:{color:'#1d7544',fontSize:14},cameraScreen:{flex:1,backgroundColor:'#10182b',justifyContent:'center',padding:16,gap:12},camera:{height:380,borderRadius:18,overflow:'hidden'},cameraText:{color:'#fff',textAlign:'center',fontSize:16},scannerPanel:{borderRadius:18,padding:12,alignItems:'center',gap:10},quickCamera:{width:218,height:218,borderRadius:24,overflow:'hidden'},scannerText:{fontSize:14,textAlign:'center'},manualToggle:{alignSelf:'flex-end',padding:8},manualRow:{width:'100%',flexDirection:'row',alignItems:'center',gap:8},expansion:{flexDirection:'row',alignItems:'center',gap:8,minHeight:40},expansionTitle:{flex:1,fontSize:16,fontWeight:'500'},detailRow:{borderRadius:12,padding:10,gap:3},detailText:{fontSize:14,fontWeight:'500'},actionRow:{flexDirection:'row',gap:8},paintHeader:{flexDirection:'row',alignItems:'center',padding:8,gap:6},paintPreview:{height:170,borderRadius:12},paintContent:{padding:14,gap:12,paddingBottom:24},flex:{flex:1}});
