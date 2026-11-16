import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { cancelAnimation, Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { AdminTopNoticeMessenger } from './adminTopNoticeMessenger';
import { adminTopNoticeTransitionDuration } from './adminTopNoticeModel';

type Context = Readonly<{ messenger: AdminTopNoticeMessenger; progress: SharedValue<number> }>;
const NoticeContext = createContext<Context | null>(null);

/** One actual coordinator for the genuine shared Messenger, outside its native route carriers. */
export function AdminTopNoticeProvider({ messenger, accessibleNavigation, children }: {
  messenger: AdminTopNoticeMessenger; accessibleNavigation: boolean; children: ReactNode;
}) {
  if (typeof accessibleNavigation !== 'boolean') throw TypeError('Actual platform accessible-navigation state is required');
  const driver = useMemo(() => ({ messenger }), [messenger]), progress = useSharedValue(0), run = useRef<object | null>(null);
  const state = useSyncExternalStore(messenger.subscribe, messenger.getSnapshot, messenger.getSnapshot);
  const leased = messenger.hasDriverLease(driver);
  useLayoutEffect(() => messenger.attachDriver(driver, accessibleNavigation) ?? undefined, [messenger, driver, accessibleNavigation]);
  useLayoutEffect(() => { messenger.setAccessibleNavigation(driver, accessibleNavigation); }, [messenger, driver, accessibleNavigation]);
  useEffect(() => {
    const transition = state.transition; if (!leased || !messenger.hasDriverLease(driver) || !transition || state.retired) return; const original = {}; run.current = original;
    const from = transition.reset ? 0 : Math.max(0, Math.min(1, progress.get())); if (transition.reset) progress.set(0);
    const complete = () => { if (run.current === original) messenger.completeTransition(driver, transition); };
    // Source AnimationController scales reverse duration to its remaining distance;
    // the height curve belongs to the view, not this linear controller progress.
    progress.set(withTiming(transition.target, { duration: adminTopNoticeTransitionDuration * Math.abs(transition.target - from), easing: Easing.linear },
      finished => { if (finished) scheduleOnRN(complete); }));
    return () => { if (run.current === original) run.current = null; cancelAnimation(progress); };
  }, [messenger, driver, leased, state.transition, state.retired, progress]);
  const context = useMemo(() => Object.freeze({ messenger, progress }), [messenger, progress]);
  return leased ? <NoticeContext.Provider value={context}>{children}</NoticeContext.Provider> : null;
}
export function useAdminTopNoticeTarget(): Context {
  const value = useContext(NoticeContext); if (!value) throw Error('The genuine AdminTopNoticeProvider is required'); return value;
}
