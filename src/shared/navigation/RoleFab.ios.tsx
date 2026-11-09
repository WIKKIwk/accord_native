import { MenuView } from '@expo/ui/community/menu';
import { SymbolView } from 'expo-symbols';
import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { PlatformColor, StyleSheet, View } from 'react-native';
import { createRoleFabStore, roleFabFingerprint, type RoleFabAction } from './roleFabMenu';

export type { RoleFabAction } from './roleFabMenu';
type Props = { actions: readonly RoleFabAction[]; onSelect: (id: string) => void | Promise<void>; isCurrent: () => boolean;
  onSelectionError?: (error: unknown) => void; resetKey: string; bottomOffset?: number;
  testIDPrefix?: string; openLabel?: string; closeLabel?: string };

/** Shared iOS role FAB using the same native MenuView and trigger pattern as Worker. */
export function RoleFab({ actions, onSelect, isCurrent, onSelectionError, resetKey, bottomOffset = 88, testIDPrefix = 'role-fab',
  openLabel = 'Amallar' }: Props) {
  const fingerprint = roleFabFingerprint(actions);
  const store = useMemo(() => createRoleFabStore(actions, resetKey, isCurrent, onSelect, fingerprint, onSelectionError),
    // The fingerprint catches in-place action changes; a new array also starts a fresh native menu.
    [actions, fingerprint, resetKey, isCurrent, onSelect, onSelectionError]);
  const entry = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useLayoutEffect(() => {
    // A fresh native event namespace is created for every committed effect,
    // including a cleanup/re-setup cycle with otherwise unchanged props.
    store.activate();
    return () => store.invalidate();
  }, [store]);
  if (!entry) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <MenuView key={entry.presentation.key} actions={entry.presentation.menuActions} testID={testIDPrefix} style={[styles.menu, { bottom: bottomOffset }]}
      onPressAction={event => entry.gate.select(entry.presentation.key, event?.nativeEvent?.event)}>
      <View style={styles.trigger} accessibilityRole="button" accessibilityLabel={openLabel}>
        <SymbolView name="plus.circle.fill" size={44} tintColor={PlatformColor('systemBlue')} />
      </View>
    </MenuView>
  </View>;
}

const styles = StyleSheet.create({
  menu: { position: 'absolute', right: 16, width: 56, height: 56 },
  trigger: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
