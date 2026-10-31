import { Button, Host, Text } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, frame } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Platform, View } from 'react-native';

export function WorkerPreflightButton({ onPress }: { onPress: () => void }) {
  const [width, setWidth] = useState(0);
  return <View style={{ width: '100%' }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {width > 0 && <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Button onPress={onPress} modifiers={[buttonStyle(Number(Platform.Version) >= 26 ? 'glassProminent' : 'borderedProminent'), buttonBorderShape('capsule'), controlSize('large')]}>
        <Text modifiers={[frame({ width: Math.max(0, width - 32), height: 34 })]}>Rang chiqarish</Text>
      </Button>
    </Host>}
  </View>;
}
