import { usePreparationText } from '../preparation/PreparationUI.ios';
import { DeviceSheet } from '../shared/printing/DeviceSheet.ios';
import type { DevicePickerAdapter } from '../shared/printing/devicePickerTypes';
export function QolipPrinterPicker({ operator, close }: { operator: DevicePickerAdapter; close(): void }) {
  return <DeviceSheet operator={operator} close={close} useText={usePreparationText} safe />;
}
