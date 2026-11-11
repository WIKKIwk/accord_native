import { useMemo, useSyncExternalStore } from 'react';
import { localeController } from '../shared/localization/runtime';
import { workerOrderProductionText, workerOrderText } from '../workerOrderText';
const subscribe = (listener: () => void) => localeController.addListener(listener);
const snapshot = () => localeController.locale;
export function useWorkerOrderText() {
  const locale = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(() => ({ locale, t: (source: string) => workerOrderText(source, locale),
    p: (key: string, values?: Record<string, unknown>) => workerOrderProductionText(key, locale, values) }), [locale]);
}
