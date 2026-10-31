import { Button, FloatingActionButton, Host, Icon, RNHostView, Row, Shape, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { animated, fillMaxSize, fillMaxWidth, graphicsLayer, height, semantics, spring, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type Props = { onSelect: (id: string) => void; onScan: () => void; bottomOffset?: number };
type Action = { id: 'scan' | 'daily' | 'paddons'; label: string; icon: 'qr_code_scanner' | 'today' | 'inventory_2'; width: number };
const actions: Action[] = [
  { id: 'scan', label: 'QR kodni skanerlash', icon: 'qr_code_scanner', width: 246 },
  { id: 'daily', label: 'Kunlik ishlar', icon: 'today', width: 188 },
  { id: 'paddons', label: 'Paddonlar', icon: 'inventory_2', width: 164 },
];

// AndroidX FloatingActionButtonMenu.kt and ExpressiveMotionTokens.kt:
// SlowEffects drives the visible item count; FastSpatial drives width/shape,
// and FastEffects drives opacity. Compose uses a unit-mass spring.
// https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/FloatingActionButtonMenu.kt
const fastSpatial = { mass: 1, stiffness: 800, damping: 2 * 0.6 * Math.sqrt(800) };
const fastEffects = { mass: 1, stiffness: 3800, damping: 2 * Math.sqrt(3800) };
const slowEffects = { mass: 1, stiffness: 800, damping: 2 * Math.sqrt(800) };
const iconSpring = spring({ dampingRatio: 0.6, stiffness: 800 });
const fabIcon = require('../../assets/icons/fab-add.xml');

function MenuItem({ action, index, visibleCount, open, bottomOffset, onSelect }: {
  action: Action; index: number; visibleCount: SharedValue<number>; open: boolean;
  bottomOffset: number; onSelect: (id: Action['id']) => void;
}) {
  const colors = useMaterialColors();
  const widthProgress = useSharedValue(0);
  const alpha = useSharedValue(0);
  useAnimatedReaction(
    () => index >= actions.length - Math.round(visibleCount.value),
    (visible, previous) => {
      if (visible === previous) return;
      widthProgress.value = withSpring(visible ? 1 : 0, fastSpatial);
      alpha.value = withSpring(visible ? 1 : 0, fastEffects);
    },
  );
  const motion = useAnimatedStyle(() => ({
    width: action.width * Math.max(0, widthProgress.value),
    opacity: Math.max(0, Math.min(1, alpha.value)),
  }));

  return <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open}
    importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    style={[styles.action, { bottom: bottomOffset + 88 + (actions.length - 1 - index) * 60 }, motion]}>
    <Host style={[styles.actionHost, { width: action.width }]}>
      <Button onClick={() => onSelect(action.id)} shape={Shape.Pill({})}
        colors={{ containerColor: colors.secondaryContainer, contentColor: colors.onSecondaryContainer }}
        contentPadding={{ start: 24, end: 24, top: 0, bottom: 0 }}
        modifiers={[fillMaxWidth(), height(56), testID(`worker-fab-${action.id}`), semantics({ contentDescription: action.label })]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
          <RNHostView matchContents><SymbolView name={{ android: action.icon }} size={24} tintColor={colors.onSecondaryContainer} /></RNHostView>
          <Text color={colors.onSecondaryContainer} style={{ fontSize: 16, fontWeight: '500' }} maxLines={1}>{action.label}</Text>
        </Row>
      </Button>
    </Host>
  </Animated.View>;
}

/** Native Compose controls with the AndroidX FAB menu motion, usable in Expo Go. */
export function WorkerFab({ onSelect, onScan, bottomOffset = 96 }: Props) {
  const colors = useMaterialColors();
  const [open, setOpen] = useState(false);
  const visibleCount = useSharedValue(0);
  const checkedProgress = useSharedValue(0);
  const toggle = useCallback(() => setOpen(value => !value), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    visibleCount.value = withSpring(open ? actions.length : 0, slowEffects);
    checkedProgress.value = withSpring(open ? 1 : 0, fastSpatial);
  }, [open, visibleCount, checkedProgress]);

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => subscription.remove();
  }, [open, close]);

  const fabMotion = useAnimatedStyle(() => {
    const progress = checkedProgress.value;
    return { width: 80 - 24 * progress, height: 80 - 24 * progress, borderRadius: 20 + 8 * progress };
  });
  const select = useCallback((id: Action['id']) => {
    close();
    if (id === 'scan') onScan();
    else onSelect(id);
  }, [close, onScan, onSelect]);

  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <Pressable pointerEvents={open ? 'auto' : 'none'} style={StyleSheet.absoluteFill} onPress={close}
      accessible={open} accessibilityRole="button" accessibilityLabel="Amallarni yopish" />
    {actions.map((action, index) => <MenuItem key={action.id} action={action} index={index}
      visibleCount={visibleCount} open={open} bottomOffset={bottomOffset} onSelect={select} />)}
    <View pointerEvents="box-none" style={[styles.fabSlot, { bottom: bottomOffset }]}>
      <Animated.View style={[styles.fab, { backgroundColor: colors.primaryContainer }, fabMotion]}>
        <Host style={StyleSheet.absoluteFill}>
          <FloatingActionButton onClick={toggle} containerColor={colors.primaryContainer} modifiers={[
            fillMaxSize(), testID('worker-fab'),
            semantics({ contentDescription: open ? 'Amallarni yopish' : 'Amallarni ochish' }),
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
  action: { position: 'absolute', right: 16, height: 56, borderRadius: 28, overflow: 'hidden', zIndex: 1 },
  actionHost: { position: 'absolute', right: 0, height: 56 },
});
