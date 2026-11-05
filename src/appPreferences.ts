import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';
import type { AccountStorage } from './savedAccountStore';

const memory = new Map<string, string>();
const webPreferences: AccountStorage = {
  async getItem(key) {
    return typeof localStorage === 'undefined' ? memory.get(key) ?? null : localStorage.getItem(key);
  },
  async setItem(key, value) {
    if (typeof localStorage === 'undefined') memory.set(key, value); else localStorage.setItem(key, value);
  },
  async removeItem(key) {
    if (typeof localStorage === 'undefined') memory.delete(key); else localStorage.removeItem(key);
  },
};

export const appPreferences: AccountStorage = Platform.OS === 'web' ? webPreferences : Storage;
