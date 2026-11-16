import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { dartTrim } from './dartJsonString';
import type { AdminItemDetail } from './adminItemDetailModel';

export type AdminItemDetailReadState = Readonly<{ phase: 'loading' | 'content' | 'error' | 'invalidated'; itemCode: string; detail: AdminItemDetail | null }>;
export type AdminItemDetailReadDependencies = Readonly<{
  isCurrent: () => boolean;
  read: (itemCode: string, guard: () => void, witness: () => boolean) => Promise<AdminItemDetail>;
}>;

/** Original-owner read/retry foundation. Mutation decisions and native presentation are deliberately separate next layers. */
export class AdminItemDetailController {
  private state: AdminItemDetailReadState;
  private active = false; private retired = false; private checking = false; private generation = 0; private serial = 0;
  private readonly listeners = new Set<() => void>();
  constructor(itemCode: string, private readonly deps: AdminItemDetailReadDependencies) {
    this.state = Object.freeze({ phase: 'loading', itemCode: dartTrim(itemCode), detail: null });
  }
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private replace(phase: AdminItemDetailReadState['phase'], detail: AdminItemDetail | null): void {
    this.state = Object.freeze({ phase, itemCode: this.state.itemCode, detail }); for (const listener of [...this.listeners]) listener();
  }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; }
    return this.active && generation === this.generation;
  };
  start(): void { if (this.active || this.retired) return; this.active = true; this.generation++; void this.reload(); }
  async reload(): Promise<void> {
    if (!this.isCurrent()) return;
    const generation = this.generation, serial = ++this.serial, code = this.state.itemCode;
    const guard = () => { if (!this.isCurrent(generation) || serial !== this.serial) throw new Error('Item detail read changed'); };
    this.replace('loading', null);
    try { guard(); const detail = await this.deps.read(code, guard, () => { guard(); return true; }); guard(); this.replace('content', detail); }
    catch { if (this.isCurrent(generation) && serial === this.serial) this.replace('error', null); }
  }
  invalidate(): void {
    if (this.retired) return; this.retired = true; this.active = false; this.generation++; this.serial++; this.replace('invalidated', null);
  }
  /** Reversible effect cleanup; retained subscriptions and owner are valid on StrictMode setup again. */
  dispose(): void {
    this.active = false; this.generation++; this.serial++; this.replace(this.retired ? 'invalidated' : 'loading', null);
  }
}
