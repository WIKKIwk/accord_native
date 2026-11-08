import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { usePreparationNotice } from '../preparation/usePreparationNotice';
import { createDispatch, supplierItems } from './supplierApi';
import { SupplierConfirmController, SupplierPickerController } from './supplierCreateController';
import type { SupplierConfirmProps, SupplierPickerProps } from './supplierCreateTypes';

const notReady = async () => { throw new Error('Supplier confirmation callback is not ready'); };

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
  const controller = useMemo(() => new SupplierConfirmController(props.session, props.item, props.qty, {
    create: createDispatch, recordCreatedPending: () => props.store.recordCreatedPending(),
  }, { onSuccess: notReady, onFailure: () => { throw new Error('Supplier confirmation callback is not ready'); } }),
  [props.session, props.item, props.qty, props.store]);
  const submitting = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.setCallbacks({ onSuccess: props.onSuccess, onFailure: notice.show }); },
    [controller, props.onSuccess, notice.show]);
  useEffect(() => { controller.start(); return () => controller.stop(); }, [controller]);
  return { controller, submitting, notice: notice.message };
}
