import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
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
  const close = useRawSplitPickerOverlay(request, owner);
  return <WorkerOrderSheet onClose={close} dismissible fitContent>
    <DeviceSheet operator={request.adapter} close={close} useText={usePreparationText}
      Label={PreparationText} Action={Action} safe />
  </WorkerOrderSheet>;
}
