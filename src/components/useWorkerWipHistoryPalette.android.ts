import { useMaterialColors } from '@expo/ui/jetpack-compose';

export function useWorkerWipHistoryPalette() {
  const colors = useMaterialColors({});
  return {
    summary: colors.tertiaryContainer, summaryText: colors.onTertiaryContainer,
    summaryChip: `${colors.onTertiaryContainer.slice(0, 7)}1F`,
    card: colors.surface, cardText: colors.onSurface, cardMuted: colors.onSurfaceVariant,
    number: colors.secondaryContainer, numberText: colors.onSecondaryContainer,
    onPrimary: colors.onPrimary,
    status: {
      waiting: { backgroundColor: colors.tertiaryContainer, color: colors.onTertiaryContainer },
      inUse: { backgroundColor: colors.primaryContainer, color: colors.onPrimaryContainer },
      processed: { backgroundColor: colors.secondaryContainer, color: colors.onSecondaryContainer },
    },
  };
}
