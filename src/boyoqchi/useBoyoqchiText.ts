import { useCallback, useSyncExternalStore } from 'react';
import { localizedGetter, uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
const subscribe = (listener: () => void) => localeController.addListener(listener);
const getLocale = () => localeController.locale;
export function useBoyoqchiText() {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return useCallback((value: string) => uiText(value, locale), [locale]);
}
export function useBoyoqchiGetter() {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return useCallback((key: string) => localizedGetter(key, locale), [locale]);
}
