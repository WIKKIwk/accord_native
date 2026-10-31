import { useMaterialColors } from '@expo/ui/jetpack-compose';

export function useWorkerColors() {
  const colors = useMaterialColors();
  return { background: colors.surfaceContainerLow, surface: colors.surface, field: colors.surfaceContainerHighest, text: colors.onSurface, muted: colors.onSurfaceVariant, icon: colors.onSurfaceVariant, clear: colors.onSurfaceVariant };
}
