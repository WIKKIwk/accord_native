import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, { interpolateColor, useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminCreateHubNativeProps } from './AdminCreateHubTypes';
import type { AdminCreateHubAction, AdminCreateHubOverlay } from './adminCreateHubController';
import { adminHubSpatial, adminHubSpringScale, adminHubStaggerOpacity, adminHubStaggerSpatial } from './adminCreateHubModel';
import { useAdminCreateHubMotion } from './useAdminCreateHubMotion';
import type { AdminCreateHubRenderSlotProps } from './adminSourceHubPlacementTypes';

export type AdminCreateHubRenderers = {
  action: (action: AdminCreateHubAction, onPress: () => void) => ReactNode;
  toggle: (label: string, onPress: () => void, children: ReactNode, testID: string) => ReactNode;
  icon: (name: 'add' | 'close', color: string) => ReactNode;
};

function Pill({ action, overlay, controller, spatial, effects, render }: {
  action: AdminCreateHubAction; overlay: AdminCreateHubOverlay; controller: AdminCreateHubNativeProps['controller'];
  spatial: SharedValue<number>; effects: SharedValue<number>; render: AdminCreateHubRenderers['action'];
}) {
  const [width, setWidth] = useState<number | null>(null), [visible, setVisible] = useState(false), mounted = useRef(false), { direction } = useBaseTheme();
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const publishVisible = (next: boolean, motion: number) => {
    if (mounted.current && controller.overlayCurrent(overlay.id, overlay.generation) && controller.getSnapshot().overlay?.motion === motion) setVisible(next);
  };
  useAnimatedReaction(() => ({ visible: width !== null && adminHubStaggerOpacity(effects.get(), action.order) > .001, motion: overlay.motion }),
    (next, previous) => { if (next.visible !== previous?.visible || next.motion !== previous?.motion) scheduleOnRN(publishVisible, next.visible, next.motion); });
  const motion = useAnimatedStyle(() => {
    const value = adminHubStaggerSpatial(spatial.get(), action.order), scale = adminHubSpringScale(value);
    return { width: width === null ? undefined : 56 + (width - 56) * value, opacity: width === null ? 0 : adminHubStaggerOpacity(effects.get(), action.order), transform: [{ scale }] };
  });
  return <Animated.View pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={[styles.pillClip, { transformOrigin: direction === 'rightToLeft' ? 'left center' : 'right center' }, motion]}>
    <View onLayout={event => {
      const value = event.nativeEvent.layout.width;
      if (mounted.current && controller.overlayCurrent(overlay.id, overlay.generation) && Number.isFinite(value) && value > 0) setWidth(Math.max(56, value));
    }} style={width === null ? undefined : { position: 'absolute', end: 0, width, height: 56 }}>
      {render(action, () => {
        if (adminHubStaggerOpacity(effects.get(), action.order) > .001) controller.select(overlay.id, overlay.generation, action.id);
      })}
    </View>
  </Animated.View>;
}

function Overlay({ props, render }: { props: AdminCreateHubNativeProps; render: AdminCreateHubRenderers }) {
  const overlay = props.state.overlay!, motion = useAdminCreateHubMotion(overlay, props.controller), { colors, mode } = useBaseTheme(), [closeLabel, setCloseLabel] = useState(false);
  const publishCloseLabel = (next: boolean, serial: number) => { if (props.controller.overlayCurrent(overlay.id, overlay.generation) && props.controller.getSnapshot().overlay?.motion === serial) setCloseLabel(next); };
  useAnimatedReaction(() => ({ close: Math.max(0, Math.min(1, motion.effects.get())) >= .5, motion: overlay.motion }),
    (next, previous) => { if (next.close !== previous?.close || next.motion !== previous?.motion) scheduleOnRN(publishCloseLabel, next.close, next.motion); });
  const toggle = useAnimatedStyle(() => {
    const t = adminHubSpatial(motion.morph.get()), size = 80 - 24 * t;
    return { width: size, height: size, borderRadius: 22 + 6 * Math.max(0, Math.min(1, t)), bottom: props.layout.toggleBottom! + 80 - size,
      backgroundColor: interpolateColor(Math.max(0, Math.min(1, motion.morph.get())), [0, 1], [colors.primaryContainer, colors.primary], 'RGB', { gamma: 1 }) };
  });
  const plus = useAnimatedStyle(() => ({ opacity: 1 - Math.max(0, Math.min(1, motion.effects.get())) }));
  const close = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, motion.effects.get())) }));
  const foreground = overlay.targetOpen ? colors.onPrimary : colors.onPrimaryContainer;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} testID="admin-create-hub-overlay">
    <Animated.View style={[StyleSheet.absoluteFill, motion.backdrop]}><Pressable accessibilityRole="button" accessibilityLabel={props.labels.close}
      onPress={() => props.controller.close(overlay.id, overlay.generation)} style={[StyleSheet.absoluteFill, { backgroundColor: mode === 'dark' ? 'rgba(0,0,0,.78)' : 'rgba(255,255,255,.68)' }]} /></Animated.View>
    <View pointerEvents="box-none" style={[styles.actions, { bottom: props.layout.actionsBottom! }]}>
      {overlay.actions.map(action => <Pill key={`${overlay.id}:${action.id}:${action.label}`} action={action} overlay={overlay} controller={props.controller}
        spatial={motion.spatial} effects={motion.effects} render={render.action} />)}
    </View>
    <Animated.View style={[styles.toggle, styles.shadow, toggle]}>
      {render.toggle(closeLabel ? props.labels.close : props.labels.closed, () => props.controller.toggle(overlay.id, overlay.generation),
        <View style={styles.glyph}><Animated.View style={[StyleSheet.absoluteFill, plus]}>{render.icon('add', foreground)}</Animated.View><Animated.View style={[StyleSheet.absoluteFill, close]}>{render.icon('close', foreground)}</Animated.View></View>, 'admin-hub-toggle-button')}
    </Animated.View>
  </View>;
}

/** Root absolute overlay deliberately leaves page/system back handlers untouched. */
export function AdminCreateHubFloating({ render, slot = 'combined', primaryMarker, ...props }: AdminCreateHubNativeProps & AdminCreateHubRenderSlotProps & { render: AdminCreateHubRenderers }) {
  const { colors, direction } = useBaseTheme();
  if (slot !== 'combined' && slot !== 'primary' && slot !== 'overlay') throw TypeError('An explicit primary/overlay rendering slot is required');
  if (!props.state.valid || props.layout.toggleBottom === null) return null;
  return <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 10000, direction: direction === 'rightToLeft' ? 'rtl' : 'ltr' }]}>
    {slot !== 'primary' && props.state.overlay ? <Overlay key={props.state.overlay.id} props={props} render={render} /> : slot !== 'overlay' && props.state.overlay === null && props.primary?.visible && props.primary.ready ? <View {...primaryMarker} collapsable={false} pointerEvents="box-none" testID="admin-create-hub-primary-marker"
      style={[styles.toggle, props.primary.replacement ? undefined : [styles.closed, styles.shadow, { backgroundColor: colors.primaryContainer, borderColor: `${colors.outlineVariant.slice(0, 7)}40` }], { bottom: props.layout.toggleBottom }]}>
      {props.primary.replacement ? props.primary.replacementValue as ReactNode : render.toggle(props.labels.trigger, () => props.controller.open(props.primary!.ticket), render.icon('add', colors.onPrimaryContainer), 'app-primary-navigation-button')}
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({ toggle: { position: 'absolute', end: 16, overflow: 'hidden' }, closed: { width: 80, height: 80, borderRadius: 22, borderWidth: 1 },
  shadow: { shadowColor: '#000000', shadowOpacity: .18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  glyph: { width: 24, height: 24 }, actions: { position: 'absolute', end: 16, gap: 4, alignItems: 'flex-end' }, pillClip: { height: 56, overflow: 'hidden', borderRadius: 28 } });
