import { isSessionWitnessCurrent, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { notificationHiddenStore } from '../shared/notificationStoresRuntime';
import type { SafeActivityHiddenStore } from './adminActivityController';
import { checkedAdminGuard } from './adminProductionRequest';

export type AdminActivityBinding = {
  hidden: SafeActivityHiddenStore;
  generation: () => string | number | null;
  subscribe: (listener: () => void) => () => void;
};

/** Bind the shared store to the original shell witness; never recapture an expired account. */
export function createAdminActivityBinding(session: Session, witness: SessionWitness): AdminActivityBinding {
  const scope = sessionReadScope(session);
  const current = () => witness.session === session && isSessionWitnessCurrent(witness) &&
    sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminActivity);
  const operationGuard = (guard: () => void) => {
    const caller = checkedAdminGuard(guard)!;
    return () => {
      if (!current()) throw new Error('Admin activity session changed');
      caller();
      if (!current()) throw new Error('Admin activity session changed');
    };
  };
  return {
    generation: () => current() ? witness.generation : null,
    subscribe: subscribeSessionWitness,
    hidden: {
      async load(guard) {
        const check = operationGuard(guard); check();
        await notificationHiddenStore.loadGuarded(check); check();
        return notificationHiddenStore.hiddenIdsForProfile(session);
      },
      async hideAll(ids, guard) {
        const check = operationGuard(guard); check();
        await notificationHiddenStore.hideAllGuarded(session, ids, check); check();
        return notificationHiddenStore.hiddenIdsForProfile(session);
      },
    },
  };
}
