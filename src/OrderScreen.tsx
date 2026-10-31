import { Button, Host, TextInput as NativeInput, useNativeState } from '@expo/ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerOrderThumbnail } from './components/WorkerOrderThumbnail';
import { useWorkerColors } from './components/useWorkerColors';
import { WorkerSheetCloseContext } from './components/workerSheetContext';
import { automaticQolipConfirmation, preflightFreezeRequest, runningFreezeRequest, validOrderControl, type QueueCursor } from './workerOrderLogic';
import type { QueueOrder } from './workerApi';

type Obj = Record<string, any>;
type Props = { session: Session; apparatusId: string; orderId: string; preview?: QueueOrder; queueCursor: QueueCursor | null; onClose: () => void; onChanged: () => void };
type ScanKind = 'material' | 'qolip' | 'input' | 'paintPhoto';
const actionLabels: Record<string, string> = { start: 'Boshlash', pause: 'To‘xtatish', resume: 'Davom ettirish', roll_complete: 'Rulonni yakunlash', complete: 'Buyurtmani yakunlash' };
const paintFields = ['Mix', '1w Oq', '7w Oq', 'Qora', 'Sariq', 'Qizil', 'Ko‘k', 'Spirt'];
const paintOptions = [
  ...['Oq', 'Sariq', 'Qizil', 'Ko‘k', 'Tilla', 'Kumush', 'Qora'].map(name => ({ name, category: 'colors', fields: paintFields })),
  { name: 'Lak', category: 'lacquers', fields: ['OPV lak', 'MAT lak'] },
  { name: 'Spirtlar', category: 'solvents', fields: ['Aralashmalar', 'Etil', 'Metoxil', 'Rasvavitel', 'Izopropel'] },
];
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

function Field({ label, onChangeText, keyboardType, initialValue = '' }: { label: string; onChangeText: (s: string) => void; keyboardType?: 'decimal-pad' | 'default'; initialValue?: string }) {
  const value = useNativeState(initialValue);
  const colors = useWorkerColors();
  return <View style={styles.field}><Text style={[styles.label, { color: colors.muted }]}>{label}</Text><Host matchContents={{ vertical: true }} style={styles.host}><NativeInput value={value} placeholder={label} onChangeText={onChangeText} keyboardType={keyboardType ?? 'default'} autoCapitalize="none" /></Host></View>;
}
function NativeButton({ label, onPress, disabled, variant }: { label: string; onPress: () => void; disabled?: boolean; variant?: 'text' | 'filled' | 'outlined' }) {
  return <Host matchContents={{ vertical: true }} style={styles.host}><Button label={label} onPress={onPress} disabled={disabled} variant={variant ?? 'outlined'} /></Host>;
}

export function OrderScreen({ session, apparatusId, orderId, preview, queueCursor, onClose, onChanged }: Props) {
  const colors = useWorkerColors();
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
  const [paintColor, setPaintColor] = useState('');
  const [paint, setPaint] = useState<Record<string, string>>({});
  const [printerUrl, setPrinterUrl] = useState('');
  const [selectedQolipSet, setSelectedQolipSet] = useState('');
  const [refresh, setRefresh] = useState(0);
  const loadVersion = useRef(0);
  const actionInFlight = useRef(false);
  const scanInFlight = useRef(false);
  const screenMounted = useRef(true);
  const queueEpoch = queueCursor?.epoch;
  const queueRevision = queueCursor?.rev;
  const latestCursor = useRef(queueCursor);
  useEffect(() => { latestCursor.current = queueCursor; }, [queueCursor]);
  useEffect(() => {
    const mounted = screenMounted;
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

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

  async function openScanner(kind: ScanKind) {
    const result = permission?.granted ? permission : await askPermission();
    if (!result.granted) { setError('QR skanerlash uchun kamera ruxsati kerak.'); return; }
    setCameraReady(false);
    setScanner(kind);
  }
  async function takePaintPhoto() {
    if (photoBusy || !cameraReady || !camera.current) return;
    setPhotoBusy(true); setError('');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) throw new Error('Rasm olinmadi.');
      const blob = await (await fetch(photo.uri)).blob();
      if (!blob.size || blob.size > 6 * 1024 * 1024) throw new Error('Rasm hajmi 6 MB dan oshmasligi kerak.');
      const params = new URLSearchParams({ order_id: orderId, apparatus: apparatusId });
      const response = await authorizedFetch(session, `/v1/mobile/returned-paint/images?${params}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'x-file-name': 'returned-paint.jpg' }, body: blob });
      if (!response.ok) throw new Error('Bo‘yoq rasmi yuklanmadi.');
      const payload = await response.json();
      const id = typeof payload.image?.image_id === 'string' ? payload.image.image_id.trim() : '';
      if (!id) throw new Error('Rasm javobi noto‘g‘ri.');
      if (paintImageId && paintImageId !== id) void authorizedFetch(session, `/v1/mobile/returned-paint/images?id=${encodeURIComponent(paintImageId)}`, { method: 'DELETE' }).catch(() => {});
      setPaintImageId(id); setScanner(null); setSuccess('Bo‘yoq rasmi yuklandi.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Rasm yuklanmadi.'); setScanner(null); }
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
  async function onScan(value: string) {
    if (scanner === 'input') {
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
    if (!clean || !scanner) return;
    setScanner(null);
    const key = normalizeCode(clean);
    if (scanner === 'material') {
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
  async function submit(action: string) {
    if (!synchronized || !allowed.includes(action) || actionInFlight.current) return;
    const isStarting = action === 'start' || action === 'resume';
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
    const fullReport = action === 'complete' && (control.complete_requires_full_report !== false || !!closingOutputId);
    const safeStopIssue = action === 'pause' && !!safeStopRequest && !!freezeNote.trim() && ![kg, meter, bobina].some(value => value.trim());
    const needsOutput = !safeStopIssue && (action === 'pause' || action === 'roll_complete' || (action === 'complete' && !closingOutputId));
    const fields = [kg, meter, bobina];
    if (needsOutput && fields.some(x => !x.trim() || !Number.isFinite(numberValue(x)) || numberValue(x) <= 0)) { setError('Metr, vazn va bobina uchun noldan katta qiymatlarni kiriting.'); return; }
    const paintValues = (usage: string, name: string, labels: string[]) => Object.fromEntries(labels.flatMap(field => {
      const value = paint[`${usage}:${name}:${field}`]?.trim();
      return value ? [[field, value.replace(',', '.')]] : [];
    }));
    const returnedPaintItems = ['rasxot', 'astatka'].flatMap(usage => paintOptions.flatMap(option => {
      const values = paintValues(usage, option.name, option.fields);
      return Object.keys(values).length ? [{ usage, category: option.category, name: option.name, values }] : [];
    }));
    const imageOnly = !!paintImageId && returnedPaintItems.length === 0;
    if (fullReport && (!waste.trim() || !Number.isFinite(numberValue(waste)) || numberValue(waste) < 0 || (!closingOutputId && numberValue(waste) === 0) || (!imageOnly && ['rasxot','astatka'].some(usage => {
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
      const result = await request(session, '/v1/mobile/admin/production-maps/queue-action', { method: 'POST', body: JSON.stringify(body) });
      if (!screenMounted.current) return;
      setSelected(''); setMaterials([]); setQolips([]); setQolipsReset(false); setInputBatch(null); setFreezeNote(''); setKg(''); setMeter(''); setBobina(''); setWaste(''); setPaintImageId(''); setPaint({}); setPaintColor('');
      const qr = result.progress_batch?.qr_payload;
      const printFailed = needsOutput && ((Array.isArray(result.prints) && result.prints.some((job: Obj) => job?.ok === false)) || result.print?.ok === false);
      if (printFailed) setError('Amal bajarildi, lekin rulon yorlig‘i chop etilmadi.');
      else setSuccess(qr ? `Amal bajarildi. Rulon QR: ${qr}` : 'Amal bajarildi.');
      setSelectedQolipSet('');
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
  const submitCurrent = useRef(submit);
  useEffect(() => { submitCurrent.current = submit; });
  function confirm(action: string) {
    Alert.alert(actionLabels[action] ?? action, 'Ushbu amal serverga yuboriladi.', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Tasdiqlash', onPress: () => { void submitCurrent.current(action); } },
    ]);
  }

  if (scanner === 'paintPhoto') return <View style={styles.cameraScreen}><CameraView ref={camera} style={styles.camera} mode="picture" onCameraReady={() => setCameraReady(true)} /><Text style={styles.cameraText}>Bo‘yoq hisobotini suratga oling</Text><NativeButton label={photoBusy ? 'Yuklanmoqda…' : 'Suratga olish'} disabled={photoBusy || !cameraReady} variant="filled" onPress={() => { void takePaintPhoto(); }} /><NativeButton label="Bekor qilish" disabled={photoBusy} onPress={() => setScanner(null)} /></View>;
  if (scanner) return <View style={styles.cameraScreen}><CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13', 'ean8'] }} onBarcodeScanned={({ data }: { data: string }) => { void onScan(data); }} /><Text style={styles.cameraText}>{scanner === 'material' ? 'Material kodini skanerlang' : scanner === 'qolip' ? 'Qolip kodini skanerlang' : 'Kiruvchi rulonni skanerlang'}</Text><NativeButton label="Bekor qilish" onPress={() => setScanner(null)} /></View>;
  if (imageOpen) {
    const token = activeSessionToken(session);
    const query = new URLSearchParams({ order_id: orderId });
    const imageId = preview?.imageId || String(order.image_id ?? '');
    if (imageId) query.set('image_id', imageId);
    const url = new URL(`/v1/mobile/admin/production-maps/order-image/view?${query}`, session.baseUrl);
    return <View style={[styles.imageViewer, { backgroundColor: colors.field }]}>
      <View style={styles.imageHeader}><Text style={[styles.section, { color: colors.text }]}>Buyurtma rasmi</Text><Pressable accessibilityRole="button" accessibilityLabel="Rasmni yopish" onPress={() => setImageOpen(false)} style={[styles.close, { backgroundColor: colors.surface }]}><SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={21} tintColor={colors.icon} /></Pressable></View>
      {token && url.protocol === 'https:' && url.origin === session.baseUrl && !imageError ? <Image source={{ uri: url.toString(), headers: { Authorization: `Bearer ${token}` }, cacheKey: JSON.stringify(['order-image', session.imageCacheScope, session.baseUrl, orderId, imageId]) }} style={styles.image} contentFit="contain" cachePolicy="memory-disk" onError={() => setImageError(true)} /> : <Text style={{ color: colors.muted }}>Rasm mavjud emas.</Text>}
    </View>;
  }
  const labelForState: Record<string, string> = { pending: 'Kutilmoqda', waiting: 'Kutilmoqda', in_progress: 'Ish jarayonida', paused: 'To‘xtatilgan', completed: 'Yakunlangan', print_preflight: 'Rang chiqarilyapti', frozen: 'Muzlatilgan' };
  const state = String(control.state || preview?.state || '');
  const title = String(preview?.title || order.title || 'Buyurtma');
  const customer = String(preview?.customer || order.customer_name || '');
  const code = String(preview?.code || order.order_number || order.code || orderId);
  const closingOutput = selected === 'complete' && typeof control.closing_output_batch_id === 'string' && !!control.closing_output_batch_id.trim();
  const showFullReport = selected === 'complete' && (control.complete_requires_full_report !== false || closingOutput);

  return <ScrollView nestedScrollEnabled style={[styles.screen, { backgroundColor: colors.field }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Buyurtma rasmini ochish" onPress={() => { setImageError(false); setImageOpen(true); }}><WorkerOrderThumbnail session={session} orderId={orderId} imageId={preview?.imageId ?? ''} active size={44} backgroundColor={colors.surface} iconColor={colors.muted} /></Pressable>
      <View style={styles.heading}><Text style={[styles.small, { color: colors.muted }]}>Buyurtma raqami:</Text><Text numberOfLines={1} style={[styles.code, { color: colors.text }]}>{code}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={closeSheet} style={[styles.close, { backgroundColor: colors.surface }]}><SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={21} tintColor={colors.icon} /></Pressable>
    </View>
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {!!customer && <Text style={[styles.muted, { color: colors.muted }]}>{customer}</Text>}
      {!!state && <Text style={[styles.muted, { color: colors.muted }]}>{labelForState[state] ?? state}</Text>}
    {loading && <ActivityIndicator color={colors.icon} />}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!success && <Text style={styles.success}>{success}</Text>}
    {!!bootstrap && <>
      <View style={styles.sectionGroup}><Text style={[styles.section, { color: colors.text }]}>Ishga tayyorgarlik</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>Material: {scanningRequired ? 'skanerlash kerak' : 'skanerlash talab qilinmaydi'}</Text>
        {scanningRequired && <><Text style={[styles.small, { color: colors.muted }]}>{materials.length ? materials.join('\n') : 'Hali skanerlanmagan'}</Text><NativeButton label="Materialni skanerlash" onPress={() => void openScanner('material')} /></>}
        <Text style={[styles.muted, { color: colors.muted }]}>Qolip: {qolipRequired ? (automaticQolip ? 'avtomatik tekshiruv' : 'skanerlash kerak') : 'skanerlash talab qilinmaydi'}</Text>
        {qolipRequired && automaticQolip && <>
          {automaticSets.length > 1 && automaticSets.map(set => <NativeButton key={String(set.set_id)} label={String(set.set_id)} disabled={!synchronized} variant={selectedQolipSet === set.set_id ? 'filled' : 'outlined'} onPress={() => setSelectedQolipSet(String(set.set_id))} />)}
          <Text style={[styles.small, { color: colors.muted }]}>{automaticConfirmation ? 'Qoliplar tayyor' : 'Qoliplar tayyorligini tekshiring'}</Text>
        </>}
        {qolipRequired && !automaticQolip && <><Text style={[styles.small, { color: colors.muted }]}>{effectiveQolips.length ? effectiveQolips.join('\n') : 'Hali skanerlanmagan'}</Text><NativeButton label="Qolipni skanerlash" onPress={() => void openScanner('qolip')} /><NativeButton label="Qoliplarni qayta skanerlash" variant="text" onPress={() => { setQolipsReset(true); setQolips([]); }} /></>}
        {(interaction.previous_wip_mode === 'scan_required' || interaction.opening_wip_mode === 'scan_required' || interaction.resume_input_required === true) && <><Text style={[styles.small, { color: colors.muted }]}>{inputBatch ? 'Kiruvchi rulon tasdiqlangan' : 'Kiruvchi rulon skanerlanmagan'}</Text><NativeButton label="Kiruvchi rulonni skanerlash" disabled={!synchronized} onPress={() => void openScanner('input')} /></>}
        {['materials','qolips'].map(k => sections[k]?.status === 'error' ? <Text key={k} style={styles.error}>{k === 'materials' ? 'Material' : 'Qolip'}: {String(sections[k]?.error?.detail || sections[k]?.error?.error || 'ma’lumotni olish imkoni bo‘lmadi')}</Text> : null)}
      </View>
      <View style={styles.sectionGroup}><Text style={[styles.section, { color: colors.text }]}>Amallar</Text>
        {showPreflightHold && <NativeButton label="Rang chiqarish" variant="filled" onPress={() => { void runPreflight('hold'); }} />}
        {showPreflightOutcome && <><NativeButton label="Rang chiqdi" variant="filled" onPress={() => { void runPreflight('passed'); }} /><NativeButton label="Chiqmadi" onPress={() => { void runPreflight('failed'); }} /></>}
        {showPreflightFreeze && <NativeButton label="Buyurtmani to‘xtatish" variant="filled" onPress={() => { void freezePreflight(); }} />}
        {allowed.filter(a => actionLabels[a] && !(a === 'start' && (showPreflightHold || showPreflightOutcome))).map(a => <NativeButton key={a} label={a === 'pause' && safeStopRequest ? 'Xavfsiz to‘xtatish' : actionLabels[a]} disabled={busy} variant={selected === a || a === 'start' ? 'filled' : 'outlined'} onPress={() => { setError(''); if (a === 'start' || a === 'resume') confirm(a); else setSelected(a); }} />)}
        {synchronized && !showPreflightHold && !showPreflightOutcome && !showPreflightFreeze && !allowed.some(a => actionLabels[a]) && <Text style={[styles.muted, { color: colors.muted }]}>Hozir bajarish mumkin bo‘lgan amal yo‘q.</Text>}
        {!synchronized && <Text style={[styles.muted, { color: colors.muted }]}>Buyurtma holati tekshirilmoqda…</Text>}
      </View>
      {!!selected && <View style={styles.sectionGroup}><Text style={[styles.section, { color: colors.text }]}>{actionLabels[selected]}</Text>
        {selected === 'pause' && safeStopRequest && <Field label="Natija bo‘lmasa, sababini kiriting" initialValue={freezeNote} onChangeText={setFreezeNote} />}
        {['pause','roll_complete','complete'].includes(selected) && !closingOutput && <><Field label="Miqdor, metr" initialValue={meter} keyboardType="decimal-pad" onChangeText={setMeter} /><Field label="Vazn, kg" initialValue={kg} keyboardType="decimal-pad" onChangeText={setKg} /><Field label="Bobina, kg" initialValue={bobina} keyboardType="decimal-pad" onChangeText={setBobina} /></>}
        {['pause','roll_complete','complete'].includes(selected) && !closingOutput && <Field label="Wi-Fi printer server manzili" initialValue={printerUrl} onChangeText={setPrinterUrl} />}
        {showFullReport && <><Field label="Chiqindi, kg" initialValue={waste} keyboardType="decimal-pad" onChangeText={setWaste} /><NativeButton label={paintImageId ? 'Bo‘yoq rasmini almashtirish' : 'Bo‘yoq hisobotini suratga olish'} disabled={photoBusy} onPress={() => { void openScanner('paintPhoto'); }} />{paintImageId && <NativeButton label="Rasmni olib tashlash" disabled={photoBusy} variant="text" onPress={() => { void removePaintPhoto(); }} />}<Text style={styles.muted}>Bo‘yoq rasmini yuklang yoki har bir bo‘limga kamida uchta qiymat kiriting.</Text>{paintOptions.map(option => <NativeButton key={option.name} label={option.name} variant={paintColor === option.name ? 'filled' : 'outlined'} onPress={() => setPaintColor(option.name)} />)}{paintColor && (['rasxot','astatka'] as const).map(usage => <View key={`${paintColor}:${usage}`}><Text style={styles.section}>{usage === 'rasxot' ? 'Rasxot' : 'Astatka'}</Text>{(paintOptions.find(option => option.name === paintColor)?.fields ?? []).map(key => <Field key={`${usage}:${paintColor}:${key}`} label={key} initialValue={paint[`${usage}:${paintColor}:${key}`] ?? ''} keyboardType="decimal-pad" onChangeText={v => setPaint(old => ({ ...old, [`${usage}:${paintColor}:${key}`]: v }))} />)}</View>)}</>}
        <NativeButton label={busy ? 'Yuborilmoqda…' : 'Tasdiqlash'} disabled={!synchronized || !allowed.includes(selected)} variant="filled" onPress={() => confirm(selected)} />
        <NativeButton label="Bekor qilish" variant="text" disabled={busy} onPress={() => setSelected('')} />
      </View>}
    </>}
    {!loading && <NativeButton label="Yangilash" onPress={() => { setError(''); void load(); }} disabled={busy} />}
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({ screen:{flex:1},content:{padding:4,gap:8,paddingBottom:32},header:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:8,gap:10},heading:{flex:1},code:{fontSize:22,fontWeight:'600'},close:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'},host:{width:'100%'},title:{fontSize:20,fontWeight:'600'},muted:{fontSize:14,color:'#52617a',lineHeight:21},small:{fontSize:13,color:'#52617a',lineHeight:20},section:{fontSize:17,fontWeight:'700',color:'#192b4d',marginBottom:4},card:{borderRadius:18,padding:14,gap:10,elevation:2},sectionGroup:{gap:10,paddingTop:8},field:{gap:3},label:{fontSize:13,color:'#52617a'},error:{color:'#a52626',fontSize:14,marginHorizontal:12},success:{color:'#1d7544',fontSize:14,marginHorizontal:12},cameraScreen:{flex:1,backgroundColor:'#10182b',justifyContent:'center',padding:16,gap:12},camera:{height:380,borderRadius:18,overflow:'hidden'},cameraText:{color:'#fff',textAlign:'center',fontSize:16},imageViewer:{flex:1,padding:16},imageHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},image:{flex:1,width:'100%'}});
