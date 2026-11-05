import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { registerSessionResetHook } from '../auth';
import { FileProductionSnapshotBackend } from './productionSnapshotFileBackend';
import { ProductionSnapshotStore } from './productionSnapshotStore';
import { WebProductionSnapshotBackend } from './productionSnapshotWebBackend';

export const productionSnapshotStore = new ProductionSnapshotStore({
  backend: Platform.OS === 'web' ? new WebProductionSnapshotBackend() : new FileProductionSnapshotBackend(),
  sha256: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
});

registerSessionResetHook(() => productionSnapshotStore.clear());
