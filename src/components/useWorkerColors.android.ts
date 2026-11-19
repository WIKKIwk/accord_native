import { useBaseTheme } from './useBaseTheme';

export function useWorkerColors() {
  const { colors } = useBaseTheme();
  return { error: colors.error, background: colors.surfaceContainerLow, surface: colors.surface, field: colors.surfaceContainerHighest, text: colors.onSurface, muted: colors.onSurfaceVariant, icon: colors.onSurfaceVariant, clear: colors.onSurfaceVariant };
}
