import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { gscaleItemsPage } from '../shared/catalogApi';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { rezkaSource, rezkaSplit, rezkaSplitClientPrintConfirm, rezkaSplitClientPrintPrepare } from './rezkaSplitApi';
import { currentRezkaScope } from './rezkaSessionGuard';
import { RezkaItemPickerController } from './rezkaItemPickerController';
import { RezkaSplitController } from './rezkaSplitController';
import type { RezkaPrinterBridge } from './rezkaSplitScreenTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function useRezkaText() {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return useCallback((text: string) => uiText(text, locale), [locale]);
}
function valid(session: Session, scope: string): boolean {
  return !!activeSessionToken(session) && currentRezkaScope(session) === scope && canOpenRoute(session, appRoutes.rezkaSplit);
}

export function useRezkaSplit(session: Session, printer: RezkaPrinterBridge) {
  const scope = currentRezkaScope(session);
  const controller = useMemo(() => new RezkaSplitController({
    isCurrent: () => valid(session, scope), loadSource: barcode => rezkaSource(session, barcode, scope),
    resolvePrinter: state => printer.resolve(state), split: request => rezkaSplit(session, request, scope),
    prepare: request => rezkaSplitClientPrintPrepare(session, request, scope), print: (output, target) => printer.print(output, target),
    confirm: request => rezkaSplitClientPrintConfirm(session, request, scope),
  }), [session, scope, printer]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const subscribePrinter = useCallback((listener: () => void) => printer.subscribe(listener), [printer]);
  const printerSnapshot = useCallback(() => printer.getSnapshot(), [printer]);
  const device = useSyncExternalStore(subscribePrinter, printerSnapshot, printerSnapshot);
  const leases = useRef(new Map<RezkaSplitController, number>());
  useEffect(() => {
    const owners = leases.current;
    owners.set(controller, (owners.get(controller) ?? 0) + 1);
    const unregister = registerSessionResetHook(async () => controller.invalidate());
    return () => {
      unregister(); owners.set(controller, (owners.get(controller) ?? 1) - 1);
      queueMicrotask(() => { if (owners.get(controller) === 0) { owners.delete(controller); controller.dispose(); } });
    };
  }, [controller]);
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => controller.clearNotice(), 4000);
    return () => clearTimeout(timer);
  }, [controller, state.notice]);
  const choosePrinter = async () => {
    if (!valid(session, scope)) return;
    const selection = await printer.choose();
    if (!selection || !valid(session, scope)) return;
    controller.setPrinter({ transport: selection.transport, ...(selection.driverUrl ? { driverUrl: selection.driverUrl } : {}) });
  };
  const scan = async (scanAction: () => Promise<string | null>) => {
    if (!valid(session, scope)) return;
    const value = await scanAction();
    if (value && valid(session, scope)) await controller.scan(value);
  };
  return { controller, state, device, scope, choosePrinter, scan, isCurrent: () => valid(session, scope) };
}

export function useRezkaItemPicker(session: Session, scope: string) {
  const controller = useMemo(() => new RezkaItemPickerController({ isCurrent: () => valid(session, scope),
    load: (query, limit) => gscaleItemsPage(session, { query, limit }) }), [session, scope]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const leases = useRef(new Map<RezkaItemPickerController, number>());
  useEffect(() => {
    const owners = leases.current;
    owners.set(controller, (owners.get(controller) ?? 0) + 1);
    const unregister = registerSessionResetHook(async () => controller.invalidate());
    controller.start();
    return () => {
      unregister(); owners.set(controller, (owners.get(controller) ?? 1) - 1);
      queueMicrotask(() => { if (owners.get(controller) === 0) { owners.delete(controller); controller.dispose(); } });
    };
  }, [controller]);
  return { controller, state };
}
