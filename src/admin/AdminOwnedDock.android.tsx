import { Icon, NavigationBarItem, RNHostView, Row } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import { useAdminOwnedDock, type AdminOwnedDockProps } from './useAdminOwnedDock';
import { useAdminShellLayout } from './useAdminShellLayout';

const icons = {
  home: { outlined: require('../../assets/icons/navigation/outlined/home.xml'), filled: require('../../assets/icons/navigation/filled/home_fill.xml') },
  user: { outlined: require('../../assets/icons/navigation/outlined/person.xml'), filled: require('../../assets/icons/navigation/filled/person_fill.xml') },
};

/** Source dock destinations; the owning route separately supplies its genuine CreateHub primary action. */
export function AdminOwnedDock(props: AdminOwnedDockProps) {
  const model = useAdminOwnedDock(props), { colors } = useBaseTheme(), layout = useAdminShellLayout(true), keyboardHeight = useSharedValue(Keyboard.metrics()?.height ?? 0);
  useEffect(() => { const show = Keyboard.addListener('keyboardDidShow', event => keyboardHeight.set(event.endCoordinates.height)), hide = Keyboard.addListener('keyboardDidHide', () => keyboardHeight.set(0));
    keyboardHeight.set(Keyboard.metrics()?.height ?? 0); return () => { show.remove(); hide.remove(); }; }, [keyboardHeight]);
  const dockHeight = layout.dockBottomInset === null ? 0 : 60 + layout.dockBottomInset;
  const keyboardOverlay = useAnimatedStyle(() => ({ height: Math.max(0, dockHeight - keyboardHeight.get()), transform: [{ translateY: Math.max(0, keyboardHeight.get() - dockHeight) }] }));
  if (layout.dockBottomInset === null) return null;
  const palette = { selectedIconColor: colors.onSecondaryContainer, selectedTextColor: colors.onSurface, selectedIndicatorColor: colors.secondaryContainer,
    unselectedIconColor: colors.onSurfaceVariant, unselectedTextColor: colors.onSurfaceVariant };
  // SDK NavigationBar fixes its own system windowInsets. RowScope permits the same genuine Material controls without adding those insets twice.
  return <Animated.View style={[styles.root, { backgroundColor: colors.surfaceContainerHigh }, keyboardOverlay]}>
    <BaseHost style={[styles.bar, { height: dockHeight }]}><Row modifiers={[fillMaxWidth(), height(60)]}>
      {model.destinations.map(item => { const selected = model.active === item.id, source = item.tab === 'home' || item.tab === 'user' ? icons[item.tab] : null;
        return <NavigationBarItem key={item.id} selected={selected} onClick={() => model.select(item.id)} colors={palette} modifiers={[height(60), testID(item.id)]}>
          <NavigationBarItem.Icon>{source ? <Icon source={selected ? source.filled : source.outlined} size={24} tint={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant} /> :
            <RNHostView matchContents><SymbolView name={{ android: 'history' }} size={24} tintColor={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant} importantForAccessibility="no" /></RNHostView>}
          </NavigationBarItem.Icon>
          <NavigationBarItem.Label><Text style={{ fontSize: 12, fontWeight: '500' }}>{item.label}</Text></NavigationBarItem.Label>
        </NavigationBarItem>;
      })}
    </Row></BaseHost>
  </Animated.View>;
}
const styles = StyleSheet.create({ root: { width: '100%' }, bar: { position: 'absolute', top: 0, left: 0, right: 0 } });
