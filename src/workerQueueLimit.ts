import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Session } from './auth';

export const QUEUE_LIMITS = [5, 10, 20, 50, 0] as const;
export type QueueLimit = typeof QUEUE_LIMITS[number];
export const DEFAULT_QUEUE_LIMIT: QueueLimit = 10;
const STORAGE_KEY = 'accord_v4_worker_queue_limits';
let saves: Promise<void> = Promise.resolve();

export function isQueueLimit(value: unknown): value is QueueLimit {
  return typeof value === 'number' && (QUEUE_LIMITS as readonly number[]).includes(value);
}

function accountKey(session: Session): string {
  return JSON.stringify([session.baseUrl, String(session.profile.role ?? ''), String(session.profile.ref ?? '')]);
}

async function read(): Promise<Record<string, unknown>> {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(STORAGE_KEY) : await SecureStore.getItemAsync(STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : {};
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { return {}; }
}

export async function loadQueueLimit(session: Session): Promise<QueueLimit> {
  await saves;
  const value = (await read())[accountKey(session)];
  return isQueueLimit(value) ? value : DEFAULT_QUEUE_LIMIT;
}

export function saveQueueLimit(session: Session, limit: QueueLimit): Promise<void> {
  if (!isQueueLimit(limit)) return Promise.reject(new RangeError('Invalid worker queue limit'));
  const save = saves.then(async () => {
    const values = await read();
    values[accountKey(session)] = limit;
    const serialized = JSON.stringify(values);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(STORAGE_KEY, serialized);
    else await SecureStore.setItemAsync(STORAGE_KEY, serialized);
  });
  saves = save.catch(() => {});
  return save;
}
