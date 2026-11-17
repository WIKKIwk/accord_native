export type BrigaderPresentation = { readonly id: number; readonly kind: string; readonly data: unknown; readonly identity: object; readonly closing: boolean };
type Entry = { value: BrigaderPresentation; result: unknown; resolve: (result: unknown) => void };
/** Source await points are settled by the actual native carrier's dismissal callback. */
export class BrigaderPresentations {
  private entries: Entry[] = []; private sequence = 0; private snapshot: readonly BrigaderPresentation[] = [];
  private readonly listeners = new Set<() => void>();
  constructor(private readonly current: () => boolean) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.snapshot = this.entries.map(entry => entry.value); this.listeners.forEach(listener => listener()); }
  request<T>(kind: string, data: unknown): Promise<T | undefined> {
    if (!this.current()) return Promise.resolve(undefined);
    return new Promise<T | undefined>(resolve => { this.entries.push({ value: { id: ++this.sequence, kind, data, identity: {}, closing: false }, result: undefined, resolve: resolve as (result: unknown) => void }); this.publish(); });
  }
  currentEntry = (id: number) => this.current() && this.entries.some(entry => entry.value.id === id);
  close(id: number, result?: unknown) {
    if (!this.currentEntry(id)) return false;
    const entry = this.entries.find(entry => entry.value.id === id)!; if (entry.value.closing) return false;
    entry.result = result; entry.value = { ...entry.value, closing: true }; this.publish(); return true;
  }
  detached(id: number) {
    const entry = this.entries.find(entry => entry.value.id === id); if (!entry?.value.closing) return;
    this.entries = this.entries.filter(value => value !== entry); const result = this.current() ? entry.result : undefined;
    this.publish(); entry.resolve(result);
  }
  dispose() { const entries = this.entries; this.entries = []; this.publish(); entries.forEach(entry => entry.resolve(undefined)); }
}
