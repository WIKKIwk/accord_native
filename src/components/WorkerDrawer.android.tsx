import { Button, Column, Host, ListItem, RNHostView } from '@expo/ui';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, type ReactNode } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Drawer } from 'react-native-drawer-layout';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean; onOpen: () => void; onClose: () => void;
  onSelect: (id: string) => void; displayName: string; canTransfer?: boolean;
  active: string; children: ReactNode;
};
type Destination = { id: string; label: string; symbol: SymbolViewProps['name'] };
const destinations: Destination[] = [
  { id: 'queue', label: 'Kuzatish', symbol: { android: 'view_list' } },
  { id: 'daily', label: 'Kunlik ish', symbol: { android: 'today' } },
  { id: 'instructions', label: 'App yo‘riqnomasi', symbol: { android: 'menu_book' } },
  { id: 'transfer', label: 'Joylashtirish va transfer', symbol: { android: 'swap_horiz' } },
  { id: 'profile', label: 'Profil', symbol: { android: 'person' } },
];

export function WorkerDrawer({ visible, onOpen, onClose, onSelect, displayName, canTransfer = false, active, children }: Props) {
  const colors = useMaterialColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [visible, onClose]);

  const select = (id: string) => { onClose(); onSelect(id); };
  return <GestureHandlerRootView style={styles.root}>
    <Drawer open={visible} onOpen={onOpen} onClose={onClose} drawerType="front"
      drawerStyle={{ width: Math.min(320, width - 56), backgroundColor: colors.surfaceContainerLow, borderTopRightRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden' }}
      overlayAccessibilityLabel="Menyuni yopish"
      renderDrawerContent={() => <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Text style={[styles.title, { color: colors.onSurfaceVariant }]}>Bo‘limlar</Text>
        <ScrollView style={styles.scroll}>
          <Host matchContents={{ vertical: true }} style={styles.items}>
            <Column spacing={2}>
              {destinations.filter(item => item.id !== 'transfer' || canTransfer).map(item => {
                const selected = item.id === active;
                const foreground = selected ? colors.onSecondaryContainer : colors.onSurface;
                return <ListItem key={item.id} onPress={() => select(item.id)}
                  supportingText={item.id === 'profile' && displayName ? displayName : undefined}
                  colors={{ containerColor: selected ? colors.secondaryContainer : colors.surfaceContainerLow, contentColor: foreground }}
                  leading={<RNHostView matchContents><SymbolView name={item.symbol} size={23} tintColor={foreground} /></RNHostView>}>
                  {item.label}
                </ListItem>;
              })}
            </Column>
          </Host>
        </ScrollView>
        <View style={styles.logout}>
          <Host matchContents={{ vertical: true }} style={styles.logoutHost}>
            <Button label="Chiqish" variant="filled" style={{ width: '100%', height: 56 }} onPress={() => select('logout')} />
          </Host>
        </View>
      </View>}>
      {children}
    </Drawer>
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', paddingHorizontal: 18, paddingBottom: 10 },
  scroll: { flex: 1 },
  items: { width: '100%' },
  logout: { width: '100%', paddingHorizontal: 12 },
  logoutHost: { width: '100%' },
});
