import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SavedAccountStore, type AccountStorage } from './savedAccountStore';
import { appPreferences } from './appPreferences';

const secureKey = (key: string) => key.replace(/:/g, '_');
const nativeSecrets: AccountStorage = {
  getItem: key => SecureStore.getItemAsync(secureKey(key)),
  setItem: (key, value) => SecureStore.setItemAsync(secureKey(key), value),
  removeItem: key => SecureStore.deleteItemAsync(secureKey(key)),
};
const webSecrets: AccountStorage = {
  getItem: key => appPreferences.getItem(`saved_account_local_secret_v1:${key}`),
  setItem: (key, value) => appPreferences.setItem(`saved_account_local_secret_v1:${key}`, value),
  removeItem: key => appPreferences.removeItem(`saved_account_local_secret_v1:${key}`),
};

let initialization: Promise<SavedAccountStore> | null = null;

export function initializeSavedAccounts(baseUrl: string): Promise<SavedAccountStore> {
  if (initialization) return initialization;
  const secrets = Platform.OS === 'web' ? webSecrets : nativeSecrets;
  const store = new SavedAccountStore(appPreferences, secrets,
    value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value));
  const pending = (async () => {
    await store.load();
    if (await store.migrateLegacySession(baseUrl)) {
      await appPreferences.removeItem('app_session_token');
      await appPreferences.removeItem('app_session_profile');
    }
    return store;
  })();
  initialization = pending;
  void pending.catch(() => { if (initialization === pending) initialization = null; });
  return pending;
}
