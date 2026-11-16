import { useLayoutEffect, useRef, type ComponentType, type ReactElement } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { AdminProfileAvatarImage } from './AdminProfileAvatarImage';
import { adminProfileAvatarGeometry } from './adminProfileAvatarModel';
import type { AdminProfileAvatarModel } from './useAdminProfileAvatar';

/** @v2 _ProfileAvatarPreviewOverlay */
export function AdminProfileAvatarPreview({ model, fallback, CloseButton }: { model: AdminProfileAvatarModel; fallback: (width: number, height: number) => ReactElement; CloseButton: ComponentType<{ onClose: () => void }> }) {
  const preview = model.state.preview!, { width, height } = useWindowDimensions(), insets = useSafeAreaInsets(), geometry = adminProfileAvatarGeometry(width, height);
  const ticket = `${model.generation}:${preview.id}`, active = useSharedValue(''), opacity = useSharedValue(0), closing = useRef(false);
  const scale = useSharedValue(1), x = useSharedValue(0), y = useSharedValue(0), startScale = useSharedValue(1), startX = useSharedValue(0), startY = useSharedValue(0), focalX = useSharedValue(0), focalY = useSharedValue(0);
  useLayoutEffect(() => { active.set(ticket); opacity.set(withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })); return () => { active.set(''); cancelAnimation(opacity); }; }, [active, opacity, ticket]);
  const finish = () => { if (model.previewCurrent(preview.id)) model.close(preview.id); };
  const close = () => {
    if (!model.previewCurrent(preview.id) || closing.current) return; closing.current = true; active.set('');
    opacity.set(withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, finished => { if (finished) scheduleOnRN(finish); }));
  };
  const pinch = usePinchGesture({ onActivate: event => { 'worklet'; if (active.get() !== ticket) return; startScale.set(scale.get()); startX.set(x.get()); startY.set(y.get()); focalX.set(event.focalX); focalY.set(event.focalY); },
    onUpdate: event => { 'worklet'; if (active.get() !== ticket) return;
      const next = Math.max(1, Math.min(3, startScale.get() * event.scale)), ratio = next / startScale.get(); scale.set(next);
      const maxX = (next - 1) * geometry.width / 2 + 80 * next, maxY = (next - 1) * geometry.height / 2 + 80 * next;
      x.set(Math.max(-maxX, Math.min(maxX, event.focalX - geometry.width / 2 - (focalX.get() - geometry.width / 2 - startX.get()) * ratio)));
      y.set(Math.max(-maxY, Math.min(maxY, event.focalY - geometry.height / 2 - (focalY.get() - geometry.height / 2 - startY.get()) * ratio)));
    } });
  const pan = usePanGesture({ averageTouches: true, maxPointers: 1, onActivate: () => { 'worklet'; if (active.get() !== ticket) return; startX.set(x.get()); startY.set(y.get()); },
    onUpdate: event => { 'worklet'; if (active.get() !== ticket) return;
      const maxX = (scale.get() - 1) * geometry.width / 2 + 80 * scale.get(), maxY = (scale.get() - 1) * geometry.height / 2 + 80 * scale.get();
      x.set(Math.max(-maxX, Math.min(maxX, startX.get() + event.translationX))); y.set(Math.max(-maxY, Math.min(maxY, startY.get() + event.translationY)));
    } });
  const gesture = useSimultaneousGestures(pinch, pan), fade = useAnimatedStyle(() => ({ opacity: opacity.get() })), motion = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }] }));
  return <Modal visible transparent animationType="none" onRequestClose={close}><GestureHandlerRootView style={styles.root}><Animated.View onAccessibilityEscape={close} style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }, fade]}>
    <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} onPress={close} />
    <GestureDetector gesture={gesture}><Animated.View style={motion}><AdminProfileAvatarImage key={`${preview.url}:${preview.uri}`} uri={preview.uri} cacheKey={`${model.namespace}:${preview.url}`}
      width={geometry.width} height={geometry.height} radius={28} fallback={fallback(geometry.width, geometry.height)}
      isCurrent={() => !!preview.uri && model.previewCurrent(preview.id) && model.imageCurrent(preview.id, preview.uri)} onError={() => { if (preview.uri) model.imageFailed(preview.id, preview.uri); }} /></Animated.View></GestureDetector>
    <View style={[styles.close, { top: insets.top + 12, right: insets.right + 12 }]}><CloseButton onClose={close} /></View>
  </Animated.View></GestureHandlerRootView></Modal>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center' }, close: { position: 'absolute', right: 12, width: 44, height: 44 } });
