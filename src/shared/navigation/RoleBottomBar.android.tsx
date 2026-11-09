import { Badge, BadgedBox, Host, Icon, NavigationBar, NavigationBarItem, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { useEffect } from 'react';
import { Keyboard, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

export type RoleNavigationItem = { id: string; label: string; icon: AndroidSymbol; testID?: string; showBadge?: boolean };
type Props = { active: string; items: readonly RoleNavigationItem[]; onSelect: (id: string) => void; bottomInset?: number };
const navigationIcons: Partial<Record<AndroidSymbol, { outlined: ImageSourcePropType; filled: ImageSourcePropType }>> = {
  home: { outlined: require('../../../assets/icons/navigation/outlined/home.xml'), filled: require('../../../assets/icons/navigation/filled/home_fill.xml') },
  chat_bubble: { outlined: require('../../../assets/icons/navigation/outlined/chat_bubble.xml'), filled: require('../../../assets/icons/navigation/filled/chat_bubble_fill.xml') },
  person: { outlined: require('../../../assets/icons/navigation/outlined/person.xml'), filled: require('../../../assets/icons/navigation/filled/person_fill.xml') },
};

function NavItem({ item, active, onSelect }: { item: RoleNavigationItem; active: string; onSelect: (id: string) => void }) {
  const palette = useMaterialColors();
  const colors = {
    selectedIconColor: palette.onSecondaryContainer, selectedTextColor: palette.onSurface,
    selectedIndicatorColor: palette.secondaryContainer, unselectedIconColor: palette.onSurfaceVariant,
    unselectedTextColor: palette.onSurfaceVariant,
  };
  const selected = item.id === active, icon = navigationIcons[item.icon];
  const iconView = icon ? <Icon source={selected ? icon.filled : icon.outlined} size={24} tint={selected ? palette.onSecondaryContainer : palette.onSurfaceVariant} />
    : <RNHostView matchContents><SymbolView name={{ android: item.icon }} size={24} tintColor={selected ? palette.onSecondaryContainer : palette.onSurfaceVariant} /></RNHostView>;
  return <NavigationBarItem selected={selected} onClick={() => onSelect(item.id)} colors={colors}
    modifiers={item.testID ? [testID(item.testID)] : undefined}>
    <NavigationBarItem.Icon>
      {item.showBadge ? <BadgedBox><BadgedBox.Badge><Badge /></BadgedBox.Badge>{iconView}</BadgedBox> : iconView}
    </NavigationBarItem.Icon>
    <NavigationBarItem.Label><Text>{item.label}</Text></NavigationBarItem.Label>
  </NavigationBarItem>;
}

export function RoleBottomBar({ active, items, onSelect, bottomInset = 0 }: Props) {
  const colors = useMaterialColors();
  const keyboardHeight = useSharedValue(Keyboard.metrics()?.height ?? 0);
  const barHeight = useSharedValue(80 + bottomInset);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => keyboardHeight.set(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => keyboardHeight.set(0));
    return () => { show.remove(); hide.remove(); };
  }, [keyboardHeight]);
  const keyboardOverlay = useAnimatedStyle(() => {
    const height = Math.max(0, keyboardHeight.get());
    // Keep the mounted bar at the window bottom behind the IME, while the
    // resized content uses the space that the keyboard now covers.
    return { height: Math.max(0, barHeight.get() - height), transform: [{ translateY: Math.max(0, height - barHeight.get()) }] };
  });
  return <Animated.View style={[styles.root, keyboardOverlay]}>
    <View onLayout={event => barHeight.set(event.nativeEvent.layout.height)}
      style={[styles.bar, { backgroundColor: colors.surfaceContainerLow, paddingBottom: bottomInset }]}>
      <Host matchContents={{ vertical: true }} style={styles.navHost}>
        <NavigationBar containerColor={colors.surfaceContainerLow} tonalElevation={0} modifiers={[fillMaxWidth()]}>
          {items.map(item => <NavItem key={item.id} item={item} active={active} onSelect={onSelect} />)}
        </NavigationBar>
      </Host>
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({ root: { width: '100%' }, bar: { position: 'absolute', top: 0, left: 0, right: 0 }, navHost: { width: '100%' } });
