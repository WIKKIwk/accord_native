import { useBaseTheme } from './useBaseTheme';

export function useWorkerColors() {
  const { colors } = useBaseTheme();
  return { error: colors.error, background: colors.surface, surface: colors.surfaceContainer, field: colors.tertiaryContainer,
    text: colors.onSurface, muted: colors.onSurfaceVariant, icon: colors.primary, clear: colors.onSurfaceVariant };
}
