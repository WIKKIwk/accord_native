import { Button, Host } from '@expo/ui';

export function WorkerPreflightButton({ onPress }: { onPress: () => void }) {
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Button label="Rang chiqarish" onPress={onPress} variant="filled" style={{ height: 58 }} /></Host>;
}
