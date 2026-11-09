import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { QolipBlockCreateSheetProps } from './qolipBlockCreateSheetProps';
import { QolipBlockCreateState } from './qolipBlockCreateState';

export function useQolipBlockCreate(props: QolipBlockCreateSheetProps) {
  // V2 initializes the form once. New warehouse/initial props do not reset an already edited sheet.
  const controller = useMemo(() => QolipBlockCreateState.forSession(props.session, props.boundary, props), [props.session, props.boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useLayoutEffect(() => { controller.activate(); return () => controller.suspend(); }, [controller]);
  const save = () => {
    void controller.save().then(created => { if (created && controller.canAct()) props.saved(created); }).catch(() => {});
  };
  return { ...state, canSave: controller.canSave, showWarehouseField: controller.showWarehouseField,
    warehouses: controller.warehouses, controller, save };
}
