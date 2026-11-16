import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { createAdminItemDetailComboSession } from './adminItemDetailComboSession';
import type { AdminItemDetailComboProduct } from './adminItemDetailComboPresentation';
import type { AdminItemDetailReadContext } from './AdminItemDetailReadTypes';
import type { AdminItemDetailCombo } from './adminItemDetailComboApi';
import type { AdminItemDetailComboController, AdminItemDetailComboState } from './adminItemDetailComboController';
import { AdminItemDetailReadLifecycle } from './AdminItemDetailReadLifecycle';

/** FutureBuilder retains the previous actual image while the replacement future waits, then clears it on error. */
export class AdminItemDetailComboReadSnapshot {
  private previous: AdminItemDetailComboState | null = null; private image: AdminItemDetailCombo | null = null;
  private value: (AdminItemDetailComboState & Readonly<{ imageEntry: AdminItemDetailCombo | null }>) | null = null;
  constructor(private readonly controller: AdminItemDetailComboController) {}
  getSnapshot = () => {
    const state = this.controller.getSnapshot();
    if (state !== this.previous) {
      if (state.phase !== 'loading') this.image = state.entry;
      this.previous = state; this.value = Object.freeze({ ...state, imageEntry: this.image });
    }
    return this.value!;
  };
  subscribe = (listener: () => void) => this.controller.subscribe(() => { this.getSnapshot(); listener(); });
}

export function useAdminItemDetailComboRead(context: AdminItemDetailReadContext, itemCode: string) {
  const { session, witness, isCurrent, canInteract } = context;
  const owner = useMemo(() => createAdminItemDetailComboSession(session, witness, isCurrent, itemCode), [session, witness, isCurrent, itemCode]);
  const controller = owner.controller, lifecycle = useMemo(() => new AdminItemDetailReadLifecycle(owner), [owner]), projection = useMemo(() => new AdminItemDetailComboReadSnapshot(controller), [controller]), state = useSyncExternalStore(projection.subscribe, projection.getSnapshot, projection.getSnapshot);
  useLayoutEffect(() => lifecycle.attach(() => controller.start(), () => controller.dispose()), [controller, lifecycle]);
  const generation = controller.interactionGeneration;
  const current = useCallback(() => isCurrent() && owner.current() && controller.isCurrent(generation), [isCurrent, owner, controller, generation]);
  const retry = useCallback(() => { if (lifecycle.current() && canInteract() && current()) void controller.reload(); }, [lifecycle, canInteract, current, controller]);
  return { owner, state, current, retry };
}
export type AdminItemDetailComboReadModel = ReturnType<typeof useAdminItemDetailComboRead>;

/** Actual mounted rows own the real optional name GET. No off-screen/static-name stand-in is created. */
export function useAdminItemDetailComboProductName(model: AdminItemDetailComboReadModel, product: AdminItemDetailComboProduct) {
  const { owner: comboOwner, current, state: { entry } } = model;
  const lifecycle = useMemo(() => new AdminItemDetailReadLifecycle({ comboOwner, entry, product }), [comboOwner, entry, product]);
  const owner = useMemo(() => comboOwner.productName(product, () => lifecycle.current() && current()), [comboOwner, product, lifecycle, current]);
  const state = useSyncExternalStore(owner?.subscribe ?? emptySubscribe, owner?.getSnapshot ?? emptySnapshot, owner?.getSnapshot ?? emptySnapshot);
  useLayoutEffect(() => {
    if (!owner) return; return lifecycle.attach(() => owner.start(), () => owner.dispose());
  }, [owner, lifecycle]);
  return state;
}
const emptySubscribe = () => () => {}, emptySnapshot = () => null;
