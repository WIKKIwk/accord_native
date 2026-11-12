import { useMaterialColors } from '@expo/ui/jetpack-compose';

export function useWorkerWipHistoryPalette() {
  const colors = useMaterialColors({});
  return {
    summary: colors.surface, summaryText: colors.onSurface,
    summaryChip: colors.surfaceContainerHighest,
    card: colors.surface, cardText: colors.onSurface, cardMuted: colors.onSurfaceVariant,
    number: colors.secondaryContainer, numberText: colors.onSecondaryContainer,
    onPrimary: colors.onPrimary,
    status: {
      waiting: { backgroundColor: colors.secondaryContainer, color: colors.onSecondaryContainer },
      inUse: { backgroundColor: colors.primaryContainer, color: colors.onPrimaryContainer },
      processed: { backgroundColor: colors.secondaryContainer, color: colors.onSecondaryContainer },
    },
  };
}
