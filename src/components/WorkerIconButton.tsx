import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import type { WorkerIconButtonProps } from './workerDialogTypes';
import { useWorkerColors } from './useWorkerColors';

export function WorkerIconButton({ icon, label, onPress, tonal }: WorkerIconButtonProps) {
  const colors = useWorkerColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.button, tonal && { backgroundColor: colors.surface }]}>
    <SymbolView name={{ android: icon, ios: icon === 'close' ? 'xmark' : icon === 'edit' ? 'pencil' : 'checkmark', web: icon }} size={20} tintColor={colors.icon} />
  </Pressable>;
}

const styles = StyleSheet.create({ button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' } });
