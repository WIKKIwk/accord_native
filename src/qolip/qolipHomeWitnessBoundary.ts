import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { assertQolipReadCurrent } from './qolipApiCommon';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';

/** Structural input only. The injected shared checker, not this type, authenticates the original witness. */
type HomeWitness = Readonly<{ session: Session; scope: string }>;
type WitnessFunctions<W extends HomeWitness> = {
  isSessionWitnessCurrent: (witness: W) => boolean;
  subscribeSessionWitness: (listener: () => void) => () => void;
};

/**
 * Consume a witness already captured by the real shell. Never capture, clone or renew it here.
 * Pass main's existing isSessionWitnessCurrent and subscribeSessionWitness unchanged after integration.
 * This injection keeps this older branch compilable without copying or changing shared authentication.
 */
export function qolipHomeWitnessBoundary<W extends HomeWitness>(session: Session, witness: W,
  functions: WitnessFunctions<W>): QolipHomeReadBoundary {
  const check = functions.isSessionWitnessCurrent, subscribe = functions.subscribeSessionWitness, scope = witness.scope;
  const checkOriginal = () => check(witness);
  let expired = false;
  const allowed = () => witness.session === session && witness.scope === scope && sessionReadScope(session) === scope &&
    session.profile.role === 'qolipchi' && session.capabilities.includes('qolip.manage') &&
    !!activeSessionToken(session) && activeSessionToken(session) !== 'test-mode-token';
  const current = () => {
    if (expired) return false;
    try {
      if (!allowed()) { expired = true; return false; }
      assertQolipReadCurrent(checkOriginal);
      if (!allowed()) { expired = true; return false; }
      return !expired;
    } catch { expired = true; return false; }
  };
  return Object.freeze({ current, subscribe: (listener: () => void) => subscribe(listener) });
}
