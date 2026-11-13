import { Button, Column, Host, ListItem, RNHostView } from '@expo/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  displayName: string;
  canTransfer?: boolean;
  showDailyWork?: boolean;
  paddons?: import('../shared/navigation/roleDrawerModel').RoleDrawerItem[];
  children: ReactNode;
  onOpen: () => void;
  active: string;
};

type Destination = { id: string; label: string; symbol: SymbolViewProps['name'] };
const destinations: Destination[] = [
  { id: 'queue', label: 'Kuzatish', symbol: { ios: 'list.bullet.rectangle', android: 'view_list', web: 'view_list' } },
  { id: 'daily', label: 'Kunlik ish', symbol: { ios: 'calendar', android: 'today', web: 'today' } },
  { id: 'instructions', label: 'App yo‘riqnomasi', symbol: { ios: 'book', android: 'menu_book', web: 'menu_book' } },
  { id: 'transfer', label: 'Joylashtirish va transfer', symbol: { ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' } },
  { id: 'profile', label: 'Profil', symbol: { ios: 'person', android: 'person', web: 'person' } },
];

export function WorkerDrawer({ visible, onClose, onSelect, displayName, canTransfer = false, children }: Props) {
  const inset = useSafeAreaInsets();
  const [slide] = useState(() => new Animated.Value(-272));
  useEffect(() => {
    if (!visible) { slide.setValue(-272); return; }
    Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [visible, slide]);
  function select(id: string) {
    onClose();
    onSelect(id);
  }
  return (
    <View style={{ flex: 1 }}>
    {children}
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Menyuni yopish" />
        <Animated.View style={[styles.drawer, { paddingTop: inset.top + 12, paddingBottom: Math.max(inset.bottom, 14), transform: [{ translateX: slide }] }]}>
          <Text style={styles.title}>Bo‘limlar</Text>
          <Host colorScheme="light" seedColor="#466251" matchContents={{ vertical: true }} style={styles.items}>
            <Column spacing={2}>
              {destinations.filter(item => item.id !== 'transfer' || canTransfer).map(item => (
                <ListItem
                  key={item.id}
                  onPress={() => select(item.id)}
                  supportingText={item.id === 'profile' && displayName ? displayName : undefined}
                  colors={item.id === 'queue' ? { containerColor: '#dceade', contentColor: '#1d382a' } : { containerColor: '#f3f6f2', contentColor: '#283d31' }}
                  leading={<RNHostView matchContents><SymbolView name={item.symbol} size={23} tintColor="#415449" /></RNHostView>}
                >{item.label}</ListItem>
              ))}
            </Column>
          </Host>
          <View style={styles.spacer} />
          <Host colorScheme="light" seedColor="#466251" matchContents={{ vertical: true }} style={styles.logout}>
            <Button label="Chiqish" variant="filled" onPress={() => select('logout')} />
          </Host>
        </Animated.View>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)' },
  drawer: { flex: 1, width: 272, backgroundColor: '#f3f6f2', borderTopRightRadius: 18, borderBottomRightRadius: 18, overflow: 'hidden' },
  title: { color: '#405147', fontSize: 16, fontWeight: '700', paddingHorizontal: 18, paddingBottom: 10 },
  items: { width: '100%' },
  spacer: { flex: 1 },
  logout: { width: '100%', paddingHorizontal: 12 },
});
