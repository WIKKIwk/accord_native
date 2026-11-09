/** @v2 QolipDataRevision */
export class QolipDataRevision {
  private value = 0;
  private readonly listeners = new Set<() => void>();
  get locations(): number { return this.value; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  notifyLocationsChanged(): void {
    this.value++;
    // Flutter ChangeNotifier reports a listener failure and continues with the others.
    for (const listener of [...this.listeners]) {
      if (!this.listeners.has(listener)) continue;
      try { listener(); } catch (error) { console.error('Qolip location revision listener failed', error); }
    }
  }
}
export const qolipDataRevision = new QolipDataRevision();
