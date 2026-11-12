import { FilledTonalIconButton, Host, Icon, IconButton, RNHostView, useMaterialColors } from '@expo/ui/jetpack-compose';
import { semantics, size } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import type { WorkerIconButtonProps } from './workerDialogTypes';

export function WorkerIconButton({ icon, label, onPress, tonal, size: buttonSize = 40 }: WorkerIconButtonProps) {
  const colors = useMaterialColors();
  const iconSize = buttonSize >= 48 ? 24 : 20;
  if (icon === 'close') {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      hitSlop={4} android_ripple={{ borderless: false }}
      style={[styles.close, buttonSize !== 40 && { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 }, tonal && { backgroundColor: colors.secondaryContainer }]}>
      <SymbolView name={{ android: 'close' }} size={iconSize} tintColor={colors.onSurfaceVariant} />
    </Pressable>;
  }
  const Component = tonal ? FilledTonalIconButton : IconButton;
  return <Host matchContents style={{ width: buttonSize, height: buttonSize, ...(icon === 'scannedWips' ? { flexShrink: 0 } : {}) }}>
    <Component onClick={onPress} modifiers={[size(buttonSize, buttonSize), semantics({ contentDescription: label })]}>
      {icon === 'scannedWips' ? <Icon source={require('../../assets/icons/worker/qr_code_scanner.xml')} size={iconSize} tint={colors.onSecondaryContainer} />
        : <RNHostView matchContents><SymbolView name={{ android: icon === 'back' ? 'arrow_back' : icon === 'photo' ? 'add_photo_alternate' : icon }} size={iconSize} tintColor={colors.onSurfaceVariant} /></RNHostView>}
    </Component>
  </Host>;
}

const styles = StyleSheet.create({
  close: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
