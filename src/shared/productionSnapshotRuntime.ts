import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { registerSessionResetHook } from '../auth';
import { FileProductionSnapshotBackend } from './productionSnapshotFileBackend';
import { ProductionSnapshotStore, type ProductionSnapshotBackend } from './productionSnapshotStore';

const unsupported = async (): Promise<never> => { throw new Error('Web snapshot backend is not configured'); };
const webBackend: ProductionSnapshotBackend = { read: unsupported, write: unsupported, entries: unsupported, remove: unsupported, clear: unsupported };

export const productionSnapshotStore = new ProductionSnapshotStore({
  backend: Platform.OS === 'web' ? webBackend : new FileProductionSnapshotBackend(),
  sha256: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
});

registerSessionResetHook(() => productionSnapshotStore.clear());
