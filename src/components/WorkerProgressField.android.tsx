import { OutlinedTextField, Shape, Text, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { BaseHost } from './BaseHost';

type Props = { label: string; onChangeText: (value: string) => void; keyboardType?: 'decimal-pad' | 'default'; initialValue?: string; multiline?: boolean };

export function WorkerProgressField({ label, onChangeText, keyboardType, initialValue = '', multiline = false }: Props) {
  const value = useNativeState(initialValue);
  const colors = useMaterialColors({});
  return <BaseHost dynamicColors matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <OutlinedTextField value={value} onValueChange={onChangeText} singleLine={!multiline}
      keyboardOptions={{ keyboardType: keyboardType === 'decimal-pad' ? 'decimal' : 'text', autoCorrectEnabled: false }}
      shape={Shape.RoundedCorner({ cornerRadii: { topStart: 12, topEnd: 12, bottomStart: 12, bottomEnd: 12 } })}
      colors={{ focusedContainerColor: colors.surface, unfocusedContainerColor: colors.surface }} modifiers={[fillMaxWidth()]}>
      <OutlinedTextField.Label><Text>{label}</Text></OutlinedTextField.Label>
    </OutlinedTextField>
  </BaseHost>;
}
