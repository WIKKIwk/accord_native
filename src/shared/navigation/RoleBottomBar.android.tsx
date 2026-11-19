import { Badge, BadgedBox, Icon, NavigationBar, NavigationBarItem, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { Keyboard, StyleSheet, View, type ColorValue, type ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { BaseHost } from '../../components/BaseHost.android';
import { useBaseTheme } from '../../components/useBaseTheme';

export type RoleNavigationItem = { id: string; label: string; icon: AndroidSymbol; testID?: string; showBadge?: boolean };
type Props = { active: string; items: readonly RoleNavigationItem[]; onSelect: (id: string) => void; bottomInset?: number; avoidKeyboard?: boolean; compact?: boolean; backgroundColor?: ColorValue };
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

export function RoleBottomBar({ active, items, onSelect, bottomInset = 0, avoidKeyboard = true, compact = false, backgroundColor }: Props) {
  const { colors } = useBaseTheme();
  const surface = backgroundColor ?? colors.surfaceContainerLow;
  const initialHeight = (compact ? 60 : 80) + bottomInset;
  const keyboardHeight = useSharedValue(Keyboard.metrics()?.height ?? 0);
  const barHeight = useSharedValue(initialHeight);
  const keyboardOpen = useRef(!!Keyboard.metrics()?.height), closedHeight = useRef(initialHeight);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => {
      keyboardOpen.current = true; keyboardHeight.set(event.endCoordinates.height);
      if (!avoidKeyboard) barHeight.set(closedHeight.current);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => { keyboardOpen.current = false; keyboardHeight.set(0); });
    const height = Keyboard.metrics()?.height ?? 0;
    keyboardOpen.current = height > 0; keyboardHeight.set(height);
    if (!avoidKeyboard && height > 0) barHeight.set(closedHeight.current);
    return () => { show.remove(); hide.remove(); };
  }, [avoidKeyboard, barHeight, keyboardHeight]);
  const keyboardOverlay = useAnimatedStyle(() => {
    const height = avoidKeyboard ? Math.max(0, keyboardHeight.get()) : 0;
    // Keep the mounted bar at the window bottom behind the IME, while the
    // resized content uses the space that the keyboard now covers.
    return { height: Math.max(0, barHeight.get() - height), transform: [{ translateY: Math.max(0, height - barHeight.get()) }] };
  });
  return <Animated.View style={[styles.root, keyboardOverlay]}>
    <View onLayout={event => {
      const height = event.nativeEvent.layout.height, open = keyboardOpen.current || !!Keyboard.metrics()?.height;
      // Compose may include the IME inset in its intrinsic height; retain the closed height behind the keyboard.
      if (!open) closedHeight.current = height;
      if (avoidKeyboard || !open) barHeight.set(height);
    }}
      style={[styles.bar, { backgroundColor: surface, paddingBottom: compact ? 0 : bottomInset }]}>
      <BaseHost matchContents={{ vertical: true }} style={styles.navHost}>
        <NavigationBar containerColor={surface} tonalElevation={0}
          modifiers={[fillMaxWidth(), ...(compact ? [height(initialHeight)] : [])]}>
          {items.map(item => <NavItem key={item.id} item={item} active={active} onSelect={onSelect} />)}
        </NavigationBar>
      </BaseHost>
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({ root: { width: '100%' }, bar: { position: 'absolute', top: 0, left: 0, right: 0 }, navHost: { width: '100%' } });
