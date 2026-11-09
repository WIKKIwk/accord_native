import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import type { AdminOrderSummary } from './adminOrderSummaryApi';
import type { AdminWorkMapController, AdminWorkMapDetailTicket } from './adminWorkMapController';
import { adminWorkMapSummaryReader } from './adminWorkMapReader';
import { adminWorkMapDetailWitness } from './adminWorkMapDetailWitness';

type Panel = { session: Session; ticket: AdminWorkMapDetailTicket; expanded: boolean };
type Result = { session: Session; ticket: AdminWorkMapDetailTicket; hydration: object; attempt: number; value?: AdminOrderSummary; failed?: true };
/** Collapse removes the source calculation state. Reopening always reads again under the original detail ticket. */
export function useAdminWorkMapSummary(session: Session, isCurrent: () => boolean, controller: AdminWorkMapController,
  ticket: AdminWorkMapDetailTicket, hydrated: object | false) {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const current = () => isProfileSessionCurrent(isCurrent) && controller.detailIsCurrent(ticket);
  const [panel, setPanel] = useState<Panel | null>(null), [attempt, setAttempt] = useState(0), [result, setResult] = useState<Result | null>(null);
  const readGeneration = useRef(0);
  const enabled = ticket.kind === 'order' && !!hydrated && current();
  const expanded = enabled && panel?.session === session && panel.ticket === ticket && panel.expanded;
  const shown = expanded && result?.session === session && result.ticket === ticket && result.hydration === hydrated && result.attempt === attempt ? result : null;
  useEffect(() => {
    if (!expanded || !hydrated || !isProfileSessionCurrent(isCurrent) || !controller.detailIsCurrent(ticket)) return;
    let mounted = true;
    const generation = readGeneration.current;
    const rawWitness = adminWorkMapDetailWitness(isCurrent, controller, ticket),
      witness = () => mounted && readGeneration.current === generation && rawWitness(), current = () => isProfileSessionCurrent(witness);
    void adminWorkMapSummaryReader(session, witness)(ticket.id).then(value => {
      if (mounted && current()) setResult({ session, ticket, hydration: hydrated, attempt, value });
    }, () => { if (mounted && current()) setResult({ session, ticket, hydration: hydrated, attempt, failed: true }); });
    return () => { mounted = false; };
  }, [session, isCurrent, controller, ticket, hydrated, expanded, attempt]);
  return { expanded: !!expanded, canExpand: enabled, value: shown?.value, failed: !!shown?.failed, loading: !!expanded && shown == null,
    toggle: () => {
      if (!hydrated || ticket.kind !== 'order' || !current()) return;
      // Retire retries synchronously, before React's passive-effect cleanup runs.
      readGeneration.current++; setResult(null); setAttempt(value => value + 1);
      setPanel(value => ({ session, ticket, expanded: !(value?.session === session && value.ticket === ticket && value.expanded) }));
    },
    retry: () => { if (expanded && current()) { readGeneration.current++; setResult(null); setAttempt(value => value + 1); } } };
}
