import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { QolipCellPickerState } from './qolipCellPickerState';
import type { QolipCellPlacementState } from './qolipCellPlacementState';

export function useQolipCellPicker(placement: QolipCellPlacementState) {
  const controller = useMemo(() => new QolipCellPickerState(() => placement.openPicker()), [placement]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate(); void controller.start();
    return () => controller.dispose();
  }, [controller]);
  return { ...state, visibleItems: controller.visibleItems, selectedProducts: controller.selectedProducts, controller };
}
