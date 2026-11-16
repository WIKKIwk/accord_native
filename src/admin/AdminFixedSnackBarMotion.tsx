import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminFixedSnackBarContent } from './AdminFixedSnackBarContent';
import { useAdminFixedSnackBarContext } from './AdminFixedSnackBarProvider';
import type { AdminFixedSnackBarGeometry } from './adminFixedSnackBarGeometry';
import { adminFixedSnackBarDragExtent, adminFixedSnackBarFlingFrame, adminFixedSnackBarHeightCurve, adminFixedSnackBarMovementDuration, adminFixedSnackBarSwipeMotion,
  type AdminFixedSnackBarEntry, type AdminFixedSnackBarHost, type AdminFixedSnackBarSwipeMotion } from './adminFixedSnackBarModel';
import { AdminFixedSnackBarMembershipOwner, type AdminFixedSnackBarMembership } from './adminFixedSnackBarMembership';
import type { AdminTopNoticeScaffold } from './adminTopNoticeModel';

type Props = Readonly<{ host: AdminFixedSnackBarHost; scaffold: AdminTopNoticeScaffold; entry: AdminFixedSnackBarEntry; geometry: AdminFixedSnackBarGeometry; isCurrent: () => boolean }>;
type Movement = Readonly<{ motion: AdminFixedSnackBarSwipeMotion; startedAt: number | null }>;
/** Native-frame Dismissible movement is independent from the shared Messenger entry/exit controller. */
export function AdminFixedSnackBarMotion({ host, scaffold, entry, geometry, isCurrent }: Props) {
  const { queue, visibility, progress, palette, dismissLabel, disableAnimations, readiness } = useAdminFixedSnackBarContext();
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot), owner = useMemo(() => new AdminFixedSnackBarMembershipOwner({}), []);
  const accepted = useRef<AdminFixedSnackBarMembership | null>(null);
  const membership = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot), [height, setHeight] = useState<number | null>(null);
  const ticket = membership?.ticket ?? '', active = useSharedValue(''), measuredHeight = useSharedValue(0), extent = useSharedValue(0), fraction = useSharedValue(0);
  const direction = useSharedValue(1), dragDirection = useSharedValue(1), movement = useSharedValue<Movement | null>(null), dragging = useSharedValue(false), ticker = useSharedValue(false);
  const canInteract = useSyncExternalStore(visibility.subscribe, () => isSynchronouslyTrue(() => visibility.canInteract(scaffold)), () => false);
  const tickerEnabled = useSyncExternalStore(visibility.subscribe, () => isSynchronouslyTrue(() => visibility.tickerEnabled(scaffold)), () => false);
  useLayoutEffect(() => owner.attach(), [owner]);
  useLayoutEffect(() => {
    if (!owner.current(membership)) return; active.set(ticket);
    return () => { active.set(''); movement.set(null); dragging.set(false); accepted.current = null; if (membership) readiness.forget(membership); };
  }, [owner, membership, ticket, active, movement, dragging, readiness]);
  useLayoutEffect(() => { ticker.set(tickerEnabled); }, [ticker, tickerEnabled]);
  const current = () => owner.current(membership) && isSynchronouslyTrue(isCurrent) && queue.entryFor(host) === entry && owner.current(membership);
  const remove = () => { if (current() && queue.canInteract(host, entry) && current()) queue.remove(entry); };
  const finishSwipe = () => { if (membership && accepted.current === membership && current()) queue.remove(entry); };
  useFrameCallback(frame => {
    'worklet';
    const settling = movement.get(); if (active.get() !== ticket || !ticker.get() || !settling) return;
    // Source Ticker is muted while hidden, but elapsed time catches up on its next actual tick.
    const startedAt = settling.startedAt ?? frame.timestamp, elapsed = Math.max(0, frame.timestamp - startedAt), motion = settling.motion;
    let value: number, done: boolean;
    if (motion.kind === 'fling') { const spring = adminFixedSnackBarFlingFrame(motion.from, motion.target, motion.velocity * (disableAnimations ? 200 : 1), elapsed / 1000); value = spring.value; done = spring.done; }
    else { const duration = adminFixedSnackBarMovementDuration * Math.abs(motion.target - motion.from) * (disableAnimations ? .05 : 1);
      const t = duration <= 0 ? 1 : Math.min(1, elapsed / duration); value = motion.from + (motion.target - motion.from) * t; done = t === 1; }
    fraction.set(value);
    if (done) { movement.set(null); if (motion.target === 1) scheduleOnRN(finishSwipe); }
    else movement.set({ motion, startedAt });
  });
  const pan = usePanGesture({ enabled: canInteract, runOnJS: true, onActivate: () => {
    if (!current() || !queue.canInteract(host, entry) || !current() || active.get() !== ticket || !ticker.get() || measuredHeight.get() <= 0) return;
    accepted.current = membership;
    // Source resumes an interrupted movement; a fresh drag resets its displacement.
    extent.set(movement.get() ? fraction.get() * measuredHeight.get() * dragDirection.get() : 0); fraction.set(Math.min(1, Math.abs(extent.get()) / measuredHeight.get()));
    direction.set(extent.get() < 0 ? -1 : 1); movement.set(null); dragging.set(true);
  }, onUpdate: event => {
    if (!current() || accepted.current !== membership || active.get() !== ticket || !ticker.get() || !dragging.get() || measuredHeight.get() <= 0) return;
    const next = adminFixedSnackBarDragExtent(extent.get(), event.changeY); extent.set(next); direction.set(next < 0 ? -1 : 1); dragDirection.set(direction.get()); fraction.set(Math.min(1, Math.abs(next) / measuredHeight.get()));
  }, onDeactivate: event => {
    if (!current() || accepted.current !== membership || active.get() !== ticket || event.canceled || !dragging.get() || measuredHeight.get() <= 0) return; dragging.set(false);
    const motion = adminFixedSnackBarSwipeMotion(Math.abs(extent.get()), measuredHeight.get(), event.velocityX, extent.get() < 0 ? -event.velocityY : event.velocityY);
    if (!motion) return; if (motion.kind === 'immediate') { finishSwipe(); return; }
    if (motion.kind === 'fling') dragDirection.set(event.velocityY < 0 ? -1 : 1);
    movement.set({ motion, startedAt: null });
  } });
  const curve = Easing.bezierFn(...adminFixedSnackBarHeightCurve);
  const outer = useAnimatedStyle(() => ({ height: height === null ? 0 : height * (snapshot.accessibleNavigation ? 1 : curve(Math.max(0, Math.min(1, progress.get())))), opacity: height === null ? 0 : 1 }));
  const swipe = useAnimatedStyle(() => ({ transform: [{ translateY: fraction.get() * measuredHeight.get() * direction.get() }] }));
  return <Animated.View testID="admin-fixed-snackbar" pointerEvents="box-none" style={[styles.clip, { left: geometry.left, width: geometry.width, bottom: geometry.bottom }, outer]}
    accessible accessibilityLiveRegion="polite" accessibilityLabel={entry.message} accessibilityActions={[{ name: 'dismiss', label: dismissLabel }]}
    onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'dismiss') remove(); }}>
    <GestureHandlerRootView style={styles.top}><GestureDetector gesture={pan}><Animated.View style={swipe}>
      <View onLayout={event => { const value = event.nativeEvent.layout.height;
        if (membership && current() && Number.isFinite(value) && value > 0) {
          measuredHeight.set(value); setHeight(value); readiness.measured(membership, { host, entry, geometry, height: value, current });
        } }}>
        <AdminFixedSnackBarContent entry={entry} palette={palette} safeLeft={geometry.safeLeft} safeRight={geometry.safeRight} />
      </View>
    </Animated.View></GestureDetector></GestureHandlerRootView>
  </Animated.View>;
}
const styles = StyleSheet.create({ clip: { position: 'absolute', overflow: 'hidden' }, top: { position: 'absolute', top: 0, left: 0, right: 0 } });
