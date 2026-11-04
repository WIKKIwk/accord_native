import { WorkerSheetButton } from './WorkerSheetButton';

export function WorkerPreflightButton({ onPress, label = 'Rang chiqarish', outlined = false }: { onPress: () => void; label?: string; outlined?: boolean }) {
  return <WorkerSheetButton label={label} onPress={onPress} variant={outlined ? 'outlined' : 'filled'} height={58}
    icon={{ android: 'colorize', ios: 'eyedropper' }} largeLabel />;
}
