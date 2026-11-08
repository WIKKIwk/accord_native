import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import { QolipBlocksState, type QolipBlocksNotice } from './qolipBlocksState';

export function useQolipBlocks(session: Session) {
  const [queue, setQueue] = useState<{ session: Session; notice: QolipBlocksNotice }[]>([]);
  const controller = useMemo(() => QolipBlocksState.forSession(session, notice =>
    setQueue(current => [...current.filter(item => item.session === session), { session, notice }])), [session]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.activate(); void controller.reload().catch(() => {}); return () => controller.dispose(); }, [controller]);
  const dismissNotice = useCallback(() => setQueue(current => {
    const index = current.findIndex(item => item.session === session);
    return index < 0 ? current : [...current.slice(0, index), ...current.slice(index + 1)];
  }), [session]);
  return { ...state, filtered: controller.filtered, controller,
    notice: queue.find(item => item.session === session)?.notice ?? null, dismissNotice };
}
