import { Button, Host } from '@expo/ui';

export function WorkerPreflightButton({ onPress, label = 'Rang chiqarish', outlined = false }: { onPress: () => void; label?: string; outlined?: boolean }) {
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Button label={label} onPress={onPress} variant={outlined ? 'outlined' : 'filled'} style={{ height: 58 }} /></Host>;
}
