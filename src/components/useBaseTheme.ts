import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { localeController } from '../shared/localization/runtime';
import palettes from '../shared/themePalettes.json';
import { themeController } from '../shared/themeRuntime';

const subscribe = (listener: () => void) => {
  const removeTheme = themeController.addListener(listener), removeLocale = localeController.addListener(listener);
  return () => { removeTheme(); removeLocale(); };
};
const snapshot = () => `${themeController.themeMode}:${themeController.variant}:${localeController.locale}`;

export function useBaseTheme() {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const system = useColorScheme();
  const mode = themeController.themeMode === 'system' ? (system === 'dark' ? 'dark' : 'light') : themeController.themeMode;
  const palette = palettes[themeController.variant][mode];
  const colors: Record<string, string> = palette.colors;
  return { mode, seed: palette.seed, colors, direction: localeController.isUrdu ? 'rightToLeft' as const : 'leftToRight' as const };
}
