import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { adminHomeCanLoadSummary } from './adminHomeModel';
import { adminSupplierSummary, type AdminSupplierSummary } from './adminSupplierSummary';

/** A fresh reader is required for every session and access scope. */
export function adminHomeSummaryReader(session: Session): () => Promise<AdminSupplierSummary> {
  const scope = sessionReadScope(session);
  const guard = () => {
    if (!activeSessionToken(session) || sessionReadScope(session) !== scope || !adminHomeCanLoadSummary(session)) {
      throw new Error('Admin summary session changed');
    }
  };
  return async () => {
    guard();
    const value = await adminSupplierSummary(session, guard);
    guard();
    return value;
  };
}
