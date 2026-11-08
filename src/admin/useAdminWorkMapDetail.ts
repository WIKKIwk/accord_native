import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import type { AdminWorkMapController, AdminWorkMapDetailTicket } from './adminWorkMapController';
import { adminWorkMapDetailReader } from './adminWorkMapReader';

type Detail = Awaited<ReturnType<ReturnType<typeof adminWorkMapDetailReader>>>;
type Result = { session: Session; ticket: AdminWorkMapDetailTicket; attempt: number; value?: Detail; error?: string };

/** Keep reads and retries bound to the opening list window, including between stale-detail attempts. */
export function useAdminWorkMapDetail(session: Session, isCurrent: () => boolean, controller: AdminWorkMapController,
  ticket: AdminWorkMapDetailTicket, close: () => void) {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const valid = isProfileSessionCurrent(isCurrent) && controller.detailIsCurrent(ticket);
  const [attempt, setAttempt] = useState(0), [result, setResult] = useState<Result | null>(null);
  const currentResult = valid && result?.session === session && result.ticket === ticket && result.attempt === attempt ? result : null;
  useEffect(() => { if (!valid) close(); }, [valid, close]);
  useEffect(() => {
    if (!valid) return;
    let mounted = true;
    const current = () => isProfileSessionCurrent(isCurrent) && controller.detailIsCurrent(ticket);
    void adminWorkMapDetailReader(session, current)(ticket).then(value => {
      if (mounted && current()) setResult({ session, ticket, attempt, value });
    }, error => {
      if (mounted && current()) setResult({ session, ticket, attempt, error: error instanceof Error ? error.message : String(error) });
    });
    return () => { mounted = false; };
  }, [session, isCurrent, controller, ticket, valid, attempt]);
  return { valid, loading: valid && currentResult == null, value: currentResult?.value, error: currentResult?.error,
    retry: () => { if (isProfileSessionCurrent(isCurrent) && controller.detailIsCurrent(ticket)) setAttempt(value => value + 1); } };
}
