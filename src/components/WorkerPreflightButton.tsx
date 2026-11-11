import { WorkerSheetButton } from './WorkerSheetButton';

export function WorkerPreflightButton({ onPress, label = 'Rang chiqarish', outlined = false, disabled }: { onPress: () => void; label?: string; outlined?: boolean; disabled?: boolean }) {
  return <WorkerSheetButton label={label} onPress={onPress} variant={outlined ? 'outlined' : 'filled'} height={58}
    icon={{ android: 'colorize', ios: 'eyedropper' }} disabled={disabled} largeLabel />;
}
