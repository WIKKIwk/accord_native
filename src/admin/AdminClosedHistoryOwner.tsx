import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { sessionWitnessVersion, subscribeSessionWitness, type Session } from '../auth';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { AdminClosedHistoryContent } from './AdminClosedHistoryContent';
import type { AdminClosedLogSheetOwner } from './AdminClosedLogSheetOwner';
import { adminClosedHistoryAccountWitness } from './adminClosedHistoryAccountWitness';
import { AdminClosedHistoryController, type AdminClosedHistoryTicket } from './adminClosedHistoryController';
import { adminWorkMapClosedRows, type AdminWorkMapClosedOrder } from './adminWorkMapClosedModel';
import type { AdminWorkMapController } from './adminWorkMapController';
import { adminWorkMapClosedDetailReader } from './adminWorkMapReader';

type Props = { session: Session; isCurrent: () => boolean; window: AdminWorkMapController; summary: AdminWorkMapClosedOrder;
  catalog: readonly { id: string; name: string }[]; logSheet: AdminClosedLogSheetOwner; canInteract?: () => boolean;
  first?: boolean; last?: boolean; fallback?: ReactNode };

/** Hydrate only a row in the active, account-owned Closed window. */
export function AdminClosedHistoryOwner(props: Props) {
  useSyncExternalStore(props.window.subscribe, props.window.getSnapshot, props.window.getSnapshot);
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  const account = useMemo(() => adminClosedHistoryAccountWitness(props.session, props.isCurrent), [props.session, props.isCurrent]);
  const orders = props.window.getSnapshot().closed, index = orders.indexOf(props.summary);
  if (index < 0 || !isProfileSessionCurrent(account)) return null;
  const ticket = props.window.closedHistoryTicket(props.summary);
  if (!ticket) return props.fallback ?? null;
  return <BoundClosedHistory {...props} account={account} ticket={ticket} position={index} />;
}

function BoundClosedHistory({ session, window, summary, catalog, logSheet, account, ticket, position, canInteract, first, last }: Props & {
  account: () => boolean; ticket: AdminClosedHistoryTicket; position: number;
}) {
  const { id, historyVersion, windowGeneration } = ticket;
  const group = useMemo(() => {
    const history = new AdminClosedHistoryController({ id, historyVersion, windowGeneration }, { isCurrent: account,
      // Raw membership only: never nest the strict session validator inside this witness.
      rowIsCurrent: current => window.closedHistoryIsCurrent(current) && window.getSnapshot().closed.includes(summary),
      read: (id, witness) => adminWorkMapClosedDetailReader(session, witness)(id) });
    let mounts = 0;
    return { history, mount() { mounts++; return () => { mounts--; queueMicrotask(() => { if (!mounts) history.dispose(); }); }; } };
  }, [session, window, summary, account, id, historyVersion, windowGeneration]);
  const history = group.history, state = useSyncExternalStore(history.subscribe, history.getSnapshot, history.getSnapshot);
  useEffect(() => group.mount(), [group]);
  if (!isProfileSessionCurrent(account) || !window.closedHistoryIsCurrent(ticket) || !window.getSnapshot().closed.includes(summary)) return null;
  if (window.getSnapshot().closed[position] !== summary) return null;
  const row = { ...adminWorkMapClosedRows([summary])[0], position: String(position + 1) };
  const interactive = () => canInteract === undefined || isProfileSessionCurrent(canInteract);
  return <AdminClosedHistoryContent row={row} summary={summary} state={state} catalog={catalog} first={first} last={last}
    onToggle={() => { if (interactive()) history.toggle(); }} onRetry={() => { if (interactive()) history.retry(); }}
    onLog={(detail, log) => {
      if (!interactive()) return;
      const selection = history.captureLog(detail, log);
      if (selection) logSheet.open({ selection, history, window, catalog });
    }} />;
}
