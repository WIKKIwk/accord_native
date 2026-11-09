import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { registerSessionResetHook, subscribeSessionWitness } from '../auth';
import { appPreferences } from '../appPreferences';
import { SearchActivityStore } from '../shared/searchActivityStore';
import { gscaleItemsPage } from '../shared/catalogApi';
import { uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { rezkaSource, rezkaSplit, rezkaSplitClientPrintConfirm, rezkaSplitClientPrintPrepare } from './rezkaSplitApi';
import { guardedRezkaRequest, isRezkaSessionCurrent, type RezkaSessionSnapshot } from './rezkaSessionGuard';
import { RezkaItemPickerController } from './rezkaItemPickerController';
import { RezkaSplitController } from './rezkaSplitController';
import type { RezkaScannerAction } from './rezkaScannerOwner';
import type { RezkaPrinterBridge } from './rezkaSplitScreenTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function useRezkaText() {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return useCallback((text: string) => uiText(text, locale), [locale]);
}

const unavailablePrinter = Object.freeze({ title: '', subtitle: '', excluded: false });
/** The route captures once; nested views must not obtain a fresh witness for a stale session. */
export function useRezkaPrintUnavailableText() {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale).toLowerCase().split(/[-_]/, 1)[0];
  return ({ uz: 'Chop qilish hozircha mavjud emas. Printer ulanishi tasdiqlanmaguncha bo‘lish amalga oshirilmaydi.',
    en: 'Printing is not available yet. Splitting is disabled until the printer connection is verified.',
    ru: 'Печать пока недоступна. Разделение отключено до проверки подключения принтера.',
    ur: 'پرنٹنگ ابھی دستیاب نہیں۔ پرنٹر کا کنکشن تصدیق ہونے تک تقسیم بند ہے۔' } as Record<string, string>)[locale]
    ?? 'Printing is not available yet. Splitting is disabled until the printer connection is verified.';
}

export function useRezkaSplit(snapshot: RezkaSessionSnapshot, printer: RezkaPrinterBridge | null) {
  const session = snapshot.session;
  const controller = useMemo(() => new RezkaSplitController({
    isCurrent: () => isRezkaSessionCurrent(snapshot, 'split'), canSubmit: () => printer !== null,
    loadSource: barcode => rezkaSource(session, barcode, snapshot),
    resolvePrinter: state => printer ? printer.resolve(state) : Promise.resolve(null), split: request => rezkaSplit(session, request, snapshot),
    prepare: request => rezkaSplitClientPrintPrepare(session, request, snapshot),
    print: (output, target) => printer ? printer.print(output, target) : Promise.reject(new Error('Printer unavailable')),
    confirm: request => rezkaSplitClientPrintConfirm(session, request, snapshot),
  }), [session, snapshot, printer]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const subscribePrinter = useCallback((listener: () => void) => printer ? printer.subscribe(listener) : () => {}, [printer]);
  const printerSnapshot = useCallback(() => printer ? printer.getSnapshot() : unavailablePrinter, [printer]);
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
    if (!printer || !isRezkaSessionCurrent(snapshot, 'split')) return;
    const selection = await printer.choose();
    if (!selection || !isRezkaSessionCurrent(snapshot, 'split')) return;
    controller.setPrinter({ transport: selection.transport, ...(selection.driverUrl ? { driverUrl: selection.driverUrl } : {}) });
  };
  const scan = async (scanner: RezkaScannerAction) => {
    if (!scanner.isCurrent() || !isRezkaSessionCurrent(snapshot, 'split')) return;
    const result = await scanner.open();
    if (result && result.isCurrent() && isRezkaSessionCurrent(snapshot, 'split')) await controller.scan(result.value);
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
