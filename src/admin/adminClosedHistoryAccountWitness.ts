import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';

/** Raw, captured account/scope/route witness; the caller supplies the one strict validation layer. */
export function adminClosedHistoryAccountWitness(session: Session, isCurrent: () => boolean): () => boolean {
  let scope: string | null;
  try { scope = sessionReadScope(session); } catch { scope = null; }
  let retired = scope === null;
  return () => {
    if (retired) return false;
    try {
      const account = isCurrent();
      // Preserve malformed/async results for the outer strict validator to reject and observe.
      if (account !== true) { retired = true; return account; }
      const current = !!activeSessionToken(session) && sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminProductionMapOrders);
      if (!current) retired = true;
      return current;
    } catch (error) { retired = true; throw error; }
  };
}
