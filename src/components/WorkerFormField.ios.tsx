import { Column, Host, Text, TextInput, useNativeState } from '@expo/ui';
import { textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { useWorkerColors } from './useWorkerColors';

type Props = { label: string; onChangeText: (value: string) => void; keyboardType?: 'decimal-pad' | 'default'; initialValue?: string };

export function WorkerFormField({ label, onChangeText, keyboardType, initialValue = '' }: Props) {
  const value = useNativeState(initialValue);
  const colors = useWorkerColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Column spacing={6} style={{ width: '100%' }}>
      <Text textStyle={{ fontSize: 13, color: colors.muted }}>{label}</Text>
      <TextInput value={value} accessibilityLabel={label} placeholder={label} onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'} autoCapitalize="none" style={{ width: '100%' }}
        modifiers={[textFieldStyle('roundedBorder')]} />
    </Column>
  </Host>;
}
