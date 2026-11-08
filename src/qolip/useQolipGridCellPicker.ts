import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { QolipGridCellPickerState } from './qolipGridCellPickerState';

type Props = { boundary: QolipHomeReadBoundary; excludeCellLabel?: string | null; select: (label: string) => void };

/** Unmounted picker content model; selection returns a label only, never dispatches a write. */
export function useQolipGridCellPicker(props: Props) {
  const controller = useMemo(() => new QolipGridCellPickerState(props.excludeCellLabel, props.boundary), [props.boundary, props.excludeCellLabel]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useLayoutEffect(() => { controller.activate(); return () => controller.suspend(); }, [controller]);
  const emit = (label: string | null) => { if (label && controller.canChoose()) props.select(label); };
  return { ...snapshot, controller, chooseGrid: (label: string) => emit(controller.gridChoice(label)),
    chooseResult: (label: string) => emit(controller.resultChoice(label)), submit: () => emit(controller.submit()) };
}
