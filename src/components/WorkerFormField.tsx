import { Host, TextInput, useNativeState } from '@expo/ui';
import { StyleSheet, Text, View } from 'react-native';
import { useWorkerColors } from './useWorkerColors';

type Props = { label: string; onChangeText: (value: string) => void; keyboardType?: 'decimal-pad' | 'default'; initialValue?: string; multiline?: boolean };

export function WorkerFormField({ label, onChangeText, keyboardType, initialValue = '' }: Props) {
  const value = useNativeState(initialValue);
  const colors = useWorkerColors();
  return <View style={styles.field}><Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    <Host matchContents={{ vertical: true }} style={styles.host}>
      <TextInput value={value} placeholder={label} onChangeText={onChangeText} keyboardType={keyboardType ?? 'default'} autoCapitalize="none" />
    </Host>
  </View>;
}

const styles = StyleSheet.create({ field: { gap: 3 }, label: { fontSize: 13, color: '#52617a' }, host: { width: '100%' } });
