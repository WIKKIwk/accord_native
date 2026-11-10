import { FilledTonalIconButton, Host, IconButton, RNHostView, useMaterialColors } from '@expo/ui/jetpack-compose';
import { semantics, size } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import type { WorkerIconButtonProps } from './workerDialogTypes';

export function WorkerIconButton({ icon, label, onPress, tonal }: WorkerIconButtonProps) {
  const colors = useMaterialColors();
  if (icon === 'close') {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      hitSlop={4} android_ripple={{ borderless: false }}
      style={[styles.close, tonal && { backgroundColor: colors.secondaryContainer }]}>
      <SymbolView name={{ android: 'close' }} size={20} tintColor={colors.onSurfaceVariant} />
    </Pressable>;
  }
  const Component = tonal ? FilledTonalIconButton : IconButton;
  return <Host matchContents style={{ width: 40, height: 40 }}>
    <Component onClick={onPress} modifiers={[size(40, 40), semantics({ contentDescription: label })]}>
      <RNHostView matchContents><SymbolView name={{ android: icon === 'back' ? 'arrow_back' : icon === 'photo' ? 'add_photo_alternate' : icon === 'scannedWips' ? 'qr_code_scanner' : icon }} size={20} tintColor={colors.onSurfaceVariant} /></RNHostView>
    </Component>
  </Host>;
}

const styles = StyleSheet.create({
  close: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
