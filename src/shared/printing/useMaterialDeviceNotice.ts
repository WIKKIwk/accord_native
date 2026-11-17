import { useEffect } from 'react';
import { usePreparationNotice } from '../../preparation/usePreparationNotice';
import type { MaterialDevicePickerContext } from './devicePickerTypes';
import type { useDevicePicker } from './useDevicePicker';

/** @v2 selectOfflinePrintDevice: USB failure remains a four-second snackbar. */
export function useMaterialDeviceNotice(picker: ReturnType<typeof useDevicePicker>, context: MaterialDevicePickerContext) {
  const { message, show } = usePreparationNotice(), connection = picker.device.connection, { error, usbErrorRevision } = picker, current = context.isCurrent;
  useEffect(() => {
    if (connection === 'usb' && error && usbErrorRevision && current()) show(error);
  }, [connection, error, usbErrorRevision, current, show]);
  return message;
}
