import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { isSessionWitnessCurrent, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { createFactoryLocationSession } from './factoryLocationSession';
import { FactoryLocationPresentation } from './factoryLocationPresentation';
import type { FactoryLocationScreenProps } from './factoryLocationScreenTypes';

export type FactoryLocationsRouteProps = { session: Session; witness: SessionWitness; isCurrent: () => boolean;
  navigation: FactoryLocationScreenProps['navigation']; footer?: ReactNode; profileAction?: ReactNode };
export function useFactoryLocationsRoute(props: FactoryLocationsRouteProps) {
  const { session, witness, isCurrent } = props;
  const owner = useMemo(() => {
    const current = () => witness.session === session && isSessionWitnessCurrent(witness) && isSynchronouslyTrue(isCurrent);
    const controller = createFactoryLocationSession(session, witness, current);
    return { controller, presentation: new FactoryLocationPresentation(controller, current), current };
  }, [session, witness, isCurrent]);
  const presentation = useSyncExternalStore(owner.presentation.subscribe, owner.presentation.getSnapshot, owner.presentation.getSnapshot);
  const state = useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot);
  useEffect(() => {
    owner.presentation.activate();
    const check = () => { if (!owner.current()) { owner.presentation.invalidate(); owner.controller.invalidate(); } };
    const unsubscribe = subscribeSessionWitness(check); check();
    return () => { unsubscribe(); owner.presentation.detach(); };
  }, [owner]);
  useEffect(() => {
    if (!presentation.invalidName) return;
    const timer = setTimeout(() => owner.presentation.clearInvalidName(), 4000); return () => clearTimeout(timer);
  }, [owner, presentation.invalidName]);
  return { owner, presentation, apparatus: state.apparatus,
    screen: { controller: owner.controller, navigation: props.navigation, footer: props.footer, profileAction: props.profileAction,
      onOpenEditor: (ticket => owner.presentation.open('editor', ticket)) as FactoryLocationScreenProps['onOpenEditor'],
      onOpenRename: (ticket => owner.presentation.open('rename', ticket)) as FactoryLocationScreenProps['onOpenRename'] } };
}
