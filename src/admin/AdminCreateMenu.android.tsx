import { Button, Host, RNHostView, Row, Shape, Text as ComposeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminMenuAction } from './adminCreateMenuController';
import { useAdminCreateMenu, type AdminCreateMenuProps } from './useAdminCreateMenu';

const openSpring = { mass: 1.18, stiffness: 230, damping: 2 * 0.88 * Math.sqrt(230 * 1.18) };
const closeSpring = { mass: 1.2, stiffness: 400, damping: 2 * 0.82 * Math.sqrt(400 * 1.2) };

function Action({ action, open, order, onSelect }: { action: AdminMenuAction; open: boolean; order: number; onSelect: (id: string) => void }) {
  const colors = useMaterialColors(), progress = useSharedValue(0), effects = useSharedValue(0);
  useEffect(() => {
    progress.value = withSpring(open ? 1 : 0, open ? openSpring : closeSpring);
    effects.value = withSpring(open ? 1 : 0, open
      ? { mass: 1.12, stiffness: 500, damping: 2 * Math.sqrt(500 * 1.12) }
      : { mass: 1.08, stiffness: 700, damping: 2 * Math.sqrt(700 * 1.08) });
  }, [open, progress, effects]);
  const motion = useAnimatedStyle(() => {
    const start = Math.min(order * 0.2, 0.76), end = Math.min(start + 0.56, 1);
    const interval = Math.max(0, Math.min(1, (effects.value - start) / (end - start)));
    return { opacity: open ? 1 - (1 - interval) ** 3 : interval ** 3,
      transform: [{ translateX: 80 * (1 - progress.value) }] };
  });
  return <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[styles.action, motion]}>
    <Host matchContents style={{ maxWidth: '100%' }}><Button enabled={action.enabled !== false} onClick={() => onSelect(action.id)}
      shape={Shape.Pill({})} colors={{ containerColor: colors.secondaryContainer, contentColor: colors.onSecondaryContainer }}
      contentPadding={{ start: 14, end: 14, top: 0, bottom: 0 }} modifiers={[height(56), testID(action.id), semantics({ contentDescription: action.label })]}>
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 10 }}>
        <RNHostView matchContents><SymbolView name={{ android: action.icon.android }} size={24} tintColor={colors.onSecondaryContainer} importantForAccessibility="no" /></RNHostView>
        <ComposeText style={{ typography: 'labelLarge' }} maxLines={1} overflow="ellipsis">{action.label}</ComposeText>
      </Row>
    </Button></Host>
  </Animated.View>;
}

/** V2's floating create overlay, using native Compose action and toggle buttons. */
export function AdminCreateMenu(props: AdminCreateMenuProps) {
  const { state, controller } = useAdminCreateMenu(props), colors = useMaterialColors(), theme = useBaseTheme();
  const progress = useSharedValue(0), bottom = props.bottomOffset ?? 94;
  useEffect(() => { progress.value = withSpring(state.open ? 1 : 0, { mass: 0.55, stiffness: 2350, damping: 2 * 0.72 * Math.sqrt(2350 * 0.55) }); }, [state.open, progress]);
  useEffect(() => {
    if (!state.open) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { controller.close(); return true; });
    return () => listener.remove();
  }, [state.open, controller]);
  const toggleStyle = useAnimatedStyle(() => ({ width: 80 - 24 * progress.value, height: 80 - 24 * progress.value,
    borderRadius: 22 + 6 * progress.value, transform: [{ translateY: -24 * progress.value }] }));
  if (props.visible === false || !state.actions.length) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {state.open ? <Pressable onPress={() => controller.close()} accessibilityRole="button" accessibilityLabel={props.closeLabel}
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.mode === 'dark' ? 'rgba(0,0,0,0.78)' : 'rgba(255,255,255,0.68)' }]} /> : null}
    <View pointerEvents={state.open ? 'auto' : 'none'} accessibilityElementsHidden={!state.open} importantForAccessibility={state.open ? 'auto' : 'no-hide-descendants'}
      style={[styles.actions, { bottom: bottom + 90 }]}>
      <ScrollView contentContainerStyle={styles.actionList} keyboardShouldPersistTaps="handled">
        {state.actions.map((action, index) => <Action key={action.id} action={action} open={state.open} order={state.actions.length - 1 - index}
          onSelect={id => { void controller.select(id); }} />)}
      </ScrollView>
    </View>
    <View pointerEvents="box-none" style={[styles.slot, { bottom }]}><Animated.View style={[styles.toggle, toggleStyle]}>
      <Host style={StyleSheet.absoluteFill}><Button onClick={() => controller.toggle()} shape={state.open ? Shape.Circle({}) : Shape.RoundedCorner({ cornerRadii: { topStart: 22, topEnd: 22, bottomStart: 22, bottomEnd: 22 } })}
        contentPadding={{ start: 0, top: 0, end: 0, bottom: 0 }} colors={{ containerColor: colors.primaryContainer, contentColor: colors.onPrimaryContainer }}
        modifiers={[fillMaxWidth(), height(state.open ? 56 : 80), semantics({ contentDescription: state.open ? props.closeLabel : props.openLabel }), testID('admin-create-toggle')]}>
        <RNHostView matchContents><SymbolView name={{ android: state.open ? 'close' : 'add' }} size={state.open ? 24 : 32} tintColor={colors.onPrimaryContainer} importantForAccessibility="no" /></RNHostView>
      </Button></Host>
    </Animated.View></View>
  </View>;
}
const styles = StyleSheet.create({ actions: { position: 'absolute', right: 16, left: 16, maxHeight: '70%' }, actionList: { gap: 4, alignItems: 'flex-end' },
  action: { maxWidth: '100%', height: 56 }, slot: { position: 'absolute', right: 16, width: 80, height: 80, alignItems: 'flex-end', justifyContent: 'flex-end' },
  toggle: { width: 80, height: 80, borderRadius: 22, overflow: 'hidden' } });
