import { PlatformColor, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DeviceSheet } from '../shared/printing/DeviceSheet';
import { usePreparationText } from '../preparation/PreparationUI';
import type { createNativeTransientDevicePicker } from '../shared/printing/transientDevicePickerRuntime';
import type { RawSplitPickerCoordinator } from './rawSplitPickerCoordinator';
import { useRawSplitPickerOverlay } from './useRawSplitPickerOverlay';

type Request = ReturnType<typeof createNativeTransientDevicePicker>;
export function RawSplitPickerOverlay({ request, owner }: { request: Request; owner: RawSplitPickerCoordinator }) {
  const close = useRawSplitPickerOverlay(request, owner);
  return <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: PlatformColor('systemBackground') }}>
    <SafeAreaView style={{ flex: 1 }}><DeviceSheet operator={request.adapter} close={close} useText={usePreparationText} safe printerOnly /></SafeAreaView>
  </View>;
}
