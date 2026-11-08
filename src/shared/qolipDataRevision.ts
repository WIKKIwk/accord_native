/** @v2 QolipDataRevision */
export class QolipDataRevision {
  private value = 0;
  private readonly listeners = new Set<() => void>();
  get locations(): number { return this.value; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  notifyLocationsChanged(): void { this.value++; for (const listener of this.listeners) listener(); }
}
export const qolipDataRevision = new QolipDataRevision();
