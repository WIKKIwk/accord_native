import { useCallback, useMemo } from 'react';
import type { AdminMenuAction } from './adminCreateMenuController';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

export function useAdminItemCreatePrimaryAction(model: AdminItemCreateScreenModel) {
  const { owner, current, nativeCurrent, a } = model;
  const actions = useMemo<readonly AdminMenuAction[]>(() => Object.freeze([{ id: 'admin-item-create-add', label: a('item.add_title'), icon: { android: 'inventory_2', ios: 'shippingbox' },
    // Root Hub already accepted the action. Like Source, the mounted screen may
    // open its root dialog after the opening page loses focus.
    onPress: () => { if (current()) owner.controller.openDialog(); } }]), [owner, current, a]);
  const canInteract = useCallback(() => { if (!nativeCurrent()) return false; const state = owner.controller.getSnapshot(); return !state.picker && !state.closingDialog && !state.form.dialog; }, [owner, nativeCurrent]);
  return { actions, canInteract };
}
