import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { sessionWitnessVersion, subscribeSessionWitness, type Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { AdminClosedHistoryContent } from './AdminClosedHistoryContent';
import { AdminClosedLogBoundary } from './AdminClosedLogBoundary';
import { adminClosedHistoryAccountWitness } from './adminClosedHistoryAccountWitness';
import { AdminClosedHistoryController, type AdminClosedHistoryTicket, type AdminClosedLogSelection } from './adminClosedHistoryController';
import { adminWorkMapClosedRows, type AdminWorkMapClosedOrder } from './adminWorkMapClosedModel';
import type { AdminWorkMapController } from './adminWorkMapController';
import { adminWorkMapClosedDetailReader } from './adminWorkMapReader';

type Props = { session: Session; isCurrent: () => boolean; window: AdminWorkMapController; summary: AdminWorkMapClosedOrder;
  catalog: readonly { id: string; name: string }[] };

/** Prepared owner only. No route imports it until the Closed boundary is independently reviewed. */
export function AdminClosedHistoryOwner(props: Props) {
  useSyncExternalStore(props.window.subscribe, props.window.getSnapshot, props.window.getSnapshot);
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  const account = useMemo(() => adminClosedHistoryAccountWitness(props.session, props.isCurrent), [props.session, props.isCurrent]);
  const orders = props.window.getSnapshot().closed, index = orders.indexOf(props.summary);
  const ticket = index >= 0 && isProfileSessionCurrent(account) ? props.window.closedHistoryTicket(props.summary) : null;
  if (!ticket) return null;
  return <BoundClosedHistory {...props} account={account} ticket={ticket} position={index} />;
}

function BoundClosedHistory({ session, window, summary, catalog, account, ticket, position }: Props & {
  account: () => boolean; ticket: AdminClosedHistoryTicket; position: number;
}) {
  const sheet = useNativeSheet(), activeSelection = useRef<AdminClosedLogSelection | null>(null);
  const group = useMemo(() => {
    const history = new AdminClosedHistoryController(ticket, { isCurrent: account,
      // Raw membership only: never nest the strict session validator inside this witness.
      rowIsCurrent: current => window.closedHistoryIsCurrent(current) && window.getSnapshot().closed.includes(summary),
      read: (id, witness) => adminWorkMapClosedDetailReader(session, witness)(id) });
    let mounts = 0;
    return { history, mount() { mounts++; return () => { mounts--; queueMicrotask(() => { if (!mounts) history.dispose(); }); }; } };
  }, [session, window, summary, account, ticket.id, ticket.historyVersion, ticket.windowGeneration]);
  const history = group.history, state = useSyncExternalStore(history.subscribe, history.getSnapshot, history.getSnapshot);
  useEffect(() => group.mount(), [group]);
  if (!isProfileSessionCurrent(account) || !window.closedHistoryIsCurrent(ticket) || !window.getSnapshot().closed.includes(summary)) return null;
  if (window.getSnapshot().closed[position] !== summary) return null;
  const row = { ...adminWorkMapClosedRows([summary])[0], position: String(position + 1) };
  return <AdminClosedHistoryContent row={row} summary={summary} state={state} catalog={catalog} onToggle={() => history.toggle()} onRetry={() => history.retry()}
    onLog={(detail, log) => {
      const selection = history.captureLog(detail, log);
      if (!selection || !isProfileSessionCurrent(selection.isCurrent) || sheet.isOpen()) return;
      const clear = () => { if (activeSelection.current === selection) activeSelection.current = null; };
      const close = () => { if (activeSelection.current === selection) { activeSelection.current = null; sheet.close(); } };
      activeSelection.current = selection;
      try { sheet.open(<AdminClosedLogBoundary selection={selection} history={history} window={window} catalog={catalog} close={close} />, { onDismiss: clear }); }
      catch (error) { clear(); throw error; }
    }} />;
}
