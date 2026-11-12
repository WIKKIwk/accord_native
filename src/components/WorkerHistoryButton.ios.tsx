import { Button, Image, ZStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, clipShape, contentShape, disabled,
  fixedSize, frame, opacity, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';

/** Native label owns the full hit area, including the space around the symbol. Render inside a SwiftUI Host. */
export function WorkerHistoryButton({ icon, label, onPress, disabled: inactive = false, testID }: {
  icon: 'qr' | 'reload' | 'close'; label: string; onPress(): void; disabled?: boolean; testID: string;
}) {
  const symbol = icon === 'qr' ? 'qrcode.viewfinder' : icon === 'reload' ? 'arrow.clockwise' : 'xmark';
  return <Button onPress={onPress} modifiers={[buttonStyle('plain'), fixedSize(), disabled(inactive),
    accessibilityLabel(label), accessibilityIdentifier(testID)]}>
    <ZStack modifiers={[frame({ width: 48, height: 48 }), background(PlatformColor('secondarySystemFill')), clipShape('circle'),
      contentShape(shapes.rectangle()), opacity(inactive ? 0.4 : 1)]}>
      <Image systemName={symbol} size={22} color={PlatformColor(icon === 'close' ? 'label' : 'systemBlue')} />
    </ZStack>
  </Button>;
}
