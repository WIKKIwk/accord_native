import { activeSessionEpoch, activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';

export type RezkaAccess = 'master' | 'split';
export type RezkaSessionSnapshot = Readonly<{ session: Session; epoch: number | null; scope: string }>;
/** Capture when the view or operation starts, not immediately before an old form is submitted. */
export function captureRezkaSession(session: Session): RezkaSessionSnapshot {
  return Object.freeze({ session, epoch: activeSessionEpoch(session), scope: sessionReadScope(session) });
}
export function currentRezkaScope(session: Session): string { return sessionReadScope(session); }
/** A request may have reached the server before the scope changed; do not automatically repeat it. */
export class RezkaScopeChanged extends Error {
  constructor(readonly mayHaveExecuted: boolean) {
    super('Sessiya tugagan. Qayta kiring.');
    this.name = 'RezkaScopeChanged';
  }
}
export function isRezkaSessionCurrent(snapshot: RezkaSessionSnapshot | null | undefined, access: RezkaAccess): boolean {
  if (!snapshot || snapshot.epoch === null) return false;
  const { session, epoch, scope } = snapshot;
  if (!activeSessionToken(session) || activeSessionEpoch(session) !== epoch || sessionReadScope(session) !== scope) return false;
  return access === 'master'
    ? session.profile.role === 'rezka_master' && session.capabilities.includes('rezka.master.access') && canOpenRoute(session, appRoutes.adminWorkerSettings)
    : canOpenRoute(session, appRoutes.rezkaSplit);
}
/** Checks the captured session object, epoch, role and scope before the initial send and any 401 retry. */
export async function guardedRezkaRequest<T>(session: Session, access: RezkaAccess, snapshot: RezkaSessionSnapshot, mutation: boolean,
  send: (beforeSend: () => void) => Promise<T>): Promise<T> {
  let attempts = 0;
  const current = () => snapshot?.session === session && isRezkaSessionCurrent(snapshot, access);
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
