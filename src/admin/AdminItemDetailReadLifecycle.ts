/** Original mounted leaf/row membership. Deferred cleanup only releases resources; it never acknowledges native removal. */
export class AdminItemDetailReadLifecycle {
  private readonly members = new Set<object>();
  private interaction: object | null = null;
  constructor(readonly identity: object) {}
  current = () => this.members.size > 0;
  commitInteraction(identity: object): () => void { this.interaction = identity; return () => { if (this.interaction === identity) this.interaction = null; }; }
  ownsInteraction(identity: object) { return this.interaction === identity; }
  attach(start: () => void, dispose: () => void): () => void {
    const member = {}; this.members.add(member); start(); let detached = false;
    return () => { if (detached) return; detached = true; this.members.delete(member); queueMicrotask(() => { if (!this.members.size) dispose(); }); };
  }
}
