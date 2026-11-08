import { Camera } from 'expo-camera';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { CameraPermissionController } from './CameraPermissionController';

/** Read on mount without prompting. The role decides if and when to request or refresh permission. */
export function useCameraSurfacePermission() {
  const controller = useMemo(() => new CameraPermissionController(Camera.getCameraPermissionsAsync, Camera.requestCameraPermissionsAsync), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.mount(); return () => controller.unmount(); }, [controller]);
  return { ...state, requestPermission: controller.requestPermission, refreshPermission: controller.refreshPermission };
}
