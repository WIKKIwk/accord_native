import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { localeController } from '../shared/localization/runtime';
import { themeController } from '../shared/themeRuntime';

const subscribe = (listener: () => void) => {
  const removeTheme = themeController.addListener(listener), removeLocale = localeController.addListener(listener);
  return () => { removeTheme(); removeLocale(); };
};
const snapshot = () => `${themeController.themeMode}:${localeController.locale}`;

const colors = {
  light: {
    primary: '#007AFF', onPrimary: '#FFFFFF', primaryContainer: '#E5E5EA', onPrimaryContainer: '#000000',
    secondary: '#6D6D72', onSecondary: '#FFFFFF', secondaryContainer: '#E5E5EA', onSecondaryContainer: '#000000',
    tertiary: '#6D6D72', onTertiary: '#FFFFFF', tertiaryContainer: '#E5E5EA', onTertiaryContainer: '#000000',
    surface: '#FFFFFF', onSurface: '#000000', onSurfaceVariant: '#6D6D72', surfaceDim: '#D1D1D6',
    surfaceBright: '#FFFFFF', surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#F2F2F7',
    surfaceContainer: '#F2F2F7', surfaceContainerHigh: '#E5E5EA', surfaceContainerHighest: '#E5E5EA',
    outline: '#8E8E93', outlineVariant: '#C6C6C8', surfaceTint: '#00000000',
  },
  dark: {
    primary: '#0A84FF', onPrimary: '#FFFFFF', primaryContainer: '#3A3A3C', onPrimaryContainer: '#FFFFFF',
    secondary: '#AEAEB2', onSecondary: '#000000', secondaryContainer: '#3A3A3C', onSecondaryContainer: '#FFFFFF',
    tertiary: '#AEAEB2', onTertiary: '#000000', tertiaryContainer: '#3A3A3C', onTertiaryContainer: '#FFFFFF',
    surface: '#000000', onSurface: '#FFFFFF', onSurfaceVariant: '#AEAEB2', surfaceDim: '#000000',
    surfaceBright: '#3A3A3C', surfaceContainerLowest: '#000000', surfaceContainerLow: '#000000',
    surfaceContainer: '#1C1C1E', surfaceContainerHigh: '#2C2C2E', surfaceContainerHighest: '#3A3A3C',
    outline: '#8E8E93', outlineVariant: '#48484A', surfaceTint: '#00000000',
  },
};

export function useBaseTheme() {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const system = useColorScheme();
  const mode = themeController.themeMode === 'system' ? (system === 'dark' ? 'dark' : 'light') : themeController.themeMode;
  const palette: Record<string, string> = colors[mode];
  return { mode, seed: palette.primary, colors: palette, direction: localeController.isUrdu ? 'rightToLeft' as const : 'leftToRight' as const };
}
