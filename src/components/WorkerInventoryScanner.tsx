import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { WorkerFormField } from './WorkerFormField';
import { WorkerSheetButton } from './WorkerSheetButton';
import { useWorkerColors } from './useWorkerColors';
import type { WorkerInventorySurface } from './useWorkerInventorySurface';

export function WorkerInventoryScanner({ surface }: { surface: WorkerInventorySurface }) {
  const [permission, requestPermission] = useCameraPermissions(), [manual, setManual] = useState(''), [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false), processing = useRef(false), lastScan = useRef(''), mounted = useRef(true);
  const colors = useWorkerColors(), { t, owner, state } = surface;
  useEffect(() => {
    mounted.current = true;
    void requestPermission();
    return () => { mounted.current = false; };
  }, [requestPermission]);
  const lookup = async (raw: string) => {
    if (processing.current || !owner.current()) return;
    processing.current = true; setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try { await owner.lookup(raw); }
    finally { processing.current = false; if (mounted.current) setBusy(false); }
  };
  return <View style={{ padding: 12, gap: 10 }}>
    <Text style={{ color: colors.text }}>{t('QR orqali izlash')}</Text>
    {permission?.granted ? <CameraView style={{ height: 220, width: '100%' }} barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix'] }}
      onBarcodeScanned={surface.sheet || busy ? undefined : ({ data }) => { if (data !== lastScan.current) { lastScan.current = data; void lookup(data); } }} />
      : <WorkerSheetButton label={t('Kamera ochilmadi. Quyidagi maydonga QR yoki barcode kiriting.')} onPress={() => { void requestPermission(); }} />}
    <Text style={{ color: colors.text }}>{t(state.qrStatus)}</Text>
    <WorkerSheetButton label={t(manualOpen ? 'Barcode maydonini yopish' : 'Barcode kiritish')} onPress={() => setManualOpen(value => !value)} />
    {manualOpen ? <>
      <WorkerFormField label={t('QR / barcode')} onChangeText={setManual} />
      <WorkerSheetButton label={t('Qabul qilish')} disabled={busy || !manual.trim()} onPress={() => { void lookup(manual); }} />
    </> : null}
    <WorkerSheetButton label={t('QR izlashni yopish')} onPress={() => owner.toggleScanning()} />
  </View>;
}
