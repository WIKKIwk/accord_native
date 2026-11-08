import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { usePreparationNotice } from '../preparation/usePreparationNotice';
import { createDispatch, supplierItems } from './supplierApi';
import { SupplierConfirmController, SupplierPickerController, type SupplierConfirmCallbacks } from './supplierCreateController';
import type { SupplierConfirmProps, SupplierPickerProps } from './supplierCreateTypes';

export function useSupplierPicker(props: SupplierPickerProps) {
  const controller = useMemo(() => new SupplierPickerController(props.session, supplierItems), [props.session]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.start();
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') void controller.reload(); });
    return () => { subscription.remove(); controller.stop(); };
  }, [controller]);
  return { controller, state, items: controller.visibleItems };
}

export function useSupplierConfirm(props: SupplierConfirmProps) {
  const notice = usePreparationNotice();
  const [callbacks] = useState(() => {
    let current: SupplierConfirmCallbacks = { onSuccess: props.onSuccess, onFailure: notice.show };
    return { set: (next: SupplierConfirmCallbacks) => { current = next; },
      onSuccess: (record: Parameters<SupplierConfirmCallbacks['onSuccess']>[0]) => current.onSuccess(record),
      onFailure: (message: string) => current.onFailure(message) };
  });
  const controller = useMemo(() => new SupplierConfirmController(props.session, props.item, props.qty, {
    create: createDispatch, recordCreatedPending: () => props.store.recordCreatedPending(),
  }, callbacks), [props.session, props.item, props.qty, props.store, callbacks]);
  const submitting = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { callbacks.set({ onSuccess: props.onSuccess, onFailure: notice.show }); }, [callbacks, props.onSuccess, notice.show]);
  useEffect(() => { controller.start(); return () => controller.stop(); }, [controller]);
  return { controller, submitting, notice: notice.message };
}
