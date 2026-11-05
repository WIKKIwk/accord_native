import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import type { ProductionSnapshotBackend, ProductionSnapshotStoredEntry } from './productionSnapshotStore';

const snapshotName = /^([a-f0-9]{64})\.(-?\d+)\.(\d+)\.snapshot$/;
const pendingName = /^\.pending-[a-fA-F0-9]+$/;

/** @v2 FileProductionSnapshotBackend */
export class FileProductionSnapshotBackend implements ProductionSnapshotBackend {
  private ready = false;
  constructor(private readonly root = new Directory(Paths.document, 'production-snapshots-v1')) {}
  private directory(): Directory {
    this.root.create({ intermediates: true, idempotent: true });
    if (!this.ready) {
      for (const item of this.root.list()) if (item instanceof File && pendingName.test(item.name)) item.delete();
      this.ready = true;
    }
    return this.root;
  }
  private files(id?: string): { file: File; id: string; savedAtMs: number; sequence: number }[] {
    if (id !== undefined && !/^[a-f0-9]{64}$/.test(id)) throw new TypeError('Invalid production snapshot key');
    const files: { file: File; id: string; savedAtMs: number; sequence: number }[] = [];
    for (const item of this.directory().list()) {
      if (!(item instanceof File)) continue;
      const match = snapshotName.exec(item.name);
      if (!match || (id !== undefined && id !== match[1])) continue;
      const savedAtMs = Number(match[2]), sequence = Number(match[3]);
      if (Number.isSafeInteger(savedAtMs) && Number.isSafeInteger(sequence)) files.push({ file: item, id: match[1], savedAtMs, sequence });
    }
    return files;
  }
  private latest(files: ReturnType<FileProductionSnapshotBackend['files']>) {
    const latest = new Map<string, (typeof files)[number]>();
    for (const entry of files) if (!latest.has(entry.id) || latest.get(entry.id)!.sequence < entry.sequence) latest.set(entry.id, entry);
    for (const entry of files) if (latest.get(entry.id) !== entry) entry.file.delete();
    return [...latest.values()];
  }
  async read(id: string, maxBytes: number): Promise<Uint8Array | null> {
    const latest = this.latest(this.files(id))[0];
    if (!latest) return null;
    try {
      if (latest.file.size > maxBytes) return null;
      const bytes = await latest.file.bytes();
      return bytes.length <= maxBytes ? bytes : null;
    } catch { return null; }
  }
  async write(id: string, bytes: Uint8Array, savedAtMs: number): Promise<void> {
    if (!Number.isSafeInteger(savedAtMs)) throw new TypeError('Invalid snapshot time');
    const previous = this.latest(this.files(id)), root = this.directory();
    const sequence = (previous[0]?.sequence ?? 0) + 1;
    if (!Number.isSafeInteger(sequence)) throw new RangeError('Snapshot sequence is too large');
    const name = `${id}.${savedAtMs}.${sequence}.snapshot`, temporaryName = `.pending-${Crypto.randomUUID().replaceAll('-', '')}`;
    const temporary = new File(root, temporaryName);
    try {
      temporary.create(); await temporary.write(bytes);
      await temporary.move(new File(root, name));
      for (const entry of previous) entry.file.delete();
    } finally {
      const leftover = new File(root, temporaryName);
      if (leftover.exists) leftover.delete();
    }
  }
  async entries(): Promise<ProductionSnapshotStoredEntry[]> {
    const result: ProductionSnapshotStoredEntry[] = [];
    for (const entry of this.latest(this.files())) {
      try { result.push({ id: entry.id, bytes: entry.file.size, savedAtMs: entry.savedAtMs }); }
      catch { /* The OS may remove a file while listing. */ }
    }
    return result;
  }
  async remove(id: string): Promise<void> { for (const entry of this.files(id)) entry.file.delete(); }
  async clear(): Promise<void> {
    for (const item of this.directory().list()) {
      if (item instanceof File && (snapshotName.test(item.name) || pendingName.test(item.name))) item.delete();
    }
  }
}
