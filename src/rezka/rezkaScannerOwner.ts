export type RezkaScanResult = { value: string; isCurrent(): boolean };
export type RezkaScannerAction = { open(): Promise<RezkaScanResult | null>; isCurrent(): boolean };

/** Owns one scanner dialog and drops results after focus, account, or dialog generation changes. */
export class RezkaScannerOwner {
  private mounted = false;
  private focused = false;
  private foreground = false;
  private invalidated = false;
  private lifetime = 0;
  private nextTicket = 0;
  private pending: { ticket: number; resolve(value: RezkaScanResult | null): void } | null = null;
  private state: Readonly<{ ticket: number | null; active: boolean; generation: number }> = { ticket: null, active: false, generation: 0 };
  private listeners = new Set<() => void>();
  constructor(private readonly sessionIsCurrent: () => boolean) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish() {
    const ticket = this.pending?.ticket ?? null, active = this.isCurrent();
    if (this.state.ticket === ticket && this.state.active === active && this.state.generation === this.lifetime) return;
    this.state = { ticket, active, generation: this.lifetime };
    this.listeners.forEach(listener => listener());
  }
  isCurrent = () => !this.invalidated && this.mounted && this.focused && this.foreground && this.sessionIsCurrent();
  accepts = (ticket: number, generation?: number) => this.pending?.ticket === ticket &&
    (generation === undefined || generation === this.lifetime) && this.isCurrent();
  mount() { this.mounted = true; this.lifetime++; this.publish(); }
  unmount() { this.mounted = false; this.focused = false; this.foreground = false; this.cancel(); this.publish(); }
  setFocused(value: boolean) { this.focused = value; if (!value) this.cancel(); this.publish(); }
  // V2 keeps the dialog across a permission prompt or app suspension and restarts its camera on resume.
  setForeground(value: boolean) { if (this.foreground !== value) this.lifetime++; this.foreground = value; this.publish(); }
  invalidate() { this.invalidated = true; this.cancel(); this.publish(); }
  recheckSession() { if (!this.sessionIsCurrent()) this.invalidate(); else this.publish(); }
  open = (): Promise<RezkaScanResult | null> => {
    if (!this.isCurrent() || this.pending) return Promise.resolve(null);
    const ticket = ++this.nextTicket;
    const result = new Promise<RezkaScanResult | null>(resolve => { this.pending = { ticket, resolve }; });
    this.publish();
    return result;
  };
  accept(ticket: number, value: string, generation?: number) {
    if (!this.accepts(ticket, generation) || !value.trim()) return;
    const lifetime = this.lifetime;
    this.finish({ value: value.trim(), isCurrent: () => this.nextTicket === ticket && this.lifetime === lifetime && this.isCurrent() });
  }
  cancel(ticket?: number) {
    if (ticket !== undefined && this.pending?.ticket !== ticket) return;
    this.lifetime++; this.finish(null); this.publish();
  }
  private finish(value: RezkaScanResult | null) {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null; this.publish(); pending.resolve(value);
  }
}
