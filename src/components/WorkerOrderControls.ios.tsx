import { Button, HStack, Image, Text } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, disabled, font, frame, multilineTextAlignment } from '@expo/ui/swift-ui/modifiers';
import { Children, type ComponentProps, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { BaseHost as Host } from './BaseHost';
import type { WorkerSheetButton } from './WorkerSheetButton';

export function WorkerOrderButton({ label, onPress, disabled: inactive = false, variant = 'outlined', icon, largeLabel }: ComponentProps<typeof WorkerSheetButton>) {
  const symbol = typeof icon === 'string' ? icon : icon?.ios;
  const glass = parseInt(String(Platform.Version), 10) >= 26;
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Button onPress={onPress} modifiers={[buttonStyle(variant === 'filled' ? (glass ? 'glassProminent' : 'borderedProminent') : variant === 'text' ? 'plain' : (glass ? 'glass' : 'bordered')),
      buttonBorderShape('capsule'), controlSize('large'), disabled(inactive)]}>
      <HStack spacing={9} modifiers={[frame({ maxWidth: Infinity })]}>
        {symbol ? <Image systemName={symbol} size={19} /> : null}
        <Text modifiers={[font({ textStyle: largeLabel ? 'title3' : 'headline', weight: 'semibold' }), multilineTextAlignment('center')]}>{label}</Text>
      </HStack>
    </Button>
  </Host>;
}

export function WorkerOrderActionGroup({ children }: { children: ReactNode }) {
  return <View style={{ gap: 10 }}>{Children.toArray(children).reverse()}</View>;
}
