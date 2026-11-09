import { Column, Host, Text, TextButton } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import type { WerkaBatchCustomerPickerRowProps } from './werkaBatchCustomerPickerRowTypes';

export function WerkaBatchCustomerPickerRow({ title, subtitle, onPress }: WerkaBatchCustomerPickerRowProps) {
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <TextButton onClick={onPress} modifiers={[fillMaxWidth()]}><Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 6 }}>
      <Text style={{ typography: 'titleLarge' }}>{title}</Text>{subtitle ? <Text>{subtitle}</Text> : null}
    </Column></TextButton>
  </Host>;
}
