import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { cancelAnimation, Easing, ReduceMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminFixedSnackBarHost } from './AdminFixedSnackBarHost';
import type { AdminFixedSnackBarProviderProps } from './AdminFixedSnackBarTypes';
import type { AdminItemCreateFixedSnackBarTarget } from './AdminItemCreateScreenAssemblyTypes';
import { useAdminTopNoticeTarget } from './AdminTopNoticeProvider';
import type { AdminFixedSnackBarController } from './adminFixedSnackBarController';
import { adminFixedSnackBarTransitionDuration } from './adminFixedSnackBarModel';
import { adminFixedSnackBarController } from './adminFixedSnackBarRuntime';
import { AdminFixedSnackBarNativeReadiness } from './adminFixedSnackBarNativeReadiness';

export type AdminFixedSnackBarContext = Readonly<AdminFixedSnackBarProviderProps & {
  queue: AdminFixedSnackBarController; progress: SharedValue<number>; target: AdminItemCreateFixedSnackBarTarget; readiness: AdminFixedSnackBarNativeReadiness;
}>;
const FixedContext = createContext<AdminFixedSnackBarContext | null>(null);
/** One ordinary FIFO coordinator under the ACTUAL shared Source Messenger, outside native page carriers. */
export function AdminFixedSnackBarProvider(props: AdminFixedSnackBarProviderProps) {
  const { messenger } = useAdminTopNoticeTarget(), { reader, visibility, palette, dismissLabel, disableAnimations } = props;
  if (!reader || typeof reader.isAvailable !== 'function' || typeof reader.observe !== 'function' || !visibility ||
    typeof visibility.subscribe !== 'function' || typeof visibility.canInteract !== 'function' || typeof visibility.tickerEnabled !== 'function' ||
    !palette || !palette.inverseSurface || !palette.onInverseSurface ||
    typeof dismissLabel !== 'string' || typeof disableAnimations !== 'boolean') throw TypeError('Actual fixed SnackBar window, palette, visibility and accessibility facts are required');
  const queue = adminFixedSnackBarController(messenger), driver = useMemo(() => ({ queue }), [queue]);
  const readiness = useMemo(() => new AdminFixedSnackBarNativeReadiness(queue), [queue]); useSyncExternalStore(readiness.subscribe, readiness.getSnapshot, readiness.getSnapshot);
  const progress = useSharedValue(0), run = useRef<object | null>(null), lastTransition = useRef<object | null>(null), state = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const leased = queue.hasDriverLease(driver), contentReceipt = state.head ? readiness.receiptFor(state.head) : null;
  useLayoutEffect(() => queue.attachDriver(driver) ?? undefined, [queue, driver]);
  useEffect(() => {
    const transition = state.transition;
    if (!leased || !queue.hasDriverLease(driver) || !transition || state.retired || transition.target === 1 && (!state.hostsReady || !contentReceipt || !readiness.has(transition.entry))) return;
    const original = {}; run.current = original;
    const reset = transition.reset && lastTransition.current !== transition; lastTransition.current = transition;
    const from = reset ? 0 : Math.max(0, Math.min(1, progress.get())); if (reset) progress.set(0);
    const complete = () => { if (run.current === original && (transition.target === 0 || readiness.has(transition.entry))) queue.completeTransition(driver, transition); };
    // This acknowledges a real animation, not a dialog/window-close operation.
    progress.set(withTiming(transition.target, { duration: adminFixedSnackBarTransitionDuration * Math.abs(transition.target - from) * (disableAnimations ? .05 : 1),
      easing: Easing.linear, reduceMotion: ReduceMotion.Never }, finished => { if (finished) scheduleOnRN(complete); }));
    return () => { if (run.current === original) run.current = null; cancelAnimation(progress); };
  }, [queue, driver, readiness, leased, contentReceipt, state.transition, state.retired, state.hostsReady, disableAnimations, progress]);
  // Flutter starts duration in ScaffoldMessenger.build after the controller's completed status.
  useLayoutEffect(() => { if (leased && state.phase === 'visible' && state.head) queue.startDisplayTimer(driver, state.head); }, [queue, driver, leased, state.phase, state.head]);
  const target = useMemo<AdminItemCreateFixedSnackBarTarget>(() => Object.freeze({
    // Deliberately independent of the not-yet-mounted page marker/geometry. No initial-mount cycle.
    isAvailable: () => queue.hasDriverLease(driver) && isSynchronouslyTrue(reader.isAvailable) && queue.hasDriverLease(driver),
    enqueue: notice => { if (queue.hasDriverLease(driver) && isSynchronouslyTrue(reader.isAvailable) && queue.hasDriverLease(driver)) queue.enqueue(notice); },
    render: host => <AdminFixedSnackBarHost {...host} />,
  }), [queue, driver, reader]);
  const context = useMemo(() => Object.freeze({ ...props, queue, progress, target, readiness }), [props, queue, progress, target, readiness]);
  return leased ? <FixedContext.Provider value={context}>{props.children}</FixedContext.Provider> : null;
}
export function useAdminFixedSnackBarContext(): AdminFixedSnackBarContext {
  const value = useContext(FixedContext); if (!value) throw Error('The genuine AdminFixedSnackBarProvider is required'); return value;
}
export function useAdminFixedSnackBarTarget(): AdminItemCreateFixedSnackBarTarget { return useAdminFixedSnackBarContext().target; }
