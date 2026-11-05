import { Directory, File, Paths } from 'expo-file-system';
import type { OrderImageDiskStore } from './orderImageCacheCore';

export class FileOrderImageDiskStore implements OrderImageDiskStore {
  private root: Directory | null = null;
  private sizes = new Map<string, number>();
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly maxBytes = 96 * 1024 * 1024) {}
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => {});
    return result;
  }
  private name(key: string): string {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new TypeError('Invalid image cache key');
    return `${key}.cache`;
  }
  private directory(): Directory {
    if (this.root) return this.root;
    const root = new Directory(Paths.cache, 'order-images-v1');
    root.create({ intermediates: true, idempotent: true });
    const files = root.list().filter((item): item is File => item instanceof File && /^[a-f0-9]{64}\.cache$/.test(item.name))
      .sort((a, b) => (a.modificationTime ?? 0) - (b.modificationTime ?? 0));
    for (const file of files) this.sizes.set(file.name, file.size);
    this.root = root;
    this.trim(root);
    return root;
  }
  private trim(root: Directory): void {
    let size = [...this.sizes.values()].reduce((sum, value) => sum + value, 0);
    while (size > this.maxBytes || this.sizes.size > 512) {
      const name = this.sizes.keys().next().value!;
      size -= this.sizes.get(name)!; this.sizes.delete(name);
      try { new File(root, name).delete(); } catch { /* OS eviction */ }
    }
  }
  read(key: string): Promise<Uint8Array | null> {
    return this.serial(async () => {
      const name = this.name(key), root = this.directory();
      if (!this.sizes.has(name)) return null;
      try {
        const bytes = await new File(root, name).bytes();
        this.sizes.delete(name); this.sizes.set(name, bytes.length);
        return bytes;
      } catch { this.sizes.delete(name); return null; }
    });
  }
  write(key: string, bytes: Uint8Array): Promise<void> {
    return this.serial(async () => {
      if (bytes.length > this.maxBytes) return;
      const name = this.name(key), root = this.directory(), temporary = new File(root, `${name}.tmp`);
      try {
        temporary.create({ overwrite: true });
        await temporary.write(bytes);
        await temporary.move(new File(root, name), { overwrite: true });
        this.sizes.delete(name); this.sizes.set(name, bytes.length); this.trim(root);
      } finally {
        const leftover = new File(root, `${name}.tmp`);
        if (leftover.exists) leftover.delete();
      }
    });
  }
  remove(key: string): Promise<void> {
    return this.serial(async () => {
      const name = this.name(key), root = this.directory(); this.sizes.delete(name);
      try { new File(root, name).delete(); } catch { /* OS eviction */ }
    });
  }
  clear(): Promise<void> {
    return this.serial(async () => {
      const root = this.directory();
      for (const name of this.sizes.keys()) { try { new File(root, name).delete(); } catch { /* OS eviction */ } }
      this.sizes.clear();
    });
  }
}
