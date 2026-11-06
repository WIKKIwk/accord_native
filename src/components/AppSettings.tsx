import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Appearance, Platform } from 'react-native';
import type { AppearancePreference } from '../appAppearance';
import { initializeBasePreferences } from '../shared/basePreferences';
import { themeController } from '../shared/themeRuntime';

type Settings = { appearance: AppearancePreference; setAppearance: (value: AppearancePreference) => Promise<void> };
const SettingsContext = createContext<Settings | null>(null);
const subscribe = (listener: () => void) => themeController.addListener(listener);
const snapshot = () => themeController.themeMode;

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const appearance = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => { void initializeBasePreferences().catch(() => {}); }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') Appearance.setColorScheme(appearance === 'system' ? 'auto' : appearance);
  }, [appearance]);
  const setAppearance = useCallback((value: AppearancePreference) => themeController.setThemeMode(value), []);
  return <SettingsContext.Provider value={{ appearance, setAppearance }}>{children}</SettingsContext.Provider>;
}

export function useAppSettings(): Settings {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('App settings are unavailable.');
  return context;
}
