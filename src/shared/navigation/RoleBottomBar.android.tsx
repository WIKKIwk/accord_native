import { Host, NavigationBar, NavigationBarItem, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

export type RoleNavigationItem = { id: string; label: string; icon: AndroidSymbol; testID?: string };
type Props = { active: string; items: readonly RoleNavigationItem[]; onSelect: (id: string) => void; bottomInset?: number };

function NavItem({ item, active, onSelect }: { item: RoleNavigationItem; active: string; onSelect: (id: string) => void }) {
  const palette = useMaterialColors();
  const colors = {
    selectedIconColor: palette.onSecondaryContainer, selectedTextColor: palette.onSurface,
    selectedIndicatorColor: palette.secondaryContainer, unselectedIconColor: palette.onSurfaceVariant,
    unselectedTextColor: palette.onSurfaceVariant,
  };
  const selected = item.id === active;
  return <NavigationBarItem selected={selected} onClick={() => onSelect(item.id)} colors={colors}
    modifiers={item.testID ? [testID(item.testID)] : undefined}>
    <NavigationBarItem.Icon>
      <RNHostView matchContents><SymbolView name={{ android: item.icon }} size={24} tintColor={selected ? palette.onSecondaryContainer : palette.onSurfaceVariant} /></RNHostView>
    </NavigationBarItem.Icon>
    <NavigationBarItem.Label><Text>{item.label}</Text></NavigationBarItem.Label>
  </NavigationBarItem>;
}

export function RoleBottomBar({ active, items, onSelect, bottomInset = 0 }: Props) {
  const colors = useMaterialColors();
  return <View style={[styles.root, { backgroundColor: colors.surfaceContainerLow, paddingBottom: bottomInset }]}>
    <Host matchContents={{ vertical: true }} style={styles.navHost}>
      <NavigationBar containerColor={colors.surfaceContainerLow} tonalElevation={0} modifiers={[fillMaxWidth()]}>
        {items.map(item => <NavItem key={item.id} item={item} active={active} onSelect={onSelect} />)}
      </NavigationBar>
    </Host>
  </View>;
}

const styles = StyleSheet.create({ root: { width: '100%' }, navHost: { width: '100%' } });
