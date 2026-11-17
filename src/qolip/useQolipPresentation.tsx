import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useNativeSheet, type NativeSheetOptions } from '../nativeSheet';
import { QolipRoleContext, useQolipRole, type QolipRoleContextValue } from './QolipRoleContext';
function CurrentContent({ role, children, close }: { role: QolipRoleContextValue; children: ReactNode; close(): void }) {
  const current = useSyncExternalStore(role.boundary.subscribe, role.isCurrent, role.isCurrent);
  useEffect(() => { if (!current) close(); }, [current, close]);
  return current ? <QolipRoleContext.Provider value={role}>{children}</QolipRoleContext.Provider> : null;
}
/** Global sheet/page routes retain this role's original session boundary and providers. */
export function useQolipPresentation() {
  const role = useQolipRole(), sheet = useNativeSheet();
  return useMemo(() => ({ ...sheet,
    open(content: ReactNode, options?: NativeSheetOptions) {
      if (role.isCurrent()) sheet.open(<CurrentContent role={role} close={sheet.close}>{content}</CurrentContent>, options);
    },
    update(content: ReactNode, options?: NativeSheetOptions) {
      sheet.update(<CurrentContent role={role} close={sheet.close}>{content}</CurrentContent>, options);
    },
  }), [role, sheet]);
}
