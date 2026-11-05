import { useSyncExternalStore } from 'react';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const snapshot = () => localeController.locale;

export function useBaseLocale() {
  const locale = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { locale, text: (key: string) => localizedGetter(key, locale) };
}
