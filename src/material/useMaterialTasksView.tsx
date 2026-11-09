import { useEffect, useRef, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { registerSessionResetHook } from '../auth';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useNativeSheet } from '../nativeSheet';
import type { SupplyTasksController } from '../shared/supplyTasks/SupplyTasksController';
import type { SupplyTaskRow, SupplyTaskWindow } from '../shared/supplyTasks/supplyTaskModels';

export type MaterialTaskHandlers = {
  /** Both handlers must hydrate and reauthorize the full order; compact rows are presentation-only. */
  openDetail?: (row: SupplyTaskRow, isCurrent: () => boolean) => void | Promise<void>;
  receive?: (row: SupplyTaskRow, isCurrent: () => boolean) => void | Promise<void>;
};

/** UI uses an injected controller; it installs no transport, session event or route by itself. */
export function useMaterialTasksView(controller: SupplyTasksController, handlers?: MaterialTaskHandlers) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const sheet = useNativeSheet(), busy = useRef(false);
  useEffect(() => registerSessionResetHook(async () => { controller.invalidate(); sheet.close(); }), [controller, sheet]);
  const valid = (window: SupplyTaskWindow, row: SupplyTaskRow) => {
    if (controller.getSnapshot().window !== window || !window.rows.includes(row) || !controller.canInteract()) return false;
    return controller.getSnapshot().window === window && window.rows.includes(row);
  };
  const openDetail = (window: SupplyTaskWindow, row: SupplyTaskRow) => {
    if (busy.current || !handlers?.openDetail || !valid(window, row)) return;
    busy.current = true;
    try {
      const result = handlers.openDetail(row, () => valid(window, row));
      if (result && typeof result.then === 'function') void Promise.resolve(result).finally(() => { busy.current = false; }).catch(() => {});
      else busy.current = false;
    } catch (error) { busy.current = false; throw error; }
  };
  const openReceive = (window: SupplyTaskWindow, row: SupplyTaskRow) => {
    if (busy.current || sheet.isOpen() || !handlers?.receive || !valid(window, row)) return;
    const receive = handlers.receive;
    busy.current = true;
    let selected = false, delivered = false;
    try {
      sheet.open(<View style={{ padding: 16 }}><WorkerSheetButton label="Kirim qilish" variant="text"
        icon={{ ios: 'scalemass', android: 'scale' }} onPress={() => {
          if (selected || !valid(window, row)) return;
          selected = true; sheet.close();
        }} /></View>, { dismissible: true, onDismiss: () => {
          if (delivered) return;
          delivered = true;
          if (!selected || !valid(window, row)) { busy.current = false; return; }
          try {
            const result = receive(row, () => valid(window, row));
            if (result && typeof result.then === 'function') void Promise.resolve(result).finally(() => { busy.current = false; }).catch(() => {});
            else busy.current = false;
          } catch (error) { busy.current = false; throw error; }
        } });
    } catch (error) { busy.current = false; throw error; }
  };
  return { state, openDetail: handlers?.openDetail ? openDetail : null, openReceive: handlers?.receive ? openReceive : null };
}
