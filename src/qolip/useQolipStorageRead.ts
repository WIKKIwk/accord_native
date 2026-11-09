import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { createQolipStorageRead } from './qolipStorageReadRuntime';

const scheduleFrame = (callback: () => void) => { requestAnimationFrame(callback); };

/** A real read owner for the original role lifetime; mutation locks still come from its actual action owner. */
export function useQolipStorageRead(session: Session, boundary: QolipHomeReadBoundary, archive: boolean, saving: boolean) {
  const controller = useMemo(() => createQolipStorageRead(session, boundary, archive, scheduleFrame), [session, boundary, archive]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useLayoutEffect(() => { controller.activate(); void controller.load(); return () => controller.suspend(); }, [controller]);
  useLayoutEffect(() => controller.setSaving(saving), [controller, saving]);
  return { ...snapshot, controller };
}
