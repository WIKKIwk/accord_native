/** @v2 ProductionDataRevision */
export class ProductionDataRevision {
  private scope: string | null = null;
  private epoch = '';
  private serverRevision: number | null = null;
  private readonly listeners = new Set<(revision: number) => void>();
  revision = 0;
  constructor(private readonly currentScope: () => string) {}
  get isCurrentScope(): boolean { return this.scope === this.currentScope(); }
  subscribe(listener: (revision: number) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify(epoch: string, revision: number): void {
    const scope = this.currentScope();
    if (this.scope === scope && this.epoch === epoch && this.serverRevision !== null && revision <= this.serverRevision) return;
    this.scope = scope; this.epoch = epoch; this.serverRevision = revision; this.revision++;
    for (const listener of this.listeners) listener(this.revision);
  }
}
