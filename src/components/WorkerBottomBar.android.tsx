import {
  Host,
  NavigationBar,
  NavigationBarItem,
  RNHostView,
  Text,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

type Props = { active: string; onSelect: (id: string) => void; onScan: () => void };
type Destination = { id: string; label: string; icon: 'home' | 'person' | 'chat_bubble' };

function NavItem({ item, active, onSelect }: { item: Destination; active: string; onSelect: (id: string) => void }) {
  const palette = useMaterialColors();
  const colors = {
    selectedIconColor: palette.onSecondaryContainer, selectedTextColor: palette.onSurface,
    selectedIndicatorColor: palette.secondaryContainer, unselectedIconColor: palette.onSurfaceVariant,
    unselectedTextColor: palette.onSurfaceVariant,
  };
  const selected = item.id === active;
  return <NavigationBarItem selected={selected} onClick={() => onSelect(item.id)} colors={colors}>
    <NavigationBarItem.Icon>
      <RNHostView matchContents><SymbolView name={{ android: item.icon }} size={24} tintColor={selected ? palette.onSecondaryContainer : palette.onSurfaceVariant} /></RNHostView>
    </NavigationBarItem.Icon>
    <NavigationBarItem.Label><Text>{item.label}</Text></NavigationBarItem.Label>
  </NavigationBarItem>;
}

export function WorkerBottomBar({ active, onSelect }: Props) {
  const colors = useMaterialColors();
  return <View style={[styles.root, { backgroundColor: colors.surfaceContainerLow }]}>
    <Host matchContents={{ vertical: true }} style={styles.navHost}>
      <NavigationBar containerColor={colors.surfaceContainerLow} tonalElevation={0} modifiers={[fillMaxWidth()]}>
        <NavItem item={{ id: 'home', label: 'Asosiy', icon: 'home' }} active={active} onSelect={onSelect} />
        <NavItem item={{ id: 'profile', label: 'Profil', icon: 'person' }} active={active} onSelect={onSelect} />
        <NavItem item={{ id: 'chat', label: 'Chat', icon: 'chat_bubble' }} active={active} onSelect={onSelect} />
      </NavigationBar>
    </Host>
  </View>;
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  navHost: { width: '100%' },
});
