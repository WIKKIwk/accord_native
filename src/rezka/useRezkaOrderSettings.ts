import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { registerSessionResetHook, subscribeSessionWitness } from '../auth';
import { adminText, localizedGetter, productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { rezkaMasterSaveOrderSettings } from './rezkaMasterApi';
import { rezkaMasterSavePrintSideGuarded } from './rezkaPrintSide';
import { isRezkaSessionCurrent } from './rezkaSessionGuard';
import { RezkaOrderSettingsController, rezkaOrderWriteLocks, type RezkaOrderConfirmation, type RezkaOrderError } from './rezkaOrderSettingsController';
import type { RezkaOrderQuickSettingsProps } from './rezkaOrderQuickSettingsTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function useRezkaOrderText() {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const admin = (key: string, values: Record<string, string> = {}) => adminText(key, locale, values);
  const production = (key: string, values: Record<string, string> = {}) => productionText(key, locale, values);
  const title = () => localizedGetter('confirmTitle', locale);
  const confirmation = (pending: RezkaOrderConfirmation) => pending.option === 'printSide'
    ? production('order.print_side.confirm', { side: production(pending.enabled ? 'order.print_side.standard' : 'order.print_side.nonstandard') })
    : admin(pending.enabled ? 'rezka_master.confirm_enable' : 'rezka_master.confirm_disable', { setting: admin(pending.option === 'duplicateLabels'
      ? 'calculate.duplicate_rezka_labels' : 'calculate.include_bobina_in_net') });
  const error = (value: RezkaOrderError | null) => {
    if (!value) return '';
    if (value.kind === 'admin') return admin(value.key);
    if (value.kind === 'production') return production(value.key);
    if (value.kind === 'raw') return value.key;
    const code = locale.toLowerCase().split(/[-_]/, 1)[0];
    return ({ uz: 'Sozlama saqlangan bo‘lishi mumkin. Buyurtmani tekshiring.', en: 'The setting may have been saved. Check the order.',
      ru: 'Настройка могла сохраниться. Проверьте заказ.', ur: 'ترتیب محفوظ ہو سکتی ہے۔ آرڈر چیک کریں۔' } as Record<string, string>)[code] ??
      'The setting may have been saved. Check the order.';
  };
  return { admin, production, title, confirmation, error };
}

/** The sheet host passes its original snapshot; never recapture after a login transition. */
export function useRezkaOrderSettings({ snapshot, map, onSaved }: RezkaOrderQuickSettingsProps, showWorkOptions: boolean) {
  const session = snapshot.session;
  const controller = useMemo(() => new RezkaOrderSettingsController({ duplicateLabels: map.duplicate_rezka_labels === true,
    includeBobina: map.include_bobina_in_net === true, standardPrintSide: map.standard_print_side !== false }, showWorkOptions, {
    isCurrent: () => isRezkaSessionCurrent(snapshot, 'master'),
    savePrintSide: (standard, previous) => rezkaMasterSavePrintSideGuarded(session, map.id, standard, previous, snapshot),
    saveOptions: (next, previous) => rezkaMasterSaveOrderSettings(session, map.id, next.duplicateLabels, next.includeBobina,
      previous.duplicateLabels, previous.includeBobina, snapshot),
    onSaved, locks: rezkaOrderWriteLocks,
    lockKey: JSON.stringify([session.baseUrl, session.profile.role, session.profile.ref, map.id]),
  }), [snapshot, session, map, showWorkOptions, onSaved]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const owners = useRef(new Map<RezkaOrderSettingsController, number>());
  useEffect(() => {
    const leases = owners.current;
    controller.resume(); leases.set(controller, (leases.get(controller) ?? 0) + 1);
    const unregister = registerSessionResetHook(async () => controller.invalidate());
    const unwatch = subscribeSessionWitness(() => { if (!isRezkaSessionCurrent(snapshot, 'master')) controller.invalidate(); });
    if (!isRezkaSessionCurrent(snapshot, 'master')) controller.invalidate();
    return () => {
      controller.suspend(); unregister(); unwatch(); leases.set(controller, (leases.get(controller) ?? 1) - 1);
      queueMicrotask(() => { if (leases.get(controller) === 0) { leases.delete(controller); controller.dispose(); } });
    };
  }, [controller, snapshot]);
  return { controller, state };
}
