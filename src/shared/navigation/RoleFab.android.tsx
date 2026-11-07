import { Button, FloatingActionButton, Host, Icon, RNHostView, Row, Shape, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { animated, fillMaxSize, fillMaxWidth, graphicsLayer, height, semantics, spring, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { type SharedValue, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export type RoleFabAction = { id: string; label: string; icon: AndroidSymbol; width: number };
type Props = { actions: readonly RoleFabAction[]; onSelect: (id: string) => void; bottomOffset?: number;
  testIDPrefix?: string; openLabel?: string; closeLabel?: string; resetKey?: string };

// AndroidX FAB menu springs: spatial motion, opacity, then the visible item count.
const fastSpatial = { mass: 1, stiffness: 800, damping: 2 * 0.6 * Math.sqrt(800) };
const fastEffects = { mass: 1, stiffness: 3800, damping: 2 * Math.sqrt(3800) };
const slowEffects = { mass: 1, stiffness: 800, damping: 2 * Math.sqrt(800) };
const iconSpring = spring({ dampingRatio: 0.6, stiffness: 800 });
const fabIcon = require('../../../assets/icons/fab-add.xml');

function MenuItem({ action, index, count, visibleCount, open, width, onSelect, testIDPrefix }: {
  action: RoleFabAction; index: number; count: number; visibleCount: SharedValue<number>; open: boolean;
  width: number; onSelect: (id: string) => void; testIDPrefix: string;
}) {
  const colors = useMaterialColors();
  const widthProgress = useSharedValue(0), alpha = useSharedValue(0);
  useAnimatedReaction(
    () => index >= count - Math.round(visibleCount.value),
    (visible, previous) => {
      if (visible === previous) return;
      widthProgress.value = withSpring(visible ? 1 : 0, fastSpatial);
      alpha.value = withSpring(visible ? 1 : 0, fastEffects);
    },
  );
  const motion = useAnimatedStyle(() => ({ width: width * Math.max(0, widthProgress.value), opacity: Math.max(0, Math.min(1, alpha.value)) }));
  return <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open}
    importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} style={[styles.action, motion]}>
    <Host style={[styles.actionHost, { width }]}>
      <Button onClick={() => onSelect(action.id)} shape={Shape.Pill({})}
        colors={{ containerColor: colors.secondaryContainer, contentColor: colors.onSecondaryContainer }}
        contentPadding={{ start: 24, end: 24, top: 0, bottom: 0 }}
        modifiers={[fillMaxWidth(), height(56), testID(`${testIDPrefix}-${action.id}`), semantics({ contentDescription: action.label })]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
          <RNHostView matchContents><SymbolView name={{ android: action.icon }} size={24} tintColor={colors.onSecondaryContainer} /></RNHostView>
          <Text color={colors.onSecondaryContainer} style={{ fontSize: 16, fontWeight: '500' }} maxLines={1}>{action.label}</Text>
        </Row>
      </Button>
    </Host>
  </Animated.View>;
}

/** Shared native FAB menu. Long role menus scroll within the available screen. */
export function RoleFab({ actions, onSelect, bottomOffset = 96, testIDPrefix = 'role-fab',
  openLabel = 'Amallarni ochish', closeLabel = 'Amallarni yopish', resetKey }: Props) {
  const colors = useMaterialColors(), { width: screenWidth } = useWindowDimensions();
  const [open, setOpen] = useState(false), [availableHeight, setAvailableHeight] = useState(0);
  const visibleCount = useSharedValue(0), checkedProgress = useSharedValue(0);
  const toggle = useCallback(() => setOpen(value => !value), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (resetKey === undefined) return;
    const frame = requestAnimationFrame(close);
    return () => cancelAnimationFrame(frame);
  }, [resetKey, close]);
  useEffect(() => {
    visibleCount.value = withSpring(open ? actions.length : 0, slowEffects);
    checkedProgress.value = withSpring(open ? 1 : 0, fastSpatial);
  }, [open, actions.length, visibleCount, checkedProgress]);
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => subscription.remove();
  }, [open, close]);

  const fabMotion = useAnimatedStyle(() => {
    const progress = checkedProgress.value;
    return { width: 80 - 24 * progress, height: 80 - 24 * progress, borderRadius: 20 + 8 * progress };
  });
  const select = useCallback((id: string) => { close(); onSelect(id); }, [close, onSelect]);
  const menuWidth = Math.max(1, Math.min(screenWidth - 32, Math.max(0, ...actions.map(action => action.width))));
  const contentHeight = Math.max(0, actions.length * 60 - 4);
  const menuHeight = Math.min(contentHeight, availableHeight > 0 ? Math.max(56, availableHeight - bottomOffset - 104) : contentHeight);

  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={event => setAvailableHeight(event.nativeEvent.layout.height)}>
    <Pressable pointerEvents={open ? 'auto' : 'none'} style={StyleSheet.absoluteFill} onPress={close}
      accessible={open} accessibilityRole="button" accessibilityLabel={closeLabel} />
    <View pointerEvents={open ? 'auto' : 'none'} style={[styles.actions, { bottom: bottomOffset + 88, width: menuWidth, height: menuHeight }]}>
      <ScrollView nestedScrollEnabled scrollEnabled={contentHeight > menuHeight} contentContainerStyle={styles.actionsContent}>
        {actions.map((action, index) => <MenuItem key={action.id} action={action} index={index} count={actions.length}
          visibleCount={visibleCount} open={open} width={Math.min(action.width, menuWidth)} onSelect={select} testIDPrefix={testIDPrefix} />)}
      </ScrollView>
    </View>
    <View pointerEvents="box-none" style={[styles.fabSlot, { bottom: bottomOffset }]}>
      <Animated.View style={[styles.fab, { backgroundColor: colors.primaryContainer }, fabMotion]}>
        <Host style={StyleSheet.absoluteFill}>
          <FloatingActionButton onClick={toggle} containerColor={colors.primaryContainer} modifiers={[
            fillMaxSize(), testID(testIDPrefix), semantics({ contentDescription: open ? closeLabel : openLabel }),
          ]}>
            <FloatingActionButton.Icon>
              <Icon source={fabIcon} size={32} tint={colors.onPrimaryContainer} modifiers={[graphicsLayer({
                rotationZ: animated(open ? 45 : 0, iconSpring),
                scaleX: animated(open ? 20 / 32 : 1, iconSpring),
                scaleY: animated(open ? 20 / 32 : 1, iconSpring),
              })]} />
            </FloatingActionButton.Icon>
          </FloatingActionButton>
        </Host>
      </Animated.View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  fabSlot: { position: 'absolute', right: 16, width: 80, height: 80, alignItems: 'flex-end', zIndex: 2 },
  fab: { width: 80, height: 80, borderRadius: 20, overflow: 'hidden', elevation: 6 },
  actions: { position: 'absolute', right: 16, zIndex: 1 },
  actionsContent: { alignItems: 'flex-end', gap: 4 },
  action: { height: 56, borderRadius: 28, overflow: 'hidden' },
  actionHost: { position: 'absolute', right: 0, height: 56 },
});
