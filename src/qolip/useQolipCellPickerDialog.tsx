import { useCallback, useEffect, useRef } from 'react';
import { QolipGridCellPicker } from './QolipGridCellPicker';
import { useQolipRole } from './QolipRoleContext';
import { useQolipPresentation } from './useQolipPresentation';
export function useQolipCellPickerDialog() {
  const role = useQolipRole(), sheet = useQolipPresentation(), pending = useRef<((value: string | null) => void) | null>(null);
  useEffect(() => () => { pending.current?.(null); pending.current = null; }, []);
  return useCallback((title: string, excludeCellLabel?: string | null): Promise<string | null> => {
    if (!role.isCurrent() || sheet.isOpen()) return Promise.resolve(null);
    return new Promise(resolve => {
      pending.current = resolve; let selected: string | null = null;
      sheet.open(<QolipGridCellPicker boundary={role.boundary} title={title} excludeCellLabel={excludeCellLabel}
        select={value => { selected = value; sheet.close(); }} />, { dismissible: true, heightFraction: 0.88, fitContent: true,
        onDismiss: () => { const finish = pending.current; pending.current = null; finish?.(role.isCurrent() ? selected : null); } });
    });
  }, [role, sheet]);
}
