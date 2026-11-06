import { Column, Host, ListItem, Text } from '@expo/ui';
import { Button, ScrollView, Spacer } from '@expo/ui/swift-ui';
import { background as swiftBackground, buttonBorderShape, buttonStyle, controlSize, disabled, font, frame, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Platform, PlatformColor, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Drawer, useDrawerProgress } from 'react-native-drawer-layout';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectRoleDrawerItem, type RoleDrawerProps } from './roleDrawerModel';
import { RoleDrawerContext } from './roleDrawerContext';

function DrawerScreen({ children }: { children: ReactNode }) {
  const progress = useDrawerProgress();
  const rounded = useAnimatedStyle(() => ({
    borderTopLeftRadius: progress.value * 28,
    borderBottomLeftRadius: progress.value * 28,
  }));
  const dimmed = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View style={[styles.screen, rounded]}>
    {children}
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: PlatformColor('systemFill') }, dimmed]} />
  </Animated.View>;
}

export function RoleDrawer(props: RoleDrawerProps & { swipeEnabled?: boolean }) {
  const { visible, onOpen, onClose, title, items, active, footerAction, closeAccessibilityLabel, children, swipeEnabled = true } = props;
  const background = PlatformColor('systemBackground');
  const foreground = PlatformColor('label');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [headingHeight, setHeadingHeight] = useState(48);
  const footerSymbol = typeof footerAction?.symbol === 'string' ? footerAction.symbol : footerAction?.symbol?.ios;

  return <RoleDrawerContext.Provider value={{ open: onOpen, close: onClose }}>
    <Drawer open={visible} onOpen={onOpen} onClose={onClose} swipeEnabled={swipeEnabled} drawerType="back" style={{ backgroundColor: background }}
      drawerStyle={{ width: Math.min(360, width * 0.82), backgroundColor: background }}
      overlayStyle={{ backgroundColor: 'transparent' }} overlayAccessibilityLabel={closeAccessibilityLabel}
      renderDrawerContent={() => <View style={[styles.drawer, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.menuBody}>
          <Host style={styles.items} ignoreSafeArea="all">
            <ScrollView><Column spacing={2} style={{ width: '100%', paddingTop: headingHeight }}>
              {items.map(item => <ListItem key={item.id} testID={`role-drawer-${item.id}`}
                onPress={() => selectRoleDrawerItem(item, props)} supportingText={item.supportingText}
                modifiers={[frame({ minHeight: 54 }), padding({ horizontal: 20 }), disabled(!!item.disabled)]}
                leading={item.symbol ? <SymbolView name={item.symbol} size={23} tintColor={foreground} /> : undefined}>
                <Text modifiers={item.id === active ? [font({ textStyle: 'body', weight: 'semibold' })] : undefined}>{item.label}</Text>
              </ListItem>)}
            </Column></ScrollView>
          </Host>
          <View pointerEvents="none" style={styles.headingOverlay} onLayout={event => setHeadingHeight(event.nativeEvent.layout.height)}>
            <Host pointerEvents="none" style={StyleSheet.absoluteFill} ignoreSafeArea="all">
              <Spacer modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), swiftBackground({ type: 'material', material: 'regular' })]} />
            </Host>
            <View style={styles.heading}><Host matchContents={{ vertical: true }} style={styles.headingHost}>
              <Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' })]}>{title}</Text>
            </Host></View>
          </View>
        </View>
        {footerAction && <View style={styles.footer}><Host matchContents>
          <Button label={footerAction.label} systemImage={footerSymbol} onPress={() => selectRoleDrawerItem(footerAction, props)}
            modifiers={[disabled(!!footerAction.disabled), buttonStyle(Number(Platform.Version) >= 26 ? 'glassProminent' : 'borderedProminent'),
              ...(footerAction.destructive ? [tint(PlatformColor('systemRed'))] : []), buttonBorderShape('capsule'), controlSize('large')]} />
        </Host></View>}
      </View>}>
      <DrawerScreen>{children}</DrawerScreen>
    </Drawer>
  </RoleDrawerContext.Provider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  drawer: { flex: 1 },
  menuBody: { flex: 1 },
  headingOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  heading: { width: '100%', paddingHorizontal: 20, paddingBottom: 20 },
  headingHost: { width: '100%' },
  items: { flex: 1, overflow: 'hidden' },
  footer: { alignItems: 'flex-start', paddingHorizontal: 20 },
});
