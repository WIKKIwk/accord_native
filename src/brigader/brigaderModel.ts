/** Shared page lifetime: blur only blocks new commands; retirement blocks every retained callback. */
export class BrigaderModel<S> {
  protected state: S;
  private readonly listeners = new Set<() => void>();
  private leases = 0; private retired = false;
  constructor(initial: S, private readonly original: () => boolean, private readonly focused: () => boolean) { this.state = initial; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  current = () => !this.retired && this.leases > 0 && this.original();
  interactive = () => this.current() && this.focused() && this.current();
  guard = () => { if (!this.current()) throw new Error('Original Brigader page expired'); };
  protected patch(patch: Partial<S>) { if (!this.current()) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  attach(start: () => void) { this.leases++; start(); return () => { this.leases--; queueMicrotask(() => { if (!this.leases) this.dispose(); }); }; }
  dispose() { this.retired = true; }
}
