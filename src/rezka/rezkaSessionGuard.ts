import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';

export type RezkaAccess = 'master' | 'split';
/** A request may have reached the server before the scope changed; do not automatically repeat it. */
export class RezkaScopeChanged extends Error {
  constructor(readonly mayHaveExecuted: boolean) {
    super('Sessiya tugagan. Qayta kiring.');
    this.name = 'RezkaScopeChanged';
  }
}
function allowed(session: Session, access: RezkaAccess, expectedScope: string): boolean {
  if (!activeSessionToken(session) || sessionReadScope(session) !== expectedScope) return false;
  return access === 'master'
    ? session.profile.role === 'rezka_master' && session.capabilities.includes('rezka.master.access') && canOpenRoute(session, appRoutes.adminWorkerSettings)
    : canOpenRoute(session, appRoutes.rezkaSplit);
}
/** Checks both initial transmission and the shared 401 refresh retry. */
export async function guardedRezkaRequest<T>(session: Session, access: RezkaAccess, expectedScope: string, mutation: boolean,
  send: (beforeSend: () => void) => Promise<T>): Promise<T> {
  let attempts = 0;
  const current = () => allowed(session, access, expectedScope);
  const beforeSend = () => {
    if (!current()) throw new RezkaScopeChanged(mutation && attempts > 0);
    attempts++;
  };
  try {
    const result = await send(beforeSend);
    if (!current()) throw new RezkaScopeChanged(mutation && attempts > 0);
    return result;
  } catch (error) {
    if (!current()) throw new RezkaScopeChanged(mutation && attempts > 0);
    throw error;
  }
}
export function currentRezkaScope(session: Session): string { return sessionReadScope(session); }
