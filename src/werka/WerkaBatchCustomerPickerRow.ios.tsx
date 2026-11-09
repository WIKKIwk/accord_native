import { Button, Host, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, contentShape, font, frame, shapes } from '@expo/ui/swift-ui/modifiers';
import type { WerkaBatchCustomerPickerRowProps } from './werkaBatchCustomerPickerRowTypes';

export function WerkaBatchCustomerPickerRow({ title, subtitle, onPress }: WerkaBatchCustomerPickerRowProps) {
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
      <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle())]}>
        <Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
      </VStack>
    </Button>
  </Host>;
}
