import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { DeviceSheet } from '../shared/printing/DeviceSheet';
import { usePreparationText } from '../preparation/PreparationUI';
import type { createNativeTransientDevicePicker } from '../shared/printing/transientDevicePickerRuntime';
import type { RawSplitPickerCoordinator } from './rawSplitPickerCoordinator';
import { useRawSplitPickerOverlay } from './useRawSplitPickerOverlay';

type Request = ReturnType<typeof createNativeTransientDevicePicker>;
export function RawSplitPickerOverlay({ request, owner }: { request: Request; owner: RawSplitPickerCoordinator }) {
  const close = useRawSplitPickerOverlay(request, owner);
  return <WorkerOrderSheet dismissible onClose={close}>
    <DeviceSheet operator={request.adapter} close={close} useText={usePreparationText} safe />
  </WorkerOrderSheet>;
}
