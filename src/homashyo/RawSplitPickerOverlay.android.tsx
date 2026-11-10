import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { PreparationText, usePreparationText } from '../preparation/PreparationUI.android';
import { DeviceSheet } from '../shared/printing/DeviceSheet';
import type { createNativeTransientDevicePicker } from '../shared/printing/transientDevicePickerRuntime';
import type { RawSplitPickerCoordinator } from './rawSplitPickerCoordinator';
import { useRawSplitPickerOverlay } from './useRawSplitPickerOverlay';

type Request = ReturnType<typeof createNativeTransientDevicePicker>;
function Action({ label, detail, onPress, disabled }: { label: string; detail?: string; onPress(): void; disabled?: boolean }) {
  const t = usePreparationText();
  return <WorkerSheetButton label={detail ? `${t(label)} · ${detail}` : t(label)} onPress={onPress} disabled={disabled} />;
}
export function RawSplitPickerOverlay({ request, owner }: { request: Request; owner: RawSplitPickerCoordinator }) {
  const colors = useMaterialColors(), close = useRawSplitPickerOverlay(request, owner);
  return <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.surface }}>
    <SafeAreaView style={{ flex: 1 }}><DeviceSheet operator={request.adapter} close={close} useText={usePreparationText}
      Label={PreparationText} Action={Action} safe printerOnly /></SafeAreaView>
  </View>;
}
