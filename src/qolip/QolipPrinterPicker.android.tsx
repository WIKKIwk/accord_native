import { Text } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { DeviceSheet } from '../shared/printing/DeviceSheet.android';
import type { DevicePickerAdapter } from '../shared/printing/devicePickerTypes';
function Label({ children }: { children: string }) { const colors = useWorkerColors(); return <Text style={{ color: colors.text }}>{children}</Text>; }
export function QolipPrinterPicker({ operator, close }: { operator: DevicePickerAdapter; close(): void }) {
  return <DeviceSheet operator={operator} close={close} useText={usePreparationText} Label={Label} Action={WorkerSheetButton} safe />;
}
