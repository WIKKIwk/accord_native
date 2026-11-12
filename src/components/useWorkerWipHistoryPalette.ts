import { useWorkerColors } from './useWorkerColors';

export function useWorkerWipHistoryPalette() {
  const colors = useWorkerColors();
  const status = { backgroundColor: colors.surface, color: colors.text };
  return {
    summary: colors.surface, summaryText: colors.text, summaryChip: colors.field,
    card: colors.field, cardText: colors.text, cardMuted: colors.muted,
    number: colors.surface, numberText: colors.text, onPrimary: colors.text,
    status: { waiting: status, inUse: status, processed: status },
  };
}
