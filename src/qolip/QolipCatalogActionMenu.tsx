import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerSheetButton } from '../components/WorkerSheetButton';

/** The source create-hub is a floating action menu above the dock. */
export function QolipCatalogActionMenu({ actions, close }: { actions: readonly { id: string; label: string; onPress(): void }[]; close(): void }) {
  const insets = useSafeAreaInsets();
  useFocusEffect(useCallback(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; }); return () => listener.remove(); }, [close]));
  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
    <View style={{ position: 'absolute', right: 16, bottom: insets.bottom + 184, width: 288, gap: 8 }}>
      {actions.map(action => <WorkerSheetButton key={action.id} label={action.label} variant="filled" height={56} onPress={action.onPress} />)}
    </View>
  </View>;
}
