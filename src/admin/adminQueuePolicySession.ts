import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import { adminApparatusQueuePolicies, adminUpdateApparatusQueuePolicy } from './adminQueuePolicyApi';
import { AdminQueuePolicyCache } from './adminQueuePolicyModel';
import { AdminQueuePolicyController } from './adminQueuePolicyController';
import type { AdminQueuePolicyScreenProps } from './AdminQueuePolicyTypes';

const cache = new AdminQueuePolicyCache();
export function adminQueuePolicySession(props: Pick<AdminQueuePolicyScreenProps, 'session' | 'witness' | 'isCurrent'>) {
  const { session, witness, isCurrent } = props, parentCurrent = createProfileSessionGuard(isCurrent);
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false;
  const current = () => {
    if (retired) return false;
    const original = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
      witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminQueuePolicies);
    if (!original() || !parentCurrent() || !original()) retired = true; return !retired;
  };
  return { current, controller: new AdminQueuePolicyController({ isCurrent: current,
    cached: () => current() ? cache.get() : null, cache: data => { if (current()) cache.set(data); },
    async read(guard, readWitness) {
      // Dart Future.wait is not eagerError: settle both original reads before reporting the first failure.
      let failed = false, firstError: unknown;
      const retainError = (error: unknown) => { if (!failed) { failed = true; firstError = error; } throw error; };
      const tasks = [adminApparatus(session, { limit: 300, retryTransient: false, beforeSend: guard, readWitness }).catch(retainError),
        adminApparatusQueuePolicies(session, guard, readWitness).catch(retainError)] as const;
      const settled = await Promise.allSettled(tasks); guard();
      if (failed) throw firstError;
      return { apparatus: (settled[0] as PromiseFulfilledResult<Awaited<typeof tasks[0]>>).value,
        policies: (settled[1] as PromiseFulfilledResult<Awaited<typeof tasks[1]>>).value };
    },
    write: (input, guard) => adminUpdateApparatusQueuePolicy(session, input, guard),
  }) };
}
