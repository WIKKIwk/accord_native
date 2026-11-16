import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { adminHomeCanLoadSummary } from './adminHomeModel';
import { adminSupplierSummary, type AdminSupplierSummary } from './adminSupplierSummary';

/** A fresh reader is required for every session and access scope. */
export function adminHomeSummaryReader(session: Session, isWitnessCurrent?: () => boolean): () => Promise<AdminSupplierSummary> {
  const scope = sessionReadScope(session);
  let retired = false;
  const readWitness = () => {
    if (retired) return false;
    try {
      const current = isProfileSessionCurrent(isWitnessCurrent) && !!activeSessionToken(session) &&
        sessionReadScope(session) === scope && adminHomeCanLoadSummary(session);
      if (!current) retired = true;
      return !retired;
    } catch { retired = true; return false; }
  };
  const guard = () => {
    if (!readWitness()) {
      throw new Error('Admin summary session changed');
    }
  };
  return async () => {
    guard();
    const value = await adminSupplierSummary(session, guard, readWitness);
    guard();
    return value;
  };
}
