import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, type ColorValue } from 'react-native';
import { useAccountSwitcherLauncher } from '../../components/useAccountSwitcherLauncher';
import { roleHeaderMetrics as metrics } from './roleNavigationMetrics';

type Props = { icon: 'menu' | 'back' | 'profile'; label: string; onPress: () => void; tintColor: ColorValue; testID?: string };

export function RoleProfileButton({ label, hint, onPress, onLongPress, tintColor, testID = 'header-profile', children }: {
  label: string; hint: string; onPress: () => void; onLongPress: () => void; tintColor?: ColorValue; testID?: string; children?: ReactNode;
}) {
  const isIOS = Platform.OS === 'ios';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    testID={testID} onPress={onPress} onLongPress={onLongPress} delayLongPress={500} hitSlop={isIOS ? 0 : 8}
    style={({ pressed }) => [styles.button, isIOS && styles.ios, pressed && styles.pressed]}>
    {children ?? <SymbolView name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
      size={isIOS ? 24 : 27} tintColor={tintColor} />}
  </Pressable>;
}

export function RoleHeaderButton({ icon, label, onPress, tintColor, testID }: Props) {
  if (icon === 'profile') return <ProfileAction label={label} onPress={onPress} tintColor={tintColor} testID={testID} />;
  const name = icon === 'menu' ? { ios: 'line.3.horizontal' as const, android: 'menu' as const, web: 'menu' as const }
    : { ios: 'chevron.left' as const, android: 'arrow_back' as const, web: 'arrow_back' as const };
  return <Pressable accessibilityRole="button" accessibilityLabel={label} testID={testID} onPress={onPress}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]} hitSlop={8}>
    <SymbolView name={name} size={25} tintColor={tintColor} />
  </Pressable>;
}

function ProfileAction({ onPress, ...props }: Omit<Props, 'icon'>) {
  const switcher = useAccountSwitcherLauncher(onPress);
  return <RoleProfileButton {...props} hint={switcher.hint} onPress={switcher.onPress} onLongPress={switcher.open} />;
}

const styles = StyleSheet.create({
  button: { width: metrics.buttonWidth, height: metrics.buttonHeight, justifyContent: 'center', alignItems: 'center' },
  ios: { width: 44, height: 44 },
  pressed: { opacity: 0.6 },
});
