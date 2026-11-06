import { Column, Host, ListItem, RNHostView } from '@expo/ui';
import { Button, Text as ComposeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { alpha, fillMaxWidth, height } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Drawer } from 'react-native-drawer-layout';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectRoleDrawerItem, type RoleDrawerProps } from './roleDrawerModel';
import { RoleDrawerContext } from './roleDrawerContext';

export function RoleDrawer(props: RoleDrawerProps) {
  const { visible, onOpen, onClose, title, items, active, footerAction, closeAccessibilityLabel, children } = props;
  const colors = useMaterialColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [visible, onClose]);

  return <RoleDrawerContext.Provider value={{ open: onOpen, close: onClose }}><GestureHandlerRootView style={styles.root}>
    <Drawer open={visible} onOpen={onOpen} onClose={onClose} drawerType="front"
      drawerStyle={{ width: Math.min(320, width - 56), backgroundColor: colors.surfaceContainerLow, borderTopRightRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden' }}
      overlayAccessibilityLabel={closeAccessibilityLabel}
      renderDrawerContent={() => <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Text style={[styles.title, { color: colors.onSurfaceVariant }]}>{title}</Text>
        <ScrollView style={styles.scroll}><Host matchContents={{ vertical: true }} style={styles.items}><Column spacing={2}>
          {items.map(item => {
            const selected = item.id === active;
            const foreground = selected ? colors.onSecondaryContainer : colors.onSurface;
            return <ListItem key={item.id} testID={`role-drawer-${item.id}`}
              onPress={item.disabled ? undefined : () => selectRoleDrawerItem(item, props)} supportingText={item.supportingText}
              modifiers={item.disabled ? [alpha(0.38)] : undefined}
              colors={{ containerColor: selected ? colors.secondaryContainer : colors.surfaceContainerLow, contentColor: foreground }}
              leading={item.symbol ? <RNHostView matchContents><SymbolView name={item.symbol} size={23} tintColor={foreground} /></RNHostView> : undefined}>
              {item.label}
            </ListItem>;
          })}
        </Column></Host></ScrollView>
        {footerAction && <View style={styles.footer}><Host matchContents={{ vertical: true }} style={styles.footerHost}>
          <Button modifiers={[fillMaxWidth(), height(56)]} enabled={!footerAction.disabled}
            colors={footerAction.destructive ? { containerColor: colors.errorContainer, contentColor: colors.onErrorContainer } : undefined}
            onClick={() => selectRoleDrawerItem(footerAction, props)}><ComposeText>{footerAction.label}</ComposeText></Button>
        </Host></View>}
      </View>}>
      {children}
    </Drawer>
  </GestureHandlerRootView></RoleDrawerContext.Provider>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', paddingHorizontal: 18, paddingBottom: 10 },
  scroll: { flex: 1 },
  items: { width: '100%' },
  footer: { width: '100%', paddingHorizontal: 12 },
  footerHost: { width: '100%' },
});
