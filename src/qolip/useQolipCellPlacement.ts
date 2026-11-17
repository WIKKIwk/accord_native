import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { currentSession, registerSessionResetHook, type Session } from '../auth';
import { qolipProducts } from '../qolipProductsApi';
import { sessionReadScope } from '../sessionReadScope';
import type { QolipBlock } from './qolipBlocksApi';
import type { QolipPlacementProduct } from './qolipCellPlacement';
import { QolipCellPlacementState } from './qolipCellPlacementState';
import { qolipLocations, qolipSaveLocation } from './qolipLocationsApi';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';

export function useQolipCellPlacement(session: Session, blocks: readonly QolipBlock[], input: {
  initialBlock?: QolipBlock | null; rowLetter?: string | null; columnNumber?: number | null;
  product?: QolipPlacementProduct | null;
  boundary?: QolipHomeReadBoundary;
}) {
  const { initialBlock, rowLetter, columnNumber, product, boundary } = input;
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Keep the original boundary identity even when two witnesses share a callback.
  const controller = useMemo(() => new QolipCellPlacementState({
    locations: block => qolipLocations(session, block, boundary?.current),
    products: () => qolipProducts(session, { limit: 20000, with_qolip_only: true }, boundary?.current),
    save: (target, item) => qolipSaveLocation(session, { ...target, product: item, quantity: 1 }, boundary?.current),
    scope: () => { const current = currentSession(); return current ? sessionReadScope(current) : ''; },
    valid: () => currentSession() === session && (boundary?.current() ?? true),
  }, blocks, { initialBlock, rowLetter, columnNumber, product }), [session, blocks, initialBlock, rowLetter, columnNumber, product, boundary]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    const unregister = registerSessionResetHook(async () => { controller.invalidateSession(); });
    controller.start();
    return () => { controller.dispose(); controller.onIdle(unregister); };
  }, [controller]);
  return { ...state, canSave: controller.canSave, controller };
}
