import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { localeController } from '../shared/localization/runtime';
import { AdminClosedLogSheet } from './AdminClosedLogSheet';
import { adminClosedLogDetail } from './adminClosedLogPresentation';
import type { AdminClosedHistoryController, AdminClosedLogSelection } from './adminClosedHistoryController';
import type { AdminWorkMapController } from './adminWorkMapController';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeNow = () => localeController.locale;
/** Hides stale sheet content immediately and closes it after the original account or row witness retires. */
export function AdminClosedLogBoundary({ selection, history, window, catalog, close }: { selection: AdminClosedLogSelection;
  history: AdminClosedHistoryController; window: AdminWorkMapController; catalog: readonly { id: string; name: string }[]; close: () => void }) {
  const locale = useSyncExternalStore(subscribeLocale, localeNow, localeNow);
  const subscribe = useCallback((listener: () => void) => {
    const stopAccount = subscribeSessionWitness(listener), stopHistory = history.subscribe(listener), stopWindow = window.subscribe(listener);
    return () => { stopAccount(); stopHistory(); stopWindow(); };
  }, [history, window]);
  const snapshot = useCallback(() => isProfileSessionCurrent(selection.isCurrent), [selection]);
  const valid = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => { if (!valid) close(); }, [valid, close]);
  if (!valid) return null;
  return <AdminClosedLogSheet model={adminClosedLogDetail(selection.detail, selection.log, catalog, locale)} />;
}
