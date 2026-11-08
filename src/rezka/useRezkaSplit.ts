import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { registerSessionResetHook, subscribeSessionWitness, type Session } from '../auth';
import { appPreferences } from '../appPreferences';
import { SearchActivityStore } from '../shared/searchActivityStore';
import { gscaleItemsPage } from '../shared/catalogApi';
import { uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { rezkaSource, rezkaSplit, rezkaSplitClientPrintConfirm, rezkaSplitClientPrintPrepare } from './rezkaSplitApi';
import { captureRezkaSession, guardedRezkaRequest, isRezkaSessionCurrent, type RezkaSessionSnapshot } from './rezkaSessionGuard';
import { RezkaItemPickerController } from './rezkaItemPickerController';
import { RezkaSplitController } from './rezkaSplitController';
import type { RezkaPrinterBridge } from './rezkaSplitScreenTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function useRezkaText() {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return useCallback((text: string) => uiText(text, locale), [locale]);
}

export function useRezkaSplit(session: Session, printer: RezkaPrinterBridge) {
  const snapshot = useMemo(() => captureRezkaSession(session), [session]);
  const controller = useMemo(() => new RezkaSplitController({
    isCurrent: () => isRezkaSessionCurrent(snapshot, 'split'), loadSource: barcode => rezkaSource(session, barcode, snapshot),
    resolvePrinter: state => printer.resolve(state), split: request => rezkaSplit(session, request, snapshot),
    prepare: request => rezkaSplitClientPrintPrepare(session, request, snapshot), print: (output, target) => printer.print(output, target),
    confirm: request => rezkaSplitClientPrintConfirm(session, request, snapshot),
  }), [session, snapshot, printer]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const subscribePrinter = useCallback((listener: () => void) => printer.subscribe(listener), [printer]);
  const printerSnapshot = useCallback(() => printer.getSnapshot(), [printer]);
  const device = useSyncExternalStore(subscribePrinter, printerSnapshot, printerSnapshot);
  const leases = useRef(new Map<RezkaSplitController, number>());
  useEffect(() => {
    const owners = leases.current;
    controller.resume(); owners.set(controller, (owners.get(controller) ?? 0) + 1);
    const unregister = registerSessionResetHook(async () => controller.invalidate());
    const unwatch = subscribeSessionWitness(() => { if (!isRezkaSessionCurrent(snapshot, 'split')) controller.invalidate(); });
    if (!isRezkaSessionCurrent(snapshot, 'split')) controller.invalidate();
    return () => {
      controller.suspend(); unregister(); unwatch(); owners.set(controller, (owners.get(controller) ?? 1) - 1);
      queueMicrotask(() => { if (owners.get(controller) === 0) { owners.delete(controller); controller.dispose(); } });
    };
  }, [controller, snapshot]);
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => controller.clearNotice(), 4000);
    return () => clearTimeout(timer);
  }, [controller, state.notice]);
  const choosePrinter = async () => {
    if (!isRezkaSessionCurrent(snapshot, 'split')) return;
    const selection = await printer.choose();
    if (!selection || !isRezkaSessionCurrent(snapshot, 'split')) return;
    controller.setPrinter({ transport: selection.transport, ...(selection.driverUrl ? { driverUrl: selection.driverUrl } : {}) });
  };
  const scan = async (scanAction: () => Promise<string | null>) => {
    if (!isRezkaSessionCurrent(snapshot, 'split')) return;
    const value = await scanAction();
    if (value && isRezkaSessionCurrent(snapshot, 'split')) await controller.scan(value);
  };
  return { controller, state, device, snapshot, choosePrinter, scan, isCurrent: () => isRezkaSessionCurrent(snapshot, 'split') };
}

export function useRezkaItemPicker(snapshot: RezkaSessionSnapshot) {
  // A picker has its own account-scoped reader; stale async loads cannot mutate the shared singleton.
  const pickerScope = useMemo(() => ({ snapshot, activity: new SearchActivityStore(appPreferences) }), [snapshot]);
  const controller = useMemo(() => new RezkaItemPickerController({ isCurrent: () => isRezkaSessionCurrent(pickerScope.snapshot, 'split'),
    load: (query, limit) => guardedRezkaRequest(pickerScope.snapshot.session, 'split', pickerScope.snapshot, false,
      beforeSend => gscaleItemsPage(pickerScope.snapshot.session, { query, limit }, beforeSend, pickerScope.activity)) }), [pickerScope]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const leases = useRef(new Map<RezkaItemPickerController, number>());
  useEffect(() => {
    const owners = leases.current;
    controller.resume(); owners.set(controller, (owners.get(controller) ?? 0) + 1);
    const unregister = registerSessionResetHook(async () => controller.invalidate());
    const unwatch = subscribeSessionWitness(() => { if (!isRezkaSessionCurrent(snapshot, 'split')) controller.invalidate(); });
    if (isRezkaSessionCurrent(snapshot, 'split')) controller.start(); else controller.invalidate();
    return () => {
      controller.suspend(); unregister(); unwatch(); owners.set(controller, (owners.get(controller) ?? 1) - 1);
      queueMicrotask(() => { if (owners.get(controller) === 0) { owners.delete(controller); controller.dispose(); } });
    };
  }, [controller, snapshot]);
  return { controller, state };
}
