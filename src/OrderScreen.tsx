import { Button, Host, TextInput as NativeInput, useNativeState } from '@expo/ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, PlatformColor, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerOrderThumbnail } from './components/WorkerOrderThumbnail';
import { useWorkerColors } from './components/useWorkerColors';
import { WorkerSheetCloseContext } from './components/workerSheetContext';
import { WorkerFormDialog } from './components/WorkerFormDialog';
import { WorkerDeliveryDialog } from './components/WorkerDeliveryDialog';
import { WorkerIconButton } from './components/WorkerIconButton';
import { WorkerPreflightButton } from './components/WorkerPreflightButton';
import { WorkerFormField as Field } from './components/WorkerFormField';
import { WorkerExpansion as Expansion } from './components/WorkerExpansion';
import { loadReturnedPaintDraft, saveReturnedPaintDraft } from './returnedPaintDraft';
import { automaticQolipConfirmation, matchesMaterialAssignment, materialStartReadiness, paintOptions, preflightFreezeRequest, returnedPaintItemsFromDraft, runningFreezeRequest, validOrderControl, type QueueCursor } from './workerOrderLogic';
import type { QueueOrder } from './workerApi';

type Obj = Record<string, any>;
type Props = { session: Session; apparatusId: string; orderId: string; preview?: QueueOrder; queueCursor: QueueCursor | null; initialAction?: 'complete' | 'astatka'; onClose: () => void; onChanged: () => void };
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

async function request(session: Session, path: string, init?: RequestInit): Promise<Obj> {
  const response = await authorizedFetch(session, path, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  const text = await response.text();
  let data: Obj = {};
  try { data = JSON.parse(text); } catch { if (!response.ok) throw new Error(`Server xatosi (${response.status})`); }
  if (!response.ok) throw new Error(String(data.detail || data.message || data.error || `Server xatosi (${response.status})`));
  return data;
}

async function connectedPrinter(address: string): Promise<Obj> {
  let url: URL;
  try { url = new URL(address.trim()); } catch { throw new Error('Printer serverining to‘liq manzilini kiriting.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Printer serverining to‘g‘ri HTTP manzilini kiriting.');
  const driverUrl = url.toString().replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${driverUrl}/v1/mobile/monitor/state`, { signal: controller.signal });
    if (!response.ok) throw new Error('Printer serveriga ulanib bo‘lmadi.');
    const state = await response.json();
    const printer = state.printer ?? state.state?.printer;
    const connected = (value: unknown) => value === true || value === 1 || ['true', '1', 'yes'].includes(String(value).toLowerCase());
    if (!printer || (!connected(printer.connected) && !connected(printer.ok))) throw new Error('Printer ulanmagan.');
    const kind = String(printer.kind || 'printer');
    return { driver_url: driverUrl, printer: kind, print_mode: kind.trim().toLowerCase() === 'godex' ? 'label' : 'rfid' };
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError' && error.message !== 'Network request failed') throw error;
    throw new Error('Printer serveriga ulanib bo‘lmadi.');
  } finally { clearTimeout(timer); }
}

function NativeButton({ label, onPress, disabled, variant, height }: { label: string; onPress: () => void; disabled?: boolean; variant?: 'text' | 'filled' | 'outlined'; height?: number }) {
  return <Host matchContents={{ vertical: true }} style={styles.host}><Button label={label} onPress={onPress} disabled={disabled} variant={variant ?? 'outlined'} style={height ? { height } : undefined} /></Host>;
}

export function OrderScreen({ session, apparatusId, orderId, preview, queueCursor, initialAction, onClose, onChanged }: Props) {
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
  const [imageError, setImageError] = useState(false);
  const [paintImageId, setPaintImageId] = useState('');
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
  const [astatkaNote, setAstatkaNote] = useState('');
  const [paintColor, setPaintColor] = useState('');
  const [paintEditor, setPaintEditor] = useState(false);
  const [paintUsage, setPaintUsage] = useState<'rasxot' | 'astatka'>('rasxot');
  const [paintDynamic, setPaintDynamic] = useState<Record<string, string[]>>({});
  const [newPaintField, setNewPaintField] = useState('');
  const newPaintFieldValue = useNativeState('');
  const [loadedDraftScope, setLoadedDraftScope] = useState('');
  const [paint, setPaint] = useState<Record<string, string>>({});
  const [printerUrl, setPrinterUrl] = useState('');
  const [selectedQolipSet, setSelectedQolipSet] = useState('');
  const [materialsExpanded, setMaterialsExpanded] = useState(false);
  const [qolipsExpanded, setQolipsExpanded] = useState(false);
  const [manualScanVisible, setManualScanVisible] = useState(false);
  const [manualScan, setManualScan] = useState('');
  const manualScanValue = useNativeState('');
  const [attachedMaterials, setAttachedMaterials] = useState<Obj[] | null>(null);
  const [attachedMaterialsError, setAttachedMaterialsError] = useState('');
  const [intakeCandidates, setIntakeCandidates] = useState<Obj[]>([]);
  const [intakeMode, setIntakeMode] = useState(false);
  const [delivery, setDelivery] = useState<{ material: Obj; deliverers: Obj[]; purpose: 'start' | 'intake' } | null>(null);
  const [deliveryChoice, setDeliveryChoice] = useState('');
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const loadVersion = useRef(0);
  const actionInFlight = useRef(false);
  const scanInFlight = useRef(false);
  const recentQuickScan = useRef<{ value: string; at: number } | null>(null);
  const screenMounted = useRef(true);
  const initialActionHandled = useRef(false);
  const workerRole = String(session.profile?.role ?? '').trim();
  const workerRef = String(session.profile?.ref ?? '').trim();
  const draftScope = JSON.stringify([session.baseUrl, workerRole, workerRef, workerRole && workerRef ? '' : session.imageCacheScope, orderId, apparatusId]) + (selected === 'astatka' ? ':astatka' : '');
  const queueEpoch = queueCursor?.epoch;
  const queueRevision = queueCursor?.rev;
  const latestCursor = useRef(queueCursor);
  useEffect(() => { latestCursor.current = queueCursor; }, [queueCursor]);
  useEffect(() => {
    const mounted = screenMounted;
    mounted.current = true;
    return () => { mounted.current = false; };
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
    setLoading(true);
    try {
      const params = `apparatus=${encodeURIComponent(apparatusId)}&order_id=${encodeURIComponent(orderId)}`;
      const scanPath = `/v1/mobile/admin/production-maps/order-scan-bootstrap?${params}${materials.length ? `&material_barcodes=${encodeURIComponent(materials.join(','))}` : ''}`;
      let accepted = false;
      for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
        const [snapshot, initialScan] = await Promise.all([
          request(session, `/v1/mobile/admin/production-maps/sequence?worker_scope=true&detail=true&${params}`),
          request(session, scanPath),
        ]);
        const scan = initialScan.control_state?.control?.interaction?.qolip_automatic_confirmation === true
          ? await request(session, `${scanPath}&automatic_qolip_confirmation=true`) : initialScan;
        if (version !== loadVersion.current) return;
        const maps = snapshot.maps;
        accepted = Array.isArray(maps) && maps.length === 1 && maps[0]?.map?.id === orderId &&
          (!snapshot.projection || snapshot.projection === 'worker_detail_v1') && typeof snapshot.scope === 'string' && !!snapshot.scope && typeof snapshot.epoch === 'string' && !!snapshot.epoch &&
          Number.isInteger(snapshot.rev) && snapshot.rev >= 0 && snapshot.epoch === scan.control_state?.epoch &&
          scan.control_state?.rev >= snapshot.rev && validOrderControl(scan, apparatusId, orderId, { epoch: queueEpoch, rev: queueRevision });
        if (accepted) { setDetail(snapshot); setBootstrap(scan); setControlRetired(false); }
      }
      if (!accepted) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
    } catch (e) { if (version === loadVersion.current) setError(e instanceof Error ? e.message : 'Buyurtmani yuklab bo‘lmadi'); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, [session, apparatusId, orderId, materials, queueEpoch, queueRevision]);
  useEffect(() => {
    const generation = loadVersion;
    const timer = setTimeout(() => { if (!busy) void load(); }, 0);
    return () => { clearTimeout(timer); generation.current++; };
  }, [load, refresh, busy]);

  const synchronized = !loading && !busy && !controlRetired && validOrderControl(bootstrap, apparatusId, orderId, queueCursor);
  const control: Obj = bootstrap?.control_state?.control ?? {};
  const interaction: Obj = control.interaction ?? {};
  const isActiveOrder = bootstrap?.control_state?.order_control === 'active' && !['frozen', 'freeze_requested'].includes(control.stage_control_state);
  const safeStopRequest = synchronized ? runningFreezeRequest(bootstrap?.control_state, apparatusId) : null;
  const allowed: string[] = synchronized && (isActiveOrder || !!safeStopRequest) && Array.isArray(control.allowed_actions) ? control.allowed_actions : [];
  const order = detail?.maps?.[0]?.map ?? {};
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
      if ((initialAction === 'complete' && canOpenInitialComplete) || (initialAction === 'astatka' && canOpenInitialAstatka)) setSelected(initialAction);
      else setError('Buyurtma holati o‘zgardi. Qayta urining.');
    }, 0);
    return () => clearTimeout(timer);
  }, [initialAction, synchronized, canOpenInitialComplete, canOpenInitialAstatka]);
  const controlEpoch = bootstrap?.control_state?.epoch;
  const controlRevision = bootstrap?.control_state?.rev;
  useEffect(() => {
    if (!controlEpoch || scanningRequired) return;
    let current = true;
    const params = new URLSearchParams({ order_id: orderId, apparatus: apparatusId });
    request(session, `/v1/mobile/admin/raw-material-assignments?${params}`).then(data => {
      if (!current) return;
      if (!Array.isArray(data)) throw new Error('Homashyolar yuklanmadi.');
      setAttachedMaterials(data.filter((row: Obj) => matchesMaterialAssignment(row, orderId, apparatusId)));
      setAttachedMaterialsError('');
    }).catch(() => { if (current) setAttachedMaterialsError('Homashyolar yuklanmadi.'); });
    return () => { current = false; };
  }, [session, apparatusId, orderId, scanningRequired, controlEpoch, controlRevision]);
  useEffect(() => {
    if (!controlEpoch || scanningRequired || interaction.material_intake_allowed !== true) return;
    let current = true;
    const params = new URLSearchParams({ order_id: orderId, apparatus: apparatusId });
    request(session, `/v1/mobile/admin/raw-material-intake-candidates?${params}`).then(data => {
      if (!current || !Array.isArray(data)) return;
      setIntakeCandidates(data.filter((row: Obj) => matchesMaterialAssignment(row, orderId, apparatusId)));
    }).catch(() => { if (current) setIntakeCandidates([]); });
    return () => { current = false; };
  }, [session, apparatusId, orderId, scanningRequired, interaction.material_intake_allowed, controlEpoch, controlRevision]);

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
      const qr = value.trim();
      setScanner(null);
      if (!qr || !synchronized || scanInFlight.current) return;
      scanInFlight.current = true;
      const version = loadVersion.current;
      setLoading(true); setError(''); setInputBatch(null);
      try {
        if (interaction.opening_wip_mode === 'scan_required') {
          try {
            const result = await request(session, '/v1/mobile/admin/production-maps/opening-wip/lookup', { method: 'POST', body: JSON.stringify({ apparatus: apparatusId, order_id: orderId, qr_payload: qr }) });
            const batch = result.batch;
            if (version !== loadVersion.current || !validOrderControl(bootstrap, apparatusId, orderId, latestCursor.current) || result.ok !== true ||
                !batch || batch.order_id !== orderId || typeof batch.batch_id !== 'string' || !batch.batch_id.trim() ||
                String(batch.qr_payload ?? '').trim().toUpperCase() !== qr.toUpperCase() || batch.wip_status !== 'waiting') throw new Error('Rulon ushbu buyurtma uchun tasdiqlanmadi.');
            setInputBatch({ id: batch.batch_id.trim(), qr, stage: String(control.stage_node_id ?? '') });
            setSuccess('Kiruvchi rulon tasdiqlandi.');
            return;
          } catch (e) {
            if (interaction.previous_wip_mode !== 'scan_required' && interaction.resume_input_required !== true) throw e;
          }
        }
        const params = new URLSearchParams({ apparatus: apparatusId, order_id: orderId, qr_payload: qr });
        if (materials.length) params.set('material_barcodes', materials.join(','));
        if (automaticQolip) params.set('automatic_qolip_confirmation', 'true');
        const scan = await request(session, `/v1/mobile/admin/production-maps/order-scan-bootstrap?${params}`);
        const proof = scan.validated_progress;
        const batch = proof?.batch;
        const route = proof?.input_route;
        if (version !== loadVersion.current || !validOrderControl(scan, apparatusId, orderId, queueCursor) || proof?.ok !== true || proof.active_order_validated !== true ||
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
    const params = new URLSearchParams({ apparatus: apparatusId, order_id: orderId });
    if (materials.length) params.set('material_barcodes', materials.join(','));
    if (automaticQolip) params.set('automatic_qolip_confirmation', 'true');
    const current = await request(session, `/v1/mobile/admin/production-maps/order-scan-bootstrap?${params}`);
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
      const received = await request(session, '/v1/mobile/admin/raw-material-intake', { method: 'POST', body: JSON.stringify({ order_id: orderId, apparatus: apparatusId, barcode }) });
      if (!screenMounted.current) return;
      if (!matchesMaterialAssignment(received, orderId, apparatusId) || normalizeCode(received.barcode) !== normalizeCode(barcode)) throw new Error('Homashyo qabuli tasdiqlanmadi.');
      const remainingBeforeRefresh = intakeCandidates.filter(row => normalizeCode(row.barcode) !== normalizeCode(barcode));
      setIntakeCandidates(remainingBeforeRefresh);
      if (!remainingBeforeRefresh.length) setIntakeMode(false);
      setSuccess('Homashyo qabul qilindi.');
      onChanged();
      setRefresh(value => value + 1);
      const listParams = new URLSearchParams({ order_id: orderId, apparatus: apparatusId });
      const [assignments, candidates] = await Promise.allSettled([
        request(session, `/v1/mobile/admin/raw-material-assignments?${listParams}`),
        request(session, `/v1/mobile/admin/raw-material-intake-candidates?${listParams}`),
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
        const params = new URLSearchParams({ order_id: orderId, apparatus: apparatusId, barcode: String(material.barcode ?? '').trim() });
        const result = await request(session, `/v1/mobile/admin/raw-material-start-receipt?${params}`);
        if (!screenMounted.current || version !== loadVersion.current || !validOrderControl(bootstrap, apparatusId, orderId, latestCursor.current)) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
        if (result.already_at_apparatus === true) await finishMaterialReceipt(material, purpose, version);
        else {
          const deliverers = Array.isArray(result.deliverers) ? result.deliverers.filter((person: Obj) => typeof person.role === 'string' && person.role && typeof person.ref === 'string' && person.ref) : [];
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
      const result = await request(session, '/v1/mobile/admin/raw-material-start-receipt', { method: 'POST', body: JSON.stringify({
        order_id: orderId, apparatus: apparatusId, barcode, delivered_by_role: person.role, delivered_by_ref: person.ref,
        idempotency_key: `material-delivery:${orderId}:${apparatusId}:${barcode}:${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }) });
      if (result.ok !== true || result.apparatus !== apparatusId || normalizeCode(result.barcode) !== normalizeCode(barcode)) throw new Error('Homashyo apparat oldiga qabul qilingani tasdiqlanmadi.');
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
    const fullReport = isAstatka || (action === 'complete' && (control.complete_requires_full_report !== false || !!closingOutputId));
    const safeStopIssue = action === 'pause' && !!safeStopRequest && !!freezeNote.trim() && ![kg, meter, bobina].some(value => value.trim());
    const needsOutput = !safeStopIssue && (action === 'pause' || action === 'roll_complete' || (action === 'complete' && !closingOutputId));
    const fields = [kg, meter, bobina];
    if (needsOutput && fields.some(x => !x.trim() || !Number.isFinite(numberValue(x)) || numberValue(x) <= 0)) { setError('Metr, vazn va bobina uchun noldan katta qiymatlarni kiriting.'); return; }
    const returnedPaintItems = returnedPaintItemsFromDraft(paint, paintDynamic);
    const imageOnly = !!paintImageId && returnedPaintItems.length === 0;
    if (fullReport && (!waste.trim() || !Number.isFinite(numberValue(waste)) || numberValue(waste) < 0 || (!closingOutputId && !isAstatka && numberValue(waste) === 0) || (!imageOnly && ['rasxot','astatka'].some(usage => {
      const values = returnedPaintItems.filter(item => item.usage === usage).flatMap(item => Object.values(item.values));
      return values.length < 3 || values.some(value => !Number.isFinite(numberValue(value)) || numberValue(value) < 0);
    })))) { setError('Chiqindi va bo‘yoq rasmini yoki har bir bo‘lim uchun kamida uchta to‘g‘ri qiymatni kiriting.'); return; }
    actionInFlight.current = true;
    loadVersion.current++;
    setControlRetired(true); setBusy(true); setError(''); setSuccess('');
    try {
      const printer = needsOutput ? await connectedPrinter(printerUrl) : null;
      if (!screenMounted.current) return;
      if (!validOrderControl(bootstrap, apparatusId, orderId, latestCursor.current)) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
      const body: Obj = { apparatus: apparatusId, order_id: orderId, action, include_control: true };
      if (materials.length && materialScan) body.material_barcodes = materials;
      if (effectiveQolips.length && isStarting && !automaticQolip) body.qolip_codes = effectiveQolips;
      if (isStarting && automaticConfirmation) body.qolip_confirmation = automaticConfirmation;
      if (inputRequired && inputBatch) Object.assign(body, { qr_payload: inputBatch.qr, progress_batch_id: inputBatch.id });
      if (action === 'start' && validPreflight && preflight.status === 'passed') body.print_preflight_hold_id = preflight.hold_id;
      if (needsOutput) Object.assign(body, { finished_goods_kg: numberValue(kg), finished_goods_meter: numberValue(meter), bobina_kg: numberValue(bobina), uom: 'm', ...printer });
      if (closingOutputId) Object.assign(body, { complete_without_output: true, progress_batch_id: closingOutputId });
      if (safeStopRequest && action === 'pause') body.freeze_request_id = safeStopRequest;
      if (safeStopIssue) body.completion_request_note = freezeNote.trim();
      if (fullReport) {
        const returnInk = returnedPaintItems.filter(item => item.usage === 'astatka').flatMap(item => Object.values(item.values)).reduce((sum, value) => sum + numberValue(value), 0);
        Object.assign(body, { total_waste: numberValue(waste), full_completion_report_required: true, returned_paint_items: returnedPaintItems });
        if (paintImageId) body.returned_paint_image_id = paintImageId;
        if (returnedPaintItems.length && (returnInk > 0 || closingOutputId)) body.return_ink_kg = returnInk;
      }
      if (preview?.customer || order.customer_name) body.customer_name = preview?.customer || order.customer_name;
      const result = isAstatka
        ? await request(session, '/v1/mobile/admin/production-maps/bosma-astatka', { method: 'POST', body: JSON.stringify({ apparatus: apparatusId, order_id: orderId, total_waste: numberValue(waste), returned_paint_items: returnedPaintItems, returned_paint_image_id: paintImageId, description: astatkaNote.trim() }) })
        : await request(session, '/v1/mobile/admin/production-maps/queue-action', { method: 'POST', body: JSON.stringify(body) });
      if (!screenMounted.current) return;
      if (isAstatka && (typeof result.report?.report_id !== 'string' || !result.report.report_id.trim())) throw new Error('Astatka qaydi javobi noto‘g‘ri.');
      setSelected(''); setMaterials([]); setQolips([]); setQolipsReset(false); setInputBatch(null); setFreezeNote(''); setKg(''); setMeter(''); setBobina('');
      if (action === 'complete' || isAstatka) {
        void saveReturnedPaintDraft(draftScope, { values: {}, fields: {}, usage: 'rasxot', imageId: '' }).catch(() => {});
        setWaste(''); setAstatkaNote(''); setPaintImageId(''); setPaint({}); setPaintColor(''); setPaintDynamic({}); setPaintUsage('rasxot'); setPaintEditor(false);
      }
      const qr = result.progress_batch?.qr_payload;
      const printFailed = needsOutput && ((Array.isArray(result.prints) && result.prints.some((job: Obj) => job?.ok === false)) || result.print?.ok === false);
      if (printFailed) setError('Amal bajarildi, lekin rulon yorlig‘i chop etilmadi.');
      else setSuccess(isAstatka ? 'Order astatkasi qayd qilindi.' : qr ? `Amal bajarildi. Rulon QR: ${qr}` : 'Amal bajarildi.');
      setSelectedQolipSet('');
      if (initialAction === action) closeSheet();
    } catch (e) { if (screenMounted.current) setError(e instanceof Error ? e.message : 'Amal bajarilmadi'); }
    finally { actionInFlight.current = false; onChanged(); if (screenMounted.current) { setRefresh(value => value + 1); setBusy(false); } }
  }
  async function runPreflight(action: 'hold' | 'passed' | 'failed') {
    if (!synchronized || actionInFlight.current || (action === 'hold' ? !showPreflightHold : !showPreflightOutcome)) return;
    const holdId = action === 'hold' ? `print-preflight:${orderId}:${apparatusId}:${Date.now()}-${Math.random().toString(36).slice(2)}` : preflight.hold_id;
    const body: Obj = { apparatus: apparatusId, order_id: orderId, action, hold_id: holdId, include_control: true };
    if (action === 'hold') body.idempotency_key = holdId;
    else body.expected_revision = preflight.revision;
    actionInFlight.current = true;
    loadVersion.current++;
    setControlRetired(true); setBusy(true); setError(''); setSuccess('');
    try {
      await request(session, '/v1/mobile/admin/production-maps/print-preflight', { method: 'POST', body: JSON.stringify(body) });
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
      const params = new URLSearchParams({ apparatus: apparatusId, order_id: orderId, include_sections: 'false' });
      const current = await request(session, `/v1/mobile/admin/production-maps/order-scan-bootstrap?${params}`);
      if (!screenMounted.current) return;
      const requestId = preflightFreezeRequest(current.control_state, apparatusId, orderId);
      if (!validOrderControl(current, apparatusId, orderId, latestCursor.current) || !requestId || requestId !== initialRequest) throw new Error('Buyurtma holati yangilandi. Qayta urining.');
      await request(session, '/v1/mobile/admin/production-maps/queue-action', { method: 'POST', body: JSON.stringify({ apparatus: apparatusId, order_id: orderId, action: 'freeze', freeze_request_id: requestId, include_control: true }) });
      if (!screenMounted.current) return;
      setSuccess('Buyurtma to‘xtatildi.');
    } catch (e) { if (screenMounted.current) setError(e instanceof Error ? e.message : 'Amal bajarilmadi'); }
    finally { actionInFlight.current = false; onChanged(); if (screenMounted.current) { setRefresh(value => value + 1); setBusy(false); } }
  }
  if (scanner === 'paintPhoto') return <View style={styles.cameraScreen}><CameraView ref={camera} style={styles.camera} mode="picture" onCameraReady={() => setCameraReady(true)} /><Text style={styles.cameraText}>Bo‘yoq hisobotini suratga oling</Text><NativeButton label={photoBusy ? 'Yuklanmoqda…' : 'Suratga olish'} disabled={photoBusy || !cameraReady} variant="filled" onPress={() => { void takePaintPhoto(); }} /><NativeButton label="Bekor qilish" disabled={photoBusy} onPress={() => setScanner(null)} /></View>;
  if (scanner) return <View style={styles.cameraScreen}><CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix', 'code128', 'ean13', 'ean8'] }} onBarcodeScanned={({ data }: { data: string }) => { void onScan(data); }} /><Text style={styles.cameraText}>{scanner === 'material' ? 'Material kodini skanerlang' : scanner === 'qolip' ? 'Qolip kodini skanerlang' : 'Kiruvchi rulonni skanerlang'}</Text><NativeButton label="Bekor qilish" onPress={() => setScanner(null)} /></View>;
  if (imageOpen) {
    const token = activeSessionToken(session);
    const query = new URLSearchParams({ order_id: orderId });
    const imageId = preview?.imageId || String(order.image_id ?? '');
    if (imageId) query.set('image_id', imageId);
    const url = new URL(`/v1/mobile/admin/production-maps/order-image/view?${query}`, session.baseUrl);
    return <View style={[styles.imageViewer, { backgroundColor: sheetBackground }]}>
      <View style={styles.imageHeader}><Text style={[styles.section, { color: colors.text }]}>Buyurtma rasmi</Text><WorkerIconButton icon="close" label="Rasmni yopish" onPress={() => setImageOpen(false)} tonal /></View>
      {token && url.protocol === 'https:' && url.origin === session.baseUrl && !imageError ? <Image source={{ uri: url.toString(), headers: { Authorization: `Bearer ${token}` }, cacheKey: JSON.stringify(['order-image', session.imageCacheScope, session.baseUrl, orderId, imageId]) }} style={styles.image} contentFit="contain" cachePolicy="memory-disk" onError={() => setImageError(true)} /> : <Text style={{ color: colors.muted }}>Rasm mavjud emas.</Text>}
    </View>;
  }
  const code = String(preview?.code || order.order_number || order.code || orderId);
  const closingOutput = selected === 'complete' && typeof control.closing_output_batch_id === 'string' && !!control.closing_output_batch_id.trim();
  const showFullReport = selected === 'astatka' || (selected === 'complete' && (control.complete_requires_full_report !== false || closingOutput));
  const rows: Obj[] | null = scanningRequired
    ? (Array.isArray(materialRequirements.assignments) ? materialRequirements.assignments.filter((row: Obj) => matchesMaterialAssignment(row, orderId, apparatusId)) : null)
    : attachedMaterials;
  const requiredMaterialCount = Number(materialRequirements.required_scan_count ?? 0);
  const matchedMaterialCount = Number(materialRequirements.matched_scan_count ?? materials.length);
  const showMaterials = preparationVisible || interaction.assigned_materials_display_only === true;
  const showMolds = (preparationVisible || ['fresh_start_blocked', 'requeued_waiting', 'waiting_previous_stage'].includes(interaction.mode)) && qolipRequired;
  function cancelProgressDialog() {
    if (busy || photoBusy) return;
    if (paintEditor) { setPaintEditor(false); return; }
    const closeInitial = !!initialAction && selected === initialAction;
    setSelected('');
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

  return <View style={[styles.screen, { backgroundColor: sheetBackground }]}><ScrollView nestedScrollEnabled contentContainerStyle={[styles.content, Platform.OS === 'ios' && iosStyles.content]} keyboardShouldPersistTaps="handled">
    <View style={[styles.header, Platform.OS === 'ios' && iosStyles.header]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Buyurtma rasmini ochish" onPress={() => { setImageError(false); setImageOpen(true); }}><WorkerOrderThumbnail session={session} orderId={orderId} imageId={preview?.imageId ?? ''} active size={44} backgroundColor={colors.surface} iconColor={colors.muted} /></Pressable>
      <View style={styles.heading}><Text style={[styles.small, { color: colors.muted }]}>Buyurtma raqami:</Text><Text numberOfLines={1} style={[styles.code, { color: colors.text }]}>{code}</Text></View>
      <WorkerIconButton icon="close" label="Yopish" onPress={closeSheet} tonal />
    </View>
    {showQuickScanner && <View style={[styles.scannerPanel, { backgroundColor: sheetCard }]}>
      {permission?.granted ? <CameraView style={styles.quickCamera} barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix', 'code128', 'ean13', 'ean8'] }} onBarcodeScanned={({ data }: { data: string }) => { void quickScan(data); }} /> :
        <NativeButton label="Kameraga ruxsat berish" onPress={() => { void askPermission(); }} />}
      <Text style={[styles.scannerText, { color: colors.muted }]}>Qolip yoki homashyo kodidan bittasini kamera markaziga olib keling</Text>
      {interaction.opening_wip_mode !== 'scan_required' && <>
        <View style={styles.manualToggle}><WorkerIconButton icon="edit" label="Kodni qo‘lda kiritish" onPress={() => setManualScanVisible(value => !value)} /></View>
        {manualScanVisible && <View style={styles.manualRow}>
          <View style={styles.flex}><Host matchContents={{ vertical: true }} style={styles.host}><NativeInput value={manualScanValue} placeholder="QR / barcode" onChangeText={setManualScan} autoCapitalize="none" /></Host></View>
          <WorkerIconButton icon="check" label="Kodni tekshirish" onPress={() => { void quickScan(manualScan); manualScanValue.set(''); setManualScan(''); }} />
        </View>}
      </>}
    </View>}
    <View style={[styles.card, { backgroundColor: sheetCard }]}>
    {loading && <ActivityIndicator color={colors.icon} />}
    {!!error && !selected && !delivery && <Text style={styles.error}>{error}</Text>}
    {!!success && <Text style={styles.success}>{success}</Text>}
    {!!bootstrap && <>
      {showMaterials && <View style={styles.sectionGroup}>
        {rows === null ? <Text style={[styles.muted, { color: colors.muted }]}>{attachedMaterialsError || 'Homashyolar yuklanmoqda…'}</Text> : rows.length === 0 ?
          <Text style={[styles.expansionTitle, { color: colors.text }]}>Ushbu buyurtma uchun homashyo biriktirilmagan</Text> : <>
            <Expansion title={rows.every(row => row.execution_status === 'awaiting_delivery') ? 'Apparat oldiga homashyo olib kelinmagan' : 'Biriktirilgan homashyolar'} count={`${rows.length} ta`} expanded={materialsExpanded} onPress={() => setMaterialsExpanded(value => !value)} />
            {materialsExpanded && rows.map((row, index) => <View key={String(row.id ?? row.barcode ?? index)} style={[styles.detailRow, { backgroundColor: colors.field }]}>
              <Text style={[styles.detailText, { color: colors.text }]}>{String(row.item_name || row.material_name || row.item_code || row.barcode || '')}</Text>
              <Text style={[styles.small, { color: colors.muted }]}>{String(row.barcode ?? '')}{materials.some(value => normalizeCode(value) === normalizeCode(row.barcode)) ? ' ✓' : ''}</Text>
            </View>)}
          </>}
        {scanningRequired && requiredMaterialCount > 0 && <View style={styles.expansion}><Text style={[styles.expansionTitle, { color: colors.text }]}>Homashyo QR tasdiqlari</Text><Text style={[styles.muted, { color: colors.muted }]}>{matchedMaterialCount}/{requiredMaterialCount}</Text></View>}
        {materialState.unavailable && materialState.reason !== 'Apparat oldiga homashyo olib kelinmagan' && <Text style={styles.error}>{materialState.reason}</Text>}
      </View>}
      {showMolds && <View style={styles.sectionGroup}>
        <Expansion title={moldSets.size > 1 ? 'Muqobil qoliplar' : 'Qoliplar'} count={`${automaticQolip && automaticConfirmation ? requiredQolips.length : effectiveQolips.length}/${requiredQolips.length} ta`} expanded={qolipsExpanded} onPress={() => setQolipsExpanded(value => !value)} />
        {automaticQolip && automaticSets.length > 1 && automaticSets.map(set => <NativeButton key={String(set.set_id)} label={String(set.set_id)} disabled={!synchronized} variant={selectedQolipSet === set.set_id ? 'filled' : 'outlined'} onPress={() => setSelectedQolipSet(String(set.set_id))} />)}
        {qolipsExpanded && requiredQolips.map((mold, index) => <View key={String(mold.qolip_code || index)} style={[styles.detailRow, { backgroundColor: colors.field }]}><Text style={[styles.detailText, { color: colors.text }]}>{String(mold.qolip_code ?? '')}{mold.color ? ` · ${mold.color}` : ''}{scannedMolds.has(normalizeCode(mold.qolip_code)) ? ' ✓' : ''}</Text></View>)}
        {!automaticQolip && moldSets.size > 1 && effectiveQolips.length > 0 && <NativeButton label="Komplektni almashtirish" variant="text" onPress={() => { setQolipsReset(true); setQolips([]); }} />}
        {sections.qolips?.status === 'error' && <Text style={styles.error}>Qoliplar yuklanmadi</Text>}
      </View>}
      {preparationVisible && previousRequired && <View style={[styles.detailRow, { backgroundColor: colors.field }]}>
        <Text style={[styles.expansionTitle, { color: colors.text }]}>{inputBatch ? (interaction.opening_wip_mode === 'scan_required' ? 'Opening WIP ruloni tasdiqlandi' : 'Oldingi bosqich tasdiqlandi') : (interaction.opening_wip_mode === 'scan_required' ? 'Opening WIP QR ni skan qiling' : 'Oldingi bosqich QR')}</Text>
        {!!inputBatch && <Text style={[styles.small, { color: colors.muted }]}>{inputBatch.qr}</Text>}
      </View>}
      <View style={styles.sectionGroup}>
        {interaction.material_intake_allowed === true && intakeCandidates.length > 0 && <NativeButton label={intakeMode ? 'Scannerni yopish' : 'Homashyo ulash'} height={52} disabled={!synchronized || deliveryBusy} onPress={() => setIntakeMode(value => !value)} />}
        {showPreflightFreeze && <NativeButton label="Rang chiqarishni to‘xtatib muzlatish" height={58} variant="filled" onPress={() => { void freezePreflight(); }} />}
        {showPreflightOutcome && <View style={styles.actionRow}>
          <View style={styles.flex}>{Platform.OS === 'ios' ? <WorkerPreflightButton label="Rang chiqdi" onPress={() => { void runPreflight('passed'); }} /> : <NativeButton label="Rang chiqdi" height={58} variant="filled" onPress={() => { void runPreflight('passed'); }} />}</View>
          <View style={styles.flex}>{Platform.OS === 'ios' ? <WorkerPreflightButton label="Chiqmadi" outlined onPress={() => { void runPreflight('failed'); }} /> : <NativeButton label="Chiqmadi" height={58} onPress={() => { void runPreflight('failed'); }} />}</View>
        </View>}
        {showPreflightHold && <WorkerPreflightButton onPress={() => { void runPreflight('hold'); }} />}
        {!showPreflightHold && !showPreflightOutcome && allowed.includes('start') && <NativeButton label="Boshlash" height={58} variant="filled" disabled={!startReady || busy} onPress={() => { void submit('start'); }} />}
        {(allowed.includes('pause') || allowed.includes('complete')) && <View style={styles.actionRow}>
          {allowed.includes('pause') && <View style={styles.flex}><NativeButton label={safeStopRequest ? 'Rulonni yechib muzlatish' : 'Rulonni yechish'} height={58} disabled={busy} onPress={() => { setError(''); setSelected('pause'); }} /></View>}
          {allowed.includes('complete') && <View style={styles.flex}><NativeButton label="Tugatish" height={58} variant="filled" disabled={busy} onPress={() => { setError(''); setSelected('complete'); }} /></View>}
        </View>}
        {allowed.includes('resume') && <NativeButton label="Davom ettirish" height={52} variant="filled" disabled={!resumeReady || busy} onPress={() => { void submit('resume'); }} />}
        {synchronized && !showPreflightHold && !showPreflightOutcome && !showPreflightFreeze && !allowed.length && <Text style={[styles.muted, { color: colors.muted }]}>{interaction.mode === 'waiting_previous_stage' ? 'Oldingi bosqich tugallanguncha kutilmoqda' : interaction.mode === 'requeued_waiting' ? 'Buyurtma apparat navbatidagi o‘z vaqtini kutmoqda' : 'Hozir bajarish mumkin bo‘lgan amal yo‘q.'}</Text>}
        {!synchronized && <Text style={[styles.muted, { color: colors.muted }]}>Buyurtma holati tekshirilmoqda…</Text>}
      </View>
    </>}
    {!loading && !bootstrap && <NativeButton label="Qayta urinish" onPress={() => { setError(''); void load(); }} disabled={busy} />}
    </View>
  </ScrollView>
    <WorkerFormDialog visible={!!selected} title={paintEditor ? 'Qaytarilgan bo‘yoq' : selected === 'astatka' ? 'Astatka hisobotini topshirish' : safeStopRequest && selected === 'pause' ? 'Rulonni yechib muzlatish' : selected === 'pause' ? 'Pauza miqdori' : 'Tugatish miqdori'}
      cancelLabel={paintEditor ? 'Orqaga' : 'Bekor qilish'} onCancel={cancelProgressDialog} cancelDisabled={busy || photoBusy}
      preventDismiss={paintEditor}
      confirmLabel={paintEditor ? 'Tayyor' : busy ? 'Yuborilmoqda…' : 'Tasdiqlash'}
      confirmDisabled={busy || photoBusy || (!paintEditor && (!synchronized || (selected === 'astatka' ? !canOpenInitialAstatka : !allowed.includes(selected)) || (showFullReport && loadedDraftScope !== draftScope)))}
      onConfirm={() => { if (paintEditor) { setError(''); setPaintEditor(false); } else void submit(selected); }}>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {paintEditor ? <>
          <View style={styles.actionRow}><View style={styles.flex}><NativeButton label="Rasxot" variant={paintUsage === 'rasxot' ? 'filled' : 'outlined'} onPress={() => setPaintUsage('rasxot')} /></View><View style={styles.flex}><NativeButton label="Astatka" variant={paintUsage === 'astatka' ? 'filled' : 'outlined'} onPress={() => setPaintUsage('astatka')} /></View></View>
          <View style={styles.actionRow}><View style={styles.flex}><NativeButton label="Kamera" disabled={photoBusy} onPress={() => { void openScanner('paintPhoto'); }} /></View><View style={styles.flex}><NativeButton label="Gallery" disabled={photoBusy} onPress={() => { void pickPaintPhoto(); }} /></View></View>
          {!!paintImageId && <NativeButton label="Rasmni olib tashlash" disabled={photoBusy} variant="text" onPress={() => { void removePaintPhoto(); }} />}
          <Text style={[styles.muted, { color: colors.muted }]}>Bo‘yoq rasmini yuklang yoki har bir bo‘limga kamida uchta qiymat kiriting.</Text>
          {paintOptions.map(option => <NativeButton key={option.name} label={option.name} variant={paintColor === option.name ? 'filled' : 'outlined'} onPress={() => setPaintColor(option.name)} />)}
          {!!paintColor && <View style={styles.sectionGroup}>
            {[...(paintOptions.find(option => option.name === paintColor)?.fields ?? []), ...(paintDynamic[`${paintUsage}:${paintColor}`] ?? [])].map(label => <Field key={`${paintUsage}:${paintColor}:${label}`} label={label} initialValue={paint[`${paintUsage}:${paintColor}:${label}`] ?? ''} keyboardType="decimal-pad" onChangeText={value => setPaint(old => ({ ...old, [`${paintUsage}:${paintColor}:${label}`]: value }))} />)}
            {paintColor === 'Pantone' && (paintDynamic[`${paintUsage}:Pantone Mix`] ?? []).map(label => <Field key={`${paintUsage}:Pantone Mix:${label}`} label={label} initialValue={paint[`${paintUsage}:Pantone Mix:${label}`] ?? ''} keyboardType="decimal-pad" onChangeText={value => setPaint(old => ({ ...old, [`${paintUsage}:Pantone Mix:${label}`]: value }))} />)}
            {!['Lak', 'Spirtlar'].includes(paintColor) && <>
              <Host matchContents={{ vertical: true }} style={styles.host}><NativeInput value={newPaintFieldValue} placeholder="Maydon nomi" onChangeText={setNewPaintField} /></Host>
              <NativeButton label={paintColor === 'Mix' ? 'Mix+' : 'Pantone+'} onPress={() => addPaintField(paintColor)} />
              {paintColor === 'Pantone' && <NativeButton label="Mix+" onPress={() => addPaintField('Pantone Mix')} />}
            </>}
          </View>}
        </> : <>
        <Text style={[styles.muted, { color: colors.muted }]}>{selected === 'astatka' ? 'Bu faqat order astatkasini qayd qiladi. Pauza va Tugatish holati o‘zgarmaydi.' : safeStopRequest && selected === 'pause' ? 'Sog‘lom rulon bo‘lsa barcha miqdorlarni kiriting. Ishlab chiqarish imkonsiz bo‘lsa miqdorlarni bo‘sh qoldirib, faqat muammo izohini yozing.' : showFullReport ? '0 yoki to‘liq bo‘lmagan hisobot uchun izoh yozing' : 'Joriy miqdorni kiriting'}</Text>
        {selected === 'pause' && safeStopRequest && <Field label="Natija bo‘lmasa, sababini kiriting" initialValue={freezeNote} onChangeText={setFreezeNote} />}
        {['pause','roll_complete','complete'].includes(selected) && !closingOutput && <><Text style={[styles.label, { color: colors.muted, textAlign: 'center' }]}>Standart miqdor</Text><Field label="Babina, kg" initialValue={bobina} keyboardType="decimal-pad" onChangeText={setBobina} /><Text style={[styles.label, { color: colors.muted, textAlign: 'center' }]}>Tayyor mahsulot</Text><Field label="Metraj, m" initialValue={meter} keyboardType="decimal-pad" onChangeText={setMeter} /><Field label="Og‘irlik, kg" initialValue={kg} keyboardType="decimal-pad" onChangeText={setKg} /></>}
        {['pause','roll_complete','complete'].includes(selected) && !closingOutput && <Field label="Wi-Fi printer server manzili" initialValue={printerUrl} onChangeText={setPrinterUrl} />}
        {showFullReport && <><Text style={[styles.label, { color: colors.muted, textAlign: 'center' }]}>Qaytim va chiqindi</Text><Field label="Jami chiqindi, kg" initialValue={waste} keyboardType="decimal-pad" onChangeText={setWaste} /><NativeButton label="Qaytarilgan bo‘yoq" variant="filled" disabled={photoBusy || loadedDraftScope !== draftScope} onPress={() => { setError(''); setPaintEditor(true); }} /></>}
        {selected === 'astatka' && <Field label="Izoh" initialValue={astatkaNote} onChangeText={setAstatkaNote} />}
        </>}
    </WorkerFormDialog>
    <WorkerDeliveryDialog visible={!!delivery} name={String(delivery?.material.item_name || delivery?.material.item_code || '')} barcode={String(delivery?.material.barcode || '')}
      choices={(delivery?.deliverers ?? []).map(person => ({ key: `${person.role}:${person.ref}`, label: String(person.name || person.ref) }))}
      selected={deliveryChoice} error={error} busy={deliveryBusy} canConfirm={!!deliveryChoice && !deliveryBusy && synchronized}
      onChoose={setDeliveryChoice} onCancel={() => setDelivery(null)} onConfirm={() => { void confirmMaterialDelivery(); }} />
  </View>;
}
const iosStyles = StyleSheet.create({ content: { paddingHorizontal: 16, paddingTop: 8 }, header: { paddingHorizontal: 0 } });
const styles = StyleSheet.create({ screen:{flex:1},content:{padding:4,gap:8,paddingBottom:32},header:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:8,gap:10},heading:{flex:1},code:{fontSize:22,fontWeight:'600'},host:{width:'100%'},muted:{fontSize:14,color:'#52617a',lineHeight:21},small:{fontSize:13,color:'#52617a',lineHeight:20},section:{fontSize:20,fontWeight:'600',color:'#192b4d',marginBottom:4},card:{borderRadius:18,padding:14,gap:10,elevation:2},sectionGroup:{gap:10,paddingTop:8},field:{gap:3},label:{fontSize:13,color:'#52617a'},error:{color:'#a52626',fontSize:14},success:{color:'#1d7544',fontSize:14},cameraScreen:{flex:1,backgroundColor:'#10182b',justifyContent:'center',padding:16,gap:12},camera:{height:380,borderRadius:18,overflow:'hidden'},cameraText:{color:'#fff',textAlign:'center',fontSize:16},imageViewer:{flex:1,padding:16},imageHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},image:{flex:1,width:'100%'},scannerPanel:{borderRadius:18,padding:12,alignItems:'center',gap:10},quickCamera:{width:218,height:218,borderRadius:24,overflow:'hidden'},scannerText:{fontSize:14,textAlign:'center'},manualToggle:{alignSelf:'flex-end',padding:8},manualRow:{width:'100%',flexDirection:'row',alignItems:'center',gap:8},expansion:{flexDirection:'row',alignItems:'center',gap:8,minHeight:40},expansionTitle:{flex:1,fontSize:16,fontWeight:'500'},detailRow:{borderRadius:12,padding:10,gap:3},detailText:{fontSize:14,fontWeight:'500'},actionRow:{flexDirection:'row',gap:8},flex:{flex:1}});
