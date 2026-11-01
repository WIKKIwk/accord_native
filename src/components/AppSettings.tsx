import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Appearance, Platform } from 'react-native';
import { loadAppearancePreference, saveAppearancePreference, type AppearancePreference } from '../appAppearance';

type Settings = { appearance: AppearancePreference; setAppearance: (value: AppearancePreference) => Promise<void> };
const SettingsContext = createContext<Settings | null>(null);

function applyAppearance(value: AppearancePreference) {
  if (Platform.OS !== 'web') Appearance.setColorScheme(value === 'system' ? 'auto' : value);
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [appearance, setCurrentAppearance] = useState<AppearancePreference>('system');
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const current = revision.current;
    void loadAppearancePreference().then(value => {
      if (!active || current !== revision.current) return;
      setCurrentAppearance(value);
      applyAppearance(value);
    });
    return () => { active = false; applyAppearance('system'); };
  }, []);

  const setAppearance = useCallback(async (value: AppearancePreference) => {
    revision.current++;
    setCurrentAppearance(value);
    applyAppearance(value);
    await saveAppearancePreference(value);
  }, []);

  return <SettingsContext.Provider value={{ appearance, setAppearance }}>{children}</SettingsContext.Provider>;
}

export function useAppSettings(): Settings {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('App settings are unavailable.');
  return context;
}
