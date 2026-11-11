import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAccountSwitcherLauncher } from './useAccountSwitcherLauncher';

/** One responder owns tap and hold, so the hold fires while the finger is down. */
export function ProfilePressTarget({ onPress, children }: { onPress?: () => void; children: ReactNode }) {
  const switcher = useAccountSwitcherLauncher(onPress);
  return <Pressable accessibilityRole="button" accessibilityLabel="Profil" accessibilityHint={switcher.hint}
    testID="header-profile" delayLongPress={500} onPress={switcher.onPress} onLongPress={switcher.open}
    style={({ pressed }) => [styles.target, pressed && styles.pressed]}>
    {children}
  </Pressable>;
}

const styles = StyleSheet.create({
  target: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  pressed: { opacity: 0.6 },
});
