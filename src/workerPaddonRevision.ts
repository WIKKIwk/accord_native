const listeners = new Set<(scope: string) => void>();
/** @v2 ActiveRezkaPaddonStore.notifyChanged */
export const workerPaddonRevision = {
  notify(scope: string) { listeners.forEach(fn => fn(scope)); },
  subscribe(fn: (scope: string) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};
