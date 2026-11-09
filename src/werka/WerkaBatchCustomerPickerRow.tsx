import { Pressable, Text } from 'react-native';
import type { WerkaBatchCustomerPickerRowProps } from './werkaBatchCustomerPickerRowTypes';

export function WerkaBatchCustomerPickerRow({ title, subtitle, onPress }: WerkaBatchCustomerPickerRowProps) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ width: '100%', paddingVertical: 12 }}>
    <Text>{title}</Text>{subtitle ? <Text>{subtitle}</Text> : null}
  </Pressable>;
}
