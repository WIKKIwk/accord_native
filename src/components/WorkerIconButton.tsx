import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import type { WorkerIconButtonProps } from './workerDialogTypes';
import { useWorkerColors } from './useWorkerColors';

export function WorkerIconButton({ icon, label, onPress, tonal }: WorkerIconButtonProps) {
  const colors = useWorkerColors();
  const materialIcon = icon === 'back' ? 'arrow_back' : icon === 'photo' ? 'add_photo_alternate' : icon;
  const iosIcon = icon === 'close' ? 'xmark' : icon === 'edit' ? 'pencil' : icon === 'back' ? 'arrow.left' : icon === 'photo' ? 'photo.badge.plus' : 'checkmark';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.button, tonal && { backgroundColor: colors.surface }]}>
    <SymbolView name={{ android: materialIcon, ios: iosIcon, web: materialIcon }} size={20} tintColor={colors.icon} />
  </Pressable>;
}

const styles = StyleSheet.create({ button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' } });
