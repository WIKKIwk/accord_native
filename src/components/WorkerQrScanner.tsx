import { Button, Column, Host, Text } from '@expo/ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authorizedFetch } from '../authorizedFetch';
import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { workerQrPayload } from '../workerQr';
import { WorkerFormDialog } from './WorkerFormDialog';
import { WorkerFormField } from './WorkerFormField';

type Props = { session: Session; apparatusId: string; onClose: () => void; onOrder: (apparatusId: string, orderId: string, qr: string) => void };
type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';

class QrLookupError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

async function post(session: Session, path: string, body: JsonObject, signal: AbortSignal): Promise<JsonObject> {
  const response = await authorizedFetch(session, path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });
  let result: JsonObject;
  try { result = object(await response.json()); }
  catch { throw new QrLookupError('invalid_response', 'Server javobini o‘qib bo‘lmadi.'); }
  if (!response.ok || result.ok !== true) {
    const code = string(result.error);
    throw new QrLookupError(code, string(result.detail) || code || `Server xatosi (${response.status})`);
  }
  return result;
}

async function findOrder(session: Session, apparatus: string, qr: string, signal: AbortSignal): Promise<string> {
  const base = '/v1/mobile/admin/production-maps';
  let batch: JsonObject;
  let opening = false;
  try {
    const result = await post(session, `${base}/progress-qr/lookup`, { qr_payload: qr, require_active_order: true }, signal);
    batch = object(result.batch);
  } catch (error) {
    if (!(error instanceof QrLookupError) || !['progress_batch_not_found', 'progress_qr_not_found'].includes(error.code)) throw error;
    const result = await post(session, `${base}/opening-wip/qr/report`, { qr_payload: qr }, signal);
    const record = object(result.record);
    const intake = object(record.intake);
    const batches = Array.isArray(record.batches) ? record.batches.map(object) : [];
    batch = batches.find(item => string(item.qr_payload).toUpperCase() === qr.toUpperCase() || string(item.batch_id) === qr) ?? {};
    if (string(intake.status).toLowerCase() !== 'confirmed' || string(intake.order_id) !== string(batch.order_id)) {
      throw new QrLookupError('invalid_response', 'QR ma’lumoti mos kelmadi.');
    }
    opening = true;
  }
  const orderId = string(batch.order_id);
  if (!orderId) throw new QrLookupError('invalid_response', 'QR uchun buyurtma topilmadi.');
  const status = string(batch.wip_status).toLowerCase();
  if (status !== 'waiting') throw new QrLookupError('not_waiting', status === 'in_use' ? 'Bu rulon hozir ishlatilmoqda.' : 'Bu rulon allaqachon ishlatilgan yoki bekor qilingan.');
  const scope = { apparatus, order_id: orderId, qr_payload: qr };
  await post(session, `${base}/${opening ? 'opening-wip/lookup' : 'progress-qr/lookup'}`,
    opening ? scope : { ...scope, require_active_order: true }, signal);
  return orderId;
}

export function WorkerQrScanner({ session, apparatusId, onClose, onOrder }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState('');
  const active = useRef(true);
  const scanLock = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; request.current?.abort(); };
  }, []);
  async function scan(raw: string) {
    const qr = workerQrPayload(raw);
    if (!qr || scanLock.current) return;
    scanLock.current = true; setBusy(true); setError('');
    const scope = sessionReadScope(session);
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const id = await findOrder(session, apparatusId, qr, controller.signal);
      if (active.current && activeSessionToken(session) && scope === sessionReadScope(session)) onOrder(apparatusId, id, qr);
    } catch (error) {
      if (active.current) setError(error instanceof Error ? error.message : 'QR kodni tekshirib bo‘lmadi.');
    } finally {
      clearTimeout(timer); request.current = null; scanLock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return <SafeAreaView style={styles.screen}>
    <Host matchContents={{ vertical: true }} style={styles.header} colorScheme="light" seedColor="#285140">
      <Column spacing={8}>
        <Button label="‹ Orqaga" variant="text" onPress={onClose} />
        <Text textStyle={{ fontSize: 22, fontWeight: '700', color: '#172a20' }}>QR skanerlash</Text>
        <Text textStyle={{ fontSize: 14, color: '#52635a' }}>Rulon kodini kamera markaziga olib keling. Buyurtma ochiladi.</Text>
      </Column>
    </Host>
    {!apparatusId ? <View style={styles.message}><Host matchContents colorScheme="light"><Text>Avval aparatni tanlang.</Text></Host></View>
      : permission?.granted ? <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix'] }} onBarcodeScanned={busy || manualOpen || !!error ? undefined : ({ data }) => { void scan(data); }} />
      : <View style={styles.message}><Host matchContents colorScheme="light"><Button label="Kameraga ruxsat berish" onPress={() => { void requestPermission(); }} /></Host></View>}
    {busy ? <ActivityIndicator size="large" color="#285140" style={styles.status} /> : null}
    {error ? <Host matchContents={{ vertical: true }} style={styles.message} colorScheme="light" seedColor="#285140"><Column spacing={8}>
      <Text textStyle={{ color: '#a62727', fontSize: 14 }}>{error}</Text>
      <Button label="Qayta skanerlash" variant="outlined" onPress={() => setError('')} />
    </Column></Host> : null}
    <Host matchContents={{ vertical: true }} style={styles.message} colorScheme="light"><Button label="Kodni qo‘lda kiritish" variant="text" disabled={busy} onPress={() => setManualOpen(true)} /></Host>
    <WorkerFormDialog visible={manualOpen} title="Kodni qo‘lda kiritish" cancelLabel="Bekor qilish" onCancel={() => setManualOpen(false)}
      confirmLabel="Tekshirish" confirmDisabled={busy || !manual.trim()} onConfirm={() => { setManualOpen(false); void scan(manual); }}>
      <WorkerFormField label="QR" initialValue={manual} onChangeText={setManual} />
    </WorkerFormDialog>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f9fb' },
  header: { width: '100%', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18 },
  camera: { height: 340, marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: '#1a231e' },
  message: { width: '100%', paddingHorizontal: 20, paddingVertical: 12 },
  status: { padding: 12 },
});
