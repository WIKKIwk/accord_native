import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { QolipCellDetailState, type QolipCellDetailChoice } from './qolipCellDetailState';
import type { QolipCellDetailProps } from './qolipCellDetailProps';
import type { QolipLocationEntry } from './qolipLocationsApi';

/** Unmounted presentation hook. Its callback returns a source sheet choice, never dispatches the corresponding action. */
export function useQolipCellDetail(props: QolipCellDetailProps) {
  // The source sheet captures its original item/alternative lists when it opens.
  const controller = useMemo(() => new QolipCellDetailState(props, props.boundary), [props.boundary, props.cellLabel]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useLayoutEffect(() => { controller.activate(); return () => controller.suspend(); }, [controller]);
  const emit = (choice: QolipCellDetailChoice | null) => { if (choice && controller.canChoose()) props.choose(choice); };
  return { ...state, controller,
    take: (item: QolipLocationEntry) => emit(controller.itemChoice('take', item)),
    moveOut: (item: QolipLocationEntry) => emit(controller.itemChoice('move-out', item)),
    add: () => emit(controller.footerChoice('add')),
    placeUnplaced: () => emit(controller.footerChoice('place-unplaced')),
    moveIn: () => emit(controller.footerChoice('move-in')),
    moveSelected: () => emit(controller.bulkChoice()),
  };
}
