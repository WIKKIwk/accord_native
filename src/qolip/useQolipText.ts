import { useSyncExternalStore } from 'react';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function useQolipText() {
  const locale = useSyncExternalStore(subscribe, currentLocale, currentLocale);
  return { locale, text: (key: string, values: Record<string, unknown> = {}) => productionText(`qolip.${key}`, locale, values) };
}
