import Constants, { AppOwnership } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { activeSessionToken, type Session } from './auth';

type LockRecord = { version: 1; salt: string; digest: string; biometric: boolean };
const disabledLockRecord = '{"version":1,"disabled":true}';
const biometricOptions = { requireAuthentication: true, authenticationPrompt: 'Ilovani ochish uchun biometrik tasdiqdan o‘ting' };
const validPin = (pin: string) => /^\d{4}$/.test(pin);
let pending: Promise<void> = Promise.resolve();

function inStorageOrder<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.then(() => undefined, () => undefined);
  return result;
}

async function keyFor(session: Session): Promise<string> {
  const role = String(session.profile.role ?? '').trim();
  const ref = String(session.profile.ref ?? '').trim();
  if (!role || !ref) throw new Error('Hisob ma’lumoti topilmadi.');
  const identity = JSON.stringify([session.baseUrl, role, ref]);
  return `accord_v4_pin_${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, identity)}`;
}

async function readRecord(session: Session): Promise<LockRecord | null> {
  const value = await SecureStore.getItemAsync(await keyFor(session));
  if (!value || value === disabledLockRecord) return null;
  const record: unknown = JSON.parse(value);
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Qulf ma’lumotini o‘qib bo‘lmadi.');
  const entry = record as Record<string, unknown>;
  if (entry.version !== 1 || typeof entry.salt !== 'string' || !/^[a-f0-9]{32}$/.test(entry.salt) ||
      typeof entry.digest !== 'string' || !/^[a-f0-9]{64}$/.test(entry.digest) || typeof entry.biometric !== 'boolean') {
    throw new Error('Qulf ma’lumotini o‘qib bo‘lmadi.');
  }
  return entry as LockRecord;
}

function requireSession(session: Session) {
  if (!activeSessionToken(session)) throw new Error('Sessiya tugagan. Qayta kiring.');
}

async function digestPin(salt: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function loadAppLock(session: Session): Promise<{ hasPin: boolean; biometric: boolean }> {
  if (Platform.OS === 'web') return { hasPin: false, biometric: false };
  await pending;
  const record = await readRecord(session);
  return { hasPin: !!record, biometric: !!record?.biometric };
}

export async function saveAppPin(session: Session, pin: string): Promise<void> {
  return inStorageOrder(async () => {
    requireSession(session);
    if (!validPin(pin)) throw new Error('PIN 4 ta raqamdan iborat bo‘lishi kerak.');
    const previous = await readRecord(session);
    const bytes = await Crypto.getRandomBytesAsync(16);
    const salt = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    const record: LockRecord = { version: 1, salt, digest: await digestPin(salt, pin), biometric: !!previous?.biometric };
    const key = await keyFor(session);
    requireSession(session);
    await SecureStore.setItemAsync(key, JSON.stringify(record));
  });
}

export async function verifyAppPin(session: Session, pin: string): Promise<boolean> {
  await pending;
  if (!validPin(pin) || !activeSessionToken(session)) return false;
  const record = await readRecord(session);
  if (!record || !activeSessionToken(session)) return false;
  const digest = await digestPin(record.salt, pin);
  return !!activeSessionToken(session) && digest === record.digest;
}

export async function clearAppLock(session: Session): Promise<void> {
  if (Platform.OS === 'web') return;
  return inStorageOrder(async () => {
    const key = await keyFor(session);
    // Overwrite the PIN before cleanup so a failed native delete cannot restore it.
    await SecureStore.setItemAsync(key, disabledLockRecord);
    if (await SecureStore.getItemAsync(key) !== disabledLockRecord) throw new Error('PIN’ni o‘chirib bo‘lmadi.');
    await SecureStore.deleteItemAsync(`${key}_biometric`).catch(() => {});
  });
}

export function biometricAvailable(): boolean {
  if (Platform.OS === 'web' || (Platform.OS === 'ios' && Constants.appOwnership === AppOwnership.Expo)) return false;
  try { return SecureStore.canUseBiometricAuthentication(); } catch { return false; }
}

export async function setAppBiometric(session: Session, enabled: boolean): Promise<void> {
  return inStorageOrder(async () => {
    requireSession(session);
    const record = await readRecord(session);
    if (!record) throw new Error('Avval PIN o‘rnating.');
    const key = await keyFor(session);
    const bioKey = `${key}_biometric`;
    if (!enabled) {
      requireSession(session);
      await SecureStore.setItemAsync(key, JSON.stringify({ ...record, biometric: false }));
      await SecureStore.deleteItemAsync(bioKey, biometricOptions).catch(() => {});
      return;
    }
    if (!biometricAvailable()) throw new Error('Bu qurilmada biometrik ochish mavjud emas.');
    const challenge = Crypto.randomUUID();
    try {
      await SecureStore.setItemAsync(bioKey, challenge, biometricOptions);
      if (await SecureStore.getItemAsync(bioKey, biometricOptions) !== challenge) throw new Error('Biometrik tasdiq bajarilmadi.');
      requireSession(session);
      await SecureStore.setItemAsync(key, JSON.stringify({ ...record, biometric: true }));
    } catch (error) {
      await SecureStore.deleteItemAsync(bioKey, biometricOptions).catch(() => {});
      throw error;
    }
  });
}

export async function unlockAppWithBiometric(session: Session): Promise<boolean> {
  await pending;
  if (!activeSessionToken(session) || !biometricAvailable()) return false;
  const record = await readRecord(session);
  if (!record?.biometric) return false;
  const value = await SecureStore.getItemAsync(`${await keyFor(session)}_biometric`, biometricOptions);
  return !!value && !!activeSessionToken(session);
}
