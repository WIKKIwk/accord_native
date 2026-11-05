import type { AccountStorage } from './savedAccountStore';

// Older iOS versions reject large SecureStore values. Keep each value well below
// the documented limit, including when every character needs four UTF-8 bytes.
const chunkSize = 400;
const marker = '!accord-chunks-v1:';
let generation = 0;

type Manifest = { generation: string; count: number };

function manifest(value: string | null): Manifest | null {
  if (!value?.startsWith(marker)) return null;
  try {
    const parsed = JSON.parse(value.slice(marker.length)) as Partial<Manifest>;
    return typeof parsed.generation === 'string' && /^[a-z0-9]+$/.test(parsed.generation) &&
      Number.isSafeInteger(parsed.count) && (parsed.count ?? 0) > 0
      ? parsed as Manifest : null;
  } catch { return null; }
}

function partKey(key: string, info: Manifest, index: number): string {
  return `${key}_part_${info.generation}_${index}`;
}

export function chunkedStorage(storage: AccountStorage): AccountStorage {
  async function removeParts(key: string, info: Manifest): Promise<void> {
    for (let i = 0; i < info.count; i++) await storage.removeItem(partKey(key, info, i));
  }

  return {
    async getItem(key) {
      const value = await storage.getItem(key), info = manifest(value);
      if (!info) return value;
      let result = '';
      for (let i = 0; i < info.count; i++) {
        const part = await storage.getItem(partKey(key, info, i));
        if (part == null) throw new Error('Incomplete secure storage value');
        result += part;
      }
      return result;
    },
    async setItem(key, value) {
      const previous = manifest(await storage.getItem(key));
      const chars = Array.from(value);
      if (chars.length <= chunkSize) {
        await storage.setItem(key, value);
      } else {
        const info: Manifest = { generation: `${Date.now().toString(36)}${(++generation).toString(36)}${Math.random().toString(36).slice(2)}`,
          count: Math.ceil(chars.length / chunkSize) };
        try {
          for (let i = 0; i < info.count; i++) {
            await storage.setItem(partKey(key, info, i), chars.slice(i * chunkSize, (i + 1) * chunkSize).join(''));
          }
          await storage.setItem(key, marker + JSON.stringify(info));
        } catch (error) {
          await removeParts(key, info).catch(() => {});
          throw error;
        }
      }
      if (previous) await removeParts(key, previous).catch(() => {});
    },
    async removeItem(key) {
      const info = manifest(await storage.getItem(key));
      if (info) await removeParts(key, info);
      await storage.removeItem(key);
    },
  };
}
