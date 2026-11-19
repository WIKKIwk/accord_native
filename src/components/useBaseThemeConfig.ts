import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { localeController } from '../shared/localization/runtime';
import { themeController } from '../shared/themeRuntime';

const subscribe = (listener: () => void) => {
  const removeTheme = themeController.addListener(listener), removeLocale = localeController.addListener(listener);
  return () => { removeTheme(); removeLocale(); };
};
const snapshot = () => `${themeController.themeMode}:${localeController.locale}`;

export function useBaseThemeConfig() {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const system = useColorScheme();
  const mode = themeController.themeMode === 'system' ? (system === 'dark' ? 'dark' : 'light') : themeController.themeMode;
  return { mode, direction: localeController.isUrdu ? 'rightToLeft' as const : 'leftToRight' as const };
}
