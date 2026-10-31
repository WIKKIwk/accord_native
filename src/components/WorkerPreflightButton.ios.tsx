import { Button, Host } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize } from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';

export function WorkerPreflightButton({ onPress }: { onPress: () => void }) {
  return <Host matchContents>
    <Button label="Rang chiqarish" onPress={onPress} modifiers={[buttonStyle(Number(Platform.Version) >= 26 ? 'glassProminent' : 'borderedProminent'), buttonBorderShape('capsule'), controlSize('large')]} />
  </Host>;
}
