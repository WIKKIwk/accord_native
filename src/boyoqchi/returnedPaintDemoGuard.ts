import type { Session } from '../auth';

export const BOYOQCHI_DEMO_UNAVAILABLE = 'Demo rejimi hozircha mavjud emas.';

/** The demo token is not proof of V2's separate persisted test-mode flag. */
export class BoyoqchiDemoUnavailableError extends Error {
  constructor() { super(BOYOQCHI_DEMO_UNAVAILABLE); this.name = 'BoyoqchiDemoUnavailableError'; }
}
export function ensureBoyoqchiRealSession(session: Session): void {
  if (session.token === 'test-mode-token') throw new BoyoqchiDemoUnavailableError();
}
