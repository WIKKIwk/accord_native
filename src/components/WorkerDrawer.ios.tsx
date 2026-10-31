import { Column, Host, ListItem, Text } from '@expo/ui';
import { Button } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, font, frame, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { Drawer, useDrawerProgress } from 'react-native-drawer-layout';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkerColors } from './useWorkerColors';

type Props = {
  visible: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
  displayName: string;
  canTransfer?: boolean;
  active: string;
  children: ReactNode;
};

type Destination = { id: string; label: string; symbol: SymbolViewProps['name'] };
const destinations: Destination[] = [
  { id: 'queue', label: 'Kuzatish', symbol: 'list.bullet.rectangle' },
  { id: 'daily', label: 'Kunlik ish', symbol: 'calendar' },
  { id: 'instructions', label: 'App yo‘riqnomasi', symbol: 'book' },
  { id: 'transfer', label: 'Joylashtirish va transfer', symbol: 'arrow.left.arrow.right' },
  { id: 'profile', label: 'Profil', symbol: 'person.crop.circle' },
];

function DrawerScreen({ children, dark }: { children: ReactNode; dark: boolean }) {
  const progress = useDrawerProgress();
  const rounded = useAnimatedStyle(() => ({
    borderTopLeftRadius: progress.value * 28,
    borderBottomLeftRadius: progress.value * 28,
  }));
  const dimmed = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View style={[styles.screen, rounded]}>
    {children}
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(36, 36, 38, 0.5)' : 'rgba(0, 0, 0, 0.16)' }, dimmed]} />
  </Animated.View>;
}

export function WorkerDrawer({ visible, onOpen, onClose, onSelect, displayName, canTransfer = false, active, children }: Props) {
  const colors = useWorkerColors();
  const dark = useColorScheme() === 'dark';
  const background = dark ? '#000000' : '#ffffff';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const select = (id: string) => { onClose(); onSelect(id); };

  return <Drawer open={visible} onOpen={onOpen} onClose={onClose} drawerType="back" style={{ backgroundColor: background }}
    drawerStyle={{ width: Math.min(360, width * 0.82), backgroundColor: background }}
    overlayStyle={{ backgroundColor: 'transparent' }} overlayAccessibilityLabel="Menyuni yopish"
    renderDrawerContent={() => <View style={[styles.drawer, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Host matchContents={{ vertical: true }} style={styles.heading}>
        <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>Bo‘limlar</Text>
      </Host>
      <ScrollView style={styles.items}>
        <Host matchContents={{ vertical: true }} style={styles.itemsHost}>
          <Column spacing={2} style={{ width: '100%' }}>
            {destinations.filter(item => item.id !== 'transfer' || canTransfer).map(item =>
              <ListItem key={item.id} onPress={() => select(item.id)}
                modifiers={[frame({ minHeight: 54 }), padding({ horizontal: 20 })]}
                leading={<SymbolView name={item.symbol} size={23} tintColor={colors.text} />}
                supportingText={item.id === 'profile' && displayName ? displayName : undefined}>
                <Text modifiers={item.id === active ? [font({ textStyle: 'body', weight: 'semibold' })] : undefined}>{item.label}</Text>
              </ListItem>)}
          </Column>
        </Host>
      </ScrollView>
      <View style={styles.logout}>
        <Host matchContents>
          <Button label="Chiqish" systemImage="rectangle.portrait.and.arrow.right" onPress={() => select('logout')}
            modifiers={[buttonStyle(Number(Platform.Version) >= 26 ? 'glassProminent' : 'borderedProminent'), tint('#FF3B30'), buttonBorderShape('capsule'), controlSize('large')]} />
        </Host>
      </View>
    </View>}>
    <DrawerScreen dark={dark}>{children}</DrawerScreen>
  </Drawer>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  drawer: { flex: 1 },
  heading: { width: '100%', paddingHorizontal: 20, paddingBottom: 20 },
  items: { flex: 1 },
  itemsHost: { width: '100%' },
  logout: { alignItems: 'flex-start', paddingHorizontal: 20 },
});
