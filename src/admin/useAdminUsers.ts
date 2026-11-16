import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { createAdminUsersSession } from './adminUsersSession';

/** Domain binding only; Admin Users UI and its unported detail routes remain held. */
export function useAdminUsers(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const owner = useMemo(() => createAdminUsersSession(session, witness, isCurrent), [session, witness, isCurrent]);
  const state = useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot);
  useEffect(() => {
    owner.attach();
    const check = () => { if (!owner.current()) owner.controller.invalidate(); };
    const unsubscribe = subscribeSessionWitness(check);
    owner.controller.start(); check();
    return () => { unsubscribe(); owner.detach(); };
  }, [owner]);
  useEffect(() => {
    if (!state.notice) return;
    const serial = state.notice.serial, timer = setTimeout(() => owner.controller.dismissNotice(serial), 4000);
    return () => clearTimeout(timer);
  }, [owner, state.notice]);
  return { state, controller: owner.controller, isCurrent: owner.current };
}
