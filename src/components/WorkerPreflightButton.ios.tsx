import { WorkerOrderButton } from './WorkerOrderControls';

export function WorkerPreflightButton({ onPress, label = 'Rang chiqarish', outlined = false, disabled: isDisabled }: { onPress: () => void; label?: string; outlined?: boolean; disabled?: boolean }) {
  return <WorkerOrderButton label={label} onPress={onPress} disabled={!!isDisabled} variant={outlined ? 'outlined' : 'filled'} />;
}
