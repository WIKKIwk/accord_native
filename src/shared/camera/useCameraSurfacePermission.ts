import { useCameraPermissions } from 'expo-camera';

/** Read current permission without prompting. The role decides if and when to request or refresh it. */
export function useCameraSurfacePermission() {
  const [permission, requestPermission, refreshPermission] = useCameraPermissions({ get: true, request: false });
  return { permission, requestPermission, refreshPermission };
}
