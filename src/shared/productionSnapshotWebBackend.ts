import type { ProductionSnapshotBackend, ProductionSnapshotStoredEntry } from './productionSnapshotStore';

type Row = { id: string; savedAtMs: number; value: Blob };

/** @v2 WebProductionSnapshotBackend */
export class WebProductionSnapshotBackend implements ProductionSnapshotBackend {
  private opening: Promise<IDBDatabase> | null = null;
  constructor(private readonly factory: IDBFactory | undefined = globalThis.indexedDB) {}
  private database(): Promise<IDBDatabase> {
    if (this.opening) return this.opening;
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      if (!this.factory) { reject(new Error('IndexedDB is unavailable')); return; }
      const request = this.factory.open('accord_production_snapshots_v4', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('snapshots')) request.result.createObjectStore('snapshots', { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error ?? new Error('Snapshot database could not be opened'));
      request.onsuccess = () => resolve(request.result);
    });
    this.opening = promise;
    void promise.catch(() => { if (this.opening === promise) this.opening = null; });
    return promise;
  }
  private async request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.database();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('snapshots', mode);
      const request = run(transaction.objectStore('snapshots'));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Snapshot transaction was aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Snapshot transaction failed'));
    });
  }
  async read(id: string, maxBytes: number): Promise<Uint8Array | null> {
    const row = await this.request<Row | undefined>('readonly', store => store.get(id));
    if (!row || !(row.value instanceof Blob) || row.value.size > maxBytes) return null;
    const bytes = new Uint8Array(await row.value.arrayBuffer());
    return bytes.length <= maxBytes ? bytes : null;
  }
  async write(id: string, bytes: Uint8Array, savedAtMs: number): Promise<void> {
    const value = new Blob([Uint8Array.from(bytes).buffer]);
    await this.request('readwrite', store => store.put({ id, savedAtMs, value } satisfies Row));
  }
  async entries(): Promise<ProductionSnapshotStoredEntry[]> {
    const rows = await this.request<Row[]>('readonly', store => store.getAll());
    return rows.map(row => ({ id: row.id, savedAtMs: row.savedAtMs, bytes: row.value.size }));
  }
  async remove(id: string): Promise<void> { await this.request('readwrite', store => store.delete(id)); }
  async clear(): Promise<void> { await this.request('readwrite', store => store.clear()); }
}
