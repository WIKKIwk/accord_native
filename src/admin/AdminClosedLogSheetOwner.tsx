import { useMemo } from 'react';
import { useNativeSheet } from '../nativeSheet';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { AdminClosedLogBoundary } from './AdminClosedLogBoundary';
import type { AdminClosedHistoryController, AdminClosedLogSelection } from './adminClosedHistoryController';
import type { AdminWorkMapController } from './adminWorkMapController';

type NativeSheet = ReturnType<typeof useNativeSheet>;
type OpenLog = { selection: AdminClosedLogSelection; history: AdminClosedHistoryController; window: AdminWorkMapController;
  catalog: readonly { id: string; name: string }[] };

/** One owner must be shared across every Closed row in a Work Map screen. */
export function createAdminClosedLogSheetOwner(sheet: NativeSheet) {
  let active: object | null = null;
  return {
    open({ selection, history, window, catalog }: OpenLog) {
      if (active || sheet.isOpen()) return;
      const token = {};
      const clear = () => { if (active === token) active = null; };
      const close = () => { if (active === token) { active = null; sheet.close(); } };
      // Reserve before checking an injected witness, which may synchronously reenter open().
      active = token;
      try {
        if (!isProfileSessionCurrent(selection.isCurrent) || active !== token || sheet.isOpen()) { clear(); return; }
        sheet.open(<AdminClosedLogBoundary selection={selection} history={history} window={window} catalog={catalog} close={close} />,
          { dismissible: true, onDismiss: clear });
        // A retired or unmounted native owner may reject open without throwing.
        if (!sheet.isOpen()) clear();
      } catch (error) { clear(); throw error; }
    },
  };
}
export type AdminClosedLogSheetOwner = ReturnType<typeof createAdminClosedLogSheetOwner>;

/** Prepared only. Create once at screen scope; do not wire while transport and route ownership are held. */
export function useAdminClosedLogSheetOwner() {
  const sheet = useNativeSheet();
  return useMemo(() => createAdminClosedLogSheetOwner(sheet), [sheet]);
}
