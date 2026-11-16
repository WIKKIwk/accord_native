import { Button, Host, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, frame } from '@expo/ui/swift-ui/modifiers';
import type { ItemGroupsPickerFieldProps } from './itemGroupsControlTypes';
export function ItemGroupsPickerField({ label, value, placeholder, enabled, onPress }: ItemGroupsPickerFieldProps) {
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={6}>
    <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>{label}</Text>
    <Button onPress={onPress} modifiers={[disabled(!enabled), buttonStyle('bordered'), frame({ maxWidth: Infinity, minHeight: 52 })]}>
      <HStack><Text>{value ?? placeholder}</Text><Spacer /><Image systemName="chevron.down" /></HStack>
    </Button>
  </VStack></Host>;
}
