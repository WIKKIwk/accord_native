import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminCustomerMaterialWarehouseProps } from './AdminCustomerDetailScreenTypes';
import { adminCustomerMaterialWarehouseSession } from './adminCustomerMaterialWarehouseSession';
import { adminWorkerDetailDialogText } from './adminWorkerDetailPresentation';
import type { AdminWorkerDetailEditorFacade, AdminWorkerDetailOverlay } from './useAdminWorkerDetail';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
type Decision = { id: number; generation: number; confirmed: boolean; sent: boolean; owner: object };
type PickerClose = { id: number; generation: number; owner: object; confirmed: boolean; selected: string | null; consumed: boolean };
export function useAdminCustomerMaterialWarehouse(props: AdminCustomerMaterialWarehouseProps) {
  const latest = useRef(props), mounted = useRef(false), pending = useRef<Decision | null>(null), pickerClose = useRef<PickerClose | null>(null), [decision, setDecision] = useState<Decision | null>(null);
  const { session, witness, isCurrent, principalRef } = props;
  // The factory only retains this accessor; mounted callbacks consume the latest committed source widget props.
  // eslint-disable-next-line react-hooks/refs
  const owner = useMemo(() => adminCustomerMaterialWarehouseSession({ session, witness, isCurrent, principalRef }, () => latest.current), [session, witness, isCurrent, principalRef]);
  const { controller } = owner, state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useLayoutEffect(() => { latest.current = props; }, [props]);
  useLayoutEffect(() => { mounted.current = true; controller.start(); return () => { mounted.current = false; pending.current = null; pickerClose.current = null; controller.dispose(); }; }, [controller]);
  useEffect(() => { const retire = () => { if (!owner.current()) controller.invalidate(); }; const unsubscribe = subscribeSessionWitness(retire); retire(); return unsubscribe; }, [owner, controller]);
  const generation = controller.interactionGeneration, current = useCallback(() => mounted.current && owner.current() && generation === controller.interactionGeneration && controller.isCurrent(), [owner, controller, generation]);
  const interactive = () => current() && isSynchronouslyTrue(latest.current.isInteractive) && pending.current === null && pickerClose.current === null;
  const top = () => Math.max(controller.getSnapshot().dialog?.id ?? -1, controller.getSnapshot().picker?.id ?? -1);
  const overlayCurrent = (id: number) => interactive() && top() === id;
  useEffect(() => { const original = pending.current; if (!original || original.sent) return; original.sent = true;
    if (!current() || original.owner !== controller || original.generation !== controller.interactionGeneration || controller.getSnapshot().dialog?.id !== original.id) return;
    pending.current = null;
    if (original.confirmed) void controller.confirmRemove(original.id); else controller.dismissDialog(original.id);
    setDecision(null);
  }, [current, controller, decision]);
  const decide = (id: number, confirmed: boolean) => { if (!overlayCurrent(id) || controller.getSnapshot().dialog?.id !== id) return;
    pending.current = { id, confirmed, generation, owner: controller, sent: false }; setDecision({ id, confirmed, generation, owner: controller, sent: false });
  };
  const prepareWarehousePickerClose = (id: number, confirmed: boolean): (() => void) | null => {
    if (!overlayCurrent(id)) return null; const picker = controller.getSnapshot().picker;
    if (picker?.id !== id || picker.kind !== 'warehouse' || (confirmed && picker.selected === null)) return null;
    const original: PickerClose = { id, confirmed, generation, owner: controller, selected: picker.selected, consumed: false }; pickerClose.current = original;
    return () => {
      if (original.consumed || pickerClose.current !== original) return; original.consumed = true;
      if (!current() || original.owner !== controller || original.generation !== controller.interactionGeneration) return;
      const latest = controller.getSnapshot().picker; pickerClose.current = null;
      if (latest?.id !== id || latest.kind !== 'warehouse') return;
      if (latest.selected !== original.selected) { controller.dismissPicker(id); return; }
      if (confirmed) void controller.confirmWarehouse(id); else controller.dismissPicker(id);
    };
  };
  const a = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values);
  const facade: AdminWorkerDetailEditorFacade = { state, identity: controller, generation, canInteract: interactive, canInteractOverlay: overlayCurrent,
    warehouses: controller.visibleWarehouses(), materials: controller.visibleMaterials(), dialogText: state.dialog ? adminWorkerDetailDialogText(state.dialog, locale) : null,
    add: () => { if (interactive() && top() < 0) { owner.beginAdd(); void controller.add(); } },
    removeWarehouse: name => { if (interactive() && top() < 0) { owner.beginRemove(); controller.requestRemove(name); } },
    removeMaterial: item => { if (interactive() && top() < 0) controller.requestRemove(item); },
    selectMaterial: (id, item) => { if (overlayCurrent(id)) void controller.selectMaterial(id, item); },
    materialScroll: (id, extentAfter) => { if (overlayCurrent(id)) controller.materialScroll(id, extentAfter); }, retryMaterial: id => { if (overlayCurrent(id)) controller.retryMaterial(id); },
    search: (id, value) => { if (overlayCurrent(id)) controller.search(id, value); }, selectWarehouse: (id, name) => { if (overlayCurrent(id)) controller.selectWarehouse(id, name); },
    confirmWarehouse: id => { if (overlayCurrent(id)) void controller.confirmWarehouse(id); }, dismissPicker: id => { if (current() && pickerClose.current === null && top() === id) controller.dismissPicker(id); },
    confirmRemove: id => decide(id, true), dismissDialog: id => decide(id, false),
  };
  const hidden = decision?.owner === controller && decision.generation === generation ? decision.id : null;
  const pickerOverlay: AdminWorkerDetailOverlay | null = state.picker && state.picker.id !== hidden ? { id: state.picker.id, type: 'picker', editor: facade } : null;
  const dialogOverlay: AdminWorkerDetailOverlay | null = state.dialog && state.dialog.id !== hidden ? { id: state.dialog.id, type: 'dialog', editor: facade } : null;
  const pickerId = state.picker && state.picker.id !== hidden ? state.picker.id : null, dialogId = state.dialog && state.dialog.id !== hidden ? state.dialog.id : null;
  const overlays = pickerId !== null && dialogId !== null ? pickerId < dialogId ? [pickerOverlay!, dialogOverlay!] : [dialogOverlay!, pickerOverlay!] : pickerId !== null ? [pickerOverlay!] : dialogId !== null ? [dialogOverlay!] : [];
  return { state, current, interactive, generation, a, t: (key: string) => localizedGetter(key, locale), overlays, editor: facade, props, prepareWarehousePickerClose };
}
export type AdminCustomerMaterialWarehouseModel = ReturnType<typeof useAdminCustomerMaterialWarehouse>;
