import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

export class AdminItemCreateScopeChanged extends Error { constructor() { super('Admin item create owner changed'); } }
export type AdminItemCreateOperation = Readonly<{ current: () => boolean; guard: () => void; wait: <T>(promise: Promise<T>) => Promise<T>; expire: () => void }>;
/** Screen authority survives focus and dialog dismissal; each request has its own finite original lifetime. */
export class AdminItemCreateScope {
  private active = false; private retired = false; private checking = false; private generation = 0; private readonly operations = new Set<AdminItemCreateOperation>();
  constructor(private readonly authority: () => boolean) {}
  get isActive() { return this.active; }
  get interactionGeneration() { return this.generation; }
  start() { if (this.retired) return false; this.active = true; this.generation++; return this.current(); }
  current(generation = this.generation): boolean {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.retired = true; return false; } this.checking = true;
    const valid = isSynchronouslyTrue(this.authority); this.checking = false; if (!valid) this.retired = true;
    return valid && !this.retired && this.active && generation === this.generation;
  }
  begin(additional: () => boolean = () => true): AdminItemCreateOperation {
    const generation = this.generation, waiters = new Set<(error: Error) => void>(); let pending = true, latched = false, checking = false;
    const current = () => {
      if (!pending || latched || !this.current(generation)) return false;
      if (checking) { latched = true; return false; } checking = true;
      const valid = isSynchronouslyTrue(additional); checking = false; if (!valid) latched = true;
      return valid && !latched && pending && this.current(generation);
    };
    const guard = () => { if (!current()) throw new AdminItemCreateScopeChanged(); };
    const operation: AdminItemCreateOperation = { current, guard, wait: async <T>(promise: Promise<T>): Promise<T> => {
      void promise.catch(() => {}); guard(); let reject!: (error: Error) => void;
      const canceled = new Promise<never>((_resolve, no) => { reject = no; waiters.add(reject); });
      try { const value = await Promise.race([promise, canceled]); guard(); return value; } finally { waiters.delete(reject); }
    }, expire: () => { if (!pending) return; pending = false; this.operations.delete(operation); waiters.forEach(reject => reject(new AdminItemCreateScopeChanged())); waiters.clear(); } };
    this.operations.add(operation); return operation;
  }
  dispose() { this.active = false; this.generation++; [...this.operations].forEach(operation => operation.expire()); }
  invalidate() { this.retired = true; this.dispose(); }
}
