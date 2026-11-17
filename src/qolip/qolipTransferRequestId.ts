import { getRandomBytesAsync } from 'expo-crypto';
/** V2 QolipProductTransferActions uses sixteen secure bytes, lowercase hex with no prefix. */
export async function qolipTransferRequestId(): Promise<string> {
  const bytes = await getRandomBytesAsync(16);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 16) throw new Error('qolip_request_id_random_unavailable');
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}
