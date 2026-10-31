import { Button, Host, Text } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, frame } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Platform, View } from 'react-native';

export function WorkerPreflightButton({ onPress, label = 'Rang chiqarish', outlined = false }: { onPress: () => void; label?: string; outlined?: boolean }) {
  const [width, setWidth] = useState(0);
  const glass = Number(Platform.Version) >= 26;
  return <View style={{ width: '100%' }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {width > 0 && <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Button onPress={onPress} modifiers={[buttonStyle(outlined ? (glass ? 'glass' : 'bordered') : (glass ? 'glassProminent' : 'borderedProminent')), buttonBorderShape('capsule'), controlSize('large')]}>
        <Text modifiers={[frame({ width: Math.max(0, width - 32), height: 34 })]}>{label}</Text>
      </Button>
    </Host>}
  </View>;
}
