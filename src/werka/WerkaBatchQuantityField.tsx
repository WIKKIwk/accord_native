import { Host, TextInput, useNativeState } from '@expo/ui';
import { Text, View } from 'react-native';

/** Owner changes the key when clearing/replacing this native field programmatically. */
export function WerkaBatchQuantityField({ label, initial, unit, onChange }: {
  label: string; initial: string; unit: string; onChange: (value: string) => void;
}) {
  const value = useNativeState(initial);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
    <Host matchContents={{ vertical: true }} style={{ flex: 1 }}><TextInput value={value} accessibilityLabel={label} placeholder="0"
      keyboardType="decimal-pad" autoCapitalize="none" onChangeText={onChange} style={{ width: '100%' }} /></Host>
    <Text>{unit}</Text>
  </View>;
}
