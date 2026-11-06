import type { Session } from '../auth';

const unlocked = new WeakSet<Session>();

/** @v2 SecurityController.unlockAfterLogin */
export function unlockAfterLogin(session: Session): void { unlocked.add(session); }

export function consumeLoginUnlock(session: Session): boolean {
  const result = unlocked.has(session);
  unlocked.delete(session);
  return result;
}
