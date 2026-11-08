import { Camera } from 'expo-camera';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { CameraPermissionController } from './CameraPermissionController';

/** Read on mount without prompting. The role controls requests and must re-check its owner/session after every await. */
export function useCameraSurfacePermission() {
  const controller = useMemo(() => new CameraPermissionController(Camera.getCameraPermissionsAsync, Camera.requestCameraPermissionsAsync), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.mount(); return () => controller.unmount(); }, [controller]);
  return { ...state, canUseCamera: controller.canUseCamera, requestPermission: controller.requestPermission, refreshPermission: controller.refreshPermission };
}
