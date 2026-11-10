import { Button, Column, Host, Text } from '@expo/ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activeSessionToken, captureSessionWitness, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { workerQrPayload } from '../workerQr';
import type { Apparatus } from '../workerApi';
import { prepareWorkerFabQr, WorkerFabGuidance, workerFabErrorText } from '../workerFabQr';
import { workerFabQrReads } from '../workerFabQrReads';
import { useWorkerOrderText } from './useWorkerOrderText';
import { WorkerAlert } from './WorkerAlert';
import { WorkerFormDialog } from './WorkerFormDialog';
import { WorkerFormField } from './WorkerFormField';

type Props = { session: Session; apparatusId: string; apparatus?: Apparatus; getSnapshot: () => Record<string, any> | null; apparatusLabel: (id: string) => string; onClose: () => void; onOrder: (apparatusId: string, orderId: string, qr: string, switching?: boolean) => void };
export function WorkerQrScanner({ session, apparatusId, apparatus, getSnapshot, apparatusLabel, onClose, onOrder }: Props) {
  const { p } = useWorkerOrderText();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState('');
  const active = useRef(true);
  const scanLock = useRef(false);
  const request = useRef<AbortController | null>(null);
  const pendingManual = useRef<{ qr: string; witness: SessionWitness | null } | null>(null);
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
    const current = () => active.current && !controller.signal.aborted && !!activeSessionToken(session) && scope === sessionReadScope(session);
    const reads = workerFabQrReads(session, apparatusId, getSnapshot, current);
    try {
      if (!apparatus) throw new WorkerFabGuidance(p('worker.qr.select_apparatus'));
      const target = await prepareWorkerFabQr(session, apparatus, qr, reads, p, apparatusLabel);
      if (reads.current()) onOrder(apparatusId, target.orderId, qr, target.switching);
    } catch (error) {
      if (reads.current()) setError(workerFabErrorText(error, p));
    } finally {
      request.current = null; scanLock.current = false;
      if (active.current) setBusy(false);
    }
  }
  function manualDismissed() {
    const pending = pendingManual.current; pendingManual.current = null;
    if (pending && active.current && isSessionWitnessCurrent(pending.witness)) void scan(pending.qr);
  }
  function confirmManual() {
    const qr = workerQrPayload(manual);
    if (!qr || scanLock.current) return;
    pendingManual.current = { qr, witness: captureSessionWitness(session) };
    setManualOpen(false);
    if (Platform.OS !== 'ios') manualDismissed();
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
    <WorkerAlert alert={error ? { title: p('worker.qr.guidance.title'), message: error, confirmLabel: p('worker.action.close') } : null} onDismiss={() => setError('')} />
    <Host matchContents={{ vertical: true }} style={styles.message} colorScheme="light"><Button label="Kodni qo‘lda kiritish" variant="text" disabled={busy} onPress={() => setManualOpen(true)} /></Host>
    <WorkerFormDialog visible={manualOpen} title="Kodni qo‘lda kiritish" cancelLabel="Bekor qilish" onCancel={() => setManualOpen(false)}
      confirmLabel="Tekshirish" confirmDisabled={busy || !manual.trim()} onConfirm={confirmManual} onDismiss={manualDismissed}>
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
