import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';
import { SavedAccountStore, type AccountStorage } from './savedAccountStore';

const memory = new Map<string, string>();
const webStorage: AccountStorage = {
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
const secureKey = (key: string) => key.replace(/:/g, '_');
const nativeSecrets: AccountStorage = {
  getItem: key => SecureStore.getItemAsync(secureKey(key)),
  setItem: (key, value) => SecureStore.setItemAsync(secureKey(key), value),
  removeItem: key => SecureStore.deleteItemAsync(secureKey(key)),
};
const webSecrets: AccountStorage = {
  getItem: key => webStorage.getItem(`saved_account_local_secret_v1:${key}`),
  setItem: (key, value) => webStorage.setItem(`saved_account_local_secret_v1:${key}`, value),
  removeItem: key => webStorage.removeItem(`saved_account_local_secret_v1:${key}`),
};

let initialization: Promise<SavedAccountStore> | null = null;

export function initializeSavedAccounts(baseUrl: string): Promise<SavedAccountStore> {
  if (initialization) return initialization;
  const preferences = Platform.OS === 'web' ? webStorage : Storage;
  const secrets = Platform.OS === 'web' ? webSecrets : nativeSecrets;
  const store = new SavedAccountStore(preferences, secrets,
    value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value));
  const pending = (async () => {
    await store.load();
    await store.migrateLegacySession(baseUrl);
    return store;
  })();
  initialization = pending;
  void pending.catch(() => { if (initialization === pending) initialization = null; });
  return pending;
}
