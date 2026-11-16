import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { useAccountSwitcherLauncher } from '../components/useAccountSwitcherLauncher';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { subscribeProfileAvatarCache } from '../shared/profileAvatarRuntime';
import type { AdminProfileActionProps } from './AdminProfileActionTypes';
import { createAdminProfileActionSession } from './adminProfileActionSession';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function useAdminProfileAction(props: AdminProfileActionProps) {
  const { session, witness, isCurrent, canInteract, onProfile } = props;
  const owner = useMemo(() => createAdminProfileActionSession(session, witness, isCurrent), [session, witness, isCurrent]), { controller } = owner;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const mounted = useRef(false), binding = useMemo(() => ({ canInteract, onProfile }), [canInteract, onProfile]), committed = useRef<typeof binding | null>(null), checking = useRef<{ reentered: boolean } | null>(null);
  useLayoutEffect(() => { mounted.current = true; controller.start(); return () => { mounted.current = false; controller.dispose(); }; }, [controller]);
  useLayoutEffect(() => { committed.current = binding; return () => { if (committed.current === binding) committed.current = null; }; }, [binding]);
  useLayoutEffect(() => { controller.update(session.profile); });
  useEffect(() => subscribeProfileAvatarCache(() => controller.update(session.profile, true)), [controller, session]);
  useEffect(() => { const retire = () => { if (!owner.current()) controller.invalidate(); }; const remove = subscribeSessionWitness(retire); retire(); return remove; }, [owner, controller]);
  const generation = controller.interactionGeneration;
  const current = useCallback(() => mounted.current && controller.isCurrent(generation), [controller, generation]);
  const interactive = () => {
    if (!current() || committed.current !== binding) return false;
    if (checking.current) { checking.current.reentered = true; return false; }
    const frame = { reentered: false }; checking.current = frame; const allowed = isSynchronouslyTrue(canInteract); checking.current = null;
    return allowed && !frame.reentered && current() && committed.current === binding;
  };
  const switcher = useAccountSwitcherLauncher(() => { if (interactive()) onProfile(); });
  return { state, current, label: localizedGetter('profileTitle', locale), hint: switcher.hint,
    press: () => { if (interactive()) switcher.onPress(); }, hold: () => { if (interactive()) switcher.open(); } };
}
