import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { materialLinkStatusLabel } from '../workerMaterialLinkApi';
import { WorkerAlert } from './WorkerAlert';
import { WorkerOrderButton } from './WorkerOrderControls';
import { useWorkerColors } from './useWorkerColors';
import { useMaterialLinkRequestPanel, useWorkerMaterialUsePanel, type WorkerMaterialPanelProps } from './useWorkerMaterialPanels';

/** @v2 WorkerMaterialUsePanel */
export function WorkerMaterialUsePanel(props: WorkerMaterialPanelProps) {
  const { controller: state, text: { p, t }, alert, dismissAlert, cancelAlert } = useWorkerMaterialUsePanel(props), colors = useWorkerColors();
  const [permission, askPermission] = useCameraPermissions(), lastScan = useRef({ value: '', at: 0 });
  useEffect(() => { if (state.scannerOpen && permission?.status === 'undetermined') void askPermission(); }, [state.scannerOpen, permission?.status, askPermission]);
  if (!state.candidates.length && !state.busy && !state.confirming) return null;
  return <View style={{ gap: 12 }}>
    <WorkerOrderButton label={p('worker.material_use.button')} disabled={props.actionsEnabled === false || state.busy || state.confirming || !state.candidates.length} onPress={() => { void state.toggleScanner(); }} />
    {state.scannerOpen && <View style={{ alignItems: 'center', gap: 10 }}>
      {permission?.granted ? <CameraView style={{ width: 218, height: 218, borderRadius: 24, overflow: 'hidden' }} barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix'] }}
        onBarcodeScanned={props.actionsEnabled === false || state.busy || state.confirming ? undefined : ({ data }) => {
          const now = Date.now(); if (lastScan.current.value === data && now - lastScan.current.at < 2_000) return;
          lastScan.current = { value: data, at: now }; void state.scan(data);
        }} /> : <WorkerOrderButton label={t('Kameraga ruxsat berish')} onPress={() => { void askPermission(); }} />}
      <Text accessibilityLiveRegion="polite" style={{ color: state.feedback === 'rejected' ? colors.error : colors.text, textAlign: 'center' }}>{state.feedbackText || p('worker.material_use.scan')}</Text>
    </View>}
    <WorkerAlert alert={alert} onDismiss={dismissAlert} onCancel={cancelAlert} />
  </View>;
}

/** @v2 MaterialLinkRequestPanel */
export function MaterialLinkRequestPanel(props: WorkerMaterialPanelProps) {
  const { controller: state, text: { t }, available } = useMaterialLinkRequestPanel(props), colors = useWorkerColors();
  if (!available && !state.latest.length && !state.error) return null;
  return <View style={{ gap: 10 }}>
    {available && <Text style={{ color: colors.text }}>{t(`Apparat oldidagi ${state.overview!.candidates.length} ta mos rulondan keraklisini tanlab so‘rov yuboring`)}</Text>}
    {state.latest.map(request => <View key={request.id} style={{ gap: 6 }}>
      <Text style={{ color: colors.text }}>{`${request.moverName}: ${t(materialLinkStatusLabel(request.status))}`}</Text>
      <Text style={{ color: colors.muted }}>{`${t('So‘ralgan rulonlar:')} ${request.rolls.map(roll => roll.barcode).join(', ')}`}</Text>
      {!!request.reason && <Text style={{ color: colors.text }}>{request.reason}</Text>}
      {request.status === 'pending' && <WorkerOrderButton label={t('So‘rovni bekor qilish')} variant="text" disabled={props.actionsEnabled === false || state.busy} onPress={() => { void state.cancel(request); }} />}
    </View>)}
    {!!state.error && <><Text accessibilityRole="alert" style={{ color: colors.error }}>{t(state.error)}</Text><WorkerOrderButton label={t('Holatni yangilash')} variant="text" disabled={props.actionsEnabled === false || state.busy} onPress={() => { void state.refresh(); }} /></>}
    {(available || state.hasPending) && <WorkerOrderButton label={t(state.hasPending ? 'Tasdiq kutilmoqda' : 'Ulash uchun so‘rov')}
      disabled={props.actionsEnabled === false || state.busy || state.hasPending || !available} onPress={() => { void state.send(); }} />}
    {props.allowNewRequests !== false && !state.overview?.candidates.length && !state.hasPending && !!state.latest.length && <Text style={{ color: colors.muted }}>{t('Hozir bu orderga ulash mumkin bo‘lgan bo‘sh rulon yo‘q')}</Text>}
  </View>;
}
