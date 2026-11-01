import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type AppearancePreference = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'accord_v4_appearance';
let pending: Promise<void> = Promise.resolve();

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export async function loadAppearancePreference(): Promise<AppearancePreference> {
  await pending;
  try {
    const saved = Platform.OS === 'web' ? globalThis.localStorage?.getItem(STORAGE_KEY) : await SecureStore.getItemAsync(STORAGE_KEY);
    return isAppearancePreference(saved) ? saved : 'system';
  } catch { return 'system'; }
}

export function saveAppearancePreference(value: AppearancePreference): Promise<void> {
  const save = pending.then(async () => {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(STORAGE_KEY, value);
    else await SecureStore.setItemAsync(STORAGE_KEY, value);
  });
  pending = save.catch(() => {});
  return save;
}
