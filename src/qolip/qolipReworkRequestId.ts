import { getRandomBytesAsync } from 'expo-crypto';
import { nativeEpochMicroseconds } from '../../modules/accord-native-clock/src/AccordNativeClockModule';

/** @v2 newQolipReworkRequestId */
export async function newQolipReworkRequestId(): Promise<string> {
  const bytes = await getRandomBytesAsync(16);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 16) throw new Error('qolip_request_id_random_unavailable');
  const randomHex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  // V2 reads the UTC wall clock after drawing all 128 random bits.
  return `qolip-rework-${nativeEpochMicroseconds()}-${randomHex}`;
}
