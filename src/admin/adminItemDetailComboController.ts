import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminItemDetailCombo } from './adminItemDetailComboApi';
import { adminItemDetailComboKnownName, type AdminItemDetailComboProduct } from './adminItemDetailComboPresentation';
import { dartTrim } from './dartJsonString';

export type AdminItemDetailComboState = Readonly<{ phase: 'loading' | 'content' | 'error' | 'unavailable' | 'invalidated'; entry: AdminItemDetailCombo | null }>;
type ComboDependencies = Readonly<{
  isCurrent: () => boolean; canRead: () => boolean;
  read: (itemCode: string, guard: () => void, witness: () => boolean) => Promise<AdminItemDetailCombo>;
}>;

/** Source catalog future owner; code identity is captured by this instance and a replacement owns a different code. */
export class AdminItemDetailComboController {
  private state: AdminItemDetailComboState = Object.freeze({ phase: 'loading', entry: null });
  private active = false; private retired = false; private checking = false; private generation = 0; private serial = 0;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly itemCode: string, private readonly deps: ComboDependencies) {}
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(phase: AdminItemDetailComboState['phase'], entry: AdminItemDetailCombo | null = null): void {
    this.state = Object.freeze({ phase, entry }); for (const listener of [...this.listeners]) listener();
  }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; } return this.active && generation === this.generation;
  };
  start(): void { if (this.active || this.retired) return; this.active = true; this.generation++; void this.reload(); }
  async reload(): Promise<void> {
    if (!this.isCurrent()) return;
    const generation = this.generation, serial = ++this.serial;
    if (!isSynchronouslyTrue(this.deps.canRead)) { if (this.isCurrent()) this.publish('unavailable'); return; }
    const guard = () => { if (!this.isCurrent(generation) || serial !== this.serial) throw new Error('Item combo read changed'); };
    this.publish('loading');
    try { guard(); const entry = await this.deps.read(this.itemCode, guard, () => { guard(); return true; }); guard(); this.publish('content', entry); }
    catch { if (this.isCurrent(generation) && serial === this.serial) this.publish('error'); }
  }
  invalidate(): void { if (this.retired) return; this.retired = true; this.active = false; this.generation++; this.serial++; this.publish('invalidated'); }
  dispose(): void { this.active = false; this.generation++; this.serial++; this.publish(this.retired ? 'invalidated' : 'loading'); }
}

export type AdminItemDetailComboProductNameState = Readonly<{ phase: 'loading' | 'content' | 'unnamed' | 'invalidated'; name: string | null }>;
/** Each actual source product row owns its own optional GET; duplicate codes are not silently coalesced. */
export class AdminItemDetailComboProductNameController {
  private state: AdminItemDetailComboProductNameState;
  private readonly code: string; private readonly knownName: string | null;
  private active = false; private retired = false; private checking = false; private generation = 0;
  private readonly listeners = new Set<() => void>();
  constructor(product: AdminItemDetailComboProduct, private readonly deps: Readonly<{
    isCurrent: () => boolean; read: (code: string, guard: () => void, witness: () => boolean) => Promise<string | null>;
  }>) {
    this.code = dartTrim(product.item_code); this.knownName = adminItemDetailComboKnownName(product);
    this.state = this.initial();
  }
  private initial(): AdminItemDetailComboProductNameState { return Object.freeze({ phase: this.knownName ? 'content' : this.code ? 'loading' : 'unnamed', name: this.knownName }); }
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(phase: AdminItemDetailComboProductNameState['phase'], name: string | null = null): void { this.state = Object.freeze({ phase, name }); for (const listener of [...this.listeners]) listener(); }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; } return this.active && generation === this.generation;
  };
  start(): void {
    if (this.active || this.retired) return; this.active = true; this.generation++;
    if (!this.isCurrent() || this.knownName || !this.code) return; void this.load();
  }
  private async load(): Promise<void> {
    const generation = this.generation, guard = () => { if (!this.isCurrent(generation)) throw new Error('Item product-name read changed'); };
    this.publish('loading');
    try { guard(); const name = await this.deps.read(this.code, guard, () => { guard(); return true; }); guard(); this.publish(name === null ? 'unnamed' : 'content', name); }
    catch { if (this.isCurrent(generation)) this.publish('unnamed'); }
  }
  invalidate(): void { if (this.retired) return; this.retired = true; this.active = false; this.generation++; this.publish('invalidated'); }
  dispose(): void { this.active = false; this.generation++; this.state = this.retired ? Object.freeze({ phase: 'invalidated', name: null }) : this.initial(); for (const listener of [...this.listeners]) listener(); }
}
