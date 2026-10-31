import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { WorkerRadioChoiceProps } from './workerDialogTypes';
import { useWorkerColors } from './useWorkerColors';

export function WorkerRadioChoice({ label, selected, disabled, onPress }: WorkerRadioChoiceProps) {
  const colors = useWorkerColors();
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={styles.row}>
    <SymbolView name={{ ios: selected ? 'checkmark.circle.fill' : 'circle', android: selected ? 'radio_button_checked' : 'radio_button_unchecked', web: selected ? 'radio_button_checked' : 'radio_button_unchecked' }} size={22} tintColor={colors.icon} />
    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 } });
