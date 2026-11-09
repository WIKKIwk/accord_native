import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import type { RawSplitPickerCoordinator } from './rawSplitPickerCoordinator';
import type { createNativeTransientDevicePicker } from '../shared/printing/transientDevicePickerRuntime';

type Request = ReturnType<typeof createNativeTransientDevicePicker>;
/** StrictMode's temporary cleanup must not settle the live request. */
export function useRawSplitPickerOverlay(request: Request, owner: RawSplitPickerCoordinator): () => void {
  const lifetime = useRef({ mounts: 0 });
  useEffect(() => {
    const scope = lifetime.current; scope.mounts++;
    return () => { scope.mounts--; queueMicrotask(() => { if (scope.mounts === 0) owner.removed(request); }); };
  }, [owner, request]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { owner.dismiss(request); return true; });
    return () => subscription.remove();
  }, [owner, request]);
  return () => owner.dismiss(request);
}
