import * as Crypto from 'expo-crypto';
import { appPreferences } from '../appPreferences';
import { SwitchPinStore } from './switchPin';

export const switchPinStore = new SwitchPinStore(appPreferences,
  value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value));
