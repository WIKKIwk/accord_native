import { Button, Host, HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { disabled, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
export function QolipCatalogPickerRow({ title, subtitle, onPress, set = false, disabled: unavailable }: {
  title: string; subtitle: string; onPress(): void; first?: boolean; last?: boolean; set?: boolean; disabled?: boolean;
}) {
  return <Host matchContents={{ vertical: true }}><Button onPress={onPress} modifiers={[disabled(!!unavailable)]}><HStack spacing={12} modifiers={[frame({ maxWidth: Infinity, minHeight: 56, alignment: 'leading' }), padding({ vertical: 8 })]}>
    {set && <Image systemName="square.stack.3d.up" />}<VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ textStyle: 'body' }), foregroundStyle(PlatformColor('label'))]}>{title}</Text>
      {!!subtitle && <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(PlatformColor('secondaryLabel'))]}>{subtitle}</Text>}
    </VStack>
  </HStack></Button></Host>;
}
